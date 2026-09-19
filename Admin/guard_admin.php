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

// 🌟 ต้อง login และมี role เป็น admin เท่านั้นถึงจะเข้าหน้า Admin ได้
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    header('Location: ../Car/index.html');
    exit;
}