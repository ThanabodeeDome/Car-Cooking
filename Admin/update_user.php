<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

$allowed_admin_ids = require __DIR__ . '/../admin_whitelist.php';
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin' || !in_array((int)$_SESSION['user_id'], $allowed_admin_ids, true)) {
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

if ($role === 'admin') {
    if (!in_array((int)$id, $allowed_admin_ids, true)) {
        echo json_encode(["success" => false, "message" => "ตั้งเป็น admin ไม่ได้ ต้องเพิ่ม id นี้ใน admin_whitelist.php ก่อน"]);
        exit;
    }
}

try {
    // 🌟 เช็ค role ปัจจุบันของบัญชีเป้าหมายก่อน (ไม่ใช่ role ใหม่ที่ส่งมา) — ถ้าตอนนี้เป็น admin อยู่แล้ว
    // ห้ามเปลี่ยนรหัสผ่านผ่าน endpoint นี้เด็ดขาด ต้องไปแก้ที่ DB โดยตรงเท่านั้น
    // (กันแม้มีคนพยายามยิง API ตรงๆ ข้าม UI ที่ซ่อนช่องนี้ไว้แล้ว)
    $targetStmt = $conn->prepare("SELECT role FROM Users WHERE id = :id");
    $targetStmt->execute([':id' => $id]);
    $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if ($targetUser && strtolower($targetUser['role']) === 'admin' && !empty($newPassword)) {
        echo json_encode(["success" => false, "message" => "บัญชี Admin ต้องเปลี่ยนรหัสผ่านผ่านฐานข้อมูลโดยตรงเท่านั้น ไม่รองรับตั้งผ่านหน้านี้"]);
        exit;
    }

    // เช็ค username ซ้ำกับคนอื่น (ไม่รวมตัวเอง)
    $checkStmt = $conn->prepare("SELECT id FROM Users WHERE username = :username AND id != :id");
    $checkStmt->execute([':username' => $username, ':id' => $id]);
    if ($checkStmt->fetch()) {
        echo json_encode(["success" => false, "message" => "Username นี้ถูกใช้แล้ว"]);
        exit;
    }

    if (!empty($newPassword)) {
        // ตั้งรหัสผ่านใหม่ด้วย (แอดมิน reset ให้ user ทั่วไปเท่านั้น ผ่านเช็คด้านบนมาแล้วว่าไม่ใช่ admin)
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
    error_log('update_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้"]);
}