<?php
// ทดสอบส่งอีเมล:  C:\PHP\php.exe Car\mail_test.php you@example.com
// แสดงสาเหตุที่ส่งไม่ได้ (รหัสผิด / พอร์ตถูกบล็อก / ยังไม่เปิด enabled) ต่างจากตอนใช้งานจริงที่แค่บันทึก log
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

require_once __DIR__ . '/mailer.php';

$to = $argv[1] ?? '';
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    echo "ใช้: php Car\\mail_test.php ชื่อ@อีเมล.com\n";
    exit(1);
}

$cfg = mail_cfg();
if (empty($cfg['enabled'])) {
    echo "ยังไม่เปิดอีเมล: แก้ Car/mail_config.php ตั้ง 'enabled' => true และกรอก host/username/password ก่อน\n";
    exit(1);
}
if (($cfg['username'] ?? '') === 'your-account@gmail.com' || ($cfg['password'] ?? '') === 'app-password-here') {
    echo "ยังไม่ได้กรอก username/password จริงใน Car/mail_config.php\n";
    exit(1);
}

try {
    $m = mail_build($cfg, [$to], 'ทดสอบอีเมลจากระบบจองรถ', mail_layout('ทดสอบอีเมล', '<p>ถ้าเห็นอีเมลนี้ แปลว่าตั้งค่า SMTP ถูกต้องแล้ว</p>', mail_base_url() . '/homepage.html'));
    $m->SMTPDebug = 0;
    $m->send();
    echo "ส่งสำเร็จ -> $to (ถ้าไม่เห็นในกล่องจดหมาย ลองดูโฟลเดอร์สแปม)\n";
} catch (Throwable $e) {
    echo "ส่งไม่สำเร็จ: " . $e->getMessage() . "\n";
    exit(1);
}
