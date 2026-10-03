<?php
// confirm_checkin.php
// เรียกตอนกดปุ่ม "เช็คอิน" บนหน้า checkin.php (หลังสแกน QR ที่รถ)
require_once 'guard_user.php';
require_once 'db_connect.php';
require_once __DIR__ . '/geo_lib.php';
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$plate = isset($data['plate']) && is_string($data['plate']) ? trim($data['plate']) : '';
$photoPath = isset($data['photo_path']) && is_string($data['photo_path']) ? trim($data['photo_path']) : null; // 🌟 ไม่บังคับ
// 🔒 รับเฉพาะ path ที่ upload_checkin_photo.php ออกให้ (กันยัด path/URL/HTML แปลกๆ ลง DB แล้วไปโผล่หน้าแอดมิน)
if ($photoPath === '') $photoPath = null;
if ($photoPath !== null && !preg_match('#^uploads/checkin/checkin_[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp)$#D', $photoPath)) {
    echo json_encode(['success' => false, 'message' => 'ไฟล์รูปไม่ถูกต้อง กรุณาถ่ายรูปใหม่']);
    exit;
}

if (empty($plate)) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบทะเบียนรถ']);
    exit;
}

$sessionEmployeeId = $_SESSION['employee_id'] ?? null;
$sessionRole = $_SESSION['role'] ?? '';

try {
    // รถคันนี้ยังไม่ได้คืน (มีรายการ "ขาไป" ค้างอยู่) = เช็คอินรายการอื่นไม่ได้
    $outNow = $conn->prepare("SELECT COUNT(*) FROM CarBookings WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = N'ขาไป'");
    $outNow->execute([':plate' => $plate]);
    if ($outNow->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'รถคันนี้ยังใช้งานอยู่ (ยังไม่ได้คืน) จึงเช็คอินรายการใหม่ไม่ได้']);
        exit;
    }

    // เลือกรายการที่ "ใกล้เวลาปัจจุบันที่สุด" (เดิมเลือกรายการที่จองล่าสุด ซึ่งอาจเป็นคิวของวันอื่น)
    // 🩹 ให้รายการของคนที่สแกนเองมาก่อน — เดิมถ้ามีคิวคนอื่นใกล้เวลากว่า เจ้าของคิวตัวจริงจะเช็คอินไม่ได้เลย
    // (ลำดับเดียวกับ get_booking_by_plate.php หน้าจอจะได้โชว์รายการเดียวกับที่เช็คอินจริง)
    $sql = "SELECT TOP 1 BookingID, EmployeeID,
                   CASE WHEN ISDATE(OutTime) = 1 THEN CONVERT(varchar(16), CAST(BookingDate AS DATETIME) + CAST(OutTime AS DATETIME), 120) END AS StartAt
            FROM CarBookings
            WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = N'จองแล้ว'
            ORDER BY CASE WHEN EmployeeID = :emp THEN 0 ELSE 1 END,
                     ABS(DATEDIFF(MINUTE, GETDATE(), CAST(BookingDate AS DATETIME) + CASE WHEN ISDATE(OutTime) = 1 THEN CAST(OutTime AS DATETIME) ELSE CAST('00:00' AS DATETIME) END)), BookingID ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate, ':emp' => (string)$sessionEmployeeId]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการจองที่รอเช็คอินสำหรับรถคันนี้']);
        exit;
    }

    // 🌟 กันคนอื่นสแกนแล้วกดเช็คอินแทนผู้ขับตัวจริง — ต้องเป็นเจ้าของ booking เท่านั้น (หรือ admin)
    if (strtolower($sessionRole) !== 'admin' && $sessionEmployeeId !== $booking['EmployeeID']) {
        echo json_encode(['success' => false, 'message' => 'คุณไม่ใช่ผู้ขับที่ระบุไว้ในรายการจองนี้']);
        exit;
    }

    // 🔒 เช็คอินล่วงหน้าได้ไม่เกิน 2 ชม. ก่อนเวลาออก — เดิมสแกนวันนี้เช็คอินคิวของสัปดาห์หน้าได้
    // รถจะขึ้น "กำลังใช้งาน" ทันทีและคิวคนอื่นระหว่างนั้นเช็คอินไม่ได้ (แอดมินยังเช็คอินแทนได้เสมอ)
    $earlyMinutes = 120;
    if (strtolower($sessionRole) !== 'admin' && !empty($booking['StartAt'])
        && time() < strtotime($booking['StartAt']) - $earlyMinutes * 60) {
        $openAt = strtotime($booking['StartAt']) - $earlyMinutes * 60;
        echo json_encode(['success' => false, 'message' => 'ยังไม่ถึงเวลารับรถ (คิวของคุณออก ' . date('d/m/Y H:i', strtotime($booking['StartAt'])) . ' น. เช็คอินได้ตั้งแต่ ' . date('d/m H:i', $openAt) . ' น.)']);
        exit;
    }

    // 🌟 เพิ่ม CheckinPhotoPath (ไม่บังคับ) เก็บรูปสภาพรถก่อนออก ไว้เทียบตอนคืนถ้ามีข้อพิพาท
    $update = $conn->prepare(
        "UPDATE CarBookings
         SET BookingStatus = 'ขาไป', CheckinTime = :checkin_time, CheckinPhotoPath = :photo_path,
             StartMileage = ISNULL((SELECT TOP 1 Mileage FROM Cars WHERE REPLACE(Plate, ' ', '') = REPLACE(:plate2, ' ', '')), StartMileage) -- ไมล์ตอนรับรถ = ไมล์ล่าสุดของรถ (คิวที่จองล่วงหน้าอาจมีทริปอื่นคั่น)
         WHERE BookingID = :id AND BookingStatus = N'จองแล้ว'"
    );
    $update->execute([
        ':checkin_time' => date('Y-m-d H:i:s'),
        ':photo_path'   => $photoPath,
        ':plate2'       => $plate,
        ':id'           => $booking['BookingID'],
    ]);
    // 🔒 กันกดเช็คอินซ้อนพร้อมกัน 2 เครื่อง/ถูกยกเลิกไประหว่างนั้น (ไม่งั้นทับ CheckinTime ซ้ำ)
    if ($update->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'รายการนี้ถูกเช็คอินหรือยกเลิกไปแล้ว กรุณารีเฟรชหน้า']);
        exit;
    }

    // GPS: บันทึกพิกัด + เทียบกับจุดบริษัท (ไม่บล็อก ถ้านอกจุด/ไม่มีพิกัด ติดธงให้แอดมิน)
    $ev = geo_evaluate($data['geo'] ?? null);
    geo_store($conn, (int)$booking['BookingID'], 'CheckIn', $ev);

    echo json_encode(['success' => true, 'message' => 'เช็คอินสำเร็จ รับรถได้เลยครับ' . geo_user_note($ev, 'รับรถ'), 'geo' => $ev['geo']]);
} catch (PDOException $e) {
    error_log('confirm_checkin error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง']);
}