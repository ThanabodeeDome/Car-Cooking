<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

// 🩹 ต้อง login ก่อนถึงจะยิง OCR ได้ (กันคนนอกยิง endpoint ตรงๆ ใช้โควตาฟรีของเราจนหมด)
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// 🌟 API key เก็บแยกไฟล์ ocr_config.php (ดู ocr_config.example.php เป็นแม่แบบ)
// ไม่ฝัง key ตรงๆ ในไฟล์นี้ กันหลุดถ้ามีคน commit ไฟล์นี้ขึ้น git โดยไม่ระวัง
if (!file_exists(__DIR__ . '/ocr_config.php')) {
    echo json_encode(["success" => false, "message" => "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OCR API key (ไม่พบ ocr_config.php)"]);
    exit;
}
require_once __DIR__ . '/ocr_config.php';

if (!defined('OCR_SPACE_API_KEY') || OCR_SPACE_API_KEY === '' || strpos(OCR_SPACE_API_KEY, 'ใส่_API_KEY') !== false) {
    echo json_encode(["success" => false, "message" => "ยังไม่ได้ใส่ OCR API key จริงใน ocr_config.php"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$base64Image = $data['image'] ?? '';
// เลขไมล์ตอนออกของรายการนี้ (ถ้าส่งมา) ใช้เลือกตัวเลขที่ "เป็นไปได้" เมื่อในรูปมีตัวเลขหลายชุด
$startMileage = isset($data['start_mileage']) && is_numeric($data['start_mileage']) ? (int)$data['start_mileage'] : null;

// ต้องเป็น data URL รูปแบบ data:image/...;base64,xxxx (มาจาก canvas.toDataURL() ฝั่ง JS)
if (!is_string($base64Image) || !$base64Image || strpos($base64Image, 'data:image') !== 0 || strlen($base64Image) > 8 * 1024 * 1024) {
    echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลรูปภาพที่ถูกต้อง"]);
    exit;
}

// 🩹 รูป PNG พื้นโปร่งใส (เช่นแคปจากบางโปรแกรม) OCR อ่านไม่ออกเลย -> ปูพื้นขาวแล้วแปลงเป็น JPEG ก่อนส่ง
function flattenTransparent(string $dataUrl): string {
    if (!function_exists('imagecreatefromstring') || strpos($dataUrl, 'data:image/png') !== 0) return $dataUrl;
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    $src = $bin !== false ? @imagecreatefromstring($bin) : false;
    if (!$src) return $dataUrl;
    $w = imagesx($src);
    $h = imagesy($src);
    $dst = imagecreatetruecolor($w, $h);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
    ob_start();
    imagejpeg($dst, null, 90);
    return 'data:image/jpeg;base64,' . base64_encode(ob_get_clean());
}

// เรียก OCR.space หนึ่งครั้งด้วย engine ที่กำหนด — คืน [ข้อความ|null, ข้อความ error|null]
function ocrSpace(string $image, string $engine): array {
    $ch = curl_init('https://api.ocr.space/parse/image');
    $curlOpts = [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25, // 🌟 กันค้างนานเกินไปถ้า OCR.space ตอบช้า
        CURLOPT_POSTFIELDS => [
            'apikey' => OCR_SPACE_API_KEY,
            'base64Image' => $image,
            'OCREngine' => $engine, // 2 = แม่นกับตัวเลข/จอ digital, 1 = ใช้สำรองเมื่อ 2 อ่านไม่ได้
            'isOverlayRequired' => 'false',
            'scale' => 'true', // 🌟 ให้ OCR.space ขยายรูปเล็กให้เองถ้าจำเป็น ช่วยเรื่องความแม่น
            'detectOrientation' => 'false',
        ],
    ];
    // 🩹 FIX: เซิร์ฟเวอร์นี้ไม่มี CA certificate bundle ที่ใช้งานได้ (เจอ error
    // "unable to get local issuer certificate" ตอนต่อ HTTPS ไปหา OCR.space) ใช้ cacert.pem ที่แนบมาแทน
    $caBundlePath = __DIR__ . '/cacert.pem';
    if (file_exists($caBundlePath)) {
        $curlOpts[CURLOPT_CAINFO] = $caBundlePath;
    }
    curl_setopt_array($ch, $curlOpts);
    $response = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        error_log('ocr_odometer curl error: ' . $curlErr);
        return [null, 'เชื่อมต่อ OCR.space ไม่สำเร็จ'];
    }
    $result = json_decode($response, true);
    if (!$result || !empty($result['IsErroredOnProcessing'])) {
        $errMsgRaw = $result['ErrorMessage'] ?? 'อ่านรูปไม่สำเร็จ';
        return [null, is_array($errMsgRaw) ? implode(', ', $errMsgRaw) : (string)$errMsgRaw];
    }
    return [(string)($result['ParsedResults'][0]['ParsedText'] ?? ''), null];
}

// 🩹 FIX หลัก: เดิมเอาตัวเลข "ทุกชุด" ในรูปมาต่อกัน (เช่น ไมล์ 185318 + trip 123.4 = 1853181234,
// หรือมีนาฬิกา 10:45 ติดมาด้วย = 1045185318) -> ตอนนี้แยกเป็นตัวเลือกทีละชุด ตัดของที่ไม่ใช่เลขไมล์ทิ้ง
// แล้วเลือกชุดที่ใช่ที่สุด — คืน list เรียงจากน่าจะใช่มากสุด: [['value' => '185318', 'score' => ...], ...]
function odometerCandidates(string $text, ?int $start): array {
    $cands = [];
    foreach (preg_split('/\R/u', $text) as $line) {
        $isOdoLine = (bool)preg_match('/\b(ODO|ODOMETER|TOTAL)\b|ไมล์|ระยะทางรวม/iu', $line);
        $isTripLine = (bool)preg_match('/\b(TRIP|AVG|RANGE|FUEL)\b|km\/h|km\/l|l\/100/iu', $line);
        // ตัวเลขที่ OCR แยกเป็นหลักๆ "1 8 5 3 1 8" (จอ LCD ช่องห่าง) -> รวมกลับเป็นชุดเดียว
        $line = preg_replace_callback('/(?<![\d.,:])\d(?:[ \t]\d){3,}(?![\d.,:])/u', fn($m) => preg_replace('/\s+/', '', $m[0]), $line);
        // ชุดตัวเลข: แบบมีตัวคั่นหลักพัน (185,318 / 185 318) ก่อน ไม่งั้นตัวเลขต่อเนื่อง (+ ทศนิยม/เวลา ไว้คัดทิ้ง)
        preg_match_all('/\d{1,3}(?:[.,\' ]\d{3})+(?![\d.,:])|\d+(?:[.,:]\d+)*/u', $line, $mm, PREG_OFFSET_CAPTURE);
        foreach ($mm[0] as [$tok, $pos]) {
            $after = substr($line, $pos + strlen($tok), 4);
            $before = $pos > 0 ? substr($line, $pos - 1, 1) : '';
            $tok = trim($tok);
            if (strpos($tok, ':') !== false) continue;                       // เวลา 10:45
            if ($before === '/' || $before === '-' || preg_match('/^[\/\-]\d/', $after)) continue; // วันที่ 16/06/2026 (แคปจอคอมติดนาฬิกา taskbar มา)
            if (preg_match('/^\s*(°|%|℃)/u', $after)) continue;                // อุณหภูมิ / เปอร์เซ็นต์
            if (preg_match('/^\d{1,3}(?:[.,\' ]\d{3})+$/', $tok)) {           // ตัวคั่นหลักพัน 185,318 / 185 318 / 185.318
                $num = preg_replace('/\D/', '', $tok);
            } elseif (preg_match('/^\d+$/', $tok)) {
                $num = $tok;
            } else {
                continue;                                                   // ทศนิยม 123.4 = trip/อัตราสิ้นเปลือง ไม่ใช่เลขไมล์
            }
            if (strlen($num) < 3 || strlen($num) > 7) continue;              // เลขไมล์รถยนต์ 3-7 หลัก
            $v = (int)$num;
            $score = strlen($num) * 10 + ($isOdoLine ? 100 : 0) - ($isTripLine ? 100 : 0);
            if ($start !== null) {
                if ($v > $start && $v <= $start + 1500) $score += 1000 - min(999, intdiv($v - $start, 2)); // อยู่ในช่วงที่เป็นไปได้ ยิ่งใกล้ยิ่งดี
                elseif ($v === $start) $score += 300;                        // เลขเท่าตอนออก (ยังไม่ได้ขับ/รูปเก่า)
            }
            $cands[$num] = max($cands[$num] ?? PHP_INT_MIN, $score);
        }
    }
    arsort($cands);
    return array_map(fn($v, $s) => ['value' => (string)$v, 'score' => $s], array_keys($cands), array_values($cands));
}

try {
    $image = flattenTransparent($base64Image);
    $rawTexts = [];
    $cands = [];
    $lastErr = null;
    // Engine 2 ก่อน (แม่นกับตัวเลข) ถ้าไม่ได้ตัวเลขเลยค่อยลอง Engine 1 อีกรอบ
    foreach (['2', '1'] as $engine) {
        [$text, $err] = ocrSpace($image, $engine);
        if ($text === null) {
            $lastErr = $err;
            continue;
        }
        $rawTexts[] = $text;
        $cands = odometerCandidates($text, $startMileage);
        if ($cands) break;
    }
    $parsedText = implode("\n---\n", $rawTexts);

    if (!$cands) {
        echo json_encode([
            "success" => false,
            "message" => $rawTexts ? "อ่านตัวเลขจากรูปไม่ได้ชัดเจน" : ($lastErr ?: "อ่านรูปไม่สำเร็จ"),
            "raw_text" => $parsedText,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $best = $cands[0]['value'];
    echo json_encode([
        "success" => true,
        "digits" => $best,
        // ตัวเลขชุดอื่นที่เจอในรูป ให้หน้าเว็บโชว์เป็นตัวเลือกเผื่อระบบเลือกผิด
        "candidates" => array_values(array_slice(array_column($cands, 'value'), 1, 4)),
        // false = เลขที่อ่านได้ไม่อยู่ในช่วง (ไมล์ตอนออก, +1,500 กม.] ควรเตือนให้ตรวจ
        "in_range" => $startMileage === null ? null : ((int)$best > $startMileage && (int)$best <= $startMileage + 1500),
        "raw_text" => $parsedText,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('ocr_odometer error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์"]);
}
