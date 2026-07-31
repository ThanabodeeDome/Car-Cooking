<?php
// 🌟 Session Hardening — ต้องตั้งก่อน session_start() เท่านั้น
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,     // ส่งผ่าน HTTPS เท่านั้น (Cloudflare Tunnel ให้ HTTPS มาแล้ว)
    'httponly' => true,     // JS อ่าน cookie นี้ไม่ได้ กัน XSS ขโมย session
    'samesite' => 'Strict', // กัน CSRF แบบพื้นฐาน
]);
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🌟 Rate Limit กันเดารหัสผ่าน (brute-force) — ล็อกตาม IP ไม่ต้องแก้ DB schema
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$lockDir = sys_get_temp_dir() . '/login_attempts';
if (!is_dir($lockDir)) mkdir($lockDir, 0700, true);
$lockFile = $lockDir . '/' . md5($ip) . '.json';

$maxAttempts = 5;
$lockoutSeconds = 900; // 15 นาที

$attemptData = ['count' => 0, 'first_attempt' => time()];
if (file_exists($lockFile)) {
    $attemptData = json_decode(file_get_contents($lockFile), true) ?: $attemptData;
}
if (time() - $attemptData['first_attempt'] > $lockoutSeconds) {
    $attemptData = ['count' => 0, 'first_attempt' => time()]; // หมดเวลาล็อก รีเซ็ตนับใหม่
}
if ($attemptData['count'] >= $maxAttempts) {
    $waitMin = ceil(($lockoutSeconds - (time() - $attemptData['first_attempt'])) / 60);
    echo json_encode(['success' => false, 'message' => "ลองผิดเกินกำหนด กรุณารออีกประมาณ $waitMin นาทีแล้วลองใหม่ครับ"]);
    exit;
}

$username = isset($_POST['username']) ? trim($_POST['username']) : '';
$password = isset($_POST['password']) ? trim($_POST['password']) : '';
// 🌟 ใหม่: รับ path ที่ตั้งใจจะเข้าไว้ตั้งแต่ก่อน login (มาจาก guard_user.php ตอนโดนเด้ง)
$redirectParam = isset($_POST['redirect']) ? trim($_POST['redirect']) : '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านด้วยครับเพื่อน!']);
    exit;
}

// 🌟 กัน open-redirect: รับเฉพาะ relative path ธรรมดาในโฟลเดอร์ Car/ เท่านั้น
// ห้ามมี :// (ลิงก์ไปโดเมนอื่น) และห้ามขึ้นต้นด้วย // (protocol-relative URL)
function isSafeRedirect($path) {
    if (empty($path)) return false;
    if (strpos($path, '://') !== false) return false;
    if (substr($path, 0, 2) === '//') return false;
    if (strpos($path, '..') !== false) return false; // กัน path traversal
    return true;
}

try {
    // ดึงข้อมูลผู้ใช้จากตาราง Users ตามชื่อที่กรอกมา
    $sql = "SELECT id, username, password, first_name, employee_id, role FROM Users WHERE username = :username";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch(PDO::class ? PDO::FETCH_ASSOC : 0);

    // 1. ตรวจสอบว่าเจอชื่อผู้ใช้ไหม และตรวจสอบรหัสผ่านว่าตรงกับที่ Hash ไว้ในฐานข้อมูลหรือไม่
    if ($user && password_verify($password, $user['password'])) {

        // ✅ login สำเร็จ -> เคลียร์ตัวนับ rate limit ของ IP นี้
        if (file_exists($lockFile)) unlink($lockFile);

        // 🌟 สร้าง session id ใหม่ทุกครั้งที่ login สำเร็จ กัน session fixation attack
        session_regenerate_id(true);

        // 2. สร้าง Session เพื่อเก็บข้อมูลจำไว้ในระบบหลังบ้าน
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['username']   = $user['username'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['employee_id'] = $user['employee_id'];
        $_SESSION['role']       = $user['role'];

        // 3. ตรวจสอบสิทธิ์ (Role) เพื่อกำหนดปลายทางที่จะส่งไป (Fix ปัญหาหน้า 404)
        if (in_array($user['role'], ['admin', 'superioradmin'], true)) {
            // แอดมิน/superioradmin ไปหน้า Admin เสมอ ไม่รับ redirect param (กันคนพยายามยัด path แปลกๆ ไปโซน Admin)
            $redirect_url = "../Admin/index.html";
        } elseif (isSafeRedirect($redirectParam)) {
            // 🌟 ถ้ามี redirect ที่ปลอดภัยแนบมา (เช่นมาจากสแกน QR checkin.php) ส่งกลับไปที่นั่นแทนหน้าหลัก
            $redirect_url = $redirectParam;
        } else {
            $redirect_url = "../Car/homepage.html";
        }

        echo json_encode([
            'success' => true,
            'message' => 'ยินดีต้อนรับคุณ ' . $user['first_name'],
            'redirect' => $redirect_url
        ]);

    } else {
        // ❌ login ผิด -> นับเพิ่ม 1 ครั้ง เก็บลง lock file
        $attemptData['count']++;
        file_put_contents($lockFile, json_encode($attemptData));

        // หากชื่อหรือรหัสไม่ตรง ห้ามบอกตรงๆ ว่าอะไรผิด (หลัก Security) ให้บอกรวมๆ ครับ
        echo json_encode(['success' => false, 'message' => 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้องครับเพื่อน']);
    }

} catch (PDOException $e) {
    // 🌟 ห้ามโชว์ $e->getMessage() ให้ user เห็นตรงๆ (โชว์โครงสร้าง DB ให้แฮกเกอร์)
    // log ไว้ฝั่ง server แทน ดูย้อนหลังได้จาก error_log ปกติ
    error_log('Login DB error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งครับ']);
}