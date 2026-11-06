<?php
// รายการ "งานของฉันตอนนี้" ของผู้ใช้ (ผู้ขับหรือผู้จองแทน) — ใช้แสดงการ์ดบนหน้าหลัก ให้กดเช็คอิน/คืนรถได้เลยโดยไม่ต้องสแกน QR
//   kind = pickup : จองแล้ว และถึงช่วงเช็คอินได้ (ก่อนเวลาไป CHECKIN_EARLY_MINUTES นาที จนถึงเวลากลับ)
//   kind = inuse  : ขาไป และยังไม่คืน (auto = ระบบเช็คอินให้และยังไม่ยืนยันรับรถ, waiting = แจ้ง "รถยังไม่มา" ไว้แล้ว)
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';
require_once __DIR__ . '/checkin_rules.php';
require_once 'auto_cancel_noshows.php';
header('Content-Type: application/json; charset=utf-8');

autoCancelNoShows($conn); // เช็คอิน/ปิดตามเวลาให้ก่อน แล้วค่อยดึงรายการ

try {
    $cols = 'b.BookingID, b.CarPlate, b.DriverName, b.Destination, b.BookingStatus, b.BookingDate, b.OutTime, '
          . 'CONVERT(varchar(5), b.PlannedReturnTime, 108) AS RT, '
          . 'CONVERT(varchar(5), b.CheckinTime, 108) AS CheckinHM';
    $cols .= geo_columns_ok($conn) ? ', b.CheckInGeo' : ", CAST(NULL AS varchar(10)) AS CheckInGeo";
    $cols .= autoCloseColumnsOk($conn) ? ', b.WaitingCarAt' : ', CAST(NULL AS datetime) AS WaitingCarAt';
    $st = $conn->prepare(
        "SELECT $cols FROM CarBookings b
         WHERE (b.EmployeeID = :emp OR b.BookedByUserID = :uid)
           AND ((b.BookingStatus = N'ขาไป' AND b.EndMileage IS NULL)
             OR (b.BookingStatus = N'จองแล้ว' AND b.BookingDate BETWEEN :d1 AND :d2))
         ORDER BY b.BookingDate, b.OutTime"
    );
    $st->execute([
        ':emp' => (string)($_SESSION['employee_id'] ?? ''),
        ':uid' => (int)($_SESSION['user_id'] ?? 0),
        ':d1' => date('Y-m-d', strtotime('-1 day')),
        ':d2' => date('Y-m-d', strtotime('+1 day')),
    ]);
    $now = time();
    $items = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $out = substr((string)$r['OutTime'], 0, 5);
        $ret = (string)$r['RT'];
        if (!preg_match('/^\d{2}:\d{2}$/', $out) || !preg_match('/^\d{2}:\d{2}$/', $ret)) continue;
        $d = substr((string)$r['BookingDate'], 0, 10);
        $start = strtotime("$d $out");
        $end = strtotime(($ret <= $out ? date('Y-m-d', strtotime("$d +1 day")) : $d) . " $ret");
        $inuse = $r['BookingStatus'] === 'ขาไป';
        if (!$inuse && !($now >= $start - CHECKIN_EARLY_MINUTES * 60 && $now < $end)) continue;
        $items[] = [
            'BookingID' => (int)$r['BookingID'],
            'kind' => $inuse ? 'inuse' : 'pickup',
            'CarPlate' => $r['CarPlate'],
            'DriverName' => $r['DriverName'],
            'Destination' => $r['Destination'],
            'OutHM' => $out,
            'DueHM' => $ret,
            'CheckinHM' => $r['CheckinHM'],
            'auto' => $inuse && $r['CheckInGeo'] === 'auto',
            'waiting' => $inuse && !empty($r['WaitingCarAt']),
            'overdue' => $inuse && $now > $end,
        ];
    }
    echo json_encode(['success' => true, 'items' => array_slice($items, 0, 4)], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('get_my_active: ' . $e->getMessage());
    echo json_encode(['success' => false, 'items' => []]);
}
