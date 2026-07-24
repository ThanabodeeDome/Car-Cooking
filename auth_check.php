<?php
// 1. เปิดระบบ Session เผื่อไว้ถ้ายังไม่ได้เปิด
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. ตรวจสอบสิทธิ์ว่าได้ล็อกอินเป็น Admin หรือยัง
// 🩹 เดิมเทียบ 'Admin' ตัว A ใหญ่ แต่ DB/login_process.php เก็บ role เป็น 'admin' ตัวเล็ก
// เทียบตรงๆ ไม่ตรงกันเลย บล็อก Admin ทุกคน แก้เป็นเทียบแบบไม่สนตัวพิมพ์
// 🌟 เพิ่มอีกชั้น: ไม่ใช่แค่ role='admin' ต้องอยู่ใน whitelist id นี้ด้วย
// กันกรณี role โดนแก้ตรงๆ ใน DB หรือมีช่องโหว่ privilege escalation จุดอื่น
$allowed_admin_ids = require __DIR__ . '/admin_whitelist.php'; // 🌟 ดึงจากไฟล์กลาง ไม่ hardcode ซ้ำหลายที่

if (
    !isset($_SESSION['user_id'])
    || strtolower($_SESSION['role'] ?? '') !== 'admin'
    || !in_array((int)$_SESSION['user_id'], $allowed_admin_ids, true)
) {
    
    // 💡 เช็กว่าถ้ารายการนี้เป็นการดึงผ่าน JavaScript (Fetch/API) 
    // หรือถูกเรียกมาจากพวกไฟล์เบื้องหลัง เช่น manage_cars.php
    if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(array("success" => false, "message" => "Access Denied"));
        exit();
    } else {
        // 💡 แต่ถ้าพิมพ์ URL เข้ามาตรงๆ บนเบราว์เซอร์ ให้ดีดกระเด็นกลับหน้าล็อกอินหลักทันที
        // 🩹 path เดิม /car-booking/login.php ผิดโฟลเดอร์ (ไม่มีไฟล์นี้จริง) แก้ให้ตรงกับ Car/index.html
        header("Location: ../Car/index.html"); 
        exit();
    }
}
?>