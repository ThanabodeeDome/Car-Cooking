<?php
// Email reminders. Run from Windows Task Scheduler every 5 minutes:
//   C:\PHP\php.exe C:\path\to\Car\notify_cron.php          (add --dry-run to only print)
// No DB writes: "already sent" state lives in a small JSON file in the system temp dir.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/notify_lib.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/auto_cancel_noshows.php';

$dry = in_array('--dry-run', $argv, true);
$cfg = mail_cfg();
if (!$dry && empty($cfg['enabled'])) { echo "mail disabled (Car/mail_config.php)\n"; exit(0); }

$stateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'car_notify_sent.json';
$sent = is_file($stateFile) ? (json_decode((string)file_get_contents($stateFile), true) ?: []) : [];
$cut = time() - 3 * 86400;
$sent = array_filter($sent, fn($t) => $t > $cut);

if (!$dry) autoReleaseNoShows($conn);
$now  = nt_now();
$rows = nt_fetch_window_bookings($conn);
$emails = [];
foreach ($conn->query("SELECT employee_id, email FROM Users")->fetchAll(PDO::FETCH_ASSOC) as $u) $emails[$u['employee_id']] = $u['email'];
$base = mail_base_url();
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$count = 0;

$send = function (string $key, $to, string $subject, string $html) use (&$sent, $dry, &$count) {
    if (isset($sent[$key])) return;
    $to = array_filter((array)$to);
    if (!$to) return;
    echo ($dry ? '[dry] ' : '') . "$key -> " . implode(',', $to) . " : $subject\n";
    if ($dry || sendAppMail($to, $subject, $html)) { if (!$dry) $sent[$key] = time(); $count++; }
};

foreach ($rows as $b) {
    $range = nt_range($b);
    if (!$range) continue;
    [$start, $end] = $range;
    $plate = $b['CarPlate'];
    $minToStart = (int)floor(($start->getTimestamp() - $now->getTimestamp()) / 60);
    $minLate    = (int)floor(($now->getTimestamp() - $end->getTimestamp()) / 60);
    $driverMail = $emails[$b['EmployeeID']] ?? null;

    if ($b['BookingStatus'] === 'จองแล้ว' && empty($b['CheckInTime']) && $minToStart > 0 && $minToStart <= 60) {
        $body = "<p>อีก <b>$minToStart นาที</b> ถึงเวลารับรถ <b>{$e($plate)}</b> (ออก {$start->format('H:i')} น.)</p><p>ไปที่รถแล้วสแกน QR เพื่อเช็คอิน หากไม่ใช้รถแล้วกรุณายกเลิกการจอง</p>";
        $send("mail_soon:{$b['BookingID']}", $driverMail, "ใกล้ถึงเวลารับรถ $plate", mail_layout("ใกล้ถึงเวลารับรถ $plate", $body, "$base/booking-details.html", 'ดูรายการจอง'));
    }

    if ($b['BookingStatus'] === 'ขาไป' && $minLate > 0) {
        $dur = nt_fmt_duration($minLate);
        $body = "<p>รถ <b>{$e($plate)}</b> เลยกำหนดคืน ({$end->format('H:i')} น.) มา $dur แล้ว</p><p>กรุณาคืนรถและสแกน QR บันทึกไมล์</p>";
        $send("mail_overdue:{$b['BookingID']}", $driverMail, "เลยเวลาคืนรถ $plate", mail_layout("เลยเวลาคืนรถ $plate", $body, "$base/return_scan.html?plate=" . rawurlencode($plate), 'คืนรถ'));
        if ($minLate > 15 && !empty($cfg['admin_emails'])) {
            $abody = "<p>รถ <b>{$e($plate)}</b> เลยเวลาคืน $dur<br>ผู้ใช้: {$e($b['DriverName'])}</p>";
            $send("mail_a_overdue:{$b['BookingID']}", $cfg['admin_emails'], "รถ $plate เลยเวลาคืน", mail_layout("รถ $plate เลยเวลาคืน", $abody));
        }
    }
}

if (!$dry) file_put_contents($stateFile, json_encode($sent));
echo "done, $count mail(s)\n";
