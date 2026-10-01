<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || !is_array($data)) {
    echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลที่จะบันทึก"]);
    exit;
}
foreach (['email', 'phone', 'division', 'department', 'unit'] as $k) {
    if (isset($data[$k]) && !is_scalar($data[$k])) $data[$k] = null;
    if (isset($data[$k])) $data[$k] = mb_substr(trim((string)$data[$k]), 0, 255);
}
// 🔒 อีเมลใช้รับ OTP รีเซ็ตรหัสผ่าน ต้องเป็นรูปแบบอีเมลจริงเท่านั้น
if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false, "message" => "รูปแบบอีเมลไม่ถูกต้อง"]);
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
    error_log('update_profile DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}