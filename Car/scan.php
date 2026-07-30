<?php
// scan.php
// 🌟 นี่คือ URL ที่ควร encode ลง QR code ติดรถ (ทะเบียนเดียวกัน ใช้ได้ทั้งตอนรับรถและคืนรถ)
// เช่น: https://yourdomain.com/car-booking/Car/scan.php?plate=กข1234
// เช็คสถานะ booking ปัจจุบันของรถคันนี้ แล้วเด้งไปหน้าที่ถูกต้องให้อัตโนมัติ ไม่ต้องมี 2 QR แยกกัน
require_once 'guard_user.php'; // ยังไม่ login จะเด้งไป login พร้อมจำ ?plate= ไว้กลับมาที่นี่ต่อ
require_once 'db_connect.php';

$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';

if (empty($plate)) {
    header('Location: homepage.html');
    exit;
}

try {
    $stmt = $conn->prepare(
        "SELECT TOP 1 BookingStatus FROM CarBookings
         WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus IN ('จองแล้ว', 'ขาไป')
         ORDER BY BookingID DESC"
    );
    $stmt->execute([':plate' => $plate]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row && $row['BookingStatus'] === 'จองแล้ว') {
        header('Location: checkin.html?plate=' . urlencode($plate));
    } elseif ($row && $row['BookingStatus'] === 'ขาไป') {
        header('Location: return_scan.html?plate=' . urlencode($plate));
    } else {
        // ไม่มี booking ค้างเลยสำหรับรถคันนี้ (อาจสแกนผิดคัน หรือคืนไปแล้ว)
        header('Location: homepage.html?msg=no_active_booking&plate=' . urlencode($plate));
    }
    exit;
} catch (PDOException $e) {
    error_log('scan.php error: ' . $e->getMessage());
    header('Location: homepage.html?msg=system_error');
    exit;
}