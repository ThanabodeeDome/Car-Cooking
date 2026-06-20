<?php
// เปิดระบบ Session เพื่อจำว่าใครกำลังล็อกอินอยู่
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

$username = isset($_POST['username']) ? trim($_POST['username']) : '';
$password = isset($_POST['password']) ? trim($_POST['password']) : '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านด้วยครับเพื่อน!']);
    exit;
}

try {
    // ดึงข้อมูลผู้ใช้จากตาราง Users ตามชื่อที่กรอกมา
    $sql = "SELECT id, username, password, first_name, role FROM Users WHERE username = :username";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch(PDO::class ? PDO::FETCH_ASSOC : 0);

    // 1. ตรวจสอบว่าเจอชื่อผู้ใช้ไหม และตรวจสอบรหัสผ่านว่าตรงกับที่ Hash ไว้ในฐานข้อมูลหรือไม่
    if ($user && password_verify($password, $user['password'])) {
        
        // 2. สร้าง Session เพื่อเก็บข้อมูลจำไว้ในระบบหลังบ้าน
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['username']   = $user['username'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['role']       = $user['role'];

        // 3. ตรวจสอบสิทธิ์ (Role) เพื่อกำหนดปลายทางที่จะส่งไป (Fix ปัญหาหน้า 404)
        if ($user['role'] === 'admin') {
            // ถ้าเป็นแอดมิน ให้ดีดไปที่โฟลเดอร์ Admin (ถอยจากโฟลเดอร์ Car ออกไป 1 ชั้นก่อน)
            $redirect_url = "../Admin/index.html"; 
        } else {
            // ถ้าเป็นพนักงานทั่วไป (user) ให้ส่งไปหน้าจองรถของพนักงาน
            // (ในที่นี้สมมุติตั้งชื่อไฟล์ว่า main.html หรือหน้าหลักของฝั่ง User ครับ)
            $redirect_url = "../Car/homepage.html"; 
        }

        echo json_encode([
            'success' => true, 
            'message' => 'ยินดีต้อนรับคุณ ' . $user['first_name'],
            'redirect' => $redirect_url
        ]);
        
    } else {
        // หากชื่อหรือรหัสไม่ตรง ห้ามบอกตรงๆ ว่าอะไรผิด (หลัก Security) ให้บอกรวมๆ ครับ
        echo json_encode(['success' => false, 'message' => 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้องครับเพื่อน']);
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง: ' . $e->getMessage()]);
}
?>