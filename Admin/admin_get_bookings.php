<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

try {
    require_once '../Car/auto_cancel_noshows.php';
    autoCancelNoShows($conn);

    $sql = "SELECT BookingID, BookingNumber, DriverName, CarPlate, BookingDate, TimeSlot, BookingStatus, CheckInTime
            FROM CarBookings
            ORDER BY BookingID DESC";
    $stmt = $conn->query($sql);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}