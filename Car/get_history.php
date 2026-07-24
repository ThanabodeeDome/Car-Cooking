<?php
session_start();
header("Content-Type: application/json; charset=utf-8");
require_once 'db_connect.php';

// 🌟 ไฟล์นี้ไม่มี login check เลยมาก่อน! ประวัติจองทั้งบริษัทเปิดโล่งให้คนนอกดูได้
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["error" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

try {
    $sql = "SELECT cb.BookingID AS booking_id,
                   cb.DriverName AS driver_name, 
                   cb.EmployeeID AS employeeId, 
                   cb.CarPlate AS car_plate, 
                   CONVERT(varchar, cb.OutDate, 23) AS out_date, 
                   CONVERT(varchar, cb.CheckInTime, 8) AS checkin_time,
                   CONVERT(varchar, cb.ReturnTime, 8) AS return_time,
                   cb.Passengers AS passengers, 
                   cb.PassengerIDs AS passenger_ids,
                   cb.BookingStatus AS booking_status
            FROM CarBookings cb
            ORDER BY cb.BookingID DESC";

    $stmt = $conn->query($sql);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($history, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_history DB error: ' . $e->getMessage());
    echo json_encode(["error" => "เกิดข้อผิดพลาดในการโหลดประวัติ"]);
}