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

$id          = $data['id'] ?? 0;
$employeeId  = trim($data['employee_id'] ?? '');
$username    = trim($data['username'] ?? '');
$firstName   = trim($data['first_name'] ?? '');
$role        = $data['role'] ?? '';
$newPassword = $data['new_password'] ?? '';

if (empty($id) || empty($username) || !in_array($role, ['admin', 'user'], true)) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบหรือ role ไม่ถูกต้อง"]);
    exit;
}

try {
    // เช็ค username ซ้ำกับคนอื่น (ไม่รวมตัวเอง)
    $checkStmt = $conn->prepare("SELECT id FROM Users WHERE username = :username AND id != :id");
    $checkStmt->execute([':username' => $username, ':id' => $id]);
    if ($checkStmt->fetch()) {
        echo json_encode(["success" => false, "message" => "Username นี้ถูกใช้แล้ว"]);
        exit;
    }

    if (!empty($newPassword)) {
        // ตั้งรหัสผ่านใหม่ด้วย (แอดมิน reset ให้)
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            "UPDATE Users SET employee_id = :emp, username = :uname, first_name = :fname, role = :role, password = :pw
             WHERE id = :id"
        );
        $stmt->execute([
            ':emp'   => $employeeId,
            ':uname' => $username,
            ':fname' => $firstName,
            ':role'  => $role,
            ':pw'    => $hash,
            ':id'    => $id,
        ]);
    } else {
        // ไม่แตะรหัสผ่านเดิม
        $stmt = $conn->prepare(
            "UPDATE Users SET employee_id = :emp, username = :uname, first_name = :fname, role = :role
             WHERE id = :id"
        );
        $stmt->execute([
            ':emp'   => $employeeId,
            ':uname' => $username,
            ':fname' => $firstName,
            ':role'  => $role,
            ':id'    => $id,
        ]);
    }

    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}