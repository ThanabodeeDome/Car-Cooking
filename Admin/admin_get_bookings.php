<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

$allowed_admin_ids = require __DIR__ . '/../admin_whitelist.php';
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin' || !in_array((int)$_SESSION['user_id'], $allowed_admin_ids, true)) {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

try {
    require_once '../Car/auto_cancel_noshows.php';
    autoCancelNoShows($conn);

    $sql = "SELECT BookingID, BookingNumber, DriverName, EmployeeID, CarPlate, BookingDate, TimeSlot, BookingStatus,
                   OutDate, OutTime, StartMileage, JobDetail, OutRemark, CheckInTime,
                   ReturnDate, ReturnTime, EndMileage, ReturnRemark,
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