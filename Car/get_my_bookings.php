<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';
require_once 'auto_cancel_noshows.php';
autoCancelNoShows($conn);

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT employee_id FROM Users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลผู้ใช้"]);
        exit;
    }

    $sql = "SELECT BookingID, BookingNumber, DriverName, Department, Destination, CarPlate, 
                   StartMileage, Passengers, OutDate, OutTime, JobDetail, OutRemark, BookingStatus,
                   ReturnDate, ReturnTime, EndMileage, ReturnRemark
            FROM CarBookings
            WHERE EmployeeID = :emp_id
            ORDER BY BookingID DESC";
    $stmt2 = $conn->prepare($sql);
    $stmt2->execute([':emp_id' => $user['employee_id']]);
    $bookings = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "bookings" => $bookings]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}