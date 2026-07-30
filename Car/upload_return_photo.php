<?php
// upload_return_photo.php
// รับรูปตอนคืนรถ 2 แบบ: type=odometer (รูปเลขไมล์) หรือ type=condition (สภาพรถ)
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบไฟล์รูปภาพ']);
    exit;
}

$type = isset($_POST['type']) ? trim($_POST['type']) : 'condition';
if (!in_array($type, ['odometer', 'condition'], true)) {
    $type = 'condition';
}

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$fileType = mime_content_type($_FILES['photo']['tmp_name']);

if (!in_array($fileType, $allowedTypes, true)) {
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
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}