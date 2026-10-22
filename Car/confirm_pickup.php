<?php
// confirm_pickup.php
// กด "ยืนยันรับรถ" ที่รถ หลังระบบเช็คอินให้อัตโนมัติตามเวลาจองไปแล้ว (CheckInGeo = 'auto')
// ไม่เปลี่ยนสถานะ/เวลาเช็คอิน (ยังเป็นเวลาตามที่จอง) — แค่ยืนยันว่า "มารับรถจริงที่รถ": เก็บพิกัดจริง + รูปสภาพรถ (ไม่บังคับ)
// เมื่อบันทึกพิกัดแล้ว ธง 'auto' หาย -> สแกนครั้งถัดไปจะไปหน้าคืนรถทันที
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';
require_once __DIR__ . '/log_lib.php';
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

$data = json_decode(file_get_contents('php://input'), true);
$plate = isset($data['plate']) && is_string($data['plate']) ? trim($data['plate']) : '';
$photoPath = isset($data['photo_path']) && is_string($data['photo_path']) ? trim($data['photo_path']) : null;
if ($photoPath === '') $photoPath = null;
if ($photoPath !== null && !preg_match('#^uploads/checkin/checkin_[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp)$#D', $photoPath)) {
    echo json_encode(['success' => false, 'message' => 'ไฟล์รูปไม่ถูกต้อง กรุณาถ่ายรูปใหม่']);
    exit;
}
if ($plate === '') {
    echo json_encode(['success' => false, 'message' => 'ไม่พบทะเบียนรถ']);
    exit;
}

$sessionEmp = (string)($_SESSION['employee_id'] ?? '');
$isAdmin = strtolower($_SESSION['role'] ?? '') === 'admin';

try {
    $hasGeo = geo_columns_ok($conn);
    $st = $conn->prepare(
        "SELECT TOP 1 BookingID, EmployeeID, BookedByUserID" . ($hasGeo ? ", CheckInGeo" : "") . "
         FROM CarBookings
         WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = N'ขาไป'
         ORDER BY CASE WHEN EmployeeID = :emp OR BookedByUserID = :uid THEN 0 ELSE 1 END, BookingID DESC"
    );
    $st->execute([':plate' => $plate, ':emp' => $sessionEmp, ':uid' => (int)($_SESSION['user_id'] ?? 0)]);
    $b = $st->fetch(PDO::FETCH_ASSOC);
    if (!$b) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการที่กำลังใช้งานของรถคันนี้']);
        exit;
    }
    if (!$isAdmin && $sessionEmp !== (string)$b['EmployeeID'] && (int)$b['BookedByUserID'] !== (int)($_SESSION['user_id'] ?? -1)) {
        echo json_encode(['success' => false, 'message' => 'คุณไม่ใช่ผู้ขับที่ระบุไว้ในรายการจองนี้']);
        exit;
    }

    if ($photoPath !== null) {
        $conn->prepare("UPDATE CarBookings SET CheckinPhotoPath = :p WHERE BookingID = :id")->execute([':p' => $photoPath, ':id' => $b['BookingID']]);
    }
    // พิกัดจริงตอนยืนยัน (แทนค่า 'auto') — ไม่บล็อกถ้านอกจุด/ไม่มีพิกัด แค่ติดธงให้แอดมินเหมือนการเช็คอินปกติ
    $ev = geo_evaluate($data['geo'] ?? null);
    geo_store($conn, (int)$b['BookingID'], 'CheckIn', $ev);

    $bi = sl_booking_info($conn, (int)$b['BookingID']);
    sl_log($conn, 'pickup_confirm', 'ยืนยันรับรถที่รถ ' . trim($bi['plate'] . ' ' . $bi['driver']), [
        'target_type' => 'booking', 'target' => $bi['no'],
        'detail' => ['geo' => $ev['geo'], 'dist_m' => $ev['dist'], 'photo' => $photoPath !== null],
    ]);

    echo json_encode(['success' => true, 'message' => 'ยืนยันรับรถแล้ว เดินทางปลอดภัยครับ' . geo_user_note($ev, 'รับรถ'), 'geo' => $ev['geo']], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('confirm_pickup error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}
