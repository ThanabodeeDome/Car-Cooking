<?php
// scan.php
// 🌟 นี่คือ URL ที่ควร encode ลง QR code ติดรถ (ทะเบียนเดียวกัน ใช้ได้ทั้งตอนรับรถและคืนรถ)
// เช่น: https://yourdomain.com/car-booking/Car/scan.php?plate=กข1234
// เช็คสถานะ booking ปัจจุบันของรถคันนี้ แล้วเด้งไปหน้าที่ถูกต้องให้อัตโนมัติ ไม่ต้องมี 2 QR แยกกัน
require_once 'guard_user.php'; // ยังไม่ login จะเด้งไป login พร้อมจำ ?plate= ไว้กลับมาที่นี่ต่อ
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';

$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';

if (empty($plate)) {
    header('Location: homepage.html');
    exit;
}

try {
    // ดึงทุกรายการของรถคันนี้ที่ยังไม่จบ (กำลังใช้งาน/รอเช็คอิน) แล้วแยกว่าอันไหน "เป็นของคนที่สแกน"
    // (เดิมเลือกรายการที่กำลังใช้งานอยู่ของ "ใครก็ได้" ก่อน ทำให้คนที่มีคิวถัดไปสแกนแล้วเห็นรายการของคนที่ใช้รถอยู่)
    $stmt = $conn->prepare(
        "SELECT BookingStatus, EmployeeID, BookedByUserID" . (geo_columns_ok($conn) ? ", CheckInGeo" : "") . " FROM CarBookings
         WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus IN (N'จองแล้ว', N'ขาไป')
         ORDER BY CASE WHEN BookingStatus = N'ขาไป' THEN 0 ELSE 1 END, ABS(DATEDIFF(MINUTE, GETDATE(), CAST(BookingDate AS DATETIME) + CASE WHEN ISDATE(OutTime) = 1 THEN CAST(OutTime AS DATETIME) ELSE CAST('00:00' AS DATETIME) END)), BookingID"
    );
    $stmt->execute([':plate' => $plate]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $me = (string)($_SESSION['employee_id'] ?? '');
    $uid = (int)($_SESSION['user_id'] ?? 0);
    $isAdmin = strtolower((string)($_SESSION['role'] ?? '')) === 'admin';
    $mine = fn($r) => $isAdmin || ($me !== '' && (string)$r['EmployeeID'] === $me) || ($uid > 0 && (int)($r['BookedByUserID'] ?? 0) === $uid);

    $mineOut = null; $minePending = null; $anyOut = false; $anyPending = false;
    foreach ($rows as $r) {
        if ($r['BookingStatus'] === 'ขาไป') { $anyOut = true; if (!$mineOut && $mine($r)) $mineOut = $r; }
        else { $anyPending = true; if (!$minePending && $mine($r)) $minePending = $r; }
    }

    if ($mineOut && ($mineOut['CheckInGeo'] ?? '') === 'auto') {
        // ระบบเช็คอินให้อัตโนมัติไปแล้วตามเวลาจอง: คนสแกนอาจกำลังรับรถจริง หรือกำลังจะคืน
        header('Location: checkin.html?plate=' . urlencode($plate) . '&picked=1');
    } elseif ($mineOut) {
        header('Location: return_scan.html?plate=' . urlencode($plate));
    } elseif ($minePending || $anyOut || $anyPending) {
        // คิวของตัวเอง (หรือรถกำลังถูกคนอื่นใช้อยู่) -> หน้าเช็คอิน ซึ่งจะบอกเองว่ารถว่างไหม/ใครใช้อยู่/ถึงเวลาหรือยัง
        header('Location: checkin.html?plate=' . urlencode($plate));
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