<?php
// save_return.php
// ใช้ร่วมกัน 2 ทาง: (1) return_scan.js หลังสแกน QR (มีรูป OCR) (2) booking.js แท็บคืนรถสำรอง (ไม่มีรูป กรอกเอง)
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];
$sessionRole = $_SESSION['role'] ?? '';

require_once __DIR__ . '/../same_origin.php';
require_same_origin();
require_once __DIR__ . '/text_util.php'; // fit_nvarchar(): ตัดหมายเหตุให้พอดีคอลัมน์ ReturnRemark (emoji กิน 2 หน่วย)

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$bookingId = isset($data['booking_id']) && is_scalar($data['booking_id']) ? trim((string)$data['booking_id']) : '';
$endMile = isset($data['end_mile']) ? (int) $data['end_mile'] : 0;

if (!$data || empty($bookingId) || $endMile <= 0) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

// 🔒 รูปต้องเป็น path ที่ upload_return_photo.php ออกให้เท่านั้น (กันยัด path/HTML ไปโผล่หน้าแอดมิน)
$photoPaths = [];
foreach (['odometer_photo_path' => 'odometer', 'condition_photo_path' => 'condition'] as $key => $kind) {
    $p = isset($data[$key]) && is_string($data[$key]) ? trim($data[$key]) : '';
    if ($p !== '' && !preg_match('#^uploads/return/return_' . $kind . '_[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp)$#D', $p)) {
        echo json_encode(["success" => false, "message" => "ไฟล์รูปไม่ถูกต้อง กรุณาถ่ายรูปใหม่"]);
        exit;
    }
    $photoPaths[$key] = $p !== '' ? $p : null;
}

// 🔒 วันเวลาคืน: ฟอร์มมือให้ผู้ใช้เลือกเองได้ แต่ต้องเป็นรูปแบบถูกต้องและไม่อยู่ในอนาคต
$returnDate = isset($data['return_date']) && is_string($data['return_date']) ? trim($data['return_date']) : '';
$returnTime = isset($data['return_time']) && is_string($data['return_time']) ? substr(trim($data['return_time']), 0, 5) : '';
if ($returnDate === '' && $returnTime === '') {
    $returnDate = date('Y-m-d');
    $returnTime = date('H:i');
}
$returnAt = DateTime::createFromFormat('!Y-m-d H:i', $returnDate . ' ' . $returnTime);
if (!$returnAt || $returnAt->format('Y-m-d H:i') !== $returnDate . ' ' . $returnTime) {
    echo json_encode(["success" => false, "message" => "รูปแบบวันที่/เวลาคืนรถไม่ถูกต้อง"]);
    exit;
}
if ($returnAt > new DateTime('+10 minutes')) {
    echo json_encode(["success" => false, "message" => "วันเวลาคืนรถต้องไม่เกินเวลาปัจจุบัน"]);
    exit;
}
$remark = isset($data['return_remark']) && is_string($data['return_remark']) ? fit_nvarchar(trim($data['return_remark']), 500) : '';

try {
    $bookingCheck = $conn->prepare(
        "SELECT BookingID, EmployeeID, CarPlate, StartMileage, BookingStatus,
                CONVERT(varchar(16), CheckInTime, 120) AS CheckInAt
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

    // 🔒 วันเวลาคืนต้องไม่ก่อนเวลาเช็คอินรับรถ (ฟอร์มคืนมือเลือกวันย้อนหลังได้ — เดิมเลือกก่อนรับรถก็ผ่าน)
    if (!empty($booking['CheckInAt']) && $returnAt->format('Y-m-d H:i') < $booking['CheckInAt']) {
        echo json_encode(["success" => false, "message" => "วันเวลาคืนรถต้องไม่ก่อนเวลารับรถ (" . date('d/m/Y H:i', strtotime($booking['CheckInAt'])) . " น.)"]);
        exit;
    }

    $startMileage = (int) $booking['StartMileage'];
    if ($endMile <= $startMileage) {
        echo json_encode(["success" => false, "message" => "เลขไมล์ตอนคืนต้องมากกว่าเลขไมล์ตอนออก ($startMileage)"]);
        exit;
    }

    // กันเลขไมล์เพี้ยน (พิมพ์ผิด/OCR อ่านผิด): ทริปเดียวเกิน 1,500 กม. ให้แอดมินเป็นคนบันทึก
    if (strtolower($sessionRole) !== 'admin' && ($endMile - $startMileage) > 1500) {
        echo json_encode(["success" => false, "message" => "ระยะทาง " . number_format($endMile - $startMileage) . " กม. ผิดปกติ (เกิน 1,500) กรุณาตรวจเลขไมล์ที่กรอกอีกครั้ง หากถูกต้องจริงให้แจ้งแอดมิน"]);
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
         WHERE BookingID = :id AND BookingStatus = N'ขาไป'"
    );
    $update->execute([
        ':return_date'     => $returnDate,
        ':return_time'     => $returnTime,
        ':end_mile'        => $endMile,
        ':remark'          => $remark !== '' ? $remark : '-',
        ':odometer_photo'  => $photoPaths['odometer_photo_path'],
        ':condition_photo' => $photoPaths['condition_photo_path'],
        ':id'              => $bookingId,
    ]);
    // 🔒 กันกดคืนซ้อนพร้อมกัน (2 แท็บ/กดเบิ้ล) ทับเลขไมล์และเวลาคืนซ้ำ
    if ($update->rowCount() === 0) {
        $conn->rollBack();
        echo json_encode(["success" => false, "message" => "รายการนี้ถูกคืนไปแล้ว กรุณารีเฟรชหน้า"]);
        exit;
    }

    // 🌟 sync เลขไมล์ล่าสุดกลับเข้าตาราง Cars ด้วย ให้ครั้งจองต่อไป auto-fill "เลขไมล์เริ่มต้น" ถูกต้อง
    $updateCar = $conn->prepare("UPDATE Cars SET Mileage = :mileage WHERE Plate = :plate");
    $updateCar->execute([':mileage' => $endMile, ':plate' => $booking['CarPlate']]);

    $conn->commit();

    // แท็บคืนรถมือใน booking.js ไม่ส่ง geo มา (ไม่ใช่การสแกนที่รถ) = ไม่ติดธง
    $ev = array_key_exists('geo', $data) ? geo_evaluate($data['geo']) : ['geo' => 'nosite', 'dist' => null, 'lat' => null, 'lng' => null, 'acc' => null];
    if (array_key_exists('geo', $data)) geo_store($conn, (int)$booking['BookingID'], 'Return', $ev);

    echo json_encode(["success" => true, "message" => "บันทึกการคืนรถสำเร็จ" . geo_user_note($ev, 'คืนรถ'), "geo" => $ev['geo']]);
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('save_return DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}