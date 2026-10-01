<?php
// check_availability.php
// ฟอร์มสมัครสมาชิก (Car/index.js) เรียกตอนกรอกแต่ละช่องเสร็จ เพื่อบอกทันทีว่า username / รหัสพนักงาน / ชื่อ-นามสกุล
// มีคนใช้ไปแล้วหรือยัง (ก่อนกดสมัคร) — register_process.php ตรวจซ้ำอีกรอบตอนบันทึกจริงเสมอ
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/same_origin.php';
require_same_origin();

// 🔒 จำกัดจำนวนครั้งต่อ IP (กันยิงไล่เดา username/รหัสพนักงานทั้งบริษัท) — 60 ครั้ง / 10 นาที
$remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$ip = $remote;
if (filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    $fwd = trim($_SERVER['HTTP_CF_CONNECTING_IP'] ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
    if (filter_var($fwd, FILTER_VALIDATE_IP)) $ip = $fwd;
}
$lockDir = sys_get_temp_dir() . '/availability_checks';
if (!is_dir($lockDir)) mkdir($lockDir, 0700, true);
$lockFile = $lockDir . '/' . md5($ip) . '.json';
$rate = file_exists($lockFile) ? (json_decode((string)file_get_contents($lockFile), true) ?: []) : [];
if (empty($rate['start']) || time() - $rate['start'] > 600) $rate = ['start' => time(), 'count' => 0];
if (++$rate['count'] > 60) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'ตรวจสอบบ่อยเกินไป กรุณารอสักครู่']);
    exit;
}
file_put_contents($lockFile, json_encode($rate), LOCK_EX);

$str = fn($k) => isset($_GET[$k]) && is_string($_GET[$k]) ? mb_substr(trim($_GET[$k]), 0, 200) : '';

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/user_dup_check.php';

try {
    $dup = findDuplicateUser($conn, $str('username'), $str('employee_id'), $str('first_name'), $str('last_name'));
    echo json_encode(['success' => true, 'taken' => $dup]);
} catch (PDOException $e) {
    error_log('check_availability.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ตรวจสอบไม่สำเร็จ']);
}
