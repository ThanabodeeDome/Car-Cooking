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
    // 🌟 เพิ่ม Division, department, Unit เข้า UPDATE (เดิมมีแค่ email, phone)
    $sql = "UPDATE Users SET email = :email, phone = :phone, Division = :division, department = :department, Unit = :unit WHERE id = :id";
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':email'      => $data['email'] ?? null,
        ':phone'      => $data['phone'] ?? null,
        ':division'   => $data['division'] ?? null,
        ':department' => $data['department'] ?? null,
        ':unit'       => $data['unit'] ?? null,
        ':id'         => $_SESSION['user_id'],
    ]);
    echo json_encode(["success" => true, "message" => "บันทึกข้อมูลสำเร็จ"]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}