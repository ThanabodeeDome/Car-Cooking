<?php
// POST {booking_id, action: 'wait'|'got'} — ผู้ใช้แจ้ง "รถยังไม่มา" / "ได้รับรถแล้ว" ของรอบตัวเอง (สถานะ ขาไป เท่านั้น)
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../same_origin.php';
require_same_origin();
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/car_waiting_lib.php';
require_once __DIR__ . '/log_lib.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(['success' => false, 'message' => 'กรุณาเข้าสู่ระบบก่อน']);
    exit;
}
$data = json_decode((string)file_get_contents('php://input'), true);
$id = (is_array($data) && isset($data['booking_id']) && is_scalar($data['booking_id']) && ctype_digit((string)$data['booking_id'])) ? (int)$data['booking_id'] : 0;
$action = is_array($data) ? ($data['action'] ?? '') : '';
if ($id <= 0 || !in_array($action, ['wait', 'got'], true)) {
    echo json_encode(['success' => false, 'message' => 'คำสั่งไม่ถูกต้อง']);
    exit;
}
if (!autoCloseColumnsOk($conn)) {
    echo json_encode(['success' => false, 'message' => 'ฟีเจอร์นี้ยังไม่เปิดใช้งาน (รอแอดมินอัปเดตฐานข้อมูล)']);
    exit;
}

try {
    $set = $action === 'wait' ? 'GETDATE()' : 'NULL';
    $cond = $action === 'wait' ? 'AND WaitingCarAt IS NULL' : 'AND WaitingCarAt IS NOT NULL';
    $st = $conn->prepare(
        "UPDATE CarBookings SET WaitingCarAt = $set
         WHERE BookingID = :id AND (EmployeeID = :emp OR BookedByUserID = :uid)
           AND BookingStatus = N'ขาไป' AND EndMileage IS NULL $cond"
    );
    $st->execute([':id' => $id, ':emp' => $_SESSION['employee_id'], ':uid' => $_SESSION['user_id']]);
    if ($st->rowCount() === 0) {
        echo json_encode(['success' => false, 'message' => 'ทำรายการไม่ได้ (อาจแจ้งไปแล้ว หรือรายการนี้ไม่อยู่ในสถานะกำลังใช้งาน)']);
        exit;
    }
    $bi = sl_booking_info($conn, $id);
    $holder = '';
    if ($action === 'wait') {
        foreach (cw_waiting_list($conn) as $w) {
            if ((int)$w['BookingID'] === $id && !empty($w['HolderName'])) { $holder = ' (คนถือรถก่อนหน้า: ' . $w['HolderName'] . ')'; break; }
        }
    }
    sl_log($conn, $action === 'wait' ? 'car_waiting' : 'car_received',
        ($action === 'wait' ? 'แจ้งรถยังไม่มา ' : 'แจ้งได้รับรถแล้ว ') . trim($bi['plate'] . ' ' . $bi['driver']) . $holder,
        ['target_type' => 'booking', 'target' => $bi['no']]);
    echo json_encode(['success' => true]);
    // ตอบผู้ใช้ก่อน แล้วค่อยส่งแจ้งเตือนในเครื่อง (Web Push) ให้คนถือรถ + รปภ./แอดมิน ทันที ไม่ต้องรอรอบ cron
    if ($action === 'wait') {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request(); else { @ob_flush(); @flush(); }
        require_once __DIR__ . '/push_lib.php';
        @push_dispatch($conn);
    }
} catch (Throwable $e) {
    error_log('car_waiting: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง']);
}
