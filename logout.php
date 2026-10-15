<?php
require_once __DIR__ . '/session_policy.php';
cb_session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

$userId = (int)($_SESSION['user_id'] ?? 0);

// 🔒 logout = ตัดทุกเครื่องของคนนี้ ไม่ใช่แค่เครื่องที่กดปุ่ม
// เคสจริงที่เจอ: แอดมินเคย login ทิ้งไว้ในเครื่องคนอื่น แล้ว logout จากเครื่องตัวเอง
// เครื่องนั้นยังเข้าหน้า Admin ได้ต่อเรื่อยๆ เพราะเดิมทำลายแค่ session ไฟล์ของตัวเอง
if ($userId > 0) {
    cb_revoke_user_sessions($userId);
}

// 🌟 ลบ remember-me token ทิ้งด้วยตอน logout จริงๆ (ไม่งั้นปิดหน้าแล้ว cookie ยัง auto-login กลับเข้ามาได้อีก)
// ครอบ try/catch ไว้: ถ้า DB ล่ม ต้องยัง logout สำเร็จ (ของเดิมจะ fatal error ค้างอยู่ในสถานะ login)
try {
    require_once __DIR__ . '/db_connect.php';
    require_once __DIR__ . '/Car/remember_helpers.php';
    clearRememberToken($conn);
} catch (Throwable $e) {
    error_log('Logout: clearRememberToken failed - ' . $e->getMessage());
}

// ทำลาย Session ทั้งหมดในเครื่อง
$sessionName = session_name();
session_unset();
session_destroy();

// 🔒 ลบ cookie session ออกจากเบราว์เซอร์ด้วย (session_destroy ลบแต่ข้อมูลฝั่งเซิร์ฟเวอร์
//    ตัว cookie ยังค้างในเครื่องและถูกส่งกลับมาทุก request)
setcookie($sessionName, '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => cb_is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
]);

// 🔒 เผื่อ cookie remember_me ตัวเดิมถูกตั้งไว้ด้วย attribute ชุดอื่น ลบซ้ำให้ชัวร์
setcookie('remember_me', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => cb_is_https(),
    'httponly' => true,
    'samesite' => 'Lax',
]);

// เด้งกลับไปที่หน้า Login หลักทันที
header("Location: Car/index.html?logout=1");
exit;
