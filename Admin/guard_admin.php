<?php
// 🔒 ยามหน้าโซน Admin — ต้องวางเป็นบรรทัดแรกของทุกหน้าในโฟลเดอร์นี้
// Session Hardening + นโยบายอายุ session ย้ายไปอยู่ที่ session_policy.php / session_boot.php
// (ต้องตั้ง cookie params ก่อน session_start() เสมอ ซึ่ง cb_session_start() จัดการให้แล้ว)
require_once __DIR__ . '/../require_admin.php';

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

// 🌟 ต้อง login และเป็น admin ที่อยู่ใน admin_whitelist.php เท่านั้น (ใช้ logic กลางเดียวกับ API ฝั่ง Admin)
//    currentAdminRole() จะเรียก cb_enforce_session_policy() ให้ด้วย = session หมดอายุ/ถูก revoke ถือว่าไม่ผ่าน
if (currentAdminRole() === false) {
    // รปภ. (role security) เข้าได้เฉพาะหน้าจดเลขไมล์
    if (isset($_SESSION['user_id']) && strtolower((string)($_SESSION['role'] ?? '')) === 'security') {
        header('Location: guard.html');
        exit;
    }
    // ?expired=1 ไว้ให้หน้า login ขึ้นข้อความว่าเซสชันหมดอายุ (ไม่ได้บอกข้อมูลอะไรที่เป็นความลับ)
    header('Location: ../Car/index.html?expired=1');
    exit;
}
