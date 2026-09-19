<?php
session_start();
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
