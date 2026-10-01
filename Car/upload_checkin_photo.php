<?php
// upload_checkin_photo.php
// อัปโหลดรูปสภาพรถก่อนออก (ไม่บังคับ) — เก็บไว้เผื่อมีข้อพิพาทตอนคืนรถว่ารอยเดิมมีอยู่ก่อนแล้ว
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// 🔒 ตรวจว่าเป็นรูปจริงจากเนื้อไฟล์ด้วย getimagesize() (อยู่ใน PHP core ไม่ต้องพึ่ง extension fileinfo)
// แล้วตั้งนามสกุลจากชนิดรูปที่ตรวจได้เอง — ห้ามใช้นามสกุลจากชื่อไฟล์ที่ client ส่งมาเด็ดขาด
// (เดิมรูปจริง + ชื่อ x.php จะถูกเซฟเป็น .php แล้ว IIS รันได้ = ยึดเซิร์ฟเวอร์ได้)
function detectImageExt($tmpPath) {
    $info = @getimagesize($tmpPath);
    $extByType = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    return ($info && isset($extByType[$info[2]])) ? $extByType[$info[2]] : null;
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

$safeExt = detectImageExt($_FILES['photo']['tmp_name']);

if (!$safeExt) {
    error_log('upload_checkin_photo: rejected non-image file ' . $_FILES['photo']['name']);
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

$empPart = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($_SESSION['employee_id'] ?? '')) ?: 'unknown';
$filename = 'checkin_' . $empPart . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $safeExt;
$destPath = $uploadDir . $filename;

if (move_uploaded_file($_FILES['photo']['tmp_name'], $destPath)) {
    // เก็บ path แบบ relative ไว้ใน DB (ไม่เก็บ absolute path ของเครื่อง server)
    echo json_encode(['success' => true, 'photo_path' => 'uploads/checkin/' . $filename]);
} else {
    error_log('upload_checkin_photo: move_uploaded_file failed, dest=' . $destPath . ' writable=' . (is_writable($uploadDir) ? 'yes' : 'NO'));
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}