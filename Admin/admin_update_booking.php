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
    $timeSlot    = $data['time_slot']    ?? $booking['TimeSlot'];
    $destination = $data['destination']  ?? $booking['Destination'];
    $startMile   = isset($data['start_mileage']) && $data['start_mileage'] !== '' ? (int)$data['start_mileage'] : $booking['StartMileage'];
    $endMile     = isset($data['end_mileage']) && $data['end_mileage'] !== '' ? (int)$data['end_mileage'] : $booking['EndMileage'];
    $status      = $data['booking_status'] ?? $booking['BookingStatus'];

    $allowedStatuses = ['ขาไป', 'ขากลับ', 'ยกเลิก', 'ยกเลิก (ไม่มาใช้งาน)'];
    if (!in_array($status, $allowedStatuses, true)) {
        $status = $booking['BookingStatus'];
    }

    $update = $conn->prepare(
        "UPDATE CarBookings SET
            EmployeeID = :employee_id,
            DriverName = :driver_name,
            Department = :department,
            CarPlate = :car_plate,
            BookingDate = :booking_date,
            TimeSlot = :time_slot,
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
        ':time_slot'     => $timeSlot,
        ':destination'   => $destination,
        ':start_mileage' => $startMile,
        ':end_mileage'   => $endMile,
        ':status'        => $status,
        ':id'            => $bookingId,
    ]);

    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('admin_update_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้"]);
}