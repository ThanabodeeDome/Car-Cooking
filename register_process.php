<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/same_origin.php';
require_same_origin();
require_once 'db_connect.php';

// รับค่าจากหน้าฟอร์มสมัครสมาชิกใหม่
$username    = isset($_POST['username']) ? trim($_POST['username']) : '';
$password    = isset($_POST['password']) ? trim($_POST['password']) : '';
$first_name  = isset($_POST['first_name']) ? trim($_POST['first_name']) : '';
$last_name   = isset($_POST['last_name']) ? trim($_POST['last_name']) : '';
$phone       = isset($_POST['phone']) ? trim($_POST['phone']) : '';
$email       = isset($_POST['email']) ? trim($_POST['email']) : '';
require_once __DIR__ . '/user_dup_check.php';
$employee_id = isset($_POST['employee_id']) ? normalizeEmployeeId((string)$_POST['employee_id']) : ''; // 91 -> 00091 เหมือนหน้าเว็บ
// 🌟 แยกจาก department field เดียว เป็น 3 ระดับ
$division    = isset($_POST['division']) ? trim($_POST['division']) : '';   // ฝ่าย
$department  = isset($_POST['department']) ? trim($_POST['department']) : ''; // แผนก
$unit        = isset($_POST['unit']) ? trim($_POST['unit']) : '';           // หน่วยงาน

// 1. ตรวจสอบว่ากรอกข้อมูลมาครบทุกช่องไหม
if (empty($username) || empty($password) || empty($first_name) || empty($last_name) || empty($phone) || empty($email) || empty($employee_id) || empty($division) || empty($department) || empty($unit)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลพนักงานให้ครบทุกช่องครับเพื่อน!']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'message' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'รูปแบบอีเมลไม่ถูกต้อง']);
    exit;
}
if (!preg_match('/^[0-9A-Za-z_-]{1,20}$/', $employee_id)) {
    echo json_encode(['success' => false, 'message' => 'รหัสพนักงานไม่ถูกต้อง']);
    exit;
}
// 2. เช็คและบล็อกไม่ให้ใช้ชื่อสงวนที่สื่อถึง role พิเศษในทุกรูปแบบตัวอักษร
$reservedUsernames = ['admin', 'administrator', 'root', 'superadmin', 'manager'];
if (in_array(strtolower($username), $reservedUsernames, true)) {
    echo json_encode([
        'success' => false,
        'message' => 'ระบบไม่อนุญาตให้ใช้ชื่อผู้ใช้งานคำนี้ เพื่อความปลอดภัยของระบบครับเพื่อน!'
    ]);
    exit;
}

try {
    // 3. ตรวจซ้ำ: username / รหัสพนักงาน (1267 = 01267) / ชื่อ-นามสกุล — กันคนเดียวสมัครหลายบัญชี
    //    (เคยเกิดจริง: คนเดียวกันสมัคร 2 บัญชีด้วย username ต่างกัน)
    $dupMsg = duplicateUserMessage(findDuplicateUser($conn, $username, $employee_id, $first_name, $last_name));
    if ($dupMsg !== null) {
        echo json_encode(['success' => false, 'message' => $dupMsg]);
        exit;
    }

    // 4. เข้ารหัสความปลอดภัยรหัสผ่าน
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // 5. บันทึกข้อมูลลง SQL Server (🌟 เพิ่ม Division, Unit)
    $insert_sql = "INSERT INTO Users (username, password, first_name, last_name, phone, email, employee_id, Division, department, Unit, role)
                   VALUES (:username, :password, :first_name, :last_name, :phone, :email, :employee_id, :division, :department, :unit, 'user')";

    $insert_stmt = $conn->prepare($insert_sql);
    $result = $insert_stmt->execute([
        ':username'    => $username,
        ':password'    => $hashed_password,
        ':first_name'  => $first_name,
        ':last_name'   => $last_name,
        ':phone'       => $phone,
        ':email'       => $email,
        ':employee_id' => $employee_id,
        ':division'    => $division,
        ':department'  => $department,
        ':unit'        => $unit
    ]);

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'ลงทะเบียนพนักงานสำเร็จแล้วครับเพื่อน! ยินดีต้อนรับเข้าสู่ระบบ']);
    } else {
        echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาดในการเขียนข้อมูลลงตารางพนักงาน']);
    }

} catch (PDOException $e) {
    // 2627/2601 = ชน unique index (กดสมัครพร้อมกัน 2 ครั้งด้วยข้อมูลเดียวกัน หลุดเช็คด้านบนมาได้)
    if (in_array((int)($e->errorInfo[1] ?? 0), [2627, 2601], true)) {
        echo json_encode(['success' => false, 'message' => 'Username หรือรหัสพนักงานนี้มีบัญชีในระบบแล้ว']);
        exit;
    }
    error_log('register_process.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งครับ']);
}