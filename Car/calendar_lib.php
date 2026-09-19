<?php
// Helpers for the calendar feed (calendar.php / get_calendar_link.php).

function calendar_secret(): string {
    $f = __DIR__ . '/app_secret.php';
    if (!is_file($f)) {
        file_put_contents($f, "<?php return '" . bin2hex(random_bytes(32)) . "';\n", LOCK_EX);
    }
    return (string)(require $f);
}

function calendar_token(int $userId): string {
    return substr(hash_hmac('sha256', 'cal:' . $userId, calendar_secret()), 0, 32);
}

// http(s)://host/Car — honours Cloudflare Tunnel / proxy headers
function calendar_base_url(): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
    $host = trim(explode(',', $host)[0]);
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/Car/x.php')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $path;
}

function ics_escape(string $s): string {
    return str_replace(["\\", ";", ",", "\r\n", "\n", "\r"], ["\\\\", "\\;", "\\,", "\\n", "\\n", "\\n"], $s);
}

// RFC 5545: lines max 75 octets, continuation lines start with one space (never split a UTF-8 char)
function ics_fold(string $line): string {
    $out = '';
    $cur = 0;
    foreach (preg_split('//u', $line, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
        $len = strlen($ch);
        if ($cur + $len > 74) {
            $out .= "\r\n ";
            $cur = 1;
        }
        $out .= $ch;
        $cur += $len;
    }
    return $out . "\r\n";
}

function calendar_build(array $rows, string $baseUrl): string {
    $tz = new DateTimeZone('Asia/Bangkok');
    $L = [];
    $L[] = 'BEGIN:VCALENDAR';
    $L[] = 'VERSION:2.0';
    $L[] = 'PRODID:-//Car Booking//TH';
    $L[] = 'CALSCALE:GREGORIAN';
    $L[] = 'METHOD:PUBLISH';
    $L[] = 'X-WR-CALNAME:จองรถ';
    $L[] = 'X-WR-TIMEZONE:Asia/Bangkok';
    $L[] = 'REFRESH-INTERVAL;VALUE=DURATION:PT30M';
    $L[] = 'X-PUBLISHED-TTL:PT30M';
    $L[] = 'BEGIN:VTIMEZONE';
    $L[] = 'TZID:Asia/Bangkok';
    $L[] = 'BEGIN:STANDARD';
    $L[] = 'DTSTART:19700101T000000';
    $L[] = 'TZOFFSETFROM:+0700';
    $L[] = 'TZOFFSETTO:+0700';
    $L[] = 'TZNAME:ICT';
    $L[] = 'END:STANDARD';
    $L[] = 'END:VTIMEZONE';

    $stamp = gmdate('Ymd\THis\Z');
    foreach ($rows as $b) {
        $date = substr((string)$b['BookingDate'], 0, 10);
        $out = substr((string)$b['OutTime'], 0, 5);
        $ret = substr((string)$b['PlannedReturnTime'], 0, 5);
        if (!$date || !$out || !$ret) continue;
        $start = DateTime::createFromFormat('Y-m-d H:i', "$date $out", $tz);
        $end = DateTime::createFromFormat('Y-m-d H:i', "$date $ret", $tz);
        if (!$start || !$end) continue;
        if ($ret <= $out) $end->modify('+1 day'); // overnight

        $inUse = $b['BookingStatus'] === 'ขาไป';
        $desc = "ผู้ขับ: {$b['DriverName']}\n"
              . ($b['Passengers'] ? "ผู้ร่วมเดินทาง: {$b['Passengers']}\n" : '')
              . "เลขที่จอง: {$b['BookingNumber']}\n"
              . ($inUse ? "สถานะ: กำลังใช้งาน (อย่าลืมสแกนคืนรถ)\n" : "ก่อนออกรถ สแกน QR ที่รถเพื่อเช็คอิน\n")
              . "ดูรายละเอียด: {$baseUrl}/booking-details.html";

        $L[] = 'BEGIN:VEVENT';
        $L[] = 'UID:carbooking-' . $b['BookingID'] . '@carbooking';
        $L[] = 'DTSTAMP:' . $stamp;
        $L[] = 'DTSTART;TZID=Asia/Bangkok:' . $start->format('Ymd\THis');
        $L[] = 'DTEND;TZID=Asia/Bangkok:' . $end->format('Ymd\THis');
        $L[] = 'SUMMARY:' . ics_escape('จองรถ ' . $b['CarPlate'] . ($inUse ? ' (ใช้งานอยู่)' : ''));
        if (!empty($b['Destination'])) $L[] = 'LOCATION:' . ics_escape((string)$b['Destination']);
        $L[] = 'DESCRIPTION:' . ics_escape($desc);
        $L[] = 'URL:' . $baseUrl . '/booking-details.html';
        foreach ([60, 15] as $m) {
            $L[] = 'BEGIN:VALARM';
            $L[] = 'ACTION:DISPLAY';
            $L[] = 'DESCRIPTION:' . ics_escape('อีก ' . $m . ' นาทีถึงเวลาใช้รถ ' . $b['CarPlate']);
            $L[] = 'TRIGGER:-PT' . $m . 'M';
            $L[] = 'END:VALARM';
        }
        $L[] = 'END:VEVENT';
    }
    $L[] = 'END:VCALENDAR';
    return implode('', array_map('ics_fold', $L));
}
