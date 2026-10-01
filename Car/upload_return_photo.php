<?php
// upload_return_photo.php
// รับรูปตอนคืนรถ 2 แบบ: type=odometer (รูปเลขไมล์) หรือ type=condition (สภาพรถ)
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// 🔒 เหมือน upload_checkin_photo.php: ตรวจรูปจริงจากเนื้อไฟล์ แล้วตั้งนามสกุลเอง ไม่เชื่อชื่อไฟล์จาก client
function detectImageExt($tmpPath) {
    $info = @getimagesize($tmpPath);
    $extByType = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    return ($info && isset($extByType[$info[2]])) ? $extByType[$info[2]] : null;
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

$safeExt = detectImageExt($_FILES['photo']['tmp_name']);

if (!$safeExt) {
    error_log('upload_return_photo: rejected non-image file ' . $_FILES['photo']['name']);
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

$empPart = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_SESSION['employee_id'] ?? '')) ?: 'unknown';
$filename = 'return_' . $type . '_' . $empPart . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $safeExt;
$destPath = $uploadDir . $filename;

if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
    echo json_encode(['success' => true, 'photo_path' => 'uploads/return/' . $filename]);
} else {
    error_log('upload_return_photo: move_uploaded_file failed, dest=' . $destPath . ' writable=' . (is_writable($uploadDir) ? 'yes' : 'NO'));
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}