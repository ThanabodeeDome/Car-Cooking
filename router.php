<?php
// 🌟 Router สำหรับ `php -S` (dev server เท่านั้น) — จำลอง IIS web.config rule
// "PHP_via_FastCGI_html" ที่ทำให้ .html รันโค้ด PHP ฝังในไฟล์ได้เหมือน .php
// ถ้าไม่มี router นี้ php -S จะ serve .html เป็น static text ดิบๆ ข้าม guard_user.php ทั้งหมด
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$file = __DIR__ . $uri;

if ($uri !== '/' && preg_match('/\.html$/', $uri) && is_file($file)) {
    chdir(dirname($file));
    require $file;
    return true;
}

return false; // ปล่อยให้ built-in server จัดการเอง (.php ปกติ, static asset, ฯลฯ)
