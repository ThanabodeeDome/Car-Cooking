<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false]);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT employee_id, first_name FROM Users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false]);
        exit;
    }

    echo json_encode(["success" => true, "employee_id" => $user['employee_id'], "first_name" => $user['first_name']]);
} catch (PDOException $e) {
    error_log('get_current_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}