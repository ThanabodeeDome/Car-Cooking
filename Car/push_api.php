<?php
// Web Push endpoint (ต้อง login):
//   GET  ?action=key                      -> {success, key}  (VAPID public key, base64url)
//   POST {action:'subscribe', subscription:{endpoint, keys:{p256dh, auth}}}
//   POST {action:'unsubscribe', endpoint}
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../same_origin.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/push_lib.php';

if (!isset($_SESSION['user_id']) || empty($_SESSION['employee_id'])) {
    echo json_encode(['success' => false, 'message' => 'กรุณาเข้าสู่ระบบก่อน']);
    exit;
}
if (!push_ready($conn)) {
    echo json_encode(['success' => false, 'code' => 'not_ready', 'message' => 'ยังไม่เปิดใช้แจ้งเตือนในเครื่อง (รอแอดมินอัปเดตฐานข้อมูล)']);
    exit;
}
$emp = (string)$_SESSION['employee_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $v = push_vapid();
    echo json_encode($v ? ['success' => true, 'key' => $v['pub']] : ['success' => false, 'message' => 'สร้างคีย์ไม่สำเร็จ']);
    exit;
}

require_same_origin();
$data = json_decode((string)file_get_contents('php://input'), true);
$action = is_array($data) ? ($data['action'] ?? '') : '';

try {
    if ($action === 'subscribe') {
        $s = $data['subscription'] ?? [];
        $endpoint = (string)($s['endpoint'] ?? '');
        $p256 = (string)($s['keys']['p256dh'] ?? '');
        $auth = (string)($s['keys']['auth'] ?? '');
        if (!preg_match('#^https://#', $endpoint) || strlen($endpoint) > 1000 || $p256 === '' || $auth === '' || strlen($p256) > 200 || strlen($auth) > 80) {
            echo json_encode(['success' => false, 'message' => 'ข้อมูลการสมัครรับแจ้งเตือนไม่ถูกต้อง']);
            exit;
        }
        $ua = mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
        // endpoint เดียวกัน = เครื่องเดียวกัน: ย้ายให้เป็นของผู้ใช้ที่ login อยู่ตอนนี้ (กรณีหลายคนใช้เครื่องเดียวกัน)
        $up = $conn->prepare("UPDATE PushSubscriptions SET EmployeeID = :e, P256dh = :p, Auth = :a, UserAgent = :u, LastSeen = GETDATE() WHERE Endpoint = :ep");
        $up->execute([':e' => $emp, ':p' => $p256, ':a' => $auth, ':u' => $ua, ':ep' => $endpoint]);
        $isNew = $up->rowCount() === 0;
        if ($isNew) {
            $conn->prepare("INSERT INTO PushSubscriptions (EmployeeID, Endpoint, P256dh, Auth, UserAgent) VALUES (:e, :ep, :p, :a, :u)")
                ->execute([':e' => $emp, ':ep' => $endpoint, ':p' => $p256, ':a' => $auth, ':u' => $ua]);
            push_mark_current($conn, $emp); // ไม่ส่งรายการเก่าที่มีอยู่แล้วย้อนหลัง
        }
        echo json_encode(['success' => true, 'new' => $isNew]);
    } elseif ($action === 'unsubscribe') {
        $endpoint = (string)($data['endpoint'] ?? '');
        $conn->prepare("DELETE FROM PushSubscriptions WHERE Endpoint = :ep AND EmployeeID = :e")->execute([':ep' => $endpoint, ':e' => $emp]);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'คำสั่งไม่ถูกต้อง']);
    }
} catch (Throwable $e) {
    error_log('push_api: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง']);
}
