<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🩹 ยังต้อง login ก่อนถึงจะจองได้ (กันคนนอกยิง endpoint ตรงๆ)
// แต่ "ผู้ขับ" ไม่จำเป็นต้องเป็นคนที่ login แล้ว (เช่น จนท. จองแทนคนขับ)
// -> employee_id ผู้ขับ ต้องมาจากฟอร์ม แล้ว validate กับ DB จริง ห้ามเชื่อ driver_name ที่ client ส่งมาตรงๆ
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อนทำการจอง"]);
    exit;
}
$bookedByUserId = $_SESSION['user_id']; // 🌟 เก็บไว้ log ว่าใครเป็นคนกดจอง (ต่างจากผู้ขับได้)

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$driverEmployeeId = isset($data['employee_id']) ? trim($data['employee_id']) : '';

if (!$data || empty($data['car_plate']) || empty($driverEmployeeId) || empty($data['time_slot'])) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

try {
    // 🌟 ตรวจรหัสพนักงานผู้ขับกับ DB จริงก่อนเสมอ (ห้ามเชื่อ driver_name จาก client)
    // ดึง Division/department/Unit ของผู้ขับมาเก็บด้วยเลย ไม่ต้องให้ฟอร์มเลือกเอง
    $empCheck = $conn->prepare(
        "SELECT first_name, last_name, Division, department, Unit FROM Users WHERE employee_id = :emp"
    );
    $empCheck->execute([':emp' => $driverEmployeeId]);
    $driverRow = $empCheck->fetch(PDO::FETCH_ASSOC);

    if (!$driverRow) {
        echo json_encode(["success" => false, "message" => "ไม่พบรหัสพนักงานผู้ขับนี้ในระบบ กรุณาตรวจสอบอีกครั้ง"]);
        exit;
    }
    $driverName = trim($driverRow['first_name'] . ' ' . $driverRow['last_name']);
    $department = trim(($driverRow['Division'] ?? '') . ' / ' . ($driverRow['department'] ?? '') . ' / ' . ($driverRow['Unit'] ?? ''));

    // 🌟 ช่วงเวลาแต่ละ slot -> เวลาเริ่ม/จบจริง ('กลางคืน' ข้ามเที่ยงคืนไปจบเช้าวันถัดไป)
    function getSlotRange($date, $slot) {
        $starts = ['เช้า' => '08:00', 'บ่าย' => '13:00', 'ทั้งวัน' => '08:00', 'กลางคืน' => '17:00'];
        $ends   = ['เช้า' => '12:00', 'บ่าย' => '17:00', 'ทั้งวัน' => '17:00', 'กลางคืน' => '08:00'];
        if (empty($date) || !isset($starts[$slot])) return null;
        $start = DateTime::createFromFormat('Y-m-d H:i', $date . ' ' . $starts[$slot]);
        $end   = DateTime::createFromFormat('Y-m-d H:i', $date . ' ' . $ends[$slot]);
        if (!$start || !$end) return null;
        if ($slot === 'กลางคืน') {
            $end->modify('+1 day'); // จบ 08:00 ของวันถัดไป
        }
        return [$start, $end];
    }

    function rangesOverlap($startA, $endA, $startB, $endB) {
        return $startA < $endB && $startB < $endA;
    }

    $requestedSlot = $data['time_slot'];
    $newRange = getSlotRange($data['use_date'] ?? '', $requestedSlot);

    if (!$newRange) {
        echo json_encode(["success" => false, "message" => "ช่วงเวลาไม่ถูกต้อง"]);
        exit;
    }
    [$newStart, $newEnd] = $newRange;

    // 🌟 เช็คสถานะรถก่อน ต้อง "ว่าง" เท่านั้นถึงจะจองได้
    $carCheck = $conn->prepare("SELECT CarStatus FROM Cars WHERE Plate = :plate");
    $carCheck->execute([':plate' => $data['car_plate']]);
    $carRow = $carCheck->fetch(PDO::FETCH_ASSOC);

    if (!$carRow || $carRow['CarStatus'] !== 'ว่าง') {
        echo json_encode(["success" => false, "message" => "รถคันนี้ไม่พร้อมให้จอง (สถานะ: " . ($carRow['CarStatus'] ?? 'ไม่พบข้อมูล') . ")"]);
        exit;
    }

    // 🌟 กันจองช่วงเวลาที่ผ่านมาแล้ว (validate ฝั่ง server กันเคส bypass frontend)
    if ($newEnd < new DateTime()) {
        echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกวันที่หรือช่วงเวลาใหม่"]);
        exit;
    }

    // ดึง booking ที่ยังไม่คืน (BookingStatus='ขาไป') ในช่วง ±1 วันจากวันที่จอง (พอสำหรับ slot ข้ามเที่ยงคืน)
    $dMinus = (clone $newStart)->modify('-1 day')->format('Y-m-d');
    $dPlus  = (clone $newStart)->modify('+1 day')->format('Y-m-d');

    // 🩹 เช็คฝั่งรถ: คันนี้มี booking ที่เวลาชนกับที่จะจองใหม่ไหม
    $carBookings = $conn->prepare(
        "SELECT BookingDate, TimeSlot FROM CarBookings
         WHERE CarPlate = :plate AND BookingStatus = 'ขาไป'
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $carBookings->execute([':plate' => $data['car_plate'], ':d1' => $dMinus, ':d2' => $dPlus]);
    foreach ($carBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $range = getSlotRange($row['BookingDate'], $row['TimeSlot']);
        if ($range && rangesOverlap($newStart, $newEnd, $range[0], $range[1])) {
            echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น"]);
            exit;
        }
    }

    // 🩹 เช็คฝั่งคน: ผู้ขับคนนี้ (ตาม employee_id ที่ validate แล้ว) มี booking เวลาชนไหม (คันไหนก็ได้)
    $empBookings = $conn->prepare(
        "SELECT BookingDate, TimeSlot FROM CarBookings
         WHERE EmployeeID = :emp AND BookingStatus = 'ขาไป'
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $empBookings->execute([':emp' => $driverEmployeeId, ':d1' => $dMinus, ':d2' => $dPlus]);
    foreach ($empBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $range = getSlotRange($row['BookingDate'], $row['TimeSlot']);
        if ($range && rangesOverlap($newStart, $newEnd, $range[0], $range[1])) {
            echo json_encode(["success" => false, "message" => "ผู้ขับคนนี้มีการจองที่เวลาชนกับช่วงนี้อยู่แล้ว"]);
            exit;
        }
    }

    // 🌟 ผู้ร่วมทาง (ไม่บังคับ) - ถ้ามีรหัสส่งมา ตรวจว่ามีจริงใน DB เหมือนกัน กันข้อมูลขยะปนเข้าไป
    // (ไม่ block การจองถ้ารหัสผิด แค่เก็บ "ไม่พบ" ต่อท้ายไว้เตือน Admin เห็นภายหลัง)
    $passengerIdsRaw = isset($data['passenger_ids']) ? trim($data['passenger_ids']) : '';
    $passengerNamesRaw = isset($data['passengers']) ? trim($data['passengers']) : '';

    $bookingNumber = 'BK-' . date('ymdHis');

    $sql = "INSERT INTO CarBookings 
        (BookingNumber, DriverName, EmployeeID, Department, Destination, CarPlate, StartMileage, Passengers, PassengerIDs, OutDate, BookingStatus, BookingDate, TimeSlot, BookedByUserID)
        VALUES 
        (:booking_number, :driver_name, :employee_id, :department, :destination, :car_plate, :start_mileage, :passengers, :passenger_ids, :out_date, 'ขาไป', :booking_date, :time_slot, :booked_by)";
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':booking_number' => $bookingNumber,
        ':driver_name'    => $driverName,        // 🌟 มาจาก DB ตาม employee_id ที่ validate แล้ว ไม่ใช่จาก client
        ':employee_id'    => $driverEmployeeId,
        ':department'     => $department,        // 🌟 มาจาก DB ของผู้ขับเอง ไม่ต้องเลือกในฟอร์มแล้ว
        ':destination'    => $data['destination'] ?? null,
        ':car_plate'      => $data['car_plate'],
        ':start_mileage'  => $data['start_mile'] ?? 0,
        ':passengers'     => $passengerNamesRaw ?: null,
        ':passenger_ids'  => $passengerIdsRaw ?: null,
        ':out_date'       => $data['use_date'] ?? null,
        ':booking_date'   => $data['use_date'] ?? null,
        ':time_slot'      => $data['time_slot'] ?? null,
        ':booked_by'      => $bookedByUserId,    // 🌟 ใหม่: เก็บไว้ว่าใคร (login) เป็นคนกดจอง แยกจากผู้ขับ
    ]);
    echo json_encode(["success" => true, "booking_number" => $bookingNumber]);
} catch (PDOException $e) {
    error_log('save_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}