<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

try {
    require_once '../Car/auto_cancel_noshows.php';
    autoCancelNoShows($conn);

    // 🌟 เพิ่มคอลัมน์ขาไป/ขากลับ + รูปถ่ายทั้ง 3 จุด ให้หน้า Admin ดึงไปโชว์ใน modal รายละเอียดได้
    // 🩹 FIX: เพิ่ม OutTime/PlannedReturnTime (ระบบใหม่ใช้เวลาอิสระแทน TimeSlot เดิม
    // เก็บ TimeSlot ไว้เผื่อ booking เก่าก่อนอัปเดตยังมีค่านี้อยู่)
    require_once '../Car/geo_lib.php';
    $geoCols = geo_columns_ok($conn)
        ? ", CheckInLat, CheckInLng, CheckInGeo, CheckInDist, ReturnLat, ReturnLng, ReturnGeo, ReturnDist"
        : '';
    $sql = "SELECT BookingID, BookingNumber, DriverName, EmployeeID, Department, Destination,
                   CarPlate, BookingDate, TimeSlot,
                   CONVERT(varchar(8), OutTime, 108) AS OutTime,
                   CONVERT(varchar(8), PlannedReturnTime, 108) AS PlannedReturnTime,
                   BookingStatus,
                   StartMileage, EndMileage, CheckInTime, ReturnDate, ReturnTime, ReturnRemark,
                   CheckinPhotoPath, OdometerPhotoPath, ReturnPhotoPath,
                   Passengers, PassengerIDs$geoCols
            FROM CarBookings
            ORDER BY BookingID DESC";
    $stmt = $conn->query($sql);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    error_log('admin_get_bookings DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูลการจอง"]);
}