<?php
// Notification core — used by the bell (get_notifications.php) and the email cron (notify_cron.php).
// 100% derived from existing tables (CarBookings / Cars / Users). Never writes to the DB.

function nt_now(): DateTime {
    return new DateTime('now', new DateTimeZone('Asia/Bangkok'));
}

// [start, end] DateTime of a booking row (end rolls to next day when return <= out = overnight trip)
function nt_range(array $b): ?array {
    $date = substr((string)($b['BookingDate'] ?? ''), 0, 10);
    $out  = substr((string)($b['OutTime'] ?? ''), 0, 5);
    $ret  = substr((string)($b['PlannedReturnTime'] ?? ''), 0, 5);
    if (!$date || !$out || !$ret) return null;
    $tz = new DateTimeZone('Asia/Bangkok');
    $start = DateTime::createFromFormat('Y-m-d H:i', "$date $out", $tz);
    $end   = DateTime::createFromFormat('Y-m-d H:i', "$date $ret", $tz);
    if (!$start || !$end) return null;
    if ($ret <= $out) $end->modify('+1 day');
    return [$start, $end];
}

function nt_fmt_duration(int $minutes): string {
    $minutes = max(0, $minutes);
    $h = intdiv($minutes, 60);
    $m = $minutes % 60;
    if ($h > 0 && $m > 0) return "$h ชม. $m นาที";
    if ($h > 0) return "$h ชม.";
    return "$m นาที";
}

// Bookings around today (yesterday..tomorrow) that can matter for reminders.
function nt_fetch_window_bookings(PDO $conn, ?string $employeeId = null): array {
    $tz = new DateTimeZone('Asia/Bangkok');
    $today = new DateTime('today', $tz);
    $d1 = (clone $today)->modify('-1 day')->format('Y-m-d');
    $d2 = (clone $today)->modify('+1 day')->format('Y-m-d');

    $sql = "SELECT BookingID, BookingNumber, CarPlate, DriverName, EmployeeID, Destination, BookingStatus,
                   CONVERT(varchar(10), BookingDate, 23) AS BookingDate, OutTime,
                   CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime,
                   CheckInTime, PassengerIDs
            FROM CarBookings
            WHERE BookingDate BETWEEN :d1 AND :d2";
    $params = [':d1' => $d1, ':d2' => $d2];
    if ($employeeId !== null) {
        $sql .= " AND (EmployeeID = :emp OR ',' + REPLACE(ISNULL(PassengerIDs, ''), ' ', '') + ',' LIKE :pass)";
        $params[':emp']  = $employeeId;
        $params[':pass'] = '%,' . $employeeId . ',%';
    }
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function nt_item(string $id, string $level, string $title, string $body, string $link, ?DateTime $ts = null): array {
    return ['id' => $id, 'level' => $level, 'title' => $title, 'body' => $body, 'link' => $link, 'ts' => ($ts ?? nt_now())->format('c')];
}

// Notifications for one logged-in user (+ extra admin items when $isAdmin).
function nt_collect_for_user(PDO $conn, string $employeeId, bool $isAdmin): array {
    $items = nt_build_user_items(nt_fetch_window_bookings($conn, $employeeId), $employeeId, nt_now());
    if ($isAdmin) {
        $items = array_merge($items, nt_collect_admin($conn));
    }
    return nt_sort_items($items);
}

// Pure logic (no DB) so it can be unit-tested with fake rows.
function nt_build_user_items(array $rows, string $employeeId, DateTime $now): array {
    $items = [];

    foreach ($rows as $b) {
        $range = nt_range($b);
        if (!$range) continue;
        [$start, $end] = $range;
        $plate  = $b['CarPlate'];
        $status = $b['BookingStatus'];
        $isDriver = $b['EmployeeID'] === $employeeId;
        $minToStart = (int)floor(($start->getTimestamp() - $now->getTimestamp()) / 60);
        $minLate    = (int)floor(($now->getTimestamp() - $end->getTimestamp()) / 60);
        $label = $start->format('H:i') . '-' . $end->format('H:i') . ' น.';

        if (!$isDriver) {
            $paxIds = array_map('trim', explode(',', (string)($b['PassengerIDs'] ?? '')));
            if (!in_array($employeeId, $paxIds, true)) continue;
            // passenger: only heads-up for a trip starting within 24h
            if ($status === 'จองแล้ว' && $minToStart > -60 && $minToStart <= 1440) {
                $items[] = nt_item("pax:{$b['BookingID']}", 'info', 'คุณเป็นผู้ร่วมเดินทาง',
                    "รถ $plate ออกเวลา " . $start->format('d/m H:i') . " น. (ผู้ขับ: {$b['DriverName']})", 'booking-details.html', $start);
            }
            continue;
        }

        if ($status === 'จองแล้ว' && empty($b['CheckInTime'])) {
            if ($minToStart > 60 && $minToStart <= 1440) {
                $items[] = nt_item("upcoming:{$b['BookingID']}", 'info', "มีการจองรถ $plate",
                    ($start->format('Y-m-d') === $now->format('Y-m-d') ? 'วันนี้' : 'พรุ่งนี้') . " $label ไปที่: " . ($b['Destination'] ?: '-'), 'booking-details.html', $start);
            } elseif ($minToStart > 0 && $minToStart <= 60) {
                $items[] = nt_item("soon:{$b['BookingID']}", 'warn', "อีก $minToStart นาทีถึงเวลารับรถ $plate",
                    'ไปที่รถแล้วสแกน QR เพื่อเช็คอิน', 'booking-details.html', $start);
            } elseif ($minToStart <= 0 && $minToStart >= -180) {
                $items[] = nt_item("late_ci:{$b['BookingID']}", 'warn', "เลยเวลารับรถ $plate มา " . nt_fmt_duration(-$minToStart) . " แล้ว",
                    'ยังไม่ได้เช็คอิน ระบบจะปล่อยคิวอัตโนมัติเมื่อเลยเวลา 60 นาที ถ้าไม่ใช้รถแล้วกรุณายกเลิกเพื่อให้คนอื่นใช้ได้', 'booking-details.html', $start);
            }
        } elseif ($status === 'ขาไป') {
            if ($minLate > 0) {
                $items[] = nt_item("overdue:{$b['BookingID']}", 'danger', "เลยเวลาคืนรถ $plate " . nt_fmt_duration($minLate),
                    "กำหนดคืน {$end->format('H:i')} น. — คืนรถแล้วสแกน QR บันทึกไมล์", 'return_scan.html?plate=' . rawurlencode($plate), $end);
            } elseif ($minLate > -60) {
                $items[] = nt_item("dueback:{$b['BookingID']}", 'warn', "ใกล้ถึงเวลาคืนรถ $plate (อีก " . nt_fmt_duration(-$minLate) . ')',
                    'เตรียมคืนรถและสแกน QR บันทึกไมล์', 'return_scan.html?plate=' . rawurlencode($plate), $end);
            }
        } elseif ($status === 'ยกเลิก (ไม่มาใช้งาน)') {
            $items[] = nt_item("noshow:{$b['BookingID']}", 'warn', "การจองรถ $plate ถูกยกเลิกอัตโนมัติ",
                "$label ไม่ได้มาเช็คอิน", 'booking-details.html', $start);
        }
    }

    return $items;
}

function nt_sort_items(array $items): array {
    $rank = ['danger' => 0, 'warn' => 1, 'info' => 2];
    usort($items, function ($a, $b) use ($rank) {
        return ($rank[$a['level']] <=> $rank[$b['level']]) ?: strcmp($a['ts'], $b['ts']);
    });
    return $items;
}

// Admin-only items. Each block is isolated so a missing table/column can never break the bell.
function nt_collect_admin(PDO $conn): array {
    $items = [];
    $now = nt_now();

    try { // overdue returns (all users)
        foreach (nt_fetch_window_bookings($conn) as $b) {
            if ($b['BookingStatus'] !== 'ขาไป') continue;
            $range = nt_range($b);
            if (!$range) continue;
            $minLate = (int)floor(($now->getTimestamp() - $range[1]->getTimestamp()) / 60);
            if ($minLate > 15) {
                $items[] = nt_item("a_overdue:{$b['BookingID']}", 'danger', "รถ {$b['CarPlate']} เลยเวลาคืน " . nt_fmt_duration($minLate),
                    "ผู้ใช้: {$b['DriverName']} (กำหนดคืน {$range[1]->format('H:i')} น.)", '../Admin/index.html', $range[1]);
            }
        }
    } catch (Throwable $e) { error_log('nt admin overdue: ' . $e->getMessage()); }

    try { // problems reported when returning the car (last 3 days)
        $stmt = $conn->prepare(
            "SELECT BookingID, CarPlate, DriverName, ReturnRemark, ReturnDate FROM CarBookings
             WHERE ReturnDate >= :d AND ReturnRemark IS NOT NULL AND LTRIM(RTRIM(ReturnRemark)) NOT IN ('', '-') AND ReturnRemark NOT LIKE N'[[]ความคิดเห็น]%'"
        );
        $stmt->execute([':d' => (clone $now)->modify('-3 days')->format('Y-m-d')]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $txt = mb_substr((string)$r['ReturnRemark'], 0, 90);
            $items[] = nt_item("a_remark:{$r['BookingID']}", 'warn', "แจ้งปัญหา: รถ {$r['CarPlate']}",
                "{$r['DriverName']}: $txt", '../Admin/index.html');
        }
    } catch (Throwable $e) { error_log('nt admin remark: ' . $e->getMessage()); }

    try { // insurance / act expiring within 30 days (or already expired)
        $stmt = $conn->query("SELECT Plate, CONVERT(varchar(10), InsuranceExpiry, 23) AS ins, CONVERT(varchar(10), ActExpiry, 23) AS act FROM Cars");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
            foreach (['ins' => 'ประกัน', 'act' => 'พ.ร.บ.'] as $k => $name) {
                if (empty($c[$k])) continue;
                $days = (int)floor((strtotime($c[$k]) - strtotime($now->format('Y-m-d'))) / 86400);
                if ($days <= 30) {
                    $items[] = nt_item("a_exp:{$k}:{$c['Plate']}", $days < 0 ? 'danger' : 'warn',
                        "$name รถ {$c['Plate']} " . ($days < 0 ? 'หมดอายุแล้ว' : "อีก $days วันหมดอายุ"), "วันหมดอายุ {$c[$k]}", '../Admin/index.html');
                }
            }
        }
    } catch (Throwable $e) { error_log('nt admin expiry: ' . $e->getMessage()); }

    try { // GPS flags: check-in / return outside a company point, or without a location (last 3 days)
        require_once __DIR__ . '/geo_lib.php';
        if (geo_columns_ok($conn)) {
            $stmt = $conn->prepare(
                "SELECT BookingID, CarPlate, DriverName, CheckInGeo, CheckInDist, ReturnGeo, ReturnDist FROM CarBookings
                 WHERE (CheckInTime >= :d1 OR ReturnDate >= :d2) AND (CheckInGeo IN ('far','none') OR ReturnGeo IN ('far','none'))"
            );
            $since = (clone $now)->modify('-3 days')->format('Y-m-d');
            $stmt->execute([':d1' => $since, ':d2' => $since]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $g) {
                foreach (['CheckIn' => 'เช็คอิน', 'Return' => 'คืนรถ'] as $p => $label) {
                    $st = $g[$p . 'Geo'] ?? null;
                    if ($st !== 'far' && $st !== 'none') continue;
                    $body = $st === 'far'
                        ? "{$g['DriverName']}: {$label}นอกจุดบริษัท (ห่างประมาณ " . ($g[$p . 'Dist'] ?? '?') . ' ม.)'
                        : "{$g['DriverName']}: {$label}โดยไม่ได้ยืนยันพิกัด";
                    $items[] = nt_item("a_geo:{$p}:{$g['BookingID']}", 'warn', "พิกัดผิดปกติ: รถ {$g['CarPlate']}", $body, '../Admin/index.html');
                }
            }
        }
    } catch (Throwable $e) { error_log('nt admin geo: ' . $e->getMessage()); }
    try { // scheduled maintenance (date based; no schema change) + cars with no maintenance record at all
        $stmt = $conn->query("SELECT Plate, CONVERT(varchar(10), NextMaintenance, 23) AS nxt, CONVERT(varchar(10), LastMaintenance, 23) AS lst FROM Cars");
        $noRecord = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
            if (!empty($c['nxt'])) {
                $days = (int)floor((strtotime($c['nxt']) - strtotime($now->format('Y-m-d'))) / 86400);
                if ($days <= 14) {
                    $items[] = nt_item("a_maint:{$c['Plate']}", $days < 0 ? 'danger' : 'warn',
                        "รถ {$c['Plate']} " . ($days < 0 ? 'เลยกำหนดเข้าซ่อมบำรุง' : "อีก $days วันถึงกำหนดซ่อมบำรุง"), "กำหนด {$c['nxt']}", '../Admin/index.html');
                }
            } elseif (empty($c['lst'])) {
                $noRecord[] = $c['Plate'];
            }
        }
        if ($noRecord) {
            $items[] = nt_item('a_maint_none:' . date('Y-m'), 'info', count($noRecord) . ' คันยังไม่มีข้อมูลซ่อมบำรุง',
                'บันทึกวันซ่อมล่าสุด/ครั้งถัดไป เพื่อให้ระบบเตือนได้: ' . implode(', ', $noRecord), '../Admin/index.html');
        }
    } catch (Throwable $e) { error_log('nt admin maint: ' . $e->getMessage()); }

    return $items;
}
