<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🌟 ไฟล์นี้ไม่มี login check เลยมาก่อน!
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
    // เดิม filter ออกแค่ 'ยกเลิก' อย่างเดียว ทำให้ booking ที่คืนแล้ว (BookingStatus = 'ขากลับ')
    // ยังถูกนับว่า "ไม่ว่าง" ต่อไปเรื่อยๆ ทั้งที่คืนรถไปแล้ว
    //
    // แก้ใหม่: มีแค่สถานะ 'ขาไป' เท่านั้นที่แปลว่ายังใช้รถอยู่ = ไม่ว่างจริง
    // ค่าอื่น (ขากลับ = คืนแล้ว, ยกเลิก = ไม่เกิดขึ้นจริง) ไม่นับว่าจอง slot ไว้
    $sql = "SELECT BookingID, BookingNumber, DriverName, 
                   CONVERT(varchar, BookingDate, 23) AS BookingDate, 
                   TimeSlot, BookingStatus
            FROM CarBookings
            WHERE CarPlate = :plate AND BookingStatus = 'ขาไป'
            ORDER BY BookingDate ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    error_log('get_car_bookings DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูล"]);
}