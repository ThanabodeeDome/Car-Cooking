<?php
// นโยบายอายุ session + ผูก session กับเครื่องที่ login + "logout = ตัดทุกเครื่อง"
//
// ปัญหาที่แก้ (พบจากเคสจริง: ส่งลิงก์ให้คนอื่นแล้วเขาเข้าหน้า Admin ได้โดยไม่ต้อง login)
//   เครื่องที่ "เคย" login แอดมินไว้ จะค้างสิทธิ์อยู่แบบไม่มีวันหมด เพราะ
//   1) cookie PHPSESSID เป็นแบบ lifetime=0 (ตายเมื่อปิดเบราว์เซอร์) แต่มือถือแทบไม่เคยปิดเบราว์เซอร์จริง
//   2) กระดิ่งแจ้งเตือนยิง get_notifications.php ทุก 60 วินาที -> session ไม่เคยหมดอายุตาม gc_maxlifetime
//   3) logout.php ทำลายแค่ session ของเครื่องที่กดเท่านั้น เครื่องอื่นของ user เดียวกันยังใช้ได้ต่อ
//
// กลไกที่ใส่เพิ่ม 4 ชั้น
//   - อายุนับจากตอน login (absolute): ต่อให้ใช้งานต่อเนื่องแค่ไหน ก็ต้อง login ใหม่เมื่อครบเวลา
//   - อายุนับจากการใช้งานครั้งล่าสุด (idle)
//   - ผูกกับ User-Agent ของเครื่องที่ login: cookie ที่หลุดไปเปิดในเครื่องอื่นใช้ไม่ได้
//   - ทะเบียน revoke: logout ครั้งเดียว ตัดทุกเครื่องของ user คนนั้นทันที
//
// session ที่เกิด "ก่อน" ไฟล์นี้ (ไม่มี field cb_*) ถือว่าหมดอายุทันที = ทุกคนต้อง login ใหม่หนึ่งครั้ง
// (ฝั่งผู้ใช้ทั่วไปที่ติ๊กจดจำฉันไว้ จะ login กลับให้เองเงียบๆ ไม่รู้สึกอะไร ส่วนแอดมินกรอกใหม่ครั้งเดียว)

require_once __DIR__ . '/session_boot.php';

const CB_ADMIN_IDLE_SECONDS = 2 * 3600;       // แอดมินหยุดใช้งาน 2 ชม. -> ต้อง login ใหม่
const CB_ADMIN_MAX_SECONDS  = 10 * 3600;      // และไม่เกิน 10 ชม. ต่อการ login หนึ่งครั้ง (ประมาณหนึ่งวันทำงาน)
const CB_USER_IDLE_SECONDS  = 24 * 3600;      // ผู้ใช้ทั่วไปผ่อนได้ เพราะมี remember-me คุมอยู่แล้ว
const CB_USER_MAX_SECONDS   = 30 * 24 * 3600;

// โฟลเดอร์เก็บสถานะ (นอก webroot เหมือน ocr log) เปิดดูผ่านเว็บไม่ได้
function cb_state_dir(): ?string
{
    static $dir = null;
    if ($dir !== null) return $dir ?: null;

    $candidates = [
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'logs',          // D:\CarBooking\logs
        sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'carbooking_logs',
    ];
    foreach ($candidates as $c) {
        if (!is_dir($c)) @mkdir($c, 0770, true);
        if (is_dir($c) && is_writable($c)) return $dir = $c;
    }
    $dir = '';
    return null;
}

function cb_revoke_file(): ?string
{
    $dir = cb_state_dir();
    return $dir ? $dir . DIRECTORY_SEPARATOR . 'session_revoked.json' : null;
}

// ลายนิ้วมือเครื่อง — ใช้ User-Agent เท่านั้น (ห้ามใช้ IP: มือถือสลับ 4G/WiFi แล้ว IP เปลี่ยน
// จะเตะผู้ใช้ออกกลางทางทั้งที่ไม่มีอะไรผิด)
function cb_device_hash(): string
{
    return hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
}

// ประทับตราตอน login สำเร็จ (ทั้งจากฟอร์ม และจาก remember-me)
function cb_session_mark_login(): void
{
    $_SESSION['cb_login_at'] = time();
    $_SESSION['cb_seen_at']  = time();
    $_SESSION['cb_device']   = cb_device_hash();
}

function cb_revoked_at(int $userId): int
{
    $file = cb_revoke_file();
    if (!$file || !is_file($file)) return 0;
    $data = json_decode((string)@file_get_contents($file), true);
    return is_array($data) ? (int)($data[(string)$userId] ?? 0) : 0;
}

// ตัดทุก session ของ user คนนี้ (ใช้ตอน logout) — session ที่ login ก่อนเวลานี้ใช้ต่อไม่ได้
function cb_revoke_user_sessions(int $userId): void
{
    $file = cb_revoke_file();
    if (!$file) return;
    try {
        $fp = @fopen($file, 'c+');
        if (!$fp) return;
        @flock($fp, LOCK_EX);
        $raw  = stream_get_contents($fp);
        $data = json_decode((string)$raw, true);
        if (!is_array($data)) $data = [];
        $data[(string)$userId] = time();
        if (count($data) > 500) $data = array_slice($data, -500, null, true); // กันไฟล์โตไม่จำกัด
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, (string)json_encode($data));
        @flock($fp, LOCK_UN);
        fclose($fp);
    } catch (Throwable $e) {
        // เขียนทะเบียนไม่ได้ก็ไม่เป็นไร ชั้นอื่น (อายุ session / ผูกเครื่อง) ยังทำงานอยู่
    }
}

// ล้าง session ปัจจุบันให้ว่าง แต่ยังคง session ไว้ "active"
// (ห้ามใช้ session_destroy() ที่นี่ เพราะหลังจากนี้ guard_user.php จะลอง login
//  ด้วย remember-me ซึ่งต้องใช้ session_regenerate_id() ที่ต้องมี session active อยู่)
function cb_clear_session(bool $alsoDropRememberCookie = false): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        @session_regenerate_id(true); // ทิ้งไฟล์ session เดิมไปเลย แล้วได้ id ใหม่ที่ว่างเปล่า
    }
    if ($alsoDropRememberCookie && !empty($_COOKIE['remember_me'])) {
        setcookie('remember_me', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'secure'   => cb_is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        unset($_COOKIE['remember_me']);
    }
}

// เรียกหลังเปิด session และก่อนเช็คสิทธิ์ทุกครั้ง — ถ้าไม่ผ่านนโยบาย จะล้าง session ให้
// คืนค่าเหตุผลที่ตัด ('' = ผ่าน) เอาไว้ log/debug ได้
function cb_enforce_session_policy(): string
{
    static $done = null;
    if ($done !== null) return $done; // เรียกซ้ำในหนึ่ง request ไม่ต้องทำงานใหม่

    if (session_status() !== PHP_SESSION_ACTIVE || !isset($_SESSION['user_id'])) {
        return $done = ''; // ยังไม่ login — ปล่อยให้ guard เดิมจัดการเรื่องเด้งหน้า
    }

    $uid     = (int)$_SESSION['user_id'];
    $isAdmin = strtolower((string)($_SESSION['role'] ?? '')) === 'admin';
    $now     = time();
    $loginAt = (int)($_SESSION['cb_login_at'] ?? 0);
    $seenAt  = (int)($_SESSION['cb_seen_at'] ?? 0);
    $device  = (string)($_SESSION['cb_device'] ?? '');
    $idleMax = $isAdmin ? CB_ADMIN_IDLE_SECONDS : CB_USER_IDLE_SECONDS;
    $absMax  = $isAdmin ? CB_ADMIN_MAX_SECONDS  : CB_USER_MAX_SECONDS;

    // session ที่เกิดก่อนมีไฟล์นี้ ไม่มีตรา cb_* ติดมา เราไม่รู้ว่า login มาตั้งแต่เมื่อไร
    // -> ถือว่า "login มานานแล้ว (1 วัน)" แล้วปล่อยให้กฎอายุข้างล่างตัดสินต่อ ผลคือ
    //    แอดมิน (absolute 10 ชม.) หมดอายุทันที = เครื่องที่ค้างสิทธิ์แอดมินอยู่ถูกตัดทันทีที่ขอหน้าใหม่
    //    ผู้ใช้ทั่วไป (absolute 30 วัน) ใช้งานต่อได้ ไม่สะดุดกลางวันทำงาน
    if (!$loginAt || !$seenAt || $device === '') {
        $_SESSION['cb_login_at'] = $loginAt = $now - 86400;
        $_SESSION['cb_seen_at']  = $seenAt  = $now;
        $_SESSION['cb_device']   = $device  = cb_device_hash();
    }

    $reason = '';
    if (!hash_equals($device, cb_device_hash())) {
        $reason = 'device';                       // cookie ถูกเอาไปใช้ในเครื่อง/เบราว์เซอร์อื่น
    } elseif ($now - $seenAt > $idleMax) {
        $reason = 'idle';
    } elseif ($now - $loginAt > $absMax) {
        $reason = 'expired';
    } elseif ($loginAt < cb_revoked_at($uid)) {
        $reason = 'revoked';                      // เจ้าตัวกด logout ที่เครื่องใดเครื่องหนึ่งแล้ว
    }

    if ($reason !== '') {
        cb_clear_session($reason === 'device');
        return $done = $reason;
    }

    $_SESSION['cb_seen_at'] = $now;
    return $done = '';
}
