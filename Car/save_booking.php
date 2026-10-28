<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อนทำการจอง"]);
    exit;
}
$bookedByUserId = $_SESSION['user_id'];

require_once __DIR__ . '/../same_origin.php';
require_same_origin();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
if (!is_array($data)) $data = [];

// 🔒 รับเฉพาะค่า string (กันส่ง array/object มาทำ trim() พังเป็น error 500) และตัดให้พอดีคอลัมน์ใน DB
require_once __DIR__ . '/text_util.php';
$str = function ($key, $max) use ($data) {
    return isset($data[$key]) && is_scalar($data[$key]) ? fit_nvarchar(trim((string)$data[$key]), $max) : '';
};
$carPlate = $str('car_plate', 50);
$driverEmployeeId = $str('employee_id', 20);
$outTime = $str('out_time', 5);
$plannedReturnTime = $str('planned_return_time', 5);
$useDate = $str('use_date', 10);
$destination = $str('destination', 255);

if (!$data || $carPlate === '' || empty($driverEmployeeId) || empty($outTime) || empty($plannedReturnTime) || empty($useDate)) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

// 🌟 REDESIGN: เวลาไป-กลับตอนนี้เป็นเวลาอิสระ 24 ชม. (ไม่ใช่ 4 slot คงที่แบบเดิม)
// คำนวณช่วง start/end จริงตรงๆ จาก out_time / planned_return_time ที่ผู้ใช้เลือก
// ถ้าเวลากลับ <= เวลาไป ถือว่าข้ามคืน จบเช้าวันถัดไป (logic เดียวกับที่ 'กลางคืน' เคยทำ)
// 🔒 บังคับรูปแบบ HH:MM / YYYY-MM-DD เป๊ะๆ — เดิม "9:00" หรือ "25:00" / "2026-02-31" ผ่านได้
// (createFromFormat ปัดเลขเกินไปวันถัดไปเงียบๆ และการเทียบ string "9:00" > "10:00" ทำให้ตรวจข้ามคืน/ชนเวลาผิด)
$newStart = DateTime::createFromFormat('!Y-m-d H:i', $useDate . ' ' . $outTime);
$newEnd   = DateTime::createFromFormat('!Y-m-d H:i', $useDate . ' ' . $plannedReturnTime);

if (!$newStart || !$newEnd
    || $newStart->format('Y-m-d H:i') !== $useDate . ' ' . $outTime
    || $newEnd->format('Y-m-d H:i') !== $useDate . ' ' . $plannedReturnTime) {
    echo json_encode(["success" => false, "message" => "รูปแบบเวลาไม่ถูกต้อง"]);
    exit;
}
// 🔒 เวลาไป = เวลากลับ เดิมถูกตีความเป็นจอง 24 ชม. (ข้ามคืน) — มักเกิดจากเลือกผิด แล้วล็อกรถทั้งวัน
if ($plannedReturnTime === $outTime) {
    echo json_encode(["success" => false, "message" => "เวลาไปและเวลากลับต้องไม่ใช่เวลาเดียวกัน"]);
    exit;
}
if ($plannedReturnTime < $outTime) {
    $newEnd->modify('+1 day'); // ข้ามคืน
}

function rangesOverlap($startA, $endA, $startB, $endB) {
    return $startA < $endB && $startB < $endA;
}

// 🌟 กันจองช่วงเวลาที่ผ่านมาแล้ว (validate ฝั่ง server กันเคส bypass frontend)
require_once __DIR__ . '/checkin_rules.php';
if ($newStart > (new DateTime())->modify('+' . BOOKING_MAX_DAYS_AHEAD . ' days')) {
    echo json_encode(["success" => false, "message" => "จองล่วงหน้าได้ไม่เกิน " . BOOKING_MAX_DAYS_AHEAD . " วัน กรุณาเลือกวันที่ใหม่"]);
    exit;
}
if ($newEnd < new DateTime()) {
    echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกวันที่หรือเวลาใหม่"]);
    exit;
}

$conn->beginTransaction();
try {
    // 🌟 ล็อกคิวตามทะเบียนรถก่อน กัน race condition ตอน 2 คนกดจองพร้อมกัน (จากรอบก่อนหน้า)
    $lockResource = 'car_booking_' . $carPlate;
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

    $carCheck = $conn->prepare("SELECT CarStatus, Mileage, CONVERT(varchar(10), MaintenanceEndDate, 23) AS ServiceUntil FROM Cars WHERE Plate = :plate");
    $carCheck->execute([':plate' => $carPlate]);
    $carRow = $carCheck->fetch(PDO::FETCH_ASSOC);

    // รถเช็คระยะ/ซ่อมที่ระบุวันเสร็จไว้ จองล่วงหน้าได้ตั้งแต่วันเสร็จ (ยกเว้นวันนี้ที่ต้องรอแอดมินยืนยันรถพร้อม)
    $svcOk = $carRow && $carRow['CarStatus'] === 'เช็คระยะ' && !empty($carRow['ServiceUntil'])
          && $useDate >= $carRow['ServiceUntil'] && $useDate > date('Y-m-d');
    if (!$carRow || ($carRow['CarStatus'] !== 'ว่าง' && !$svcOk)) {
        $conn->rollBack();
        $why = ($carRow && $carRow['CarStatus'] === 'เช็คระยะ')
            ? 'รถกำลังเช็คระยะ/ซ่อม' . (!empty($carRow['ServiceUntil']) ? ' คาดว่าพร้อมใช้ ' . $carRow['ServiceUntil'] : ' (ยังไม่ระบุวันเสร็จ)')
            : 'สถานะ: ' . ($carRow['CarStatus'] ?? 'ไม่พบข้อมูล');
        echo json_encode(["success" => false, "message" => "รถคันนี้ไม่พร้อมให้จองในวันที่เลือก ($why)"], JSON_UNESCAPED_UNICODE);
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
    $carBookings->execute([':plate' => $carPlate, ':d1' => $dMinus, ':d2' => $dPlus]);
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

    $passengerIdsRaw = $str('passenger_ids', 1000);
    // คอลัมน์ PassengerIDs เก็บได้ 255 ตัวอักษร (ประมาณ 40 คน) เกินแล้ว DB error -> แจ้งให้เข้าใจแทน (ไม่ตัดทิ้งเงียบๆ)
    if (mb_strlen($passengerIdsRaw) > 255) {
        $conn->rollBack();
        echo json_encode(["success" => false, "message" => "ผู้ร่วมเดินทางมากเกินไป (สูงสุดประมาณ 40 คนต่อการจอง)"]);
        exit;
    }
    $passengerNamesRaw = $str('passengers', 1000);

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
        ':destination'    => $destination !== '' ? $destination : null,
        ':car_plate'      => $carPlate,
        ':start_mileage'  => (int)($carRow['Mileage'] ?? 0), // ใช้ไมล์ล่าสุดของรถจาก DB ไม่เชื่อค่าที่ client ส่งมา (กันกรอกไมล์เริ่มต้นปลอม)
        ':passengers'     => $passengerNamesRaw ?: null,
        ':passenger_ids'  => $passengerIdsRaw ?: null,
        ':out_date'       => $useDate,
        ':out_time'       => $outTime,
        ':planned_return_time' => $plannedReturnTime,
        ':booking_date'   => $useDate,
        ':booked_by'      => $bookedByUserId,
    ]);

    $newBookingId = (int)$conn->lastInsertId();
    $conn->commit();

    // booking_id = "รหัสจอง" สั้นๆ ที่ผู้ขับบอก รปภ. ตอนคืนรถ (เลขที่ BK-... ยาวเกินกว่าจะบอกปากเปล่า)
    echo json_encode(["success" => true, "booking_number" => $bookingNumber, "booking_id" => $newBookingId]);

    // 📝 บันทึกระบบ: จองรถ (ผู้จอง = คนที่ล็อกอิน, ผู้ขับอาจเป็นคนอื่นถ้าจองแทน)
    require_once __DIR__ . '/log_lib.php';
    sl_log($conn, 'booking_create', "จอง $carPlate วันที่ $useDate $outTime-$plannedReturnTime ผู้ขับ $driverName", [
        'target_type' => 'booking', 'target' => $bookingNumber,
        'detail' => ['driver_emp' => $driverEmployeeId, 'destination' => $destination, 'booked_for_other' => ($driverEmployeeId !== (string)($_SESSION['employee_id'] ?? ''))],
    ]);

    // อีเมลยืนยัน (ฟรี ผ่าน SMTP) — ส่งแยก process เบื้องหลัง ไม่ให้หน้าจองรอ SMTP (พลาดก็ไม่กระทบการจอง)
    require_once __DIR__ . '/mailer.php';
    $mailData = [
        'booking_number' => $bookingNumber, 'car_plate' => $carPlate, 'use_date' => $useDate,
        'out_time' => $outTime, 'planned_return_time' => $plannedReturnTime, 'driver_name' => $driverName,
        'destination' => $destination, 'employee_id' => $driverEmployeeId, 'passenger_ids' => $passengerIdsRaw,
    ];
    if (!empty(mail_cfg()['enabled'])) {
        $spawned = false;
        if (function_exists('popen')) {
            $dir = dirname(PHP_BINARY);
            $cli = is_file($dir . DIRECTORY_SEPARATOR . 'php-win.exe') ? $dir . DIRECTORY_SEPARATOR . 'php-win.exe'
                 : (is_file($dir . DIRECTORY_SEPARATOR . 'php.exe') ? $dir . DIRECTORY_SEPARATOR . 'php.exe' : '');
            if ($cli !== '' && DIRECTORY_SEPARATOR === '\\') {
                $cmd = 'start "" /B "' . $cli . '" "' . __DIR__ . '\\mail_job.php" ' . base64_encode(json_encode($mailData, JSON_UNESCAPED_UNICODE));
                $h = @popen($cmd, 'r');
                if ($h !== false) { pclose($h); $spawned = true; }
            }
        }
        if (!$spawned) mail_booking_confirmation($conn, $mailData); // ไม่ได้ (เช่น ไม่ใช่ Windows) ส่งตรงเหมือนเดิม
    }
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    error_log('save_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}