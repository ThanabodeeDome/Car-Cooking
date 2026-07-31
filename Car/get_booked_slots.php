<?php
// get_booked_slots.php
// คืนรายการ TimeSlot ที่ถูกจองไปแล้วของรถคันนี้ในวันที่ระบุ (สถานะ 'จองแล้ว' หรือ 'ขาไป' เท่านั้น
// พอคืนรถแล้ว สถานะเปลี่ยนเป็น 'คืนแล้ว'/'ยกเลิก' ช่องนั้นจะกลับมาว่างเอง ไม่ต้องเคลียร์อะไรเพิ่ม)
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$plate = isset($_GET['plate']) ? trim($_GET['plate']) : '';
$date  = isset($_GET['date']) ? trim($_GET['date']) : '';

if (empty($plate) || empty($date)) {
    echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบ', 'booked_slots' => []]);
    exit;
}

try {
    $stmt = $conn->prepare(
        "SELECT TimeSlot FROM CarBookings
         WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:plate, ' ', '')
           AND BookingDate = :date
           AND BookingStatus IN ('จองแล้ว', 'ขาไป')"
    );
    $stmt->execute([':plate' => $plate, ':date' => $date]);
    $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // 🌟 'ทั้งวัน' ถูกจอง = กันเช้า+บ่ายด้วย (ครอบคลุมทั้งวัน) และกลับกัน
    // ถ้าเช้า+บ่าย ถูกจองครบคู่ ก็เท่ากับ "ทั้งวัน" ควรกันด้วย (กันชนช่วงเวลาซ้อนกันจริง)
    $booked = array_values(array_unique($rows));
    $hasMorning = in_array('เช้า', $booked, true);
    $hasAfternoon = in_array('บ่าย', $booked, true);
    $hasFullDay = in_array('ทั้งวัน', $booked, true);

    if ($hasFullDay) {
        $booked[] = 'เช้า';
        $booked[] = 'บ่าย';
    }
    if ($hasMorning && $hasAfternoon) {
        $booked[] = 'ทั้งวัน';
    }
    $booked = array_values(array_unique($booked));

    echo json_encode(['success' => true, 'booked_slots' => $booked], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_booked_slots error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง', 'booked_slots' => []]);
}