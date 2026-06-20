<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// รับค่าจากหน้าฟอร์มสมัครสมาชิกใหม่
$username    = isset($_POST['username']) ? trim($_POST['username']) : '';
$password    = isset($_POST['password']) ? trim($_POST['password']) : '';
$first_name  = isset($_POST['first_name']) ? trim($_POST['first_name']) : '';
$last_name   = isset($_POST['last_name']) ? trim($_POST['last_name']) : '';
$phone       = isset($_POST['phone']) ? trim($_POST['phone']) : '';
$email       = isset($_POST['email']) ? trim($_POST['email']) : '';
$employee_id = isset($_POST['employee_id']) ? trim($_POST['employee_id']) : '';
$department  = isset($_POST['department']) ? trim($_POST['department']) : '';

// 1. ตรวจสอบว่ากรอกข้อมูลมาครบทุกช่องไหม
if (empty($username) || empty($password) || empty($first_name) || empty($last_name) || empty($phone) || empty($email) || empty($employee_id) || empty($department)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลพนักงานให้ครบทุกช่องครับเพื่อน!']);
    exit;
}

// 🚀 2. [เพิ่มใหม่] เช็คและบล็อกไม่ให้ใช้ชื่อ 'admin' ในทุกรูปแบบตัวอักษร
// strtolowerจะแปลงข้อความที่พิมพ์มาให้เป็นตัวพิมพ์เล็กทั้งหมดก่อนมาเทียบคำครับ
if (strtolower($username) === 'admin' || strtolower($username) === 'administrator' || strtolower($username) === 'root') {
    echo json_encode([
        'success' => false, 
        'message' => 'ระบบไม่อนุญาตให้ใช้ชื่อผู้ใช้งานคำนี้ (admin/administrator/root) เพื่อความปลอดภัยของระบบครับเพื่อน!'
    ]);
    exit;
}

try {
    // 3. ตรวจสอบว่า Username ซ้ำในระบบหรือไม่ (โค้ดเดิม)
    $check_sql = "SELECT COUNT(*) FROM Users WHERE username = :username";
    $stmt = $conn->prepare($check_sql);
    $stmt->execute([':username' => $username]);
    
    if ($stmt->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Username นี้ถูกใช้งานแล้ว ลองเปลี่ยนใหม่นะครับ']);
        exit;
    }

    // 4. เข้ารหัสความปลอดภัยรหัสผ่าน (โค้ดเดิม)
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // 5. บันทึกข้อมูลลง SQL Server (โค้ดเดิม)
    $insert_sql = "INSERT INTO Users (username, password, first_name, last_name, phone, email, employee_id, department, role) 
                   VALUES (:username, :password, :first_name, :last_name, :phone, :email, :employee_id, :department, 'user')";
    
    $insert_stmt = $conn->prepare($insert_sql);
    $result = $insert_stmt->execute([
        ':username'    => $username,
        ':password'    => $hashed_password,
        ':first_name'  => $first_name,
        ':last_name'   => $last_name,
        ':phone'       => $phone,
        ':email'       => $email,
        ':employee_id' => $employee_id,
        ':department'  => $department
    ]);

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'ลงทะเบียนพนักงานสำเร็จแล้วครับเพื่อน! ยินดีต้อนรับเข้าสู่ระบบ']);
    } else {
        echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาดในการเขียนข้อมูลลงตารางพนักงาน']);
    }

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง: ' . $e->getMessage()]);
}
?>