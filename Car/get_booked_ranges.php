<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';
require_once __DIR__ . '/auto_cancel_noshows.php';
autoReleaseNoShows($conn);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';
$date = isset($_GET['date']) ? trim($_GET['date']) : '';

if (!$plate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

try {
    // 🌟 ดึงช่วงเวลาที่ถูกจองแล้ว (จองแล้ว + ขาไป) ของรถคันนี้ ในช่วง ±1 วันจากวันที่ดู
    // (พอสำหรับกรณีจองข้ามคืนที่อาจกินไปถึงเช้าวันถัดไป/ก่อนหน้า)
    $dMinus = date('Y-m-d', strtotime($date . ' -1 day'));
    $dPlus  = date('Y-m-d', strtotime($date . ' +1 day'));

    $stmt = $conn->prepare(
        "SELECT DriverName, BookingDate, OutTime, PlannedReturnTime
         FROM CarBookings
         WHERE CarPlate = :plate AND BookingStatus IN ('จองแล้ว', 'ขาไป')
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $stmt->execute([':plate' => $plate, ':d1' => $dMinus, ':d2' => $dPlus]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $ranges = array_map(function ($row) {
        return [
            'driver_name' => $row['DriverName'],
            'booking_date' => $row['BookingDate'],
            'out_time' => $row['OutTime'],
            'planned_return_time' => $row['PlannedReturnTime'],
        ];
    }, $rows);

    echo json_encode(["success" => true, "ranges" => $ranges], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_booked_ranges DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด"]);
}