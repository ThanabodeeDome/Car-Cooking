<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/same_origin.php';
require_same_origin();
require_once 'db_connect.php';

// 🩹 FIX: ปัญหาเดียวกันกับ login_process.php — ระบบรันหลัง Cloudflare Tunnel
// REMOTE_ADDR ที่เซิร์ฟเวอร์เห็นเป็น IP ของตัว tunnel เอง เหมือนกันหมดทุกเครื่อง
// แก้โดยอ่าน IP จริงจาก header ที่ Cloudflare ใส่มาให้แทน
function getClientIp(): string {
    $remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    // 🔒 เชื่อ header จาก proxy เฉพาะเมื่อ request มาจาก tunnel/proxy ในเครื่องหรือวง LAN (กันปลอม IP หลบ rate limit)
    $fromProxy = filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    if ($fromProxy) {
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP']) && filter_var(trim($_SERVER['HTTP_CF_CONNECTING_IP']), FILTER_VALIDATE_IP)) {
            return trim($_SERVER['HTTP_CF_CONNECTING_IP']);
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $first = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
        }
    }
    return $remote;
}

// 🌟 Rate Limit กันเดา employee_id/username (brute-force account takeover)
$ip = getClientIp();
$lockDir = sys_get_temp_dir() . '/reset_attempts';
if (!is_dir($lockDir)) mkdir($lockDir, 0700, true);
$lockFile = $lockDir . '/' . md5($ip) . '.json';

$maxAttempts = 5;
$lockoutSeconds = 900; // 15 นาที

$attemptData = ['count' => 0, 'first_attempt' => time()];
if (file_exists($lockFile)) {
    $attemptData = json_decode(file_get_contents($lockFile), true) ?: $attemptData;
}
if (time() - $attemptData['first_attempt'] > $lockoutSeconds) {
    $attemptData = ['count' => 0, 'first_attempt' => time()];
}
if ($attemptData['count'] >= $maxAttempts) {
    $waitMin = ceil(($lockoutSeconds - (time() - $attemptData['first_attempt'])) / 60);
    echo json_encode(['success' => false, 'message' => "ลองผิดเกินกำหนด กรุณารออีกประมาณ $waitMin นาทีแล้วลองใหม่ครับ"]);
    exit;
}

$username     = isset($_POST['username']) ? trim($_POST['username']) : '';
$employee_id  = isset($_POST['employee_id']) ? trim($_POST['employee_id']) : '';
$new_password = isset($_POST['new_password']) ? trim($_POST['new_password']) : '';

$otp = isset($_POST['otp']) ? trim($_POST['otp']) : '';
// action=start: ตรวจตัวตน (+ส่ง OTP ถ้าเปิดอีเมล) ยังไม่ต้องมีรหัสใหม่ / action=finish (ค่าเริ่มต้น): ตั้งรหัสใหม่
$action = in_array($_POST['action'] ?? 'finish', ['start', 'verify'], true) ? $_POST['action'] : 'finish';

if (empty($username) || empty($employee_id) || ($action === 'finish' && empty($new_password))) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลเพื่อยืนยันตัวตนให้ครบถ้วนครับเพื่อน!']);
    exit;
}

try {
    // 1. ตรวจสอบก่อนว่ามี User ชื่อนี้ และรหัสพนักงานตรงกันจริงไหม
    $check_sql = "SELECT COUNT(*) FROM Users WHERE username = :username AND employee_id = :employee_id";
    $stmt = $conn->prepare($check_sql);
    $stmt->execute([
        ':username'    => $username,
        ':employee_id' => $employee_id
    ]);

    // ถ้าไม่พบข้อมูลที่ตรงกัน (กรอกข้อมูลมั่ว หรือแอบมาแฮกไอดีคนอื่น)
    if ($stmt->fetchColumn() == 0) {
        $attemptData['count']++;
        file_put_contents($lockFile, json_encode($attemptData));
        echo json_encode(['success' => false, 'message' => 'ข้อมูลยืนยันตัวตนไม่ถูกต้อง ชื่อผู้ใช้หรือรหัสพนักงานไม่ตรงกับในระบบครับ']);
        exit;
    }

    if ($action === 'finish' && strlen($new_password) < 6) {
        echo json_encode(['success' => false, 'message' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร']);
        exit;
    }

    // 1.5 ถ้าตั้งค่าอีเมลไว้ (Car/mail_config.php) ต้องยืนยัน OTP ที่ส่งเข้าอีเมลของเจ้าของบัญชีก่อน
    //     (กันคนรู้แค่ username + รหัสพนักงานมาเปลี่ยนรหัสคนอื่น). ถ้าไม่ได้เปิดอีเมล ใช้ flow เดิม
    require_once __DIR__ . '/Car/mailer.php';
    if ($action === 'start' && empty(mail_cfg()['enabled'])) {
        echo json_encode(['success' => true, 'mode' => 'direct']);
        exit;
    }
    if (!empty(mail_cfg()['enabled'])) {
        $u = $conn->prepare("SELECT email, ResetOTP, CASE WHEN ResetOTPExpiry >= GETDATE() THEN 1 ELSE 0 END AS otp_alive FROM Users WHERE username = :username AND employee_id = :employee_id");
        $u->execute([':username' => $username, ':employee_id' => $employee_id]);
        $row = $u->fetch(PDO::FETCH_ASSOC);

        if ($action === 'start' || $otp === '') {
            if (empty($row['email']) || !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
                echo json_encode(['success' => false, 'message' => 'บัญชีนี้ไม่มีอีเมลในระบบ กรุณาติดต่อแอดมินเพื่อรีเซ็ตรหัสผ่าน']);
                exit;
            }
            $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $conn->prepare("UPDATE Users SET ResetOTP = :h, ResetOTPExpiry = DATEADD(MINUTE, 10, GETDATE()) WHERE username = :username AND employee_id = :employee_id")
                 ->execute([':h' => password_hash($code, PASSWORD_DEFAULT), ':username' => $username, ':employee_id' => $employee_id]);
            $sentOk = sendAppMail($row['email'], 'รหัสยืนยันการตั้งรหัสผ่านใหม่',
                mail_layout('รหัสยืนยัน (OTP)', '<p>รหัสของคุณคือ</p><p style="font-size:28px;letter-spacing:6px"><b>' . $code . '</b></p><p>ใช้ได้ภายใน 10 นาที ถ้าคุณไม่ได้ขอ ให้ไม่ต้องสนใจอีเมลนี้</p>'));
            $attemptData['count']++; // นับการขอ OTP ด้วย กันยิงอีเมลรัว
            file_put_contents($lockFile, json_encode($attemptData));
            if (!$sentOk) {
                echo json_encode(['success' => false, 'message' => 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่หรือติดต่อแอดมิน']);
                exit;
            }
            $at = strpos($row['email'], '@');
            $masked = substr($row['email'], 0, 2) . str_repeat('*', max(1, $at - 2)) . substr($row['email'], $at);
            if ($action === 'start') {
                echo json_encode(['success' => true, 'mode' => 'otp', 'message' => "ส่งรหัส 6 หลักไปที่ $masked แล้ว (ใช้ได้ 10 นาที)"]);
                exit;
            }
            echo json_encode(['success' => false, 'otp_required' => true, 'message' => "ส่งรหัส 6 หลักไปที่ $masked แล้ว กรอกรหัสนั้นแล้วกดบันทึกอีกครั้ง"]);
            exit;
        }

        $valid = !empty($row['ResetOTP'])
              && !empty($row['otp_alive']) && password_verify($otp, $row['ResetOTP']);
        if (!$valid) {
            $attemptData['count']++;
            file_put_contents($lockFile, json_encode($attemptData));
            $left = max(0, $maxAttempts - $attemptData['count']);
            echo json_encode(['success' => false, 'message' => "รหัสยืนยัน (OTP) ไม่ถูกต้องหรือหมดอายุ (เหลือโอกาสลองอีก $left ครั้ง) ตรวจให้แน่ใจว่าใช้รหัสจากอีเมลฉบับล่าสุด"]);
            exit;
        }
        if ($action === 'verify') {
            echo json_encode(['success' => true]);
            exit;
        }
    }

    if ($action === 'verify') { // ไม่ได้เปิดอีเมล: ไม่มี OTP ให้ตรวจ
        echo json_encode(['success' => true]);
        exit;
    }

    // 2. ถ้าข้อมูลถูกต้อง ทำการเข้ารหัสผ่านใหม่ให้ปลอดภัย
    $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

    // 3. ยิงสคริปต์ SQL ไปอัปเดตรหัสผ่านในตาราง Users
    $update_sql = "UPDATE Users SET ResetOTP = NULL, ResetOTPExpiry = NULL, password = :password WHERE username = :username AND employee_id = :employee_id";
    $update_stmt = $conn->prepare($update_sql);
    $result = $update_stmt->execute([
        ':password'    => $hashed_password,
        ':username'    => $username,
        ':employee_id' => $employee_id
    ]);

    if ($result) {
        if (file_exists($lockFile)) unlink($lockFile);
        // 🔒 เปลี่ยนรหัสแล้วต้องเตะ remember-me ทุกเครื่องทิ้ง (ไม่งั้นคนที่ขโมย cookie ไปยังเข้าได้ต่อ 90 วัน)
        try {
            $conn->prepare("DELETE rt FROM RememberTokens rt JOIN Users u ON u.id = rt.user_id WHERE u.username = :username AND u.employee_id = :employee_id")
                 ->execute([':username' => $username, ':employee_id' => $employee_id]);
        } catch (PDOException $e) {
            error_log('reset_password_process.php revoke tokens: ' . $e->getMessage());
        }
        echo json_encode(['success' => true, 'message' => 'เปลี่ยนรหัสผ่านใหม่สำเร็จแล้วครับเพื่อน! ลองเข้าสู่ระบบดูได้เลย']);
    } else {
        echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาดในสเต็ปการอัปเดตข้อมูลฐานข้อมูล']);
    }

} catch (PDOException $e) {
    error_log('reset_password_process.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งครับ']);
}