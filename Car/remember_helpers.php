<?php
// 🌟 Remember-me: selector/validator pattern — cookie เก็บแค่ selector (หาแถวใน DB)
// + validator (สุ่มยาว เทียบกับ hash ที่เก็บไว้) ไม่เก็บ token ดิบทั้งก้อนใน DB เลย
// กันกรณี DB หลุด/ถูกอ่าน คนร้ายก็ยังปลอมล็อกอินไม่ได้เพราะไม่มี validator ตัวจริง
// ใช้เฉพาะฝั่งผู้ใช้ทั่วไป (Car/) เท่านั้น ฝั่ง Admin ไม่ใช้ pattern นี้ (session สั้นเหมือนเดิมตามที่ตกลงไว้)

const REMEMBER_COOKIE_NAME = 'remember_me';
const REMEMBER_DAYS = 90;

function issueRememberToken(PDO $conn, int $userId, bool $isHttps): void {
    $selector = bin2hex(random_bytes(9));
    $validator = bin2hex(random_bytes(32));
    $validatorHash = hash('sha256', $validator);
    $expiresAt = (new DateTime())->modify('+' . REMEMBER_DAYS . ' days');

    $stmt = $conn->prepare(
        "INSERT INTO RememberTokens (user_id, selector, token_hash, expires_at) VALUES (:uid, :sel, :hash, :exp)"
    );
    $stmt->execute([
        ':uid'  => $userId,
        ':sel'  => $selector,
        ':hash' => $validatorHash,
        ':exp'  => $expiresAt->format('Y-m-d H:i:s'),
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
        "SELECT rt.id, rt.token_hash, rt.expires_at, u.id AS user_id, u.username, u.first_name, u.employee_id, u.role
         FROM RememberTokens rt JOIN Users u ON u.id = rt.user_id
         WHERE rt.selector = :sel"
    );
    $stmt->execute([':sel' => $selector]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return false;

    // token หมดอายุ หรือ validator ไม่ตรง -> ลบทิ้ง กันใช้ซ้ำ (คนละคนพยายามเดา selector/validator)
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

    issueRememberToken($conn, (int)$row['user_id'], $isHttps);
    return true;
}
