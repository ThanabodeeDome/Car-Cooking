<?php
// confirm_checkin.php
// เรียกตอนกดปุ่ม "เช็คอิน" บนหน้า checkin.php (หลังสแกน QR ที่รถ)
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$plate = isset($data['plate']) ? trim($data['plate']) : '';
$photoPath = isset($data['photo_path']) ? trim($data['photo_path']) : null; // 🌟 ไม่บังคับ

if (empty($plate)) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบทะเบียนรถ']);
    exit;
}

try {
    $sql = "SELECT TOP 1 BookingID, EmployeeID FROM CarBookings
            WHERE CarPlate = :plate AND BookingStatus = 'จองแล้ว'
            ORDER BY BookingID DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการจองที่รอเช็คอินสำหรับรถคันนี้']);
        exit;
    }

    // 🌟 กันคนอื่นสแกนแล้วกดเช็คอินแทนผู้ขับตัวจริง — ต้องเป็นเจ้าของ booking เท่านั้น (หรือ admin)
    $sessionEmployeeId = $_SESSION['employee_id'] ?? null;
    $sessionRole = $_SESSION['role'] ?? '';
    if (strtolower($sessionRole) !== 'admin' && $sessionEmployeeId !== $booking['EmployeeID']) {
        echo json_encode(['success' => false, 'message' => 'คุณไม่ใช่ผู้ขับที่ระบุไว้ในรายการจองนี้']);
        exit;
    }

    // 🌟 เพิ่ม CheckinPhotoPath (ไม่บังคับ) เก็บรูปสภาพรถก่อนออก ไว้เทียบตอนคืนถ้ามีข้อพิพาท
    $update = $conn->prepare(
        "UPDATE CarBookings
         SET BookingStatus = 'ขาไป', CheckinTime = :checkin_time, CheckinPhotoPath = :photo_path
         WHERE BookingID = :id"
    );
    $update->execute([
        ':checkin_time' => date('Y-m-d H:i:s'),
        ':photo_path'   => $photoPath,
        ':id'           => $booking['BookingID'],
    ]);

    echo json_encode(['success' => true, 'message' => 'เช็คอินสำเร็จ รับรถได้เลยครับ']);
} catch (PDOException $e) {
    error_log('confirm_checkin error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}