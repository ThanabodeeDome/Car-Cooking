<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['booking_id'])) {
    echo json_encode(["success" => false, "message" => "ไม่พบรายการ"]);
    exit;
}

try {
    $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = 'ยกเลิก' WHERE BookingID = :id");
    $stmt->execute([':id' => $data['booking_id']]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('admin_cancel_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถยกเลิกการจองได้"]);
}