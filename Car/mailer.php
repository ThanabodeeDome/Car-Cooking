<?php
// Free email sender (PHPMailer + any SMTP). Never throws: failures are logged and return false.
require_once __DIR__ . '/lib/PHPMailer/src/Exception.php';
require_once __DIR__ . '/lib/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/lib/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

function mail_cfg(): array {
    static $cfg = null;
    if ($cfg === null) {
        $f = __DIR__ . '/mail_config.php';
        $cfg = is_file($f) ? (require $f) : ['enabled' => false];
    }
    return $cfg;
}

function mail_build(array $cfg, $to, string $subject, string $htmlBody): PHPMailer {
    $m = new PHPMailer(true);
    $m->CharSet = 'UTF-8';
    $m->isSMTP();
    $m->Host = $cfg['host'];
    $m->Port = (int)$cfg['port'];
    $m->SMTPAuth = ($cfg['username'] ?? '') !== '';
    $m->Username = $cfg['username'] ?? '';
    $m->Password = $cfg['password'] ?? '';
    $m->SMTPSecure = $cfg['secure'] ?? '';
    $m->SMTPAutoTLS = ($cfg['secure'] ?? '') !== '';
    $m->Timeout = 5;
    $m->setFrom($cfg['from_email'], $cfg['from_name'] ?? '');
    foreach ((array)$to as $addr) $m->addAddress($addr);
    $m->isHTML(true);
    $m->Subject = $subject;
    $m->Body = $htmlBody;
    $m->AltBody = trim(html_entity_decode(strip_tags(str_replace(['<br>', '</p>'], "\n", $htmlBody))));
    return $m;
}

// $to: string|string[]. Returns true on success (or when disabled = silently skipped => false).
function sendAppMail($to, string $subject, string $htmlBody): bool {
    $cfg = mail_cfg();
    $to = array_values(array_filter((array)$to, fn($a) => filter_var($a, FILTER_VALIDATE_EMAIL)));
    if (empty($cfg['enabled']) || !$to) return false;
    try {
        mail_build($cfg, $to, $subject, $htmlBody)->send();
        return true;
    } catch (Throwable $e) {
        error_log('sendAppMail failed: ' . $e->getMessage());
        return false;
    }
}

function mail_layout(string $title, string $bodyHtml, ?string $linkUrl = null, string $linkText = 'เปิดระบบจองรถ'): string {
    $t = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $btn = $linkUrl ? '<p><a href="' . htmlspecialchars($linkUrl, ENT_QUOTES, 'UTF-8') . '" style="background:#e11d2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">' . htmlspecialchars($linkText, ENT_QUOTES, 'UTF-8') . '</a></p>' : '';
    return '<div style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;padding:20px">'
         . "<h2 style=\"margin:0 0 12px;color:#111\">$t</h2>$bodyHtml$btn"
         . '<p style="color:#9ca3af;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบจองรถ</p></div>';
}

function mail_base_url(): string {
    return rtrim(mail_cfg()['base_url'] ?? '', '/');
}

// Booking confirmation to driver + passengers. Called after the DB commit; must never affect the booking.
function mail_booking_confirmation(PDO $conn, array $b): void {
    if (empty(mail_cfg()['enabled'])) return;
    try {
        $ids = array_filter(array_map('trim', array_merge([$b['employee_id']], explode(',', (string)($b['passenger_ids'] ?? '')))));
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $st = $conn->prepare("SELECT employee_id, email FROM Users WHERE employee_id IN ($ph)");
        $st->execute(array_values($ids));
        $emails = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $emails[$r['employee_id']] = $r['email'];

        $e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
        $body = '<p>เลขที่จอง <b>' . $e($b['booking_number']) . '</b></p>'
              . '<p>รถ: <b>' . $e($b['car_plate']) . '</b><br>วันที่: ' . $e($b['use_date']) . ' เวลา ' . $e($b['out_time']) . ' - ' . $e($b['planned_return_time']) . ' น.'
              . '<br>ผู้ขับ: ' . $e($b['driver_name']) . '<br>ปลายทาง: ' . $e($b['destination'] ?: '-') . '</p>'
              . '<p>ก่อนออกรถ กรุณาสแกน QR ที่รถเพื่อเช็คอิน และสแกนคืนรถเมื่อใช้เสร็จ</p>';
        $html = mail_layout('ยืนยันการจองรถ ' . $b['car_plate'], $body, mail_base_url() . '/booking-details.html');
        foreach ($emails as $addr) sendAppMail($addr, 'ยืนยันการจองรถ ' . $b['car_plate'] . ' ' . $b['use_date'], $html);
    } catch (Throwable $e) {
        error_log('mail_booking_confirmation: ' . $e->getMessage());
    }
}
