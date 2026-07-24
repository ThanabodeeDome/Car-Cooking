<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🩹 บังคับ login ก่อน + ดึง employee_id จาก session เอง ห้ามเชื่อค่าที่ client ส่งมา
// (เดิมรับ $data['employee_id'] ตรงๆ ใครก็ปลอมรหัสคนอื่นจองแทนได้)
if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อนทำการจอง"]);
    exit;
}
$sessionEmployeeId = $_SESSION['employee_id'];

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['car_plate']) || empty($data['driver_name']) || empty($data['time_slot'])) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}


try {
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

    // 🩹 เช็คฝั่งรถ: คันนี้มี booking ที่เวลาชนกับที่จะจองใหม่ไหม (เทียบเวลาจริง แทนเทียบชื่อ slot ตรงๆ
    // เพื่อรองรับ 'กลางคืน' ที่ข้ามเที่ยงคืน และให้จองคนละช่วงเวลาวันเดียวกันได้โดยไม่ชนกัน)
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

    // 🩹 เช็คฝั่งคน: employee คนนี้มี booking ที่เวลาชนกับที่จะจองใหม่ไหม (คันไหนก็ได้)
    // ต่างจากเดิมที่บล็อกทันทีถ้ามี 'ขาไป' ค้างอยู่ ไม่ว่าจะคนละช่วงเวลาแค่ไหนก็ตาม
    // ตอนนี้บล็อกเฉพาะที่ "เวลาชนกันจริง" เท่านั้น จองเช้า+บ่ายวันเดียวกันล่วงหน้าได้แล้ว
    $empBookings = $conn->prepare(
        "SELECT BookingDate, TimeSlot FROM CarBookings
         WHERE EmployeeID = :emp AND BookingStatus = 'ขาไป'
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $empBookings->execute([':emp' => $sessionEmployeeId, ':d1' => $dMinus, ':d2' => $dPlus]);
    foreach ($empBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $range = getSlotRange($row['BookingDate'], $row['TimeSlot']);
        if ($range && rangesOverlap($newStart, $newEnd, $range[0], $range[1])) {
            echo json_encode(["success" => false, "message" => "คุณมีการจองที่เวลาชนกับช่วงนี้อยู่แล้ว"]);
            exit;
        }
    }

    $department = trim(($data['main_dept'] ?? '') . ' / ' . ($data['sub_dept'] ?? '') . ' / ' . ($data['section'] ?? ''));
    $bookingNumber = 'BK-' . date('ymdHis');

    $sql = "INSERT INTO CarBookings 
        (BookingNumber, DriverName, EmployeeID, Department, Destination, CarPlate, StartMileage, Passengers, PassengerIDs, OutDate, JobDetail, OutRemark, BookingStatus, BookingDate, TimeSlot)
        VALUES 
        (:booking_number, :driver_name, :employee_id, :department, :destination, :car_plate, :start_mileage, :passengers, :passenger_ids, :out_date, :job_detail, :out_remark, 'ขาไป', :booking_date, :time_slot)";
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':booking_number' => $bookingNumber,
        ':driver_name'    => $data['driver_name'],
        ':employee_id'    => $sessionEmployeeId,
        ':department'     => $department,
        ':destination'    => $data['destination'] ?? null,
        ':car_plate'      => $data['car_plate'],
        ':start_mileage'  => $data['start_mile'] ?? 0,
        ':passengers'     => $data['passengers'] ?? null,
        ':passenger_ids'  => $data['passenger_ids'] ?? null,
        ':out_date'       => $data['use_date'] ?? null,
        ':job_detail'     => $data['work_type'] ?? null,
        ':out_remark'     => $data['out_remark'] ?? null,
        ':booking_date'   => $data['use_date'] ?? null,
        ':time_slot'      => $data['time_slot'] ?? null,
    ]);
    echo json_encode(["success" => true, "booking_number" => $bookingNumber]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}