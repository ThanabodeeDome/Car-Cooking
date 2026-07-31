<?php
// 1. เปิดระบบ Session เผื่อไว้ถ้ายังไม่ได้เปิด
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/require_admin.php';

// 2. ตรวจสอบสิทธิ์ว่าเป็น admin หรือ superioradmin ที่ผ่าน whitelist จริง (ใช้ logic กลางไฟล์เดียว)
$adminRole = currentAdminRole();

if ($adminRole === false) {
    
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