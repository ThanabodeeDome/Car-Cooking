<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
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
    // ยกเลิกได้เฉพาะรายการที่ยังไม่จบ (เดิมกดแล้วทับรายการ "คืนแล้ว" ให้กลายเป็น "ยกเลิก" ได้ ทำให้ประวัติเพี้ยน)
    $stmt = $conn->prepare("UPDATE CarBookings SET BookingStatus = N'ยกเลิก' WHERE BookingID = :id AND BookingStatus IN (N'จองแล้ว', N'ขาไป')");
    $stmt->execute([':id' => $data['booking_id']]);
    if ($stmt->rowCount() === 0) {
        echo json_encode(["success" => false, "message" => "ยกเลิกไม่ได้ รายการนี้คืนรถแล้ว ยกเลิกไปแล้ว หรือไม่พบรายการ"]);
        exit;
    }
    require_once __DIR__ . '/../Car/log_lib.php';
    $bi = sl_booking_info($conn, (int)$data['booking_id']);
    sl_log($conn, 'admin_booking_cancel', 'แอดมินยกเลิกการจอง ' . trim($bi['plate'] . ' ' . $bi['driver']), ['target_type' => 'booking', 'target' => $bi['no']]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('admin_cancel_booking DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถยกเลิกการจองได้"]);
}