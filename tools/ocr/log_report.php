<?php
/* สรุป log OCR จากการใช้งานจริง: ระบบอ่านได้เลขอะไร เทียบกับเลขที่ผู้ใช้กดบันทึกจริง
   ใช้: php tools/ocr/log_report.php [YYYY-MM]        (ไม่ใส่ = เดือนปัจจุบัน)

   อ่าน log ที่ Car/ocr_log.php เขียนไว้ (JSONL เดือนละไฟล์ นอก webroot) ซึ่งมี 2 ชนิด
     type=read  -> ทุกครั้งที่สแกนรูปเลขไมล์ (ocr_odometer.php)
     type=save  -> ตอนกดบันทึกคืนรถสำเร็จ พร้อมเลขที่บันทึกจริง (save_return.php)

   ⚠️ บทเรียนจากรอบแรก: เดิมวัดโดยเทียบกับ CarBookings.EndMileage ตรงๆ ซึ่งเป็น "ค่าสุดท้าย"
   ของการจองนั้น ไม่ใช่ค่า ณ เวลาที่สแกน เคสจริงที่เจอคือคนขับสแกนดูตอน 17:05 (OCR อ่าน
   333684 ซึ่งตรงกับรูปเป๊ะ) แล้วขับต่อ ไปกดคืนจริงเช้าวันรุ่งขึ้นที่ 333711 รายงานเลยบอกว่า
   "อ่านพลาด" ทั้งที่อ่านถูก จึงเปลี่ยนมาจับคู่กับ type=save ที่เกิดใกล้กันแทน
   ส่วนการเทียบกับ EndMileage ยังพิมพ์ให้ดูได้ แต่แยกหัวข้อและกำกับไว้ว่าเป็นค่าหยาบ */

const PAIR_WINDOW_SECONDS = 1800; // การสแกนกับการกดบันทึก ต้องห่างกันไม่เกิน 30 นาที ถึงจะถือว่าเป็นคู่กัน

$ROOT = str_replace('\\', '/', dirname(__DIR__, 2));
require_once "$ROOT/Car/ocr_log.php";
require_once "$ROOT/Car/db_connect.php";

$month = $argv[1] ?? date('Y-m');
$dir = ocr_log_dir();
$file = $dir ? $dir . DIRECTORY_SEPARATOR . "ocr-$month.jsonl" : null;
if (!$file || !is_file($file)) {
    fwrite(STDERR, "ไม่พบไฟล์ log ของเดือน $month" . ($dir ? " ใน $dir" : '') . "\n");
    exit(1);
}

$reads = $saves = [];
foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $e = json_decode($line, true);
    if (!$e) continue;
    $type = $e['type'] ?? '';
    if ($type === 'read') $reads[] = $e;
    elseif ($type === 'save') $saves[] = $e;
}
if (!$reads) { echo "ยังไม่มีรายการอ่านในเดือนนี้\n"; exit(0); }

// ข้อมูลการจอง เอาไว้โชว์ทะเบียน/เลขที่ใบจอง + ใช้เทียบแบบหยาบ
$ids = array_values(array_unique(array_filter(array_column($reads, 'booking_id'))));
$booking = [];
if ($ids) {
    $in = implode(',', array_map('intval', $ids));
    $sql = "SELECT BookingID, BookingNumber, CarPlate, StartMileage, EndMileage, BookingStatus,
                   ISNULL(OdometerPhotoPath,'') op
            FROM CarBookings WHERE BookingID IN ($in)";
    foreach ($conn->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) $booking[(int)$r['BookingID']] = $r;
}

// หาการกดบันทึกที่ใกล้ที่สุดของ booking เดียวกัน (ต้องเกิดหลังการสแกน และอยู่ในกรอบเวลา)
function pairedSave(array $read, array $saves): ?array {
    $best = null; $bestGap = PHP_INT_MAX;
    $t = strtotime($read['ts'] ?? '');
    if (!$t) return null;
    foreach ($saves as $s) {
        if ((int)($s['booking_id'] ?? 0) !== (int)($read['booking_id'] ?? -1)) continue;
        $gap = strtotime($s['ts'] ?? '') - $t;
        if ($gap < 0 || $gap > PAIR_WINDOW_SECONDS) continue;
        if ($gap < $bestGap) { $bestGap = $gap; $best = $s; }
    }
    return $best;
}

$stat = ['อ่านได้' => 0, 'ไม่เดา' => 0, 'ต้องให้ยืนยัน' => 0];
$exact = ['ตรง' => 0, 'ไม่ตรง' => 0];   // วัดแบบแม่น (จับคู่กับตอนกดบันทึก)
$rough = ['ตรง' => 0, 'ไม่ตรง' => 0];   // วัดแบบหยาบ (เทียบ EndMileage สุดท้าย)
$missExact = $missRough = [];

foreach ($reads as $e) {
    $e['digits'] === null ? $stat['ไม่เดา']++ : $stat['อ่านได้']++;
    if (($e['agree'] ?? null) === false) $stat['ต้องให้ยืนยัน']++;

    $row = $booking[$e['booking_id'] ?? -1] ?? null;
    $save = pairedSave($e, $saves);

    if ($save !== null) {
        $ok = $e['digits'] !== null && (int)$e['digits'] === (int)$save['saved_mile'];
        $ok ? $exact['ตรง']++ : $exact['ไม่ตรง']++;
        if (!$ok) $missExact[] = [$e, $row, (int)$save['saved_mile'], $save['ts']];
        continue; // มีค่าที่เชื่อถือได้แล้ว ไม่ต้องเอาไปนับแบบหยาบซ้ำ
    }

    if (!$row || $row['EndMileage'] === null) continue; // ยังไม่ปิดงาน เทียบไม่ได้
    $ok = $e['digits'] !== null && (int)$e['digits'] === (int)$row['EndMileage'];
    $ok ? $rough['ตรง']++ : $rough['ไม่ตรง']++;
    if (!$ok) $missRough[] = [$e, $row];
}

printf("=== OCR log เดือน %s — สแกน %d ครั้ง / กดบันทึกคืนรถ %d ครั้ง ===\n", $month, count($reads), count($saves));
foreach ($stat as $k => $v) printf("  %-14s %d\n", $k, $v);

$exactTotal = $exact['ตรง'] + $exact['ไม่ตรง'];
echo "\n--- วัดแบบแม่น: เทียบกับเลขที่กดบันทึกจริง (ห่างกันไม่เกิน " . (PAIR_WINDOW_SECONDS / 60) . " นาที) ---\n";
if ($exactTotal === 0) {
    echo "  ยังไม่มีคู่ให้วัด (log แบบ type=save เพิ่งเริ่มเก็บ — รอบที่ผ่านมามีแต่ type=read)\n";
} else {
    printf("  อ่านตรง %d/%d (%.1f%%)\n", $exact['ตรง'], $exactTotal, $exact['ตรง'] / $exactTotal * 100);
}

$roughTotal = $rough['ตรง'] + $rough['ไม่ตรง'];
if ($roughTotal > 0) {
    echo "\n--- วัดแบบหยาบ: เทียบกับ EndMileage สุดท้ายของใบจอง (อาจคนละเวลากับตอนสแกน) ---\n";
    printf("  อ่านตรง %d/%d (%.1f%%)  ⚠️ ตัวเลขนี้เชื่อไม่ได้เต็มร้อย ใช้ดูคร่าวๆ เท่านั้น\n", $rough['ตรง'], $roughTotal, $rough['ตรง'] / $roughTotal * 100);
}

function dumpMiss(array $e, ?array $row, string $truthLabel, $truth, string $extra = ''): void {
    $head = $row ? "{$row['BookingNumber']} ({$row['CarPlate']})" : "booking " . ($e['booking_id'] ?? '-');
    echo "\n--- พลาด: $head {$e['ts']}\n";
    echo "  ระบบอ่าน: " . ($e['digits'] ?? '(ไม่เดา)') . "  | $truthLabel: $truth  | ไมล์ตอนออก(ตอนสแกน): " . ($e['start_mileage'] ?? '-') . "\n";
    if ($extra !== '') echo "  $extra\n";
    if (!empty($e['candidates'])) echo "  ตัวเลือกรอง: " . implode(', ', $e['candidates']) . "\n";
    if ($row && !empty($row['op'])) echo "  รูป: Car/{$row['op']}  <- ก๊อปไป tools/ocr/fixtures/ แล้วเพิ่มใน truth csv ได้เลย\n";
    foreach ($e['engines'] ?? [] as $eng => $t) echo "  [engine $eng] " . str_replace("\n", " | ", trim((string)$t)) . "\n";
}

foreach ($missExact as [$e, $row, $savedMile, $saveTs]) {
    dumpMiss($e, $row, 'กดบันทึกจริง', $savedMile, "เวลาที่กดบันทึก: $saveTs");
}
foreach ($missRough as [$e, $row]) {
    // เตือนเมื่อไมล์ตอนออกใน log ไม่ตรงกับในฐานข้อมูลตอนนี้ = ข้อมูลใบจองถูกแก้หลังสแกน เทียบไม่ได้จริง
    $warn = '';
    if (isset($e['start_mileage']) && (int)$e['start_mileage'] !== (int)$row['StartMileage']) {
        $warn = "⚠️ ไมล์ตอนออกในใบจองตอนนี้คือ {$row['StartMileage']} (ตอนสแกนคือ {$e['start_mileage']}) = ข้อมูลถูกแก้ทีหลัง เทียบกันไม่ได้";
    }
    dumpMiss($e, $row, 'EndMileage สุดท้าย', $row['EndMileage'], $warn);
}
