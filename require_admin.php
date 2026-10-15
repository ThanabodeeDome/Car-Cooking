<?php
// require_admin.php
// วางไว้ root เดียวกับ admin_whitelist.php, superior_whitelist.php, auth_check.php
// รวม logic เช็คสิทธิ์ admin/superioradmin ไว้ที่เดียว — แก้ role logic ต่อไปแก้ที่นี่ที่เดียวพอ
// ไม่ต้องไล่แก้ทุกไฟล์ Admin/*.php ทีละไฟล์อีกแล้ว

// เปิด session ด้วยค่า cookie ที่ปลอดภัยชุดเดียวกันทุกไฟล์ + โหลดนโยบายอายุ session
require_once __DIR__ . '/session_policy.php';
cb_session_start();

/**
 * เช็คว่า session ปัจจุบันเป็น admin ที่ผ่าน whitelist จริง
 * คืนค่า 'admin' ถ้าผ่าน หรือ false ถ้าไม่ผ่าน
 */
function currentAdminRole(): string|false
{
    // 🔒 ตัด session ที่หมดอายุ / ถูกกด logout จากเครื่องอื่น / cookie ถูกเอาไปเปิดในเครื่องอื่น
    //    ออกก่อนเช็คสิทธิ์ — ทำที่นี่ที่เดียว คุมทั้งหน้า Admin และ API ฝั่ง Admin ทุกไฟล์
    cb_enforce_session_policy();

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
    // กัน CSRF: คำสั่งที่แก้ข้อมูล (ไม่ใช่ GET) ต้องมาจากหน้าเว็บของเราเอง
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        require_once __DIR__ . '/same_origin.php';
        require_same_origin();
    }
    return $role;
}