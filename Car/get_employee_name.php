<?php
// get_employee_name.php
// วางไว้ที่เดียวกับ get_profile.php / db_connect.php (ใน Car/)
// ใช้สำหรับ auto-fill ชื่อจากรหัสพนักงาน ตอนกรอกฟอร์มจอง (ผู้ขับ + ผู้ร่วมทาง)
// 🌟 ตั้งใจให้ return แค่ "ชื่อ" เท่านั้น ไม่ส่ง email/phone/แผนก ออกมาทาง endpoint นี้เด็ดขาด

require_once 'guard_user.php'; // ต้อง login ก่อนถึงจะ query ได้ กันคนนอกดึงชื่อพนักงานไปสุ่มได้
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$employee_id = isset($_GET['employee_id']) ? trim($_GET['employee_id']) : '';

if (empty($employee_id)) {
    echo json_encode(['success' => false, 'message' => 'กรุณาระบุรหัสพนักงาน']);
    exit;
}

try {
    $sql = "SELECT first_name, last_name FROM Users WHERE employee_id = :employee_id";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':employee_id' => $employee_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        echo json_encode([
            'success' => true,
            'name' => $user['first_name'] . ' ' . $user['last_name'],
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรหัสพนักงานนี้']);
    }
} catch (PDOException $e) {
    error_log('Employee lookup error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}