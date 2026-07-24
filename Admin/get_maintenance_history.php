<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

$allowed_admin_ids = require __DIR__ . '/../admin_whitelist.php';
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin' || !in_array((int)$_SESSION['user_id'], $allowed_admin_ids, true)) {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

$carId = $_GET['car_id'] ?? 0;
if (empty($carId)) {
    echo json_encode(["success" => false, "message" => "ไม่พบ CarID"]);
    exit;
}

try {
    $stmt = $conn->prepare(
        "SELECT MaintenanceID, CarID, MaintenanceType, StartDate, EndDate,
                Mileage, Cost, Note, NextDueDate, CreatedBy, CreatedAt
         FROM MaintenanceHistory
         WHERE CarID = :car_id
         ORDER BY StartDate DESC"
    );
    $stmt->execute([':car_id' => $carId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "history" => $rows]);
} catch (PDOException $e) {
    error_log('get_maintenance_history DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดประวัติซ่อมบำรุง"]);
}