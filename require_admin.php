<?php
// require_admin.php
// วางไว้ root เดียวกับ admin_whitelist.php, superior_whitelist.php, auth_check.php
// รวม logic เช็คสิทธิ์ admin/superioradmin ไว้ที่เดียว — แก้ role logic ต่อไปแก้ที่นี่ที่เดียวพอ
// ไม่ต้องไล่แก้ทุกไฟล์ Admin/*.php ทีละไฟล์อีกแล้ว

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * เช็คว่า session ปัจจุบันเป็น admin ที่ผ่าน whitelist จริง
 * คืนค่า 'admin' ถ้าผ่าน หรือ false ถ้าไม่ผ่าน
 */
function currentAdminRole(): string|false
{
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
        return false;
    }
    $userId = (int) $_SESSION['user_id'];
    $role = strtolower($_SESSION['role']);

    $adminIds = require __DIR__ . '/admin_whitelist.php';

    if ($role === 'admin' && in_array($userId, $adminIds, true)) {
        return 'admin';
    }
    return false;
}

/**
 * ใช้ในไฟล์ API (Admin/*.php) — ถ้าไม่ผ่านสิทธิ์ ตอบ JSON แล้ว exit ทันที
 * เรียกใช้แค่บรรทัดเดียวแทนโค้ดเช็คซ้ำๆ เดิม 3 บรรทัด
 */
function requireAdminAccess(): string
{
    $role = currentAdminRole();
    if ($role === false) {
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
        exit;
    }
    return $role;
}