<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['booking_id'])) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการที่จะยกเลิก"]);
    exit;
}

try {
    $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = 'ยกเลิก' 
                         WHERE BookingID = :id AND (BookingStatus = 'ขาไป' OR BookingStatus IS NULL)");
    $stmt->execute([':id' => $data['booking_id']]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["success" => false, "message" => "ไม่สามารถยกเลิกได้ (อาจถูกคืนหรือยกเลิกไปแล้ว)"]);
        exit;
    }
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}