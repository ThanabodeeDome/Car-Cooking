<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['booking_id'])) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการที่จะยกเลิก"]);
    exit;
}

try {
    // 🩹 เพิ่ม 'จองแล้ว' เข้าเงื่อนไข — booking ใหม่ตอนนี้เริ่มที่สถานะนี้ (ยังไม่เช็คอิน)
    // เดิมเช็คแค่ 'ขาไป' อย่างเดียว ทำให้จองแล้วเปลี่ยนใจไม่มารับรถ ยกเลิกไม่ได้เลย
    $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = 'ยกเลิก' 
                         WHERE BookingID = :id AND EmployeeID = :emp 
                           AND (BookingStatus = 'จองแล้ว' OR BookingStatus = 'ขาไป' OR BookingStatus IS NULL)");
    $stmt->execute([':id' => $data['booking_id'], ':emp' => $sessionEmployeeId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["success" => false, "message" => "ไม่สามารถยกเลิกได้ (อาจถูกเช็คอิน คืนรถ หรือยกเลิกไปแล้ว)"]);
        exit;
    }
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('cancel_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถยกเลิกได้"]);
}