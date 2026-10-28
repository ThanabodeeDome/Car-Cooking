<?php
// 🌟 Router สำหรับ `php -S` (dev server เท่านั้น) — จำลอง IIS web.config
//   1) rule "PHP_via_FastCGI_html": .html รันโค้ด PHP ฝังในไฟล์ได้เหมือน .php
//   2) กฎ URL สะอาดชุดเดียวกับ web.config (ไม่เห็น /Car/ และ .html) — ถ้าแก้กฎใน web.config ต้องแก้ที่นี่ให้ตรงกัน
$uri  = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$path = ltrim($uri, '/');
$qs   = $_SERVER['QUERY_STRING'] ?? '';

$clean = [
    'login' => 'Car/index.html',
    'booking' => 'Car/booking.html',
    'queue' => 'Car/car-status.html',
    'history' => 'Car/booking-details.html',
    'cars' => 'Car/car-details.html',
    'checkin' => 'Car/checkin.html',
    'return' => 'Car/return_scan.html',
    'profile' => 'Car/profile.html',
    'scan' => 'Car/scan.php',
    'guard' => 'Car/guard.html',
];
$old = [
    'index' => 'login',
    'booking' => 'booking',
    'car-status' => 'queue',
    'booking-details' => 'history',
    'car-details' => 'cars',
    'checkin' => 'checkin',
    'return_scan' => 'return',
    'profile' => 'profile',
    'guard' => 'guard',
];

function go($to, $qs) { header('Location: ' . $to . ($qs !== '' ? '?' . $qs : ''), true, 302); return true; }
function serve($file) {
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if ($ext === 'php' || $ext === 'html') { chdir(dirname($file)); require $file; return true; }
    $mime = ['css' => 'text/css', 'js' => 'application/javascript', 'json' => 'application/json', 'png' => 'image/png', 'jpg' => 'image/jpeg',
             'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon',
             'woff' => 'font/woff', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'map' => 'application/json'];
    header('Content-Type: ' . ($mime[$ext] ?? 'application/octet-stream'));
    readfile($file);
    return true;
}

if ($path === '') return serve(__DIR__ . '/Car/homepage.html');
if (preg_match('#^Car/?$#', $path)) return go('/', $qs);
if (preg_match('#^(login|booking|queue|history|cars|checkin|return|profile|scan|guard)(?:/|\.html)$#', $path, $mm)) return go('/' . $mm[1], $qs);
if (preg_match('#^(?:Car/)?homepage\.html$#', $path)) return go('/', $qs);
if (preg_match('#^(?:Car/)?([A-Za-z0-9_\-]+)\.html$#', $path, $m) && isset($old[$m[1]])) return go('/' . $old[$m[1]], $qs);
if ($path === 'Car/scan.php') return go('/scan', $qs);
if (preg_match('#^(?:admin|Admin/index\.html)$#', $path)) return go('/Admin/', $qs);
if (preg_match('#^([a-z]+)/?$#', $path, $m) && isset($clean[$m[1]])) return serve(__DIR__ . '/' . $clean[$m[1]]);

// ไฟล์ที่มีจริงที่รากเว็บ/ใน Admin/Car ให้ server จัดการตามปกติ
$real = __DIR__ . '/' . $path;
if (is_file($real)) {
    if (preg_match('/\.html$/', $path)) return serve($real); // .html ทุกไฟล์รัน PHP (เหมือน IIS handler)
    return false;
}
// relative asset/API ที่หน้า URL สะอาดเรียก -> หยิบจาก Car/
if (!preg_match('#^(Car|Admin|\.git)/#', $path) && strpos($path, '..') === false
    && preg_match('#(\.(css|js|json|php|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map)$|^assets/|^uploads/)#', $path) && is_file(__DIR__ . '/Car/' . $path)) {
    return serve(__DIR__ . '/Car/' . $path);
}
if (is_dir($real) && is_file($real . '/index.html')) return serve($real . '/index.html');
return false;
