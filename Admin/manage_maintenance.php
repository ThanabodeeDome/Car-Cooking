<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

// ปล่อยรถกลับเป็น ว่าง เมื่อไม่มีงานเช็ค/ซ่อมที่ยังเปิดอยู่เหลือ (รถที่ถูกล็อกเป็น เช็คระยะ เท่านั้น)
function mt_release_car_by_id(PDO $conn, int $carId): void {
    $open = $conn->prepare("SELECT COUNT(*) FROM MaintenanceHistory WHERE CarID = :c AND EndDate IS NULL");
    $open->execute([':c' => $carId]);
    if ((int)$open->fetchColumn() > 0) return;
    $conn->prepare("UPDATE Cars SET CarStatus = N'ว่าง', LastMaintenance = CAST(GETDATE() AS DATE), MaintenanceStartDate = NULL, MaintenanceEndDate = NULL WHERE CarID = :c AND CarStatus = N'เช็คระยะ'")
         ->execute([':c' => $carId]);
}
function mt_release_car_if_done(PDO $conn, $maintId): void {
    $cs = $conn->prepare("SELECT CarID FROM MaintenanceHistory WHERE MaintenanceID = :id");
    $cs->execute([':id' => $maintId]);
    $carId = (int)$cs->fetchColumn();
    if ($carId) mt_release_car_by_id($conn, $carId);
}

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
    // ส่งรถเข้าเช็ค/ซ่อมตอนนี้: ล็อกรถไม่ให้จอง วันที่เสร็จที่กรอก = "คาดว่าเสร็จ" (ยังไม่ปิดงานจนกว่าแอดมินยืนยันรถพร้อมใช้)
    $hold     = !empty($data['hold_car']);
    foreach ([$start, $end, $nextDue] as $dv) {
        if (!empty($dv) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$dv)) {
            echo json_encode(["success" => false, "message" => "รูปแบบวันที่ไม่ถูกต้อง"]);
            exit;
        }
    }
    if ($hold && $end !== null && $end < $start) {
        echo json_encode(["success" => false, "message" => "วันที่คาดว่าเสร็จต้องไม่ก่อนวันเริ่ม"]);
        exit;
    }
    $expectedEnd = $hold ? $end : null;
    if ($hold) $end = null; // รายการยังเปิดอยู่

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
        $newId = $conn->lastInsertId();
        if ($hold) {
            $conn->prepare("UPDATE Cars SET CarStatus = N'เช็คระยะ', MaintenanceStartDate = :s, MaintenanceEndDate = :e WHERE CarID = :id")
                 ->execute([':s' => $start, ':e' => $expectedEnd, ':id' => $carId]);
            require_once __DIR__ . '/../Car/log_lib.php';
            sl_log($conn, 'car_service_start', 'ส่งรถเข้าเช็คระยะ/ซ่อม รถ ID ' . (int)$carId . ($expectedEnd ? ' คาดว่าเสร็จ ' . $expectedEnd : ''), ['target_type' => 'car', 'target' => (string)$carId]);
        }
        echo json_encode(["success" => true, "id" => $newId]);
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
        // ปิดงานพร้อมบันทึกผล (ไมล์/ค่าใช้จ่าย/เช็คครั้งถัดไป/หมายเหตุ) ถ้ากรอกมา — ช่องที่ว่างไม่ทับค่าเดิม
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$end)) $end = date('Y-m-d');
        $nx = !empty($data['next_due_date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$data['next_due_date']) ? $data['next_due_date'] : null;
        $stmt = $conn->prepare(
            "UPDATE MaintenanceHistory SET EndDate = :end,
                    Mileage = COALESCE(:mileage, Mileage), Cost = COALESCE(:cost, Cost),
                    NextDueDate = COALESCE(:nx, NextDueDate), Note = COALESCE(:note, Note)
             WHERE MaintenanceID = :id"
        );
        $stmt->execute([
            ':end' => $end,
            ':mileage' => !empty($data['mileage']) ? $data['mileage'] : null,
            ':cost' => !empty($data['cost']) ? $data['cost'] : null,
            ':nx' => $nx,
            ':note' => isset($data['note']) && trim((string)$data['note']) !== '' ? $data['note'] : null,
            ':id' => $id,
        ]);
        mt_release_car_if_done($conn, $id);
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
        $cs = $conn->prepare("SELECT CarID FROM MaintenanceHistory WHERE MaintenanceID = :id");
        $cs->execute([':id' => $id]);
        $delCar = (int)$cs->fetchColumn();
        $stmt = $conn->prepare("DELETE FROM MaintenanceHistory WHERE MaintenanceID = :id");
        $stmt->execute([':id' => $id]);
        if ($delCar) mt_release_car_by_id($conn, $delCar);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_maintenance delete DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถลบข้อมูลได้"]);
    }
    exit;
}

echo json_encode(["success" => false, "message" => "action ไม่ถูกต้อง"]);