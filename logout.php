<?php
session_start();

// 🌟 ลบ remember-me token ทิ้งด้วยตอน logout จริงๆ (ไม่งั้นปิดหน้าแล้ว cookie ยัง auto-login กลับเข้ามาได้อีก)
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/Car/remember_helpers.php';
clearRememberToken($conn);

// ทำลาย Session ทั้งหมดในเครื่อง
session_unset();
session_destroy();

// เด้งกลับไปที่หน้า Login หลักทันที (เปลี่ยนชื่อไฟล์เป็นชื่อหน้า Login ของเพื่อนได้เลย)
header("Location: Car/index.html");
exit;
?>