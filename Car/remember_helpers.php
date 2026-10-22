<?php
// 🌟 Remember-me: selector/validator pattern — cookie เก็บแค่ selector (หาแถวใน DB)
// + validator (สุ่มยาว เทียบกับ hash ที่เก็บไว้) ไม่เก็บ token ดิบทั้งก้อนใน DB เลย
// กันกรณี DB หลุด/ถูกอ่าน คนร้ายก็ยังปลอมล็อกอินไม่ได้เพราะไม่มี validator ตัวจริง
// ใช้เฉพาะฝั่งผู้ใช้ทั่วไป (Car/) เท่านั้น ฝั่ง Admin ไม่ใช้ pattern นี้ (session สั้นเหมือนเดิมตามที่ตกลงไว้)

const REMEMBER_COOKIE_NAME = 'remember_me';
// 60 วัน — ลดการ login ซ้ำจากการสแกน QR/เปิดแอป แต่ยังต้องติ๊ก "จดจำฉัน" เองเท่านั้น (ไม่ติ๊กให้) และผูกกับเครื่องที่ login
const REMEMBER_DAYS = 60;

function issueRememberToken(PDO $conn, int $userId, bool $isHttps): void {
    $selector = bin2hex(random_bytes(9));
    $validator = bin2hex(random_bytes(32));
    $validatorHash = hash('sha256', $validator);
    $expiresAt = (new DateTime())->modify('+' . REMEMBER_DAYS . ' days');

    // 🔒 ผูก token กับเครื่องที่ขอ (sha256 ของ User-Agent) — cookie ที่ถูกคัดลอกไปเครื่องอื่นใช้ไม่ได้
    require_once __DIR__ . '/../session_policy.php';

    $stmt = $conn->prepare(
        "INSERT INTO RememberTokens (user_id, selector, token_hash, expires_at, device_hash)
         VALUES (:uid, :sel, :hash, :exp, :dev)"
    );
    $stmt->execute([
        ':uid'  => $userId,
        ':sel'  => $selector,
        ':hash' => $validatorHash,
        ':exp'  => $expiresAt->format('Y-m-d H:i:s'),
        ':dev'  => cb_device_hash(),
    ]);

    setcookie(REMEMBER_COOKIE_NAME, $selector . ':' . $validator, [
        'expires'  => time() + REMEMBER_DAYS * 24 * 3600,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax', // Strict จะบล็อกตอนมาจากลิงก์นอก (เช่นสแกน QR เปิดแท็บใหม่) ใช้ Lax แทนสำหรับ cookie นี้
    ]);
}

function clearRememberToken(PDO $conn): void {
    if (empty($_COOKIE[REMEMBER_COOKIE_NAME])) return;
    $parts = explode(':', $_COOKIE[REMEMBER_COOKIE_NAME], 2);
    $selector = $parts[0] ?? '';
    if ($selector) {
        $del = $conn->prepare("DELETE FROM RememberTokens WHERE selector = :sel");
        $del->execute([':sel' => $selector]);
    }
    setcookie(REMEMBER_COOKIE_NAME, '', ['expires' => time() - 3600, 'path' => '/']);
}

// คืน true ถ้า login สำเร็จจาก remember cookie (ตั้ง $_SESSION ให้แล้ว + หมุน token ใหม่)
function tryRememberLogin(PDO $conn, bool $isHttps): bool {
    if (empty($_COOKIE[REMEMBER_COOKIE_NAME])) return false;

    $parts = explode(':', $_COOKIE[REMEMBER_COOKIE_NAME], 2);
    if (count($parts) !== 2) return false;
    [$selector, $validator] = $parts;
    if (!$selector || !$validator) return false;

    $stmt = $conn->prepare(
        "SELECT rt.id, rt.token_hash, rt.expires_at, rt.device_hash,
                u.id AS user_id, u.username, u.first_name, u.employee_id, u.role
         FROM RememberTokens rt JOIN Users u ON u.id = rt.user_id
         WHERE rt.selector = :sel"
    );
    $stmt->execute([':sel' => $selector]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return false;

    // 🔒 token นี้ออกให้เครื่องไหน ก็ใช้ได้แค่เครื่องนั้น — cookie ที่ถูกคัดลอกไปเครื่องอื่นใช้ไม่ได้
    require_once __DIR__ . '/../session_policy.php';
    $deviceOk = empty($row['device_hash']) // token เก่าที่ยังไม่มีการผูกเครื่อง (ตอนนี้ล้างทิ้งหมดแล้ว)
        || hash_equals((string)$row['device_hash'], cb_device_hash());

    // token หมดอายุ / validator ไม่ตรง / มาจากเครื่องอื่น -> ลบทิ้ง กันใช้ซ้ำ
    // เครื่อง/UA ไม่ตรง (เช่นสลับโหมดจำลองมือถือ) = แค่ไม่ให้เข้าอัตโนมัติรอบนี้ ไม่ลบ token ทิ้ง กลับมา UA เดิมแล้วใช้ต่อได้
    if (!$deviceOk) return false;

    if (strtotime($row['expires_at']) < time() || !hash_equals($row['token_hash'], hash('sha256', $validator))) {
        $del = $conn->prepare("DELETE FROM RememberTokens WHERE id = :id");
        $del->execute([':id' => $row['id']]);
        setcookie(REMEMBER_COOKIE_NAME, '', ['expires' => time() - 3600, 'path' => '/']);
        return false;
    }

    // ใช้แล้วลบทันที (one-time use) แล้วออกตัวใหม่ให้เลย -> กัน replay ถ้า cookie เก่าหลุดไปอยู่ที่อื่น
    $del = $conn->prepare("DELETE FROM RememberTokens WHERE id = :id");
    $del->execute([':id' => $row['id']]);

    session_regenerate_id(true);
    $_SESSION['user_id']     = $row['user_id'];
    $_SESSION['username']    = $row['username'];
    $_SESSION['first_name']  = $row['first_name'];
    $_SESSION['employee_id'] = $row['employee_id'];
    $_SESSION['role']        = $row['role'];

    // 🔒 นับว่าเป็นการ login ครั้งใหม่ (ประทับเวลา + ผูกกับเครื่องนี้) ให้ตรงกับที่ login_process.php ทำ
    require_once __DIR__ . '/../session_policy.php';
    cb_session_mark_login();

    issueRememberToken($conn, (int)$row['user_id'], $isHttps);
    return true;
}
