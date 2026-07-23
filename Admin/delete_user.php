<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = $data['id'] ?? 0;

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "ไม่พบ user"]);
    exit;
}

if ((int)$id === (int)$_SESSION['user_id']) {
    echo json_encode(["success" => false, "message" => "ลบบัญชีตัวเองไม่ได้"]);
    exit;
}

try {
    $stmt = $conn->prepare("DELETE FROM Users WHERE id = :id");
    $stmt->execute([':id' => $id]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}