<?php
// เปิด session ด้วยค่าความปลอดภัยชุดเดียวกันทุกไฟล์
// เดิม: login_process.php / guard_admin.php ตั้ง cookie params ครบ (secure+httponly+samesite)
//       แต่ guard_user.php กับ API ฝั่ง Car เรียก session_start() เปล่าๆ -> cookie ที่ "เกิดครั้งแรก"
//       ตอนยังไม่ login จะไม่มี HttpOnly/Secure เลย (ตามค่า php.ini ของเครื่องนี้ที่ปิดไว้ทั้งคู่)
// ใหม่: ใครจะเปิด session ให้เรียก cb_session_start() ที่เดียวพอ

function cb_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'); // เผื่อผ่าน Cloudflare Tunnel
}

function cb_session_start(): void
{
    @ini_set('display_errors', '0'); // 🔒 ห้ามโชว์ error/path ของ PHP ให้ผู้ใช้เห็น (ยังลง log ตามปกติ)
    if (session_status() !== PHP_SESSION_NONE) return; // มีคนเปิดไปแล้ว ไม่ต้องทำซ้ำ

    // 🔒 use_strict_mode: ไม่ยอมรับ session id ที่ยังไม่เคยมีจริงในเซิร์ฟเวอร์
    //    (php.ini เครื่องนี้ปิดไว้ = ใครยัด PHPSESSID ค่าอะไรมา PHP สร้างให้ตามนั้น -> session fixation)
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.use_only_cookies', '1'); // ห้ามรับ session id จาก URL

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => cb_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}
