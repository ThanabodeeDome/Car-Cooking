<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

$plate = $_GET['plate'] ?? '';
if (empty($plate)) {
    echo json_encode(["success" => false, "message" => "ไม่พบทะเบียนรถ"]);
    exit;
}

try {
    $sql = "SELECT BookingID, BookingNumber, DriverName, BookingDate, TimeSlot, BookingStatus
            FROM CarBookings
            WHERE CarPlate = :plate AND (BookingStatus IS NULL OR BookingStatus != 'ยกเลิก')
            ORDER BY BookingDate ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate]);
    $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}