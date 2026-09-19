<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';
require_once __DIR__ . '/auto_cancel_noshows.php';
autoReleaseNoShows($conn);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

$plate = $_GET['plate'] ?? '';
if (empty($plate)) {
    echo json_encode(["success" => false, "message" => "ไม่พบทะเบียนรถ"]);
    exit;
}

try {
    // 🩹 FIX: เพิ่ม OutTime/PlannedReturnTime (เวลาไป-กลับแบบอิสระ ระบบใหม่)
    // ควบคู่กับ TimeSlot เดิม (ระบบเก่า) — booking เก่ามีแต่ TimeSlot, booking ใหม่มีแต่ OutTime/PlannedReturnTime
    // ฝั่ง JS จะเช็คว่าแถวไหนมีอะไรแล้วแปลงเป็นช่วงเวลาให้ตรงกันก่อนแสดงผล
    $sql = "SELECT BookingID, BookingNumber, DriverName, Destination,
                   CONVERT(varchar, BookingDate, 23) AS BookingDate, 
                   TimeSlot,
                   CONVERT(varchar(8), OutTime, 108) AS OutTime,
                   CONVERT(varchar(8), PlannedReturnTime, 108) AS PlannedReturnTime,
                   BookingStatus
            FROM CarBookings
            WHERE CarPlate = :plate AND BookingStatus IN ('จองแล้ว', 'ขาไป')
            ORDER BY BookingDate ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    error_log('get_car_bookings DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูล"]);
}