<?php
// save_return.php
// ใช้ร่วมกัน 2 ทาง: (1) return_scan.js หลังสแกน QR (มีรูป OCR) (2) booking.js แท็บคืนรถสำรอง (ไม่มีรูป กรอกเอง)
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];
$sessionRole = $_SESSION['role'] ?? '';

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$bookingId = isset($data['booking_id']) ? trim($data['booking_id']) : '';
$endMile = isset($data['end_mile']) ? (int) $data['end_mile'] : 0;

if (!$data || empty($bookingId) || $endMile <= 0) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

try {
    $bookingCheck = $conn->prepare(
        "SELECT BookingID, EmployeeID, CarPlate, StartMileage, BookingStatus
         FROM CarBookings WHERE BookingID = :id"
    );
    $bookingCheck->execute([':id' => $bookingId]);
    $booking = $bookingCheck->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(["success" => false, "message" => "ไม่พบรายการจองนี้"]);
        exit;
    }

    if ($booking['BookingStatus'] !== 'ขาไป') {
        echo json_encode(["success" => false, "message" => "รายการนี้ไม่อยู่ในสถานะที่คืนได้ (อาจคืนไปแล้วหรือยังไม่เช็คอิน)"]);
        exit;
    }

    // 🌟 กันคนอื่นคืนรถแทนผู้ขับตัวจริง — ต้องเป็นเจ้าของ booking เท่านั้น (หรือ admin)
    if (strtolower($sessionRole) !== 'admin' && $sessionEmployeeId !== $booking['EmployeeID']) {
        echo json_encode(["success" => false, "message" => "คุณไม่ใช่ผู้ขับที่ระบุไว้ในรายการจองนี้"]);
        exit;
    }

    $startMileage = (int) $booking['StartMileage'];
    if ($endMile <= $startMileage) {
        echo json_encode(["success" => false, "message" => "เลขไมล์ตอนคืนต้องมากกว่าเลขไมล์ตอนออก ($startMileage)"]);
        exit;
    }

    $conn->beginTransaction();

    $update = $conn->prepare(
        "UPDATE CarBookings
         SET BookingStatus = 'คืนแล้ว',
             ReturnDate = :return_date,
             ReturnTime = :return_time,
             EndMileage = :end_mile,
             ReturnRemark = :remark,
             OdometerPhotoPath = :odometer_photo,
             ReturnPhotoPath = :condition_photo
         WHERE BookingID = :id"
    );
    $update->execute([
        ':return_date'     => $data['return_date'] ?? date('Y-m-d'),
        ':return_time'     => $data['return_time'] ?? date('H:i'),
        ':end_mile'        => $endMile,
        ':remark'          => $data['return_remark'] ?? '-',
        ':odometer_photo'  => $data['odometer_photo_path'] ?? null,
        ':condition_photo' => $data['condition_photo_path'] ?? null,
        ':id'              => $bookingId,
    ]);

    // 🌟 sync เลขไมล์ล่าสุดกลับเข้าตาราง Cars ด้วย ให้ครั้งจองต่อไป auto-fill "เลขไมล์เริ่มต้น" ถูกต้อง
    $updateCar = $conn->prepare("UPDATE Cars SET Mileage = :mileage WHERE Plate = :plate");
    $updateCar->execute([':mileage' => $endMile, ':plate' => $booking['CarPlate']]);

    $conn->commit();

    echo json_encode(["success" => true, "message" => "บันทึกการคืนรถสำเร็จ"]);
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('save_return DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}