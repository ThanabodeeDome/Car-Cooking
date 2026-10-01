<?php
// 🌟 Session Hardening เหมือน login_process.php — ต้องตั้งก่อน session_start() เท่านั้น
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

// 🌟 ต้อง login และเป็น admin ที่อยู่ใน admin_whitelist.php เท่านั้น (ใช้ logic กลางเดียวกับ API ฝั่ง Admin)
require_once __DIR__ . '/../require_admin.php';
if (currentAdminRole() === false) {
    header('Location: ../Car/index.html');
    exit;
}