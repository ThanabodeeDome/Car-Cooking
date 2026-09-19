<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อนทำการจอง"]);
    exit;
}
$bookedByUserId = $_SESSION['user_id'];

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$driverEmployeeId = isset($data['employee_id']) ? trim($data['employee_id']) : '';
$outTime = isset($data['out_time']) ? trim($data['out_time']) : '';
$plannedReturnTime = isset($data['planned_return_time']) ? trim($data['planned_return_time']) : '';
$useDate = isset($data['use_date']) ? trim($data['use_date']) : '';

if (!$data || empty($data['car_plate']) || empty($driverEmployeeId) || empty($outTime) || empty($plannedReturnTime) || empty($useDate)) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

// 🌟 REDESIGN: เวลาไป-กลับตอนนี้เป็นเวลาอิสระ 24 ชม. (ไม่ใช่ 4 slot คงที่แบบเดิม)
// คำนวณช่วง start/end จริงตรงๆ จาก out_time / planned_return_time ที่ผู้ใช้เลือก
// ถ้าเวลากลับ <= เวลาไป ถือว่าข้ามคืน จบเช้าวันถัดไป (logic เดียวกับที่ 'กลางคืน' เคยทำ)
$newStart = DateTime::createFromFormat('Y-m-d H:i', $useDate . ' ' . $outTime);
$newEnd   = DateTime::createFromFormat('Y-m-d H:i', $useDate . ' ' . $plannedReturnTime);

if (!$newStart || !$newEnd) {
    echo json_encode(["success" => false, "message" => "รูปแบบเวลาไม่ถูกต้อง"]);
    exit;
}
if ($plannedReturnTime <= $outTime) {
    $newEnd->modify('+1 day'); // ข้ามคืน
}

function rangesOverlap($startA, $endA, $startB, $endB) {
    return $startA < $endB && $startB < $endA;
}

// 🌟 กันจองช่วงเวลาที่ผ่านมาแล้ว (validate ฝั่ง server กันเคส bypass frontend)
if ($newEnd < new DateTime()) {
    echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกวันที่หรือเวลาใหม่"]);
    exit;
}

$conn->beginTransaction();
try {
    // 🌟 ล็อกคิวตามทะเบียนรถก่อน กัน race condition ตอน 2 คนกดจองพร้อมกัน (จากรอบก่อนหน้า)
    $lockResource = 'car_booking_' . $data['car_plate'];
    $lockStmt = $conn->prepare(
        "DECLARE @res INT;
         EXEC @res = sp_getapplock
            @Resource = :res,
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 10000;
         SELECT @res AS lockResult;"
    );
    $lockStmt->execute([':res' => $lockResource]);
    $lockRow = $lockStmt->fetch(PDO::FETCH_ASSOC);
    if (!$lockRow || (int)$lockRow['lockResult'] < 0) {
        $conn->rollBack();
        echo json_encode(["success" => false, "message" => "ระบบกำลังประมวลผลรายการจองรถคันนี้อยู่ กรุณาลองใหม่อีกครั้ง"]);
        exit;
    }

    $empCheck = $conn->prepare(
        "SELECT first_name, last_name, Division, department, Unit FROM Users WHERE employee_id = :emp"
    );
    $empCheck->execute([':emp' => $driverEmployeeId]);
    $driverRow = $empCheck->fetch(PDO::FETCH_ASSOC);

    if (!$driverRow) {
        $conn->rollBack();
        echo json_encode(["success" => false, "message" => "ไม่พบรหัสพนักงานผู้ขับนี้ในระบบ กรุณาตรวจสอบอีกครั้ง"]);
        exit;
    }
    $driverName = trim($driverRow['first_name'] . ' ' . $driverRow['last_name']);
    $department = trim(($driverRow['Division'] ?? '') . ' / ' . ($driverRow['department'] ?? '') . ' / ' . ($driverRow['Unit'] ?? ''));

    $carCheck = $conn->prepare("SELECT CarStatus FROM Cars WHERE Plate = :plate");
    $carCheck->execute([':plate' => $data['car_plate']]);
    $carRow = $carCheck->fetch(PDO::FETCH_ASSOC);

    if (!$carRow || $carRow['CarStatus'] !== 'ว่าง') {
        $conn->rollBack();
        echo json_encode(["success" => false, "message" => "รถคันนี้ไม่พร้อมให้จอง (สถานะ: " . ($carRow['CarStatus'] ?? 'ไม่พบข้อมูล') . ")"]);
        exit;
    }

    $dMinus = (clone $newStart)->modify('-1 day')->format('Y-m-d');
    $dPlus  = (clone $newStart)->modify('+1 day')->format('Y-m-d');

    // 🌟 ดึงช่วงเวลาที่จองไว้แล้วของรถคันนี้ (OutTime/PlannedReturnTime จริง ไม่ใช่ slot name)
    // แล้วคำนวณ end จริงของแต่ละแถวด้วย logic ข้ามคืนแบบเดียวกัน ก่อนเทียบ overlap
    $carBookings = $conn->prepare(
        "SELECT BookingDate, OutTime, PlannedReturnTime FROM CarBookings WITH (UPDLOCK, HOLDLOCK)
         WHERE CarPlate = :plate AND BookingStatus IN ('จองแล้ว', 'ขาไป')
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $carBookings->execute([':plate' => $data['car_plate'], ':d1' => $dMinus, ':d2' => $dPlus]);
    foreach ($carBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $rOut = substr($row['OutTime'], 0, 5);
        $rRet = substr($row['PlannedReturnTime'], 0, 5);
        if (!$rOut || !$rRet) continue; // แถวเก่าก่อนอัปเดตระบบ ยังไม่มีเวลาแบบใหม่ ข้ามไป
        $rStart = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rOut);
        $rEnd   = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rRet);
        if (!$rStart || !$rEnd) continue;
        if ($rRet <= $rOut) $rEnd->modify('+1 day');

        if (rangesOverlap($newStart, $newEnd, $rStart, $rEnd)) {
            $conn->rollBack();
            echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น"]);
            exit;
        }
    }

    $empBookings = $conn->prepare(
        "SELECT BookingDate, OutTime, PlannedReturnTime FROM CarBookings WITH (UPDLOCK, HOLDLOCK)
         WHERE EmployeeID = :emp AND BookingStatus IN ('จองแล้ว', 'ขาไป')
           AND BookingDate BETWEEN :d1 AND :d2"
    );
    $empBookings->execute([':emp' => $driverEmployeeId, ':d1' => $dMinus, ':d2' => $dPlus]);
    foreach ($empBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $rOut = substr($row['OutTime'], 0, 5);
        $rRet = substr($row['PlannedReturnTime'], 0, 5);
        if (!$rOut || !$rRet) continue;
        $rStart = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rOut);
        $rEnd   = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rRet);
        if (!$rStart || !$rEnd) continue;
        if ($rRet <= $rOut) $rEnd->modify('+1 day');

        if (rangesOverlap($newStart, $newEnd, $rStart, $rEnd)) {
            $conn->rollBack();
            echo json_encode(["success" => false, "message" => "ผู้ขับคนนี้มีการจองที่เวลาชนกับช่วงนี้อยู่แล้ว"]);
            exit;
        }
    }

    $passengerIdsRaw = isset($data['passenger_ids']) ? trim($data['passenger_ids']) : '';
    $passengerNamesRaw = isset($data['passengers']) ? trim($data['passengers']) : '';

    $bookingNumber = 'BK-' . date('ymdHis') . '-' . random_int(10, 99); // suffix กันเลขซ้ำเมื่อจองซ้ำหลายสัปดาห์ในวินาทีเดียวกัน

    // 🌟 บันทึก OutTime + PlannedReturnTime แทน TimeSlot (คอลัมน์ TimeSlot เดิมเว้นว่างไว้เฉยๆ
    // เผื่อยังมีโค้ด/รายงานอื่นอ้างอิงอยู่ ไม่ลบคอลัมน์ทิ้งเพื่อความปลอดภัย)
    $sql = "INSERT INTO CarBookings 
        (BookingNumber, DriverName, EmployeeID, Department, Destination, CarPlate, StartMileage, Passengers, PassengerIDs, OutDate, OutTime, PlannedReturnTime, BookingStatus, BookingDate, BookedByUserID)
        VALUES 
        (:booking_number, :driver_name, :employee_id, :department, :destination, :car_plate, :start_mileage, :passengers, :passenger_ids, :out_date, :out_time, :planned_return_time, 'จองแล้ว', :booking_date, :booked_by)";
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':booking_number' => $bookingNumber,
        ':driver_name'    => $driverName,
        ':employee_id'    => $driverEmployeeId,
        ':department'     => $department,
        ':destination'    => $data['destination'] ?? null,
        ':car_plate'      => $data['car_plate'],
        ':start_mileage'  => $data['start_mile'] ?? 0,
        ':passengers'     => $passengerNamesRaw ?: null,
        ':passenger_ids'  => $passengerIdsRaw ?: null,
        ':out_date'       => $useDate,
        ':out_time'       => $outTime,
        ':planned_return_time' => $plannedReturnTime,
        ':booking_date'   => $useDate,
        ':booked_by'      => $bookedByUserId,
    ]);

    $conn->commit();

    echo json_encode(["success" => true, "booking_number" => $bookingNumber]);

    // อีเมลยืนยัน (ฟรี ผ่าน SMTP) — ส่งหลังตอบ client แล้ว พลาดก็ไม่กระทบการจอง
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    require_once __DIR__ . '/mailer.php';
    mail_booking_confirmation($conn, [
        'booking_number' => $bookingNumber, 'car_plate' => $data['car_plate'], 'use_date' => $useDate,
        'out_time' => $outTime, 'planned_return_time' => $plannedReturnTime, 'driver_name' => $driverName,
        'destination' => $data['destination'] ?? '', 'employee_id' => $driverEmployeeId, 'passenger_ids' => $passengerIdsRaw,
    ]);
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('save_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}