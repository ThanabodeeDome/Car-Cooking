<?php
// Personal calendar feed (ICS) — subscribe once in Google/Apple Calendar; bookings then appear + update by themselves.
// URL: calendar.php?u=<userId>&t=<token>   token = HMAC(userId) with a server-side secret, so links can't be guessed.
// No DB changes. Contains only the user's own not-yet-returned bookings (as driver or passenger).
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/calendar_lib.php';

$uid = (int)($_GET['u'] ?? 0);
$tok = (string)($_GET['t'] ?? '');
if ($uid <= 0 || !hash_equals(calendar_token($uid), $tok)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'invalid link';
    exit;
}

try {
    $st = $conn->prepare("SELECT employee_id, first_name FROM Users WHERE id = :id");
    $st->execute([':id' => $uid]);
    $u = $st->fetch(PDO::FETCH_ASSOC);
    if (!$u) { http_response_code(404); exit; }

    $tz = new DateTimeZone('Asia/Bangkok');
    $from = (new DateTime('today', $tz))->modify('-1 day')->format('Y-m-d');
    $stmt = $conn->prepare(
        "SELECT BookingID, BookingNumber, CarPlate, DriverName, EmployeeID, Destination, BookingStatus, Passengers,
                CONVERT(varchar(10), BookingDate, 23) AS BookingDate, OutTime,
                CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime
         FROM CarBookings
         WHERE BookingStatus IN (N'จองแล้ว', N'ขาไป') AND BookingDate >= :d
           AND (EmployeeID = :emp OR ',' + REPLACE(ISNULL(PassengerIDs, ''), ' ', '') + ',' LIKE :pass)
         ORDER BY BookingDate, OutTime"
    );
    $stmt->execute([':d' => $from, ':emp' => $u['employee_id'], ':pass' => '%,' . $u['employee_id'] . ',%']);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    error_log('calendar.php: ' . $e->getMessage());
    http_response_code(500);
    exit;
}

$base = calendar_base_url();
header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: inline; filename="car-booking.ics"');
header('Cache-Control: private, max-age=300');
echo calendar_build($rows, $base);
