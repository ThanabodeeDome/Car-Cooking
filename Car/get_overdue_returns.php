<?php
// รายชื่อ "ค้างคืนรถ" ที่ทุกคนที่ล็อกอินเห็นได้ (แสดงบนหน้าหลัก) — รถที่ 'ขาไป' และเลยเวลากลับมาเกิน $graceMinutes
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once 'auto_cancel_noshows.php';
header('Content-Type: application/json; charset=utf-8');

autoCancelNoShows($conn); // เช็คอินตามเวลาให้ก่อน แล้วค่อยนับรายการค้าง

$graceMinutes = 60;
try {
    $st = $conn->prepare(
        "SELECT b.CarPlate, b.DriverName,
                CONVERT(varchar(16), t.EndAt, 120) AS DueAt,
                DATEDIFF(MINUTE, t.EndAt, GETDATE()) AS OverdueMin
         FROM CarBookings b
         JOIN (" . bookingTimesSql("N'ขาไป'") . ") t ON t.BookingID = b.BookingID
         WHERE b.BookingStatus = N'ขาไป' AND t.EndAt IS NOT NULL
           AND DATEADD(MINUTE, :g, t.EndAt) < GETDATE()
         ORDER BY t.EndAt"
    );
    $st->bindValue(':g', $graceMinutes, PDO::PARAM_INT);
    $st->execute();
    echo json_encode(['success' => true, 'overdue' => $st->fetchAll(PDO::FETCH_ASSOC)], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_overdue_returns: ' . $e->getMessage());
    echo json_encode(['success' => false, 'overdue' => []]);
}
