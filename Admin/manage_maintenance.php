<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

$json = file_get_contents('php://input');
$data = json_decode($json, true) ?? [];
$action = $data['action'] ?? ($_GET['action'] ?? '');

// ---------- เพิ่ม record ซ่อม/เช็คระยะใหม่ ----------
if ($action === 'add') {
    $carId    = $data['car_id'] ?? 0;
    $type     = $data['maintenance_type'] ?? '';
    $start    = $data['start_date'] ?? null;
    $end      = !empty($data['end_date']) ? $data['end_date'] : null; // ว่าง = ยังซ่อมอยู่
    $mileage  = !empty($data['mileage']) ? $data['mileage'] : null;
    $cost     = !empty($data['cost']) ? $data['cost'] : null;
    $note     = $data['note'] ?? null;
    $nextDue  = !empty($data['next_due_date']) ? $data['next_due_date'] : null;

    if (empty($carId) || empty($start)) {
        echo json_encode(["success" => false, "message" => "ต้องระบุ CarID และวันที่เริ่ม"]);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "INSERT INTO MaintenanceHistory
                (CarID, MaintenanceType, StartDate, EndDate, Mileage, Cost, Note, NextDueDate, CreatedBy, CreatedAt)
             VALUES
                (:car_id, :type, :start, :end, :mileage, :cost, :note, :next_due, :created_by, GETDATE())"
        );
        $stmt->execute([
            ':car_id'     => $carId,
            ':type'       => $type,
            ':start'      => $start,
            ':end'        => $end,
            ':mileage'    => $mileage,
            ':cost'       => $cost,
            ':note'       => $note,
            ':next_due'   => $nextDue,
            ':created_by' => $_SESSION['user_id'],
        ]);
        echo json_encode(["success" => true, "id" => $conn->lastInsertId()]);
    } catch (PDOException $e) {
        error_log('manage_maintenance add DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถบันทึกได้"]);
    }
    exit;
}

// ---------- ปิดงานซ่อม (ใส่ EndDate ให้ record ที่ค้างอยู่) ----------
if ($action === 'close') {
    $id  = $data['maintenance_id'] ?? 0;
    $end = $data['end_date'] ?? date('Y-m-d');

    if (empty($id)) {
        echo json_encode(["success" => false, "message" => "ไม่พบ MaintenanceID"]);
        exit;
    }

    try {
        $stmt = $conn->prepare(
            "UPDATE MaintenanceHistory SET EndDate = :end WHERE MaintenanceID = :id"
        );
        $stmt->execute([':end' => $end, ':id' => $id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_maintenance close DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถปิดงานซ่อมได้"]);
    }
    exit;
}

// ---------- ลบ record ----------
if ($action === 'delete') {
    $id = $data['maintenance_id'] ?? 0;
    if (empty($id)) {
        echo json_encode(["success" => false, "message" => "ไม่พบ MaintenanceID"]);
        exit;
    }

    try {
        $stmt = $conn->prepare("DELETE FROM MaintenanceHistory WHERE MaintenanceID = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_maintenance delete DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถลบข้อมูลได้"]);
    }
    exit;
}

echo json_encode(["success" => false, "message" => "action ไม่ถูกต้อง"]);