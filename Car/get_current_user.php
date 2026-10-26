<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false]);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT employee_id, first_name, AvatarPath, role FROM Users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false]);
        exit;
    }

    echo json_encode(["success" => true, "employee_id" => $user['employee_id'], "first_name" => $user['first_name'], "is_admin" => strtolower((string)($user['role'] ?? '')) === 'admin', "avatar_path" => $user['AvatarPath'] ?? null]);
} catch (PDOException $e) {
    error_log('get_current_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}