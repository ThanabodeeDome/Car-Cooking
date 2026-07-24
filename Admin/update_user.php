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

// 🌟 ห้ามตั้ง role='admin' ให้ id ที่ไม่อยู่ใน whitelist (auth_check.php ไม่ยอมให้เข้า Admin panel อยู่ดี
// แต่กันไว้ตั้งแต่ต้นทาง ไม่ให้ตั้งค่า role มั่วจน DB ไม่ตรงกับสิทธิ์จริง)
if ($role === 'admin') {
    if (!in_array((int)$id, $allowed_admin_ids, true)) {
        echo json_encode(["success" => false, "message" => "ตั้งเป็น admin ไม่ได้ ต้องเพิ่ม id นี้ใน admin_whitelist.php ก่อน"]);
        exit;
    }
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
    error_log('update_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้"]);
}