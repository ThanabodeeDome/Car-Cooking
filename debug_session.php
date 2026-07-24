<?php
// debug_session.php — ไฟล์ชั่วคราว เอาไว้เช็คว่า session เก็บค่าอะไรจริงๆ หลัง login
// วางไว้ที่ root (ข้าง Car/ กับ Admin/) เปิดผ่าน URL: localhost/car-booking/debug_session.php
// เช็คเสร็จแล้ว "ลบไฟล์นี้ทิ้งทันที" ห้ามเหลือไว้บนเซิร์ฟเวอร์จริง (โชว์ข้อมูล session ตรงๆ)

session_start();
header('Content-Type: application/json; charset=utf-8');

$whitelist = null;
$whitelistError = null;
try {
    $whitelist = require __DIR__ . '/admin_whitelist.php';
} catch (Throwable $e) {
    $whitelistError = $e->getMessage();
}

echo json_encode([
    "session_raw"     => $_SESSION,
    "role_value"      => $_SESSION['role'] ?? '(ไม่มีเลย)',
    "role_length"     => isset($_SESSION['role']) ? strlen($_SESSION['role']) : null, // ถ้ายาวกว่า 5 (admin=5ตัว) แปลว่ามีช่องว่าง/อักขระแปลกปน
    "role_bytes_hex"  => isset($_SESSION['role']) ? bin2hex($_SESSION['role']) : null, // ดู byte จริงเทียบ hex ของ 'admin' คือ 61646d696e
    "user_id"         => $_SESSION['user_id'] ?? '(ไม่มีเลย)',
    "whitelist_loaded"=> $whitelist,
    "whitelist_error" => $whitelistError,
    "in_whitelist"    => (isset($_SESSION['user_id']) && is_array($whitelist)) ? in_array($_SESSION['user_id'], $whitelist, true) : null,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);