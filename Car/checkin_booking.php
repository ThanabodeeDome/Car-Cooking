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
    echo json_encode(["success" => false, "message" => "ไม่พบรายการที่จะเช็คอิน"]);
    exit;
}

try {
    // 🌟 เดิมเช็คแค่ login ไม่เช็คว่าเป็นเจ้าของ booking จริง คนอื่นเช็คอิน booking คนอื่นได้
    $stmt = $conn->prepare("UPDATE CarBookings 
                         SET CheckInTime = GETDATE() 
                         WHERE BookingID = :id AND EmployeeID = :emp AND (BookingStatus = 'ขาไป' OR BookingStatus IS NULL) AND CheckInTime IS NULL");
    $stmt->execute([':id' => $data['booking_id'], ':emp' => $sessionEmployeeId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["success" => false, "message" => "ไม่สามารถเช็คอินได้ (อาจเช็คอินไปแล้ว หรือถูกยกเลิก)"]);
        exit;
    }
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('checkin_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถเช็คอินได้"]);
}