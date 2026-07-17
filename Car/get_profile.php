<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT id, username, first_name, last_name, phone, email, employee_id, department, role, AvatarPath FROM Users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลผู้ใช้"]);
        exit;
    }

    $stmt2 = $conn->prepare("SELECT COUNT(*) as total FROM CarBookings WHERE EmployeeID = :emp_id");
    $stmt2->execute([':emp_id' => $user['employee_id']]);
    $user['total_bookings'] = $stmt2->fetch(PDO::FETCH_ASSOC)['total'];

    $stmt3 = $conn->prepare("SELECT COUNT(*) as done FROM CarBookings WHERE EmployeeID = :emp_id AND BookingStatus = 'ขากลับ'");
    $stmt3->execute([':emp_id' => $user['employee_id']]);
    $user['completed_bookings'] = $stmt3->fetch(PDO::FETCH_ASSOC)['done'];

    echo json_encode(["success" => true, "user" => $user]);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}