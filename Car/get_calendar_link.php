<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/calendar_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'กรุณาเข้าสู่ระบบก่อน']);
    exit;
}
$uid = (int)$_SESSION['user_id'];
$url = calendar_base_url() . '/calendar.php?u=' . $uid . '&t=' . calendar_token($uid);
echo json_encode([
    'success' => true,
    'url'     => $url,
    'webcal'  => preg_replace('#^https?://#', 'webcal://', $url),
]);
