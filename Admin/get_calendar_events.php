<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
if (currentAdminRole() === false) {
    http_response_code(403);
    echo json_encode(["error" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

// ช่วงเวลาแบบเก่า (ก่อนใช้เวลาอิสระ) — ใช้เฉพาะแถวเก่าที่ยังไม่มี OutTime/PlannedReturnTime
$slotTimes = [
    'เช้า'   => ['08:00', '12:00'],
    'บ่าย'   => ['13:00', '17:00'],
    'ทั้งวัน' => ['08:00', '17:00'],
];

try {
    $sql = "SELECT BookingID, BookingNumber, DriverName, CarPlate, BookingStatus, TimeSlot,
                   CONVERT(varchar(10), BookingDate, 23) AS BookingDate,
                   LEFT(OutTime, 5) AS OutTime,
                   CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime
            FROM CarBookings
            WHERE BookingDate IS NOT NULL
              AND BookingStatus NOT LIKE N'ยกเลิก%'";
    $rows = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    $colors = ['คืนแล้ว' => '#8b5cf6', 'ขาไป' => '#2563eb', 'จองแล้ว' => '#f59e0b'];

    $events = [];
    foreach ($rows as $r) {
        $out = $r['OutTime'];
        $ret = $r['PlannedReturnTime'];
        if (!$out || !$ret) {
            [$out, $ret] = $slotTimes[$r['TimeSlot']] ?? ['08:00', '17:00'];
        }
        $endDate = $r['BookingDate'];
        if ($ret <= $out) { // ข้ามคืน -> จบเช้าวันถัดไป
            $endDate = date('Y-m-d', strtotime($r['BookingDate'] . ' +1 day'));
        }
        $range = "$out-$ret น.";

        $events[] = [
            'id'    => $r['BookingID'],
            'title' => "[$range] {$r['CarPlate']} - {$r['DriverName']}",
            'start' => $r['BookingDate'] . 'T' . $out . ':00',
            'end'   => $endDate . 'T' . $ret . ':00',
            'color' => $colors[$r['BookingStatus']] ?? '#64748b',
            'extendedProps' => [
                'bookingNumber' => $r['BookingNumber'],
                'status'        => $r['BookingStatus'],
                'timeSlot'      => $range,
            ],
        ];
    }

    echo json_encode($events, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_calendar_events DB error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "เกิดข้อผิดพลาดในการโหลดข้อมูลปฏิทิน"]);
}