<?php
// confirm_return.php
// เรียกตอนกดปุ่ม "ยืนยันคืนรถ" บนหน้า checkin.php (โหมดคืนรถ หลังสแกน QR ที่รถ)
// 🌟 ไฟล์นี้หายไปจากระบบ — checkin.js เรียกอยู่แต่ไม่มี endpoint จริง ทำให้รูปที่อัปโหลด
// สำเร็จแล้ว (ผ่าน upload_return_photo.php) ไม่เคยถูกบันทึก path ผูกกับ booking เลย
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$plate = isset($data['plate']) ? trim($data['plate']) : '';
$endMile = isset($data['end_mile']) ? (int) $data['end_mile'] : 0;
$photoPath = isset($data['photo_path']) ? trim($data['photo_path']) : null; // รูปเลขไมล์ตอนคืน
$remark = isset($data['return_remark']) ? trim($data['return_remark']) : '-';

if (empty($plate)) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบทะเบียนรถ']);
    exit;
}
if ($endMile <= 0) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกเลขไมล์ตอนคืนให้ถูกต้อง']);
    exit;
}

try {
    // 🌟 หา booking ที่ "ขาไป" (เช็คอินแล้ว กำลังใช้งานอยู่) ของรถทะเบียนนี้ — รอคืนอยู่
    $sql = "SELECT TOP 1 BookingID, EmployeeID, StartMileage FROM CarBookings
            WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '') AND BookingStatus = 'ขาไป'
            ORDER BY BookingID DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':plate' => $plate]);
    $booking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการที่รอคืนสำหรับรถคันนี้']);
        exit;
    }

    // 🌟 กันคนอื่นสแกนแล้วกดคืนแทนผู้ขับตัวจริง — ต้องเป็นเจ้าของ booking เท่านั้น (หรือ admin)
    $sessionEmployeeId = $_SESSION['employee_id'] ?? null;
    $sessionRole = $_SESSION['role'] ?? '';
    if (strtolower($sessionRole) !== 'admin' && $sessionEmployeeId !== $booking['EmployeeID']) {
        echo json_encode(['success' => false, 'message' => 'คุณไม่ใช่ผู้ขับที่ระบุไว้ในรายการจองนี้']);
        exit;
    }

    // 🌟 กันกรอกเลขไมล์ตอนคืนน้อยกว่าตอนออก (ข้อมูลผิดปกติชัดเจน)
    $startMileage = (int) $booking['StartMileage'];
    if ($endMile <= $startMileage) {
        echo json_encode(['success' => false, 'message' => "เลขไมล์ตอนคืน ($endMile) ต้องมากกว่าเลขไมล์ตอนออก ($startMileage)"]);
        exit;
    }

    if (strtolower($sessionRole) !== 'admin' && ($endMile - $startMileage) > 1500) {
        echo json_encode(['success' => false, 'message' => 'ระยะทาง ' . number_format($endMile - $startMileage) . ' กม. ผิดปกติ (เกิน 1,500) กรุณาตรวจเลขไมล์ที่กรอกอีกครั้ง หากถูกต้องจริงให้แจ้งแอดมิน']);
        exit;
    }

    $conn->beginTransaction();

    // 🌟 บันทึก OdometerPhotoPath = รูปเลขไมล์ที่ถ่ายตอนคืน (คนละคอลัมน์กับ CheckinPhotoPath
    // ที่เก็บรูปสภาพรถตอนออก และ ReturnPhotoPath ที่เก็บรูปสภาพรถตอนคืนจากฟอร์มมืออีกที)
    $update = $conn->prepare(
        "UPDATE CarBookings
         SET BookingStatus = 'คืนแล้ว',
             ReturnDate = :return_date,
             ReturnTime = :return_time,
             EndMileage = :end_mile,
             ReturnRemark = :remark,
             OdometerPhotoPath = :photo_path
         WHERE BookingID = :id"
    );
    $update->execute([
        ':return_date' => date('Y-m-d'),
        ':return_time' => date('H:i:s'),
        ':end_mile'    => $endMile,
        ':remark'      => $remark ?: '-',
        ':photo_path'  => $photoPath,
        ':id'          => $booking['BookingID'],
    ]);

    // 🌟 sync เลขไมล์ล่าสุดกลับเข้าตาราง Cars ด้วย (เหมือน save_return.php เดิม)
    // ให้ครั้งจองต่อไป auto-fill "เลขไมล์เริ่มต้น" ถูกต้อง
    $updateCar = $conn->prepare("UPDATE Cars SET Mileage = :mileage WHERE Plate = :plate");
    $updateCar->execute([':mileage' => $endMile, ':plate' => $plate]);

    $conn->commit();

    echo json_encode(['success' => true, 'message' => 'คืนรถสำเร็จแล้วครับ']);
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('confirm_return error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง']);
}