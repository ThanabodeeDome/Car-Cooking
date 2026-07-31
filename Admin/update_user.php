<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';

$actingRole = requireAdminAccess(); // 'admin' หรือ 'superioradmin' เท่านั้นถึงจะมาถึงบรรทัดนี้

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$id          = $data['id'] ?? 0;
$employeeId  = trim($data['employee_id'] ?? '');
$username    = trim($data['username'] ?? '');
$firstName   = trim($data['first_name'] ?? '');
$role        = $data['role'] ?? '';
$newPassword = $data['new_password'] ?? '';

// 🌟 ห้ามแก้ role ของตัวเอง ไม่ว่าจะ admin หรือ superioradmin ก็ตาม (กัน privilege escalation ตัวเอง)
if ((int)$id === (int)$_SESSION['user_id']) {
    echo json_encode(["success" => false, "message" => "ไม่สามารถแก้ไข Role ของตัวเองได้"]);
    exit;
}

// 🌟 role ที่ตั้งผ่านหน้านี้ได้มีแค่ user/manager เท่านั้น
// การตั้งเป็น admin หรือ superioradmin ต้องทำผ่าน Database โดยตรงเท่านั้น ห้ามตั้งผ่านแอปเด็ดขาด
$editableRoles = ['user', 'manager'];

if (empty($id) || empty($username) || !in_array($role, $editableRoles, true)) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ หรือ Role นี้ตั้งผ่านหน้านี้ไม่ได้ (admin/superioradmin ต้องเพิ่มจาก Database เท่านั้น)"]);
    exit;
}

// 🌟 กันแก้ role ของคนที่เป็น admin/superioradmin อยู่แล้วให้กลายเป็น user/manager ผ่านหน้านี้เช่นกัน
// (ลด/ถอดสิทธิ์ admin ต้องทำผ่าน Database โดยตรง ให้สอดคล้องกับกฎเดียวกัน)
try {
    $targetStmt = $conn->prepare("SELECT role FROM Users WHERE id = :id");
    $targetStmt->execute([':id' => $id]);
    $targetRow = $targetStmt->fetch(PDO::FETCH_ASSOC);
    if ($targetRow && in_array(strtolower($targetRow['role']), ['admin', 'superioradmin'], true)) {
        echo json_encode(["success" => false, "message" => "ผู้ใช้นี้เป็น admin/superioradmin อยู่แล้ว แก้ไข Role ได้ผ่าน Database เท่านั้น"]);
        exit;
    }
} catch (PDOException $e) {
    error_log('update_user role-check DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง"]);
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
    error_log('update_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลได้"]);
}