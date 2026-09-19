<?php
// upload_checkin_photo.php
// อัปโหลดรูปสภาพรถก่อนออก (ไม่บังคับ) — เก็บไว้เผื่อมีข้อพิพาทตอนคืนรถว่ารอยเดิมมีอยู่ก่อนแล้ว
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');

// 🩹 FIX: mime_content_type() คืน false เงียบๆ ถ้า extension "fileinfo" ปิดอยู่บน server
// (ค่อนข้างพบบ่อยบน shared hosting) พอเป็น false ตัวเช็ค !in_array(false,...) จะเป็นจริงเสมอ
// -> ไฟล์ถูกปฏิเสธ "ทุกไฟล์" แบบเงียบๆ ไม่มี error log ให้เห็นเลยว่าทำไม
// เปลี่ยนมาลอง finfo_open() ก่อน ถ้าใช้ไม่ได้ fallback ไปเช็คจากนามสกุลไฟล์แทน (กันตาย)
function detectMimeType($tmpPath, $originalName) {
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $type = finfo_file($finfo, $tmpPath);
            finfo_close($finfo);
            if ($type) return $type;
        }
    }
    if (function_exists('mime_content_type')) {
        $type = @mime_content_type($tmpPath);
        if ($type) return $type;
    }
    // fallback สุดท้าย: เดาจากนามสกุลไฟล์ (ไม่แม่นเท่า mime จริง แต่ดีกว่าปฏิเสธมั่ว)
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $extMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    return $extMap[$ext] ?? null;
}

// 🩹 FIX: เดิม error ทุกแบบ (ไฟล์ใหญ่เกิน php.ini, เน็ตหลุดกลางอัป, ฯลฯ) โชว์ข้อความเดียวกันหมด
// "ไม่พบไฟล์รูปภาพ" ทำให้เข้าใจผิดว่าไม่มีไฟล์ ทั้งที่จริงมีไฟล์แต่ server ปฏิเสธเพราะสาเหตุอื่น
function uploadErrorMessage($errCode) {
    switch ($errCode) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'ไฟล์รูปใหญ่เกินขีดจำกัดของเซิร์ฟเวอร์ กรุณาลดขนาดรูปหรือถ่ายใหม่ด้วยความละเอียดต่ำลง';
        case UPLOAD_ERR_PARTIAL:
            return 'อัปโหลดไม่สมบูรณ์ (สัญญาณเน็ตหลุดระหว่างอัป) กรุณาลองใหม่';
        case UPLOAD_ERR_NO_FILE:
            return 'ไม่ได้เลือกไฟล์รูปภาพ';
        case UPLOAD_ERR_NO_TMP_DIR:
        case UPLOAD_ERR_CANT_WRITE:
        case UPLOAD_ERR_EXTENSION:
            return 'เซิร์ฟเวอร์บันทึกไฟล์ไม่ได้ กรุณาติดต่อผู้ดูแลระบบ';
        default:
            return 'ไม่พบไฟล์รูปภาพ';
    }
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['photo']['error'] ?? null;
    // 🌟 เคสพิเศษ: ถ้าไฟล์ใหญ่เกิน post_max_size (ไม่ใช่แค่ upload_max_filesize) PHP จะเคลียร์ทั้ง
    // $_POST และ $_FILES ทิ้งเงียบๆ โดยไม่มี error code ให้เช็คเลย ต้องดูจาก Content-Length แทน
    if ($errCode === null && empty($_POST) && ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        error_log('upload_checkin_photo: likely post_max_size exceeded, Content-Length=' . $_SERVER['CONTENT_LENGTH']);
        echo json_encode(['success' => false, 'message' => 'ไฟล์รูปใหญ่เกินขีดจำกัดของเซิร์ฟเวอร์ กรุณาลดขนาดรูปหรือถ่ายใหม่ด้วยความละเอียดต่ำลง']);
        exit;
    }
    error_log('upload_checkin_photo: upload error code = ' . var_export($errCode, true));
    echo json_encode(['success' => false, 'message' => uploadErrorMessage($errCode)]);
    exit;
}

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$fileType = detectMimeType($_FILES['photo']['tmp_name'], $_FILES['photo']['name']);

if (!$fileType || !in_array($fileType, $allowedTypes, true)) {
    error_log('upload_checkin_photo: rejected mime type = ' . var_export($fileType, true) . ' for file ' . $_FILES['photo']['name']);
    echo json_encode(['success' => false, 'message' => 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP เท่านั้น']);
    exit;
}

// จำกัดขนาดไฟล์ 8MB กันอัปโหลดรูปใหญ่เกินไปพังพื้นที่ server
if ($_FILES['photo']['size'] > 8 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'ไฟล์ใหญ่เกินไป (สูงสุด 8MB)']);
    exit;
}

$uploadDir = __DIR__ . '/uploads/checkin/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
$safeExt = preg_replace('/[^a-zA-Z0-9]/', '', $ext); // กันชื่อไฟล์แปลก/path traversal ผ่านนามสกุล
$filename = 'checkin_' . ($_SESSION['employee_id'] ?? 'unknown') . '_' . time() . '.' . $safeExt;
$destPath = $uploadDir . $filename;

if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
    // เก็บ path แบบ relative ไว้ใน DB (ไม่เก็บ absolute path ของเครื่อง server)
    echo json_encode(['success' => true, 'photo_path' => 'uploads/checkin/' . $filename]);
} else {
    error_log('upload_checkin_photo: move_uploaded_file failed, dest=' . $destPath . ' writable=' . (is_writable($uploadDir) ? 'yes' : 'NO'));
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}