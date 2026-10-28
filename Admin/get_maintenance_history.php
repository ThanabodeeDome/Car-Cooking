<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

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

    $cs = $conn->prepare("SELECT CarStatus, Mileage, CONVERT(varchar(10), MaintenanceEndDate, 23) AS until FROM Cars WHERE CarID = :c");
    $cs->execute([':c' => $carId]);
    $car = $cs->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($car) $car = ['status' => $car['CarStatus'], 'until' => $car['until'], 'mileage' => $car['Mileage'] !== null ? (int)$car['Mileage'] : null];
    echo json_encode(["success" => true, "history" => $rows, "car" => $car], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_maintenance_history DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดประวัติซ่อมบำรุง"]);
}