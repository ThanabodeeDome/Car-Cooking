<?php
// get_booking_by_plate.php
// ใช้โดย checkin.js (status default 'จองแล้ว') และ return_scan.js (status='ขาไป')
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';
$status = isset($_GET['status']) ? trim($_GET['status']) : 'จองแล้ว';

// 🌟 กันส่งค่า status แปลกๆ เข้ามา query ตรงๆ — จำกัดแค่ 2 ค่าที่ระบบรู้จักเท่านั้น
if (!in_array($status, ['จองแล้ว', 'ขาไป'], true)) {
    $status = 'จองแล้ว';
}

if (empty($plate)) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบทะเบียนรถ']);
    exit;
}

try {
    $sql = "SELECT TOP 1 BookingID, BookingNumber, DriverName, EmployeeID, Department,
                   Destination, CarPlate, StartMileage, Passengers, PassengerIDs,
                   BookingDate, TimeSlot
            FROM CarBookings
            WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = :status
            ORDER BY BookingID DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate, ':status' => $status]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        $msg = $status === 'จองแล้ว'
            ? 'ไม่พบรายการจองที่รอเช็คอินสำหรับรถคันนี้'
            : 'ไม่พบรายการที่กำลังใช้งานอยู่สำหรับรถคันนี้ (อาจคืนไปแล้ว)';
        echo json_encode(['success' => false, 'message' => $msg]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'mode' => $status === 'จองแล้ว' ? 'checkin' : 'return',
        'booking' => $booking
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_booking_by_plate error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}