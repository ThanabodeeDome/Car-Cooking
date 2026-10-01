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

// ต้องเป็น data URL รูปแบบ data:image/...;base64,xxxx (มาจาก canvas.toDataURL() ฝั่ง JS)
if (!is_string($base64Image) || !$base64Image || strpos($base64Image, 'data:image') !== 0 || strlen($base64Image) > 8 * 1024 * 1024) {
    echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลรูปภาพที่ถูกต้อง"]);
    exit;
}

try {
    $ch = curl_init('https://api.ocr.space/parse/image');
    $curlOpts = [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20, // 🌟 กันค้างนานเกินไปถ้า OCR.space ตอบช้า
        CURLOPT_POSTFIELDS => [
            'apikey' => OCR_SPACE_API_KEY,
            'base64Image' => $base64Image,
            'OCREngine' => '2', // 🌟 Engine 2 แม่นกว่าสำหรับตัวเลข/จอ digital
            'isOverlayRequired' => 'false',
            'scale' => 'true', // 🌟 ให้ OCR.space ขยายรูปเล็กให้เองถ้าจำเป็น ช่วยเรื่องความแม่น
            'detectOrientation' => 'false',
        ],
    ];

    // 🩹 FIX: เซิร์ฟเวอร์นี้ไม่มี CA certificate bundle ที่ใช้งานได้ (เจอ error
    // "unable to get local issuer certificate" ตอนต่อ HTTPS ไปหา OCR.space)
    // แก้โดยชี้ไปที่ cacert.pem ที่แนบมาพร้อมโปรเจกต์แทน ไม่ต้องพึ่งการตั้งค่า php.ini ระดับเซิร์ฟเวอร์
    // เช็คก่อนว่าไฟล์มีจริง กันพังกรณีลืมอัปโหลด cacert.pem ขึ้นไปด้วย (fallback ไปใช้ CA store เดิมของระบบแทน)
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
        echo json_encode(["success" => false, "message" => "เชื่อมต่อ OCR.space ไม่สำเร็จ กรุณากรอกเลขไมล์เอง"]);
        exit;
    }

    $result = json_decode($response, true);

    if (!$result || !empty($result['IsErroredOnProcessing'])) {
        $errMsgRaw = $result['ErrorMessage'] ?? 'อ่านรูปไม่สำเร็จ';
        $errMsg = is_array($errMsgRaw) ? implode(', ', $errMsgRaw) : $errMsgRaw;
        echo json_encode(["success" => false, "message" => $errMsg]);
        exit;
    }

    $parsedText = $result['ParsedResults'][0]['ParsedText'] ?? '';

    // 🌟 ดึงเฉพาะตัวเลขล้วนๆ จากข้อความที่ OCR อ่านได้ทั้งหมด (ตัดคำว่า "ODO", จุด, ช่องว่างทิ้ง)
    preg_match_all('/\d+/', $parsedText, $matches);
    $digitsOnly = implode('', $matches[0] ?? []);

    if (strlen($digitsOnly) < 3) {
        echo json_encode([
            "success" => false,
            "message" => "อ่านตัวเลขจากรูปไม่ได้ชัดเจน",
            "raw_text" => $parsedText,
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "digits" => $digitsOnly,
        "raw_text" => $parsedText,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('ocr_odometer error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์"]);
}