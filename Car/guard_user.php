<?php
// เปิด session ด้วยค่า cookie ที่ปลอดภัยชุดเดียวกันทุกไฟล์ (secure/httponly/samesite + strict mode)
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

// 🔒 ตัด session ที่หมดอายุ / ถูกกด logout จากเครื่องอื่น / cookie ถูกเอาไปเปิดในเครื่องอื่น
//    ทำก่อนบล็อก remember-me ข้างล่าง เพื่อให้คนที่ติ๊ก "จดจำฉัน" ไว้ login กลับได้เองเงียบๆ
cb_enforce_session_policy();

// 🌟 ถ้า session หมด (เช่นปิดเบราว์เซอร์มา) ลองใช้ remember-me cookie login เงียบๆ ก่อนเด้งไปหน้า login
if (!isset($_SESSION['user_id']) && !empty($_COOKIE['remember_me'])) {
    require_once __DIR__ . '/db_connect.php';
    require_once __DIR__ . '/remember_helpers.php';
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    tryRememberLogin($conn, $isHttps);
}

if (!isset($_SESSION['user_id'])) {
    // 🌟 จำหน้าที่ตั้งใจจะเข้าไว้ (เช่น checkin.php?plate=กข1234 จากการสแกน QR)
    // ส่งไปเป็น query string ?redirect=... ให้หน้า login อ่านแล้วส่งต่อให้ login_process.php
    $intended = $_SERVER['REQUEST_URI'] ?? '';
    $safeRedirect = ltrim($intended, '/'); // relative เท่านั้น กัน open-redirect ไปโดเมนอื่น

    // 🩹 ตัด "Car/" ที่ขึ้นต้นออก เพราะ login_process.php เองก็อยู่ใน /Car/ อยู่แล้ว
    // ถ้าไม่ตัด จะกลายเป็น Car/Car/homepage.html ซ้ำกัน ตอน redirect หลัง login (404)
    if (strpos($safeRedirect, 'Car/') === 0) {
        $safeRedirect = substr($safeRedirect, 4);
    }

    // 🌟 URL สะอาด (/booking, /queue ...) -> แปลงกลับเป็นชื่อไฟล์จริงก่อนส่งไปหน้า login (login_process.php รับเฉพาะ .html/.php)
    $cleanToFile = ['booking' => 'booking.html', 'queue' => 'car-status.html', 'history' => 'booking-details.html', 'cars' => 'car-details.html',
                    'checkin' => 'checkin.html', 'return' => 'return_scan.html', 'profile' => 'profile.html', 'scan' => 'scan.php'];
    $pathOnly = trim((string)parse_url('/' . $safeRedirect, PHP_URL_PATH), '/');
    $queryOnly = (string)parse_url('/' . $safeRedirect, PHP_URL_QUERY);
    if ($pathOnly === '') {
        $safeRedirect = 'homepage.html' . ($queryOnly !== '' ? '?' . $queryOnly : '');
    } elseif (isset($cleanToFile[$pathOnly])) {
        $safeRedirect = $cleanToFile[$pathOnly] . ($queryOnly !== '' ? '?' . $queryOnly : '');
    }

    header("Location: index.html?redirect=" . urlencode($safeRedirect));
    exit;
}