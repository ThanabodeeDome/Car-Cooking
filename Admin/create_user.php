<?php
// แอดมินเพิ่มบัญชีผู้ใช้เอง (พนักงาน / รปภ. / Admin)
// บัญชี Admin ที่สร้างตรงนี้ "ยังใช้สิทธิ์ Admin ไม่ได้" จนกว่าจะเพิ่ม id ลงไฟล์ admin_whitelist.php (ด่านกันสร้างแอดมินผ่านเว็บอย่างเดียว)
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';
require_once __DIR__ . '/../db_error_text.php';
require_once __DIR__ . '/../user_dup_check.php';
requireAdminAccess();

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) $data = [];
$str = fn($k) => isset($data[$k]) && is_string($data[$k]) ? trim($data[$k]) : '';

$role       = $str('role');
$employeeId = normalizeEmployeeId($str('employee_id'));
$username   = $str('username');
$password   = isset($data['password']) && is_string($data['password']) ? $data['password'] : '';
$firstName  = $str('first_name');
$lastName   = $str('last_name');
$phone      = $str('phone');
$email      = $str('email');
$division   = $str('division');
$department = $str('department');
$unit       = $str('unit');

if (!in_array($role, ['user', 'security', 'admin'], true)) {
    echo json_encode(['success' => false, 'message' => 'สิทธิ์ไม่ถูกต้อง']);
    exit;
}
if ($employeeId === '' || $username === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอก รหัสพนักงาน, Username และรหัสผ่าน (ช่องอื่นเว้นว่างได้)']);
    exit;
}
if (!preg_match('/^[0-9A-Za-z_-]{1,20}$/', $employeeId)) {
    echo json_encode(['success' => false, 'message' => 'รหัสพนักงานใช้ได้เฉพาะตัวเลข/ตัวอักษรอังกฤษ/_/- ไม่เกิน 20 ตัว']);
    exit;
}
if (!preg_match('/^[0-9A-Za-z_.@-]{3,50}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username ใช้ได้เฉพาะตัวเลข/ตัวอักษรอังกฤษ/_/./-/@ ยาว 3–50 ตัว']);
    exit;
}
if (in_array(strtolower($username), ['admin', 'administrator', 'root', 'superadmin', 'manager'], true)) {
    echo json_encode(['success' => false, 'message' => 'ชื่อ Username นี้เป็นชื่อสงวน ใช้ไม่ได้']);
    exit;
}
if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'message' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร']);
    exit;
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'รูปแบบอีเมลไม่ถูกต้อง']);
    exit;
}
if (mb_strlen($phone) > 20 || mb_strlen($firstName) > 100 || mb_strlen($lastName) > 100 || mb_strlen($email) > 100) {
    echo json_encode(['success' => false, 'message' => 'ข้อมูลยาวเกินกำหนด (ชื่อ/นามสกุล/อีเมล ไม่เกิน 100, เบอร์โทร ไม่เกิน 20 ตัวอักษร)']);
    exit;
}

// ไม่กรอกชื่อ = ใช้ Username เป็นชื่อที่แสดง (first_name ห้ามว่างใน DB และหลายหน้าใช้แสดงชื่อ)
if ($firstName === '' || $firstName === '-') $firstName = $username;
if ($lastName === '-') $lastName = '';
if ($phone === '-') $phone = '';

try {
    // แอดมินเพิ่มเอง: ซ้ำได้เฉพาะ Username / รหัสพนักงาน (ไม่เช็คชื่อ-นามสกุลซ้ำ เพราะบัญชี รปภ./ส่วนกลางอาจไม่มีชื่อจริง)
    $dupMsg = duplicateUserMessage(findDuplicateUser($conn, $username, $employeeId));
    if ($dupMsg !== null) {
        echo json_encode(['success' => false, 'message' => $dupMsg]);
        exit;
    }
    // คอลัมน์ last_name/phone/email/department เป็น NOT NULL -> ไม่กรอกส่งเป็นค่าว่าง
    $st = $conn->prepare(
        "INSERT INTO Users (username, password, first_name, last_name, phone, email, employee_id, Division, department, Unit, role)
         VALUES (:u, :p, :fn, :ln, :ph, :em, :emp, :dv, :dp, :un, :r)"
    );
    $st->execute([
        ':u' => $username, ':p' => password_hash($password, PASSWORD_DEFAULT), ':fn' => $firstName, ':ln' => $lastName,
        ':ph' => $phone, ':em' => $email, ':emp' => $employeeId, ':dv' => $division, ':dp' => $department, ':un' => $unit, ':r' => $role,
    ]);
    $newId = (int)$conn->lastInsertId();

    require_once __DIR__ . '/../Car/log_lib.php';
    sl_log($conn, 'user_create', 'แอดมินเพิ่มบัญชี ' . $username . ' (รหัสพนักงาน ' . $employeeId . ', สิทธิ์ ' . ($role === 'security' ? 'รปภ.' : ($role === 'admin' ? 'Admin' : 'พนักงาน')) . ')', [
        'target_type' => 'user', 'target' => $username,
        'detail' => ['employee_id' => $employeeId, 'role' => $role],
    ]);
    echo json_encode(['success' => true, 'id' => $newId, 'needs_whitelist' => $role === 'admin']);
} catch (PDOException $e) {
    if (in_array((int)($e->errorInfo[1] ?? 0), [2627, 2601], true)) {
        echo json_encode(['success' => false, 'message' => 'Username หรือรหัสพนักงานนี้มีบัญชีในระบบแล้ว']);
        exit;
    }
    error_log('create_user DB error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => cb_db_error_message($e, 'เกิดข้อผิดพลาด เพิ่มบัญชีไม่สำเร็จ')]);
}
