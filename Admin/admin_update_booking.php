<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

$bookingId = isset($data['booking_id']) ? trim($data['booking_id']) : '';
if (empty($bookingId)) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการจองนี้"]);
    exit;
}

try {
    $existing = $conn->prepare("SELECT * FROM CarBookings WHERE BookingID = :id");
    $existing->execute([':id' => $bookingId]);
    $booking = $existing->fetch(PDO::FETCH_ASSOC);

    if (!$booking) {
        echo json_encode(["success" => false, "message" => "ไม่พบรายการจองนี้"]);
        exit;
    }

    // 🌟 ถ้าแอดมินเปลี่ยนรหัสพนักงานผู้ขับ -> validate กับ DB จริง แล้วดึงชื่อ+หน่วยงานใหม่มาแทนอัตโนมัติ
    // (เหมือนกับตอนจองปกติ กันแอดมินพิมพ์ชื่อ/หน่วยงานเองมั่วไม่ตรงกับรหัสพนักงานจริง)
    $employeeId = isset($data['employee_id']) ? trim($data['employee_id']) : $booking['EmployeeID'];
    $driverName = $booking['DriverName'];
    $department = $booking['Department'];

    if ($employeeId !== $booking['EmployeeID']) {
        $empCheck = $conn->prepare(
            "SELECT first_name, last_name, Division, department, Unit FROM Users WHERE employee_id = :emp"
        );
        $empCheck->execute([':emp' => $employeeId]);
        $empRow = $empCheck->fetch(PDO::FETCH_ASSOC);

        if (!$empRow) {
            echo json_encode(["success" => false, "message" => "ไม่พบรหัสพนักงานนี้ในระบบ"]);
            exit;
        }
        $driverName = trim($empRow['first_name'] . ' ' . $empRow['last_name']);
        $department = trim(($empRow['Division'] ?? '') . ' / ' . ($empRow['department'] ?? '') . ' / ' . ($empRow['Unit'] ?? ''));
    }

    // 🌟 ฟิลด์อื่นๆ แก้ได้อิสระ ไม่บังคับกรอกครบ (เผื่อแก้แค่บางช่อง)
    $carPlate    = $data['car_plate']    ?? $booking['CarPlate'];
    $bookingDate = $data['booking_date'] ?? $booking['BookingDate'];
    // 🩹 FIX: ระบบจองเปลี่ยนมาใช้เวลาอิสระ (OutTime/PlannedReturnTime) แทน TimeSlot คงที่แล้ว
    // เดิม endpoint นี้ยัง update แค่คอลัมน์ TimeSlot ซึ่งไม่มีผลกับเวลาที่แสดงจริงอีกต่อไป
    $outTime = isset($data['out_time']) && $data['out_time'] !== '' ? $data['out_time'] : $booking['OutTime'];
    $plannedReturnTime = isset($data['planned_return_time']) && $data['planned_return_time'] !== ''
        ? $data['planned_return_time']
        : $booking['PlannedReturnTime'];
    $destination = $data['destination']  ?? $booking['Destination'];

    // ตรวจรูปแบบวันที่/เวลา (กันค่าเพี้ยนลง DB)
    $bookingDateStr = substr((string)$bookingDate, 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $bookingDateStr) || !strtotime($bookingDateStr)) {
        echo json_encode(["success" => false, "message" => "รูปแบบวันที่ไม่ถูกต้อง"]);
        exit;
    }
    $bookingDate = $bookingDateStr;
    foreach ([$outTime, $plannedReturnTime] as $t) {
        if ($t !== null && $t !== '' && !preg_match('/^\d{2}:\d{2}(:\d{2})?/', (string)$t)) {
            echo json_encode(["success" => false, "message" => "รูปแบบเวลาไม่ถูกต้อง"]);
            exit;
        }
    }
    $startMile   = isset($data['start_mileage']) && $data['start_mileage'] !== '' ? (int)$data['start_mileage'] : $booking['StartMileage'];
    $endMile     = isset($data['end_mileage']) && $data['end_mileage'] !== '' ? (int)$data['end_mileage'] : $booking['EndMileage'];
    $status      = $data['booking_status'] ?? $booking['BookingStatus'];

    // สถานะจริงในระบบ (เดิมมี 'ขากลับ' ซึ่งไม่ใช่สถานะจริง ทำให้ตั้ง จองแล้ว/คืนแล้ว ไม่ได้)
    $allowedStatuses = ['จองแล้ว', 'ขาไป', 'คืนแล้ว', 'ยกเลิก', 'ยกเลิก (ไม่มาใช้งาน)'];
    if (!in_array($status, $allowedStatuses, true)) {
        $status = $booking['BookingStatus'];
    }

    // 🩹 FIX: endpoint นี้เดิมไม่เช็คชนเวลาเลย แอดมินแก้ทะเบียน/วันที่/เวลาตรงๆ
    // สร้างการจองซ้อนกันเงียบๆ ได้ (ต่างจาก save_booking.php ฝั่งผู้ใช้ปกติที่ล็อก+เช็คไว้แล้ว)
    // เช็คเฉพาะตอนสถานะใหม่ยังนับเป็น "ใช้งานอยู่" เท่านั้น ถ้าแอดมินกำลังยกเลิกไม่ต้องเช็ค (คืนคิวให้คันนี้)
    $activeStatuses = ['จองแล้ว', 'ขาไป'];
    $newStart = null;
    $newEnd = null;
    if (in_array($status, $activeStatuses, true) && $outTime && $plannedReturnTime) {
        $newStart = DateTime::createFromFormat('Y-m-d H:i', $bookingDate . ' ' . substr($outTime, 0, 5));
        $newEnd   = DateTime::createFromFormat('Y-m-d H:i', $bookingDate . ' ' . substr($plannedReturnTime, 0, 5));
        if ($newStart && $newEnd && substr($plannedReturnTime, 0, 5) <= substr($outTime, 0, 5)) {
            $newEnd->modify('+1 day');
        }
    }

    function rangesOverlapAdmin($startA, $endA, $startB, $endB) {
        return $startA < $endB && $startB < $endA;
    }

    $conn->beginTransaction();
    try {
        if ($newStart && $newEnd) {
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

            $dMinus = (clone $newStart)->modify('-1 day')->format('Y-m-d');
            $dPlus  = (clone $newStart)->modify('+1 day')->format('Y-m-d');

            $carBookings = $conn->prepare(
                "SELECT BookingID, BookingDate, OutTime, PlannedReturnTime FROM CarBookings WITH (UPDLOCK, HOLDLOCK)
                 WHERE CarPlate = :plate AND BookingStatus IN ('จองแล้ว', 'ขาไป')
                   AND BookingID <> :id
                   AND BookingDate BETWEEN :d1 AND :d2"
            );
            $carBookings->execute([':plate' => $carPlate, ':id' => $bookingId, ':d1' => $dMinus, ':d2' => $dPlus]);
            foreach ($carBookings->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $rOut = substr($row['OutTime'], 0, 5);
                $rRet = substr($row['PlannedReturnTime'], 0, 5);
                if (!$rOut || !$rRet) continue;
                $rStart = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rOut);
                $rEnd   = DateTime::createFromFormat('Y-m-d H:i', $row['BookingDate'] . ' ' . $rRet);
                if (!$rStart || !$rEnd) continue;
                if ($rRet <= $rOut) $rEnd->modify('+1 day');

                if (rangesOverlapAdmin($newStart, $newEnd, $rStart, $rEnd)) {
                    $conn->rollBack();
                    echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น"]);
                    exit;
                }
            }
        }

        $update = $conn->prepare(
            "UPDATE CarBookings SET
                EmployeeID = :employee_id,
                DriverName = :driver_name,
                Department = :department,
                CarPlate = :car_plate,
                BookingDate = :booking_date,
                OutTime = :out_time,
                PlannedReturnTime = :planned_return_time,
                Destination = :destination,
                StartMileage = :start_mileage,
                EndMileage = :end_mileage,
                BookingStatus = :status
             WHERE BookingID = :id"
        );
        $update->execute([
            ':employee_id'   => $employeeId,
            ':driver_name'   => $driverName,
            ':department'    => $department,
            ':car_plate'     => $carPlate,
            ':booking_date'  => $bookingDate,
            ':out_time'      => $outTime,
            ':planned_return_time' => $plannedReturnTime,
            ':destination'   => $destination,
            ':start_mileage' => $startMile,
            ':end_mileage'   => $endMile,
            ':status'        => $status,
            ':id'            => $bookingId,
        ]);

        $conn->commit();
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log('admin_update_booking DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้"]);
    }
} catch (PDOException $e) {
    error_log('admin_update_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้"]);
}