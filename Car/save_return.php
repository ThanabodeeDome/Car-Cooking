<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🌟 ไฟล์นี้ไม่มี auth check เลยมาก่อน! ใครก็ปิด booking คนอื่น+ยัดเลขไมล์ได้
if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['booking_id'])) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการที่จะคืน"]);
    exit;
}

try {
    // 🌟 ดึง StartMileage + CarPlate มาเช็คก่อน update + เช็คว่า booking นี้เป็นของ employee คนที่ login อยู่จริง
    $check = $conn->prepare("SELECT StartMileage, CarPlate FROM CarBookings WHERE BookingID = :id AND BookingStatus = 'ขาไป' AND EmployeeID = :emp");
    $check->execute([':id' => $data['booking_id'], ':emp' => $sessionEmployeeId]);
    $booking = $check->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(["success" => false, "message" => "รายการนี้ถูกคืนไปแล้ว หรือไม่พบข้อมูล"]);
        exit;
    }

    $endMile = (int)($data['end_mile'] ?? 0);
    if ($endMile <= (int)$booking['StartMileage']) {
        echo json_encode(["success" => false, "message" => "เลขไมล์ตอนคืนต้องมากกว่าเลขไมล์ตอนออก (" . $booking['StartMileage'] . ")"]);
        exit;
    }

    // 1. อัปเดตประวัติการจอง
    $sql = "UPDATE CarBookings 
            SET ReturnDate = :return_date, ReturnTime = :return_time, EndMileage = :end_mileage, 
                ReturnRemark = :return_remark, BookingStatus = 'ขากลับ'
            WHERE BookingID = :id AND BookingStatus = 'ขาไป' AND EmployeeID = :emp";
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':return_date'   => $data['return_date'] ?? null,
        ':return_time'   => $data['return_time'] ?? null,
        ':end_mileage'   => $endMile,
        ':return_remark' => $data['return_remark'] ?? null,
        ':id'            => $data['booking_id'],
        ':emp'           => $sessionEmployeeId,
    ]);

    // 2. 🌟 อัปเดตเลขไมล์ปัจจุบันของรถในตาราง Cars ให้เป็นค่าล่าสุด
    $updateCar = $conn->prepare("UPDATE Cars SET Mileage = :mileage WHERE Plate = :plate");
    $updateCar->execute([
        ':mileage' => $endMile,
        ':plate'   => $booking['CarPlate'],
    ]);

    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('save_return DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกการคืนรถได้"]);
}