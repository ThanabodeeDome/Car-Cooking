<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

// ช่วงเวลาแต่ละ TimeSlot ใช้แปลงเป็นเวลาเริ่ม/จบของ event บนปฏิทิน + label อ่านง่าย
$slotTimes = [
    'เช้า'     => ['08:00:00', '12:00:00', 'เช้า'],
    'บ่าย'     => ['13:00:00', '17:00:00', 'บ่าย'],
    'ทั้งวัน'   => ['08:00:00', '17:00:00', 'ทั้งวัน'],
    'กลางคืน'  => ['17:00:00', '08:00:00', 'กลางคืน'],
];

try {
    $sql = "SELECT BookingID, BookingNumber, DriverName, CarPlate, BookingDate, TimeSlot, BookingStatus
            FROM CarBookings
            WHERE BookingDate IS NOT NULL
              AND BookingStatus NOT LIKE N'ยกเลิก%'";
    $rows = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    $events = [];
    foreach ($rows as $r) {
        [$startT, $endT, $slotLabel] = $slotTimes[$r['TimeSlot']] ?? ['08:00:00', '17:00:00', ''];
        $isReturned = $r['BookingStatus'] === 'ขากลับ';

        // 🩹 'กลางคืน' จบข้ามเที่ยงคืน ต้อง +1 วันให้ end date ไม่งั้น end เวลาน้อยกว่า start ปฏิทินจะพัง
        $endDate = $r['BookingDate'];
        if ($r['TimeSlot'] === 'กลางคืน') {
            $endDate = date('Y-m-d', strtotime($r['BookingDate'] . ' +1 day'));
        }

        $events[] = [
            'id'    => $r['BookingID'],
            'title' => "[{$slotLabel}] {$r['CarPlate']} - {$r['DriverName']}",
            'start' => $r['BookingDate'] . 'T' . $startT,
            'end'   => $endDate . 'T' . $endT,
            'color' => $isReturned ? '#8b5cf6' : '#3b82f6', // คืนแล้ว=ม่วง, กำลังจอง/ใช้งาน=ฟ้า
            'extendedProps' => [
                'bookingNumber' => $r['BookingNumber'],
                'status'        => $r['BookingStatus'],
                'timeSlot'      => $r['TimeSlot'],
            ],
        ];
    }

    echo json_encode($events, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}