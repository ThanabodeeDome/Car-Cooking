<?php
// 1. เปิดระบบ Session เผื่อไว้ถ้ายังไม่ได้เปิด
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 2. ตรวจสอบสิทธิ์ว่าได้ล็อกอินเป็น Admin หรือยัง
// 🩹 เดิมเทียบ 'Admin' ตัว A ใหญ่ แต่ DB/login_process.php เก็บ role เป็น 'admin' ตัวเล็ก
// เทียบตรงๆ ไม่ตรงกันเลย บล็อก Admin ทุกคน แก้เป็นเทียบแบบไม่สนตัวพิมพ์
if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    
    // 💡 เช็กว่าถ้ารายการนี้เป็นการดึงผ่าน JavaScript (Fetch/API) 
    // หรือถูกเรียกมาจากพวกไฟล์เบื้องหลัง เช่น manage_cars.php
    if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode(array("success" => false, "message" => "Access Denied"));
        exit();
    } else {
        // 💡 แต่ถ้าพิมพ์ URL เข้ามาตรงๆ บนเบราว์เซอร์ ให้ดีดกระเด็นกลับหน้าล็อกอินหลักทันที
        header("Location: /car-booking/login.php"); 
        exit();
    }
}
?>