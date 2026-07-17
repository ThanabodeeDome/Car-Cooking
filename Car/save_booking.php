<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['car_plate']) || empty($data['driver_name'])) {
    echo json_encode(["success" => false, "message" => "ข้อมูลไม่ครบ"]);
    exit;
}

$department = trim(($data['main_dept'] ?? '') . ' / ' . ($data['sub_dept'] ?? '') . ' / ' . ($data['section'] ?? ''));
$bookingNumber = 'BK-' . date('ymdHis');

try {
    $sql = "INSERT INTO CarBookings 
            (BookingNumber, DriverName, EmployeeID, Department, Destination, CarPlate, StartMileage, Passengers, OutDate, OutTime, JobDetail, OutRemark, BookingStatus)
            VALUES 
            (:booking_number, :driver_name, :employee_id, :department, :destination, :car_plate, :start_mileage, :passengers, :out_date, :out_time, :job_detail, :out_remark, 'ขาไป')";
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
        ':out_date'       => $data['use_date'] ?? null,
        ':out_time'       => $data['out_time'] ?? null,
        ':job_detail'     => $data['work_type'] ?? null,
        ':out_remark'     => $data['out_remark'] ?? null,
    ]);
    echo json_encode(["success" => true, "booking_number" => $bookingNumber]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}