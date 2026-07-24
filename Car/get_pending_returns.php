<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

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

    $sql = "SELECT BookingID, BookingNumber, CarPlate, StartMileage
            FROM CarBookings
            WHERE EmployeeID = :emp_id AND BookingStatus = 'ขาไป'
            ORDER BY BookingID DESC";
    $stmt2 = $conn->prepare($sql);
    $stmt2->execute([':emp_id' => $user['employee_id']]);
    $pending = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "pending" => $pending]);
} catch (PDOException $e) {
    error_log('get_pending_returns DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"]);
}