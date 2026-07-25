<?php
// upload_checkin_photo.php
// อัปโหลดรูปสภาพรถก่อนออก (ไม่บังคับ) — เก็บไว้เผื่อมีข้อพิพาทตอนคืนรถว่ารอยเดิมมีอยู่ก่อนแล้ว
require_once 'guard_user.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบไฟล์รูปภาพ']);
    exit;
}

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$fileType = mime_content_type($_FILES['photo']['tmp_name']);

if (!in_array($fileType, $allowedTypes, true)) {
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
    echo json_encode(['success' => false, 'message' => 'อัปโหลดไม่สำเร็จ']);
}