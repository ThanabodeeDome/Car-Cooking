<?php
// คำขอ "คืนรถนอกจุดบริษัท" ที่รอแอดมิน — GET = รายการรอ, POST {action: approve|reject, log_id} = อนุมัติ/ปฏิเสธ
// อนุมัติ = บันทึกคืนรถตามข้อมูลที่ผู้ใช้ส่งไว้ (เลขไมล์/รูป/เวลา) และเก็บตำแหน่งจริงของคำขอไว้ใน CarBookings
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();
require_once __DIR__ . '/../Car/return_request_lib.php';
require_once __DIR__ . '/../Car/geo_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $list = array_map(function ($r) { unset($r['_detail']); return $r; }, rr_pending($conn));
    echo json_encode(['success' => true, 'requests' => $list], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/../same_origin.php';
require_same_origin();
$data = json_decode(file_get_contents('php://input'), true);
$action = is_array($data) ? ($data['action'] ?? '') : '';
$logId = is_array($data) ? (int)($data['log_id'] ?? 0) : 0;
if (!in_array($action, ['approve', 'reject'], true) || $logId <= 0) {
    echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ถูกต้อง']);
    exit;
}

$req = null;
foreach (rr_pending($conn, 200) as $r) if ($r['log_id'] === $logId) { $req = $r; break; }
if (!$req) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบคำขอนี้ (อาจถูกจัดการไปแล้ว หรือรถถูกคืนแล้ว) กรุณารีเฟรช']);
    exit;
}
$label = trim($req['plate'] . ' ' . $req['driver_name']);

try {
    if ($action === 'reject') {
        sl_log($conn, 'return_rejected', 'ปฏิเสธคำขอคืนรถนอกจุด ' . $label, ['target_type' => 'booking', 'target' => $req['booking_no']]);
        echo json_encode(['success' => true, 'message' => 'ปฏิเสธคำขอแล้ว ผู้ขับต้องคืนรถในจุดบริษัท']);
        exit;
    }

    $d = $req['_detail'];
    $endMile = (int)($d['end_mile'] ?? 0);
    if ($endMile <= $req['start_mileage']) {
        echo json_encode(['success' => false, 'message' => 'เลขไมล์ในคำขอไม่ถูกต้อง ให้ปฏิเสธแล้วให้ผู้ขับส่งใหม่']);
        exit;
    }
    $okPath = '#^uploads/return/return_(?:odometer|condition)_[A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|webp)$#D';
    $odo = preg_match($okPath, (string)($d['odometer_photo_path'] ?? '')) ? $d['odometer_photo_path'] : null;
    $cond = preg_match($okPath, (string)($d['condition_photo_path'] ?? '')) ? $d['condition_photo_path'] : null;
    $remark = (string)($d['remark'] ?? '');
    $note = 'คืนนอกจุด (แอดมินอนุมัติ) เหตุผล: ' . (string)($d['reason'] ?? '');

    $conn->beginTransaction();
    $u = $conn->prepare(
        "UPDATE CarBookings SET BookingStatus = N'คืนแล้ว', ReturnDate = :d, ReturnTime = :t, EndMileage = :m,
                ReturnRemark = :r, OdometerPhotoPath = :o, ReturnPhotoPath = :c
         WHERE BookingID = :id AND BookingStatus = N'ขาไป'"
    );
    $u->execute([
        ':d' => $d['return_date'] ?? date('Y-m-d'), ':t' => $d['return_time'] ?? date('H:i:s'), ':m' => $endMile,
        ':r' => mb_substr(($remark !== '' && $remark !== '-' ? $remark . ' | ' : '') . $note, 0, 500),
        ':o' => $odo, ':c' => $cond, ':id' => $req['booking_id'],
    ]);
    if ($u->rowCount() === 0) {
        $conn->rollBack();
        echo json_encode(['success' => false, 'message' => 'รายการนี้ถูกคืนไปแล้ว กรุณารีเฟรช']);
        exit;
    }
    $conn->prepare("UPDATE Cars SET Mileage = :m WHERE Plate = :p")->execute([':m' => $endMile, ':p' => $req['plate']]);
    $conn->commit();

    $g = is_array($d['geo'] ?? null) ? $d['geo'] : [];
    geo_store($conn, $req['booking_id'], 'Return', [
        'lat' => $g['lat'] ?? null, 'lng' => $g['lng'] ?? null, 'acc' => $g['acc'] ?? null,
        'geo' => $g['geo'] ?? 'none', 'dist' => $g['dist'] ?? null,
    ]);
    sl_log($conn, 'return_approved', 'อนุมัติคืนรถนอกจุด ' . $label . ' ไมล์คืน ' . number_format($endMile) . ' กม.', ['target_type' => 'booking', 'target' => $req['booking_no']]);
    echo json_encode(['success' => true, 'message' => 'อนุมัติแล้ว บันทึกคืนรถเรียบร้อย']);
} catch (Throwable $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    error_log('admin_return_requests: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาด ทำรายการไม่สำเร็จ']);
}
