<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['car_plate']) || empty($data['driver_name']) || empty($data['time_slot'])) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}


try {
    // 🌟 เช็คสถานะรถก่อน ต้อง "ว่าง" เท่านั้นถึงจะจองได้
    $carCheck = $conn->prepare("SELECT CarStatus FROM Cars WHERE Plate = :plate");
    $carCheck->execute([':plate' => $data['car_plate']]);
    $carRow = $carCheck->fetch(PDO::FETCH_ASSOC);

    if (!$carRow || $carRow['CarStatus'] !== 'ว่าง') {
        echo json_encode(["success" => false, "message" => "รถคันนี้ไม่พร้อมให้จอง (สถานะ: " . ($carRow['CarStatus'] ?? 'ไม่พบข้อมูล') . ")"]);
        exit;
    }

    $requestedSlot = $data['time_slot'];

    // 🌟 กำหนดว่า slot ที่ขอจอง จะไปชนกับ slot ไหนบ้างที่มีอยู่แล้ว
    if ($requestedSlot === 'ทั้งวัน') {
        // จองทั้งวัน ชนกับทุก slot ที่มีอยู่ในวันนั้น (เช้า, บ่าย, หรือทั้งวันเดิม)
        $conflictSlots = ['เช้า', 'บ่าย', 'ทั้งวัน'];
    } else {
        // จองเช้า/บ่าย ชนกับ slot เดียวกัน หรือถ้ามี "ทั้งวัน" จองไว้แล้วก็ชนด้วย
        $conflictSlots = [$requestedSlot, 'ทั้งวัน'];
    }

    $placeholders = implode(',', array_fill(0, count($conflictSlots), '?'));
    // เดิมกันแค่ 'ยกเลิก' ออก ทำให้ booking ที่คืนแล้ว (BookingStatus='ขากลับ')
    // ยังถูกนับว่าชนกับการจองใหม่ จองซ้ำไม่ได้ทั้งที่รถว่างแล้วจริง ๆ
    // แก้ให้เช็คว่า "ยังใช้อยู่จริง" (BookingStatus = 'ขาไป') เท่านั้นถึงจะถือว่าชน
    $sql_check = "SELECT COUNT(*) as total FROM CarBookings 
                  WHERE CarPlate = ? AND BookingDate = ? AND TimeSlot IN ($placeholders)
                  AND BookingStatus = 'ขาไป'";

    $params_check = array_merge([$data['car_plate'], $data['use_date']], $conflictSlots);
    $check = $conn->prepare($sql_check);
    $check->execute($params_check);
    $exists = $check->fetch(PDO::FETCH_ASSOC)['total'];

    if ($exists > 0) {
        echo json_encode(["success" => false, "message" => "ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น"]);
        exit;
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
        ':employee_id'    => $data['employee_id'] ?? null,
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