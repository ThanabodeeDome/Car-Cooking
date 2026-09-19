<?php
// upload_return_photo.php
// รับรูปตอนคืนรถ 2 แบบ: type=odometer (รูปเลขไมล์) หรือ type=condition (สภาพรถ)
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');

// 🩹 FIX เดียวกับ upload_checkin_photo.php: mime_content_type() คืน false เงียบๆ
// ถ้า extension "fileinfo" ปิดอยู่บน server -> ไฟล์โดนปฏิเสธหมดแบบไม่มี log ให้เห็นสาเหตุ
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
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $extMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    return $extMap[$ext] ?? null;
}

// 🩹 FIX เดียวกัน: error ทุกแบบเดิมโชว์ "ไม่พบไฟล์รูปภาพ" หมด ทั้งที่บางครั้งคือไฟล์ใหญ่เกิน php.ini
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
    if ($errCode === null && empty($_POST) && ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        error_log('upload_return_photo: likely post_max_size exceeded, Content-Length=' . $_SERVER['CONTENT_LENGTH']);
        echo json_encode(['success' => false, 'message' => 'ไฟล์รูปใหญ่เกินขีดจำกัดของเซิร์ฟเวอร์ กรุณาลดขนาดรูปหรือถ่ายใหม่ด้วยความละเอียดต่ำลง']);
        exit;
    }
    error_log('upload_return_photo: upload error code = ' . var_export($errCode, true));
    echo json_encode(['success' => false, 'message' => uploadErrorMessage($errCode)]);
    exit;
}

$type = isset($_POST['type']) ? trim($_POST['type']) : 'condition';
if (!in_array($type, ['odometer', 'condition'], true)) {
    $type = 'condition';
}

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$fileType = detectMimeType($_FILES['photo']['tmp_name'], $_FILES['photo']['name']);

if (!$fileType || !in_array($fileType, $allowedTypes, true)) {
    error_log('upload_return_photo: rejected mime type = ' . var_export($fileType, true) . ' for file ' . $_FILES['photo']['name']);
    echo json_encode(['success' => false, 'message' => 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP เท่านั้น']);
    exit;
}

if ($_FILES['photo']['size'] > 8 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'ไฟล์ใหญ่เกินไป (สูงสุด 8MB)']);
    exit;
}

$uploadDir = __DIR__ . '/uploads/return/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
$safeExt = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
$filename = 'return_' . $type . '_' . ($_SESSION['employee_id'] ?? 'unknown') . '_' . time() . '.' . $safeExt;
$destPath = $uploadDir . $filename;

if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
    echo json_encode(['success' => true, 'photo_path' => 'uploads/return/' . $filename]);
} else {
    error_log('upload_return_photo: move_uploaded_file failed, dest=' . $destPath . ' writable=' . (is_writable($uploadDir) ? 'yes' : 'NO'));
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}