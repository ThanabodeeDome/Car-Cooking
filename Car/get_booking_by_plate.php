<?php
// get_booking_by_plate.php
// ใช้โดย checkin.js (status default 'จองแล้ว') และ return_scan.js (status='ขาไป')
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';
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
                   CONVERT(varchar(10), BookingDate, 23) AS BookingDate, TimeSlot,
                   LEFT(OutTime, 5) AS OutTime, CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime,
                   CONVERT(varchar(5), CheckinTime, 108) AS CheckinHM" . (geo_columns_ok($conn) ? ", CheckInGeo" : "") . "
            FROM CarBookings
            WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = :status
            ORDER BY CASE WHEN EmployeeID = :emp OR BookedByUserID = :uid THEN 0 ELSE 1 END, ABS(DATEDIFF(MINUTE, GETDATE(), CAST(BookingDate AS DATETIME) + CASE WHEN ISDATE(OutTime) = 1 THEN CAST(OutTime AS DATETIME) ELSE CAST('00:00' AS DATETIME) END)), BookingID ASC";
    $stmt = $conn->prepare($sql);
    // คิวของคนที่สแกนเองมาก่อน (ลำดับเดียวกับ confirm_checkin.php)
    $stmt->execute([':plate' => $plate, ':status' => $status, ':emp' => (string)($_SESSION['employee_id'] ?? ''), ':uid' => (int)($_SESSION['user_id'] ?? 0)]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    // รถคันนี้กำลังถูกใช้งานอยู่ (ขาไป) โดยใคร กำหนดคืนกี่โมง — ใช้เตือนคนที่มาเช็คอินรับรถว่ายังรับไม่ได้
    $inUse = null;
    if ($status === 'จองแล้ว') {
        $u = $conn->prepare("SELECT TOP 1 DriverName, EmployeeID, CONVERT(varchar(5), PlannedReturnTime, 108) AS DueHM FROM CarBookings WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = N'ขาไป' ORDER BY BookingID DESC");
        $u->execute([':plate' => $plate]);
        $inUse = $u->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    if (!$booking) {
        if ($inUse) {
            echo json_encode(['success' => false, 'message' => 'รถคันนี้กำลังถูกใช้งานโดย ' . trim((string)$inUse['DriverName']) . ' (กำหนดคืน ' . $inUse['DueHM'] . ' น.) ยังไม่มีรายการจองที่เช็คอินได้ตอนนี้']);
            exit;
        }
        $msg = $status === 'จองแล้ว'
            ? 'ไม่พบรายการจองที่รอเช็คอินสำหรับรถคันนี้'
            : 'ไม่พบรายการที่กำลังใช้งานอยู่สำหรับรถคันนี้ (อาจคืนไปแล้ว)';
        echo json_encode(['success' => false, 'message' => $msg]);
        exit;
    }

    // ยังไม่ถึงเวลาเปิดเช็คอิน (ล่วงหน้าไม่เกิน CHECKIN_EARLY_MINUTES) — ผู้ใช้ทั่วไปเท่านั้น แอดมินเช็คอินแทนได้เสมอ
    $booking['TooEarly'] = false;
    if ($status === 'จองแล้ว' && strtolower((string)($_SESSION['role'] ?? '')) !== 'admin' && !empty($booking['OutTime'])) {
        require_once __DIR__ . '/checkin_rules.php';
        $startTs = strtotime($booking['BookingDate'] . ' ' . $booking['OutTime']);
        $openTs = $startTs ? $startTs - CHECKIN_EARLY_MINUTES * 60 : 0;
        if ($openTs && time() < $openTs) {
            $booking['TooEarly'] = true;
            $booking['OpenAt'] = date('d/m H:i', $openTs);
        }
    }

    // เช็คอินอัตโนมัติตามเวลาไปแล้ว แต่ยังไม่มีใครกดยืนยันรับรถที่รถ (CheckInGeo ยังเป็น 'auto')
    $booking['AutoCheckin'] = (($booking['CheckInGeo'] ?? '') === 'auto');
    $booking['InUse'] = $inUse ? ['driver' => trim((string)$inUse['DriverName']), 'due' => (string)$inUse['DueHM']] : null;
    echo json_encode([
        'success' => true,
        'mode' => $status === 'จองแล้ว' ? 'checkin' : 'return',
        'booking' => $booking
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_booking_by_plate error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}