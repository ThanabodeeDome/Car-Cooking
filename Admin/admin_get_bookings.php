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
    $sql = "SELECT BookingID, BookingNumber, DriverName, EmployeeID, Department, Destination,
                   CarPlate, BookingDate, TimeSlot, BookingStatus,
                   StartMileage, EndMileage, CheckInTime, ReturnDate, ReturnTime, ReturnRemark,
                   CheckinPhotoPath, OdometerPhotoPath, ReturnPhotoPath,
                   Passengers, PassengerIDs
            FROM CarBookings
            ORDER BY BookingID DESC";
    $stmt = $conn->query($sql);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    error_log('admin_get_bookings DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูลการจอง"]);
}