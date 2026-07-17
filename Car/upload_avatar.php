<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(["success" => false, "message" => "ไม่พบไฟล์รูปภาพ"]);
    exit;
}

$allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
$ext = strtolower(pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowedExt)) {
    echo json_encode(["success" => false, "message" => "รองรับเฉพาะไฟล์ jpg, png, webp"]);
    exit;
}

if ($_FILES['avatar']['size'] > 2 * 1024 * 1024) { // จำกัด 2MB
    echo json_encode(["success" => false, "message" => "ไฟล์ใหญ่เกินไป (จำกัด 2MB)"]);
    exit;
}

$uploadDir = "assets/img-avatar/";
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true); // 🌟 สร้างโฟลเดอร์อัตโนมัติถ้ายังไม่มี
}

$fileName = "avatar_" . $_SESSION['user_id'] . "_" . time() . "." . $ext;
$uploadPath = $uploadDir . $fileName;

if (!move_uploaded_file($_FILES['avatar']['tmp_name'], $uploadPath)) {
    echo json_encode(["success" => false, "message" => "อัปโหลดไฟล์ไม่สำเร็จ"]);
    exit;
}

try {
    $stmt = $conn->prepare("UPDATE Users SET AvatarPath = :path WHERE id = :id");
    $stmt->execute([
        ':path' => $uploadPath,
        ':id'   => $_SESSION['user_id'],
    ]);
    echo json_encode(["success" => true, "path" => $uploadPath]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}