<?php
/* สรุป log OCR จากการใช้งานจริง: ระบบอ่านได้เลขอะไร เทียบกับเลขที่ผู้ใช้ยืนยันจริง
   ใช้: php tools/ocr/log_report.php [YYYY-MM]        (ไม่ใส่ = เดือนปัจจุบัน)

   - อ่าน log ที่ Car/ocr_log.php เขียนไว้ (JSONL เดือนละไฟล์ นอก webroot)
   - เลขที่ยืนยันจริงดึงจาก CarBookings.EndMileage ตาม booking_id (ไม่ได้ให้ฝั่งหน้าเว็บส่งมา
     จะได้ไม่ต้องแตะ flow บันทึกคืนรถ และได้ค่าที่เป็นของจริงในระบบแน่ๆ)
   - ใบที่อ่านพลาด จะพิมพ์ข้อความดิบจาก OCR + path รูปให้ เอาไปเพิ่มเป็น fixture แล้ววัดซ้ำได้ */
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

$reads = [];
foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $e = json_decode($line, true);
    if (!$e || ($e['type'] ?? '') !== 'read') continue;
    $reads[] = $e;
}
if (!$reads) { echo "ยังไม่มีรายการอ่านในเดือนนี้\n"; exit(0); }

// ดึงเลขไมล์ที่ยืนยันจริง + path รูป ของ booking ที่ปรากฏใน log
$ids = array_values(array_unique(array_filter(array_column($reads, 'booking_id'))));
$saved = [];
if ($ids) {
    $in = implode(',', array_map('intval', $ids));
    foreach ($conn->query("SELECT BookingID, BookingNumber, CarPlate, EndMileage, BookingStatus, ISNULL(OdometerPhotoPath,'') op FROM CarBookings WHERE BookingID IN ($in)")->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $saved[(int)$r['BookingID']] = $r;
    }
}

$stat = ['อ่านได้' => 0, 'ไม่เดา' => 0, 'ต้องให้ยืนยัน' => 0, 'จับคู่ได้' => 0, 'ตรง' => 0, 'ไม่ตรง' => 0];
$misses = [];
foreach ($reads as $e) {
    $e['digits'] === null ? $stat['ไม่เดา']++ : $stat['อ่านได้']++;
    if (($e['agree'] ?? null) === false) $stat['ต้องให้ยืนยัน']++;

    $row = $saved[$e['booking_id'] ?? -1] ?? null;
    if (!$row || $row['EndMileage'] === null) continue;     // ยังไม่ปิดงาน จับคู่ไม่ได้
    $stat['จับคู่ได้']++;
    if ($e['digits'] !== null && (int)$e['digits'] === (int)$row['EndMileage']) {
        $stat['ตรง']++;
    } else {
        $stat['ไม่ตรง']++;
        $misses[] = [$e, $row];
    }
}

echo "=== OCR log เดือน $month (" . count($reads) . " ครั้ง) ===\n";
foreach ($stat as $k => $v) printf("  %-14s %d\n", $k, $v);
if ($stat['จับคู่ได้'] > 0) {
    printf("\n  อ่านตรงกับที่ผู้ใช้ยืนยัน %d/%d (%.1f%%)\n", $stat['ตรง'], $stat['จับคู่ได้'], $stat['ตรง'] / $stat['จับคู่ได้'] * 100);
}

foreach ($misses as [$e, $row]) {
    echo "\n--- พลาด: {$row['BookingNumber']} ({$row['CarPlate']}) {$e['ts']}\n";
    echo "  ระบบอ่าน: " . ($e['digits'] ?? '(ไม่เดา)') . "  | ผู้ใช้ยืนยัน: {$row['EndMileage']}  | ไมล์ตอนออก: " . ($e['start_mileage'] ?? '-') . "\n";
    if (!empty($e['candidates'])) echo "  ตัวเลือกรอง: " . implode(', ', $e['candidates']) . "\n";
    if (!empty($row['op'])) echo "  รูป: Car/{$row['op']}  <- ก๊อปไป tools/ocr/fixtures/ แล้วเพิ่มใน truth csv ได้เลย\n";
    foreach ($e['engines'] ?? [] as $eng => $t) echo "  [engine $eng] " . str_replace("\n", " | ", trim((string)$t)) . "\n";
}
