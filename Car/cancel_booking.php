<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();
require_once 'db_connect.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['booking_id']) || !is_scalar($data['booking_id']) || !ctype_digit((string)$data['booking_id'])) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการที่จะยกเลิก"]);
    exit;
}

try {
    // 🩹 เพิ่ม 'จองแล้ว' เข้าเงื่อนไข — booking ใหม่ตอนนี้เริ่มที่สถานะนี้ (ยังไม่เช็คอิน)
    // 🩹 ตัด 'ขาไป' ออก: ตอนนี้ 'ขาไป' = เช็คอินรับรถไปแล้ว ถ้ายกเลิกได้ รถที่ยังไม่คืนจะกลายเป็น "ว่าง"
    // ให้คนอื่นจองซ้อน และไม่มีการบันทึกเลขไมล์คืน (ต้องคืนรถแทน หรือให้แอดมินยกเลิก)
    // ผู้ขับ หรือ ผู้จอง (กรณีจองแทนกัน) ยกเลิกได้
    if (!empty($data['unused'])) {
        // "ไม่ได้ใช้รถ": คิวที่ถูกเช็คอินอัตโนมัติตามเวลาไปแล้ว ('ขาไป') แต่ไม่ได้ใช้จริง — ปล่อยรถคืนได้โดยไม่ต้องกรอกไมล์
        // ใช้ได้เฉพาะที่ยังไม่มีการคืน/ไม่มีเลขไมล์คืน
        $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = N'ยกเลิก (ไม่ได้ใช้รถ)'
                             WHERE BookingID = :id AND (EmployeeID = :emp OR BookedByUserID = :uid)
                               AND BookingStatus = N'ขาไป' AND EndMileage IS NULL");
    } else {
        $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = 'ยกเลิก'
                             WHERE BookingID = :id AND (EmployeeID = :emp OR BookedByUserID = :uid)
                               AND (BookingStatus = 'จองแล้ว' OR BookingStatus IS NULL)");
    }
    $stmt->execute([':id' => $data['booking_id'], ':emp' => $sessionEmployeeId, ':uid' => $_SESSION['user_id']]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(["success" => false, "message" => "ไม่สามารถยกเลิกได้ (อาจถูกเช็คอิน คืนรถ หรือยกเลิกไปแล้ว)"]);
        exit;
    }
    // 📝 บันทึกระบบ: ยกเลิกการจอง / ปล่อยรถ (ไม่ได้ใช้รถ)
    require_once __DIR__ . '/log_lib.php';
    $bi = sl_booking_info($conn, (int)$data['booking_id']);
    $isUnused = !empty($data['unused']);
    sl_log($conn, $isUnused ? 'booking_unused' : 'booking_cancel', ($isUnused ? 'ปล่อยรถ (ไม่ได้ใช้รถ) ' : 'ยกเลิกการจอง ') . trim($bi['plate'] . ' ' . $bi['driver']), [
        'target_type' => 'booking', 'target' => $bi['no'],
    ]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('cancel_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถยกเลิกได้"]);
}