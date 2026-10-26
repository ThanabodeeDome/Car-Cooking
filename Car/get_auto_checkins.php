<?php
// รายการของ "ฉัน" (ผู้ขับหรือผู้จองแทน) ที่ระบบเช็คอินให้อัตโนมัติแล้ว แต่ยังไม่มีใครกดยืนยันรับรถ
// (ยืนยันรับรถ = confirm_pickup.php จะเปลี่ยนเครื่องหมาย 'auto' เป็นผลตรวจพิกัดจริง รายการจึงหายจากนี้เอง)
// ใช้แสดงป้ายแจ้งเตือนบนทุกหน้า เพื่อไม่ให้ผู้ใช้ไม่รู้ว่าถูกเช็คอินไปแล้ว
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';
require_once 'auto_cancel_noshows.php';
header('Content-Type: application/json; charset=utf-8');

autoCancelNoShows($conn); // เช็คอินตามเวลาให้ก่อน แล้วค่อยดึงรายการ

try {
    if (!geo_columns_ok($conn)) {
        echo json_encode(['success' => true, 'items' => []]);
        exit;
    }
    $st = $conn->prepare(
        "SELECT TOP 5 b.BookingID, b.CarPlate, b.DriverName, b.Destination,
                CONVERT(varchar(5), b.CheckinTime, 108) AS CheckinHM,
                CONVERT(varchar(5), b.PlannedReturnTime, 108) AS DueHM
         FROM CarBookings b
         WHERE b.BookingStatus = N'ขาไป' AND b.CheckInGeo = 'auto'
           AND (b.EmployeeID = :emp OR b.BookedByUserID = :uid)
         ORDER BY b.BookingID DESC"
    );
    $st->execute([':emp' => (string)($_SESSION['employee_id'] ?? ''), ':uid' => (int)($_SESSION['user_id'] ?? 0)]);
    echo json_encode(['success' => true, 'items' => $st->fetchAll(PDO::FETCH_ASSOC)], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_auto_checkins: ' . $e->getMessage());
    echo json_encode(['success' => false, 'items' => []]);
}
