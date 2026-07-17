<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลที่จะบันทึก"]);
    exit;
}

try {
    $sql = "UPDATE Users SET email = :email, phone = :phone WHERE id = :id";
    $stmt = $conn->prepare($sql); // 🌟 แก้ตรงนี้ ใช้ $sql ที่ประกาศไว้ ไม่ใช่ query อื่น
    $stmt->execute([
        ':email' => $data['email'] ?? null,
        ':phone' => $data['phone'] ?? null,
        ':id'    => $_SESSION['user_id'],
    ]);
    echo json_encode(["success" => true, "message" => "บันทึกข้อมูลสำเร็จ"]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}