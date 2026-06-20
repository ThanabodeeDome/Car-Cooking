<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

$username     = isset($_POST['username']) ? trim($_POST['username']) : '';
$employee_id  = isset($_POST['employee_id']) ? trim($_POST['employee_id']) : '';
$new_password = isset($_POST['new_password']) ? trim($_POST['new_password']) : '';

if (empty($username) || empty($employee_id) || empty($new_password)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลเพื่อยืนยันตัวตนให้ครบถ้วนครับเพื่อน!']);
    exit;
}

try {
    // 1. ตรวจสอบก่อนว่ามี User ชื่อนี้ และรหัสพนักงานตรงกันจริงไหม
    $check_sql = "SELECT COUNT(*) FROM Users WHERE username = :username AND employee_id = :employee_id";
    $stmt = $conn->prepare($check_sql);
    $stmt->execute([
        ':username'    => $username,
        ':employee_id' => $employee_id
    ]);

    // ถ้าไม่พบข้อมูลที่ตรงกัน (กรอกข้อมูลมั่ว หรือแอบมาแฮกไอดีคนอื่น)
    if ($stmt->fetchColumn() == 0) {
        echo json_encode(['success' => false, 'message' => 'ข้อมูลยืนยันตัวตนไม่ถูกต้อง ชื่อผู้ใช้หรือรหัสพนักงานไม่ตรงกับในระบบครับ']);
        exit;
    }

    // 2. ถ้าข้อมูลถูกต้อง ทำการเข้ารหัสผ่านใหม่ให้ปลอดภัย
    $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

    // 3. ยิงสคริปต์ SQL ไปอัปเดตรหัสผ่านในตาราง Users
    $update_sql = "UPDATE Users SET password = :password WHERE username = :username AND employee_id = :employee_id";
    $update_stmt = $conn->prepare($update_sql);
    $result = $update_stmt->execute([
        ':password'    => $hashed_password,
        ':username'    => $username,
        ':employee_id' => $employee_id
    ]);

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'เปลี่ยนรหัสผ่านใหม่สำเร็จแล้วครับเพื่อน! ลองเข้าสู่ระบบดูได้เลย']);
    } else {
        echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาดในสเต็ปการอัปเดตข้อมูลฐานข้อมูล']);
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง: ' . $e->getMessage()]);
}
?>