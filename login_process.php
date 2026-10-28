<?php
// 🌟 Session Hardening — ต้องตั้งก่อน session_start() เท่านั้น
// 🩹 secure=true บังคับ cookie ส่งผ่าน HTTPS เท่านั้น — ถ้า deploy ผ่าน HTTP ตรงๆ (ยังไม่มี Tunnel/SSL)
// จะทำให้ session หายทันทีทุก request เช็คจาก request จริงแทน hardcode true ตายตัว
// ย้ายค่า cookie params ทั้งก้อนไปไว้ที่ cb_session_start() (session_boot.php) แล้ว
// เพื่อให้ทุกไฟล์ในระบบเปิด session ด้วยค่าชุดเดียวกันจริงๆ ไม่ใช่แค่ไฟล์นี้
require_once __DIR__ . '/session_policy.php';
cb_session_start();
$isHttps = cb_is_https();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/same_origin.php';
require_same_origin();
require_once 'db_connect.php';
require_once 'Car/remember_helpers.php';

require_once __DIR__ . '/rate_limit.php';
require_once __DIR__ . '/Car/log_lib.php';

$username = isset($_POST['username']) ? trim($_POST['username']) : '';
$password = isset($_POST['password']) ? trim($_POST['password']) : '';
// 🌟 ใหม่: รับ path ที่ตั้งใจจะเข้าไว้ตั้งแต่ก่อน login (มาจาก guard_user.php ตอนโดนเด้ง)
$redirectParam = isset($_POST['redirect']) ? trim($_POST['redirect']) : '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านด้วยครับเพื่อน!']);
    exit;
}

// 🌟 Rate Limit กันเดารหัสผ่าน (brute-force) — รายละเอียดการนับดูที่ rate_limit.php
// นับแยกตาม "บัญชี + IP" คนพิมพ์รหัสผิดจึงล็อกแค่บัญชีตัวเอง เพื่อนร่วมออฟฟิศที่ออกเน็ต
// ผ่าน IP เดียวกันยังล็อกอินได้ปกติ
$ip          = getClientIp();
$acctBucket  = 'acct:' . mb_strtolower($username) . '|' . $ip;
$ipBucket    = 'ip:' . $ip;
$maxAttempts = 5;   // ต่อบัญชีต่อ IP
$maxPerIp    = 30;  // รวมทุกบัญชีจาก IP เดียว (เผื่อถูกยิงเดารหัสหลายบัญชีจริงๆ)

$waitIp = rl_retry_after('login_attempts', $ipBucket, $maxPerIp);
if ($waitIp > 0) {
    echo json_encode(['success' => false, 'message' => 'มีการลองรหัสผิดจากเครือข่ายนี้มากเกินไป กรุณารอ ' . rl_wait_text($waitIp) . ' แล้วลองใหม่ครับ']);
    exit;
}
$waitAcct = rl_retry_after('login_attempts', $acctBucket, $maxAttempts);
if ($waitAcct > 0) {
    echo json_encode(['success' => false, 'message' => 'ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ ' . rl_wait_text($waitAcct) . ' แล้วลองใหม่ครับ']);
    exit;
}

// 🌟 กัน open-redirect: รับเฉพาะ relative path ธรรมดาในโฟลเดอร์ Car/ เท่านั้น
// ห้ามมี :// (ลิงก์ไปโดเมนอื่น) และห้ามขึ้นต้นด้วย // (protocol-relative URL)
function isSafeRedirect($path) {
    if (empty($path) || strlen($path) > 500) return false;
    if (strpos($path, '..') !== false) return false; // กัน path traversal
    // 🔒 รับเฉพาะชื่อไฟล์ .html/.php แบบ relative (+ query string) เท่านั้น
    // เดิมเช็คแค่ :// กับ // ทำให้ "javascript:..." หรือ "/\evil.com" ผ่านได้ -> XSS/เด้งออกนอกเว็บหลัง login
    return (bool) preg_match('#^(?:[A-Za-z0-9_\-]+/)*[A-Za-z0-9_\-]+\.(?:html|php)(?:\?[^\s"\'<>\\\\]*)?$#D', $path);
}

try {
    // ดึงข้อมูลผู้ใช้จากตาราง Users ตามชื่อที่กรอกมา
    $sql = "SELECT id, username, password, first_name, employee_id, role FROM Users WHERE username = :username";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch(PDO::class ? PDO::FETCH_ASSOC : 0);

    // 1. ตรวจสอบว่าเจอชื่อผู้ใช้ไหม และตรวจสอบรหัสผ่านว่าตรงกับที่ Hash ไว้ในฐานข้อมูลหรือไม่
    if ($user && password_verify($password, $user['password'])) {

        // ✅ login สำเร็จ -> เคลียร์ตัวนับ rate limit ทั้งของบัญชีนี้และของ IP นี้
        rl_clear('login_attempts', $acctBucket);
        rl_clear('login_attempts', $ipBucket);

        // 🌟 สร้าง session id ใหม่ทุกครั้งที่ login สำเร็จ กัน session fixation attack
        session_regenerate_id(true);

        // 2. สร้าง Session เพื่อเก็บข้อมูลจำไว้ในระบบหลังบ้าน
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['username']   = $user['username'];
        $_SESSION['first_name'] = $user['first_name'];
        $_SESSION['employee_id'] = $user['employee_id'];
        $_SESSION['role']       = $user['role'];

        // 🔒 ประทับเวลา login + ลายนิ้วมือเครื่อง ไว้ให้ cb_enforce_session_policy() ใช้คุมอายุ
        //    และผูก session นี้กับเบราว์เซอร์ที่กรอกรหัสผ่านจริงๆ เท่านั้น
        cb_session_mark_login();

        // 📝 บันทึกระบบ: เข้าสู่ระบบสำเร็จ
        sl_log($conn, 'login_ok', 'เข้าสู่ระบบ (' . ($user['role'] === 'admin' ? 'แอดมิน' : 'พนักงาน') . ')', [
            'actor' => ['id' => (int)$user['id'], 'name' => (string)$user['first_name'], 'emp' => (string)$user['employee_id']],
            'target_type' => 'user', 'target' => (string)$user['username'],
        ]);

        // 🌟 Remember-me 90 วัน เฉพาะผู้ใช้ทั่วไป (ไม่ใช่ admin) — ตามที่ตกลงกันไว้
        // แก้ปัญหา login บ่อยของพนักงาน โดยไม่ยืด session ฝั่ง admin ที่คุมข้อมูลทั้งระบบ
        // ต้องติ๊ก "จดจำฉัน" (checkbox name=remember) ถึงจะออก token
        if ($user['role'] !== 'admin' && !empty($_POST['remember'])) {
            issueRememberToken($conn, (int)$user['id'], $isHttps);
        }

        // 3. ตรวจสอบสิทธิ์ (Role) เพื่อกำหนดปลายทางที่จะส่งไป (Fix ปัญหาหน้า 404)
        if ($user['role'] === 'admin') {
            // แอดมินไปหน้า Admin เสมอ ไม่รับ redirect param (กันคนพยายามยัด path แปลกๆ ไปโซน Admin)
            $redirect_url = "../Admin/index.html";
        } elseif ($user['role'] === 'security') {
            // รปภ. ไปหน้าจดเลขไมล์เสมอ (ใช้ระบบส่วนอื่นไม่ได้)
            $redirect_url = "../Car/guard.html";
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
        // ❌ login ผิด -> นับเพิ่ม 1 ครั้ง ทั้งชั้นบัญชีและชั้น IP
        $fails = rl_fail('login_attempts', $acctBucket);
        rl_fail('login_attempts', $ipBucket);
        $left = $maxAttempts - $fails;

        // 📝 บันทึกระบบ: เข้าสู่ระบบไม่สำเร็จ (บันทึกเฉพาะชื่อผู้ใช้ที่ลอง — ไม่เก็บรหัสผ่านที่พิมพ์)
        sl_log($conn, 'login_fail', 'เข้าสู่ระบบไม่สำเร็จ (ลองครั้งที่ ' . $fails . ')' . ($user ? '' : ' — ไม่พบชื่อผู้ใช้นี้'), [
            'actor' => ['id' => $user ? (int)$user['id'] : null, 'name' => $user ? (string)$user['first_name'] : null, 'emp' => $user ? (string)$user['employee_id'] : null],
            'target_type' => 'user', 'target' => mb_substr($username, 0, 60),
        ]);

        // หากชื่อหรือรหัสไม่ตรง ห้ามบอกตรงๆ ว่าอะไรผิด (หลัก Security) ให้บอกรวมๆ ครับ
        // แต่บอกจำนวนครั้งที่เหลือได้ ให้ผู้ใช้รู้ตัวก่อนโดนล็อก
        $msg = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้องครับเพื่อน';
        if ($left <= 2 && $left > 0) $msg .= " (เหลือโอกาสลองอีก $left ครั้ง)";
        if ($left <= 0) $msg .= ' กรุณารอ ' . rl_wait_text(rl_retry_after('login_attempts', $acctBucket, $maxAttempts)) . ' แล้วลองใหม่ หรือกด "ลืมรหัสผ่าน"';
        echo json_encode(['success' => false, 'message' => $msg]);
    }

} catch (PDOException $e) {
    // 🌟 ห้ามโชว์ $e->getMessage() ให้ user เห็นตรงๆ (โชว์โครงสร้าง DB ให้แฮกเกอร์)
    // log ไว้ฝั่ง server แทน ดูย้อนหลังได้จาก error_log ปกติ
    error_log('Login DB error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งครับ']);
}