<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

$start = $_GET['start'] ?? date('Y-m-d', strtotime('-30 days'));
$end   = $_GET['end'] ?? date('Y-m-d');
// 🔒 รับเฉพาะรูปแบบ YYYY-MM-DD (ค่าแปลกๆ ทำให้ strtotime() เพี้ยน/คิวรี error)
if (!is_string($start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !strtotime($start)) $start = date('Y-m-d', strtotime('-30 days'));
if (!is_string($end) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end) || !strtotime($end)) $end = date('Y-m-d');
// endEx = วันถัดจาก end 1 วัน ใช้เทียบแบบ "<" กัน BookingDate ที่มีเวลา (เช่น 14:00) หลุดออกจากช่วง
$endEx = date('Y-m-d', strtotime($end . ' +1 day'));

try {
    // ---------- 1) การจอง: สรุปตามสถานะ + trend รายวัน ----------
    $stmt = $conn->prepare(
        "SELECT BookingStatus, COUNT(*) AS total
         FROM CarBookings
         WHERE BookingDate >= :start AND BookingDate < :endEx
         GROUP BY BookingStatus"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $bookingByStatus = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $conn->prepare(
        "SELECT BookingDate, COUNT(*) AS cnt
         FROM CarBookings
         WHERE BookingDate >= :start AND BookingDate < :endEx
           AND BookingStatus NOT LIKE N'ยกเลิก%'
         GROUP BY BookingDate
         ORDER BY BookingDate"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $bookingByDay = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 2) การใช้รถ: จำนวนครั้งต่อคัน (ไม่นับที่ยกเลิก) ----------
    $stmt = $conn->prepare(
        "SELECT CarPlate, COUNT(*) AS cnt
         FROM CarBookings
         WHERE BookingDate >= :start AND BookingDate < :endEx
           AND BookingStatus NOT LIKE N'ยกเลิก%'
         GROUP BY CarPlate
         ORDER BY cnt DESC"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $carUsage = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 3) ค่าซ่อม: รวมต่อคัน จากตาราง MaintenanceHistory ----------
    $stmt = $conn->prepare(
        "SELECT c.Plate, COUNT(*) AS jobs, SUM(ISNULL(m.Cost, 0)) AS totalCost
         FROM MaintenanceHistory m
         JOIN Cars c ON c.CarID = m.CarID
         WHERE m.StartDate >= :start AND m.StartDate < :endEx
         GROUP BY c.Plate
         ORDER BY totalCost DESC"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $repairCost = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 4) การยกเลิก: รายการ + อัตราส่วน ----------
    $stmt = $conn->prepare(
        "SELECT BookingDate, CarPlate, DriverName, BookingStatus
         FROM CarBookings
         WHERE BookingDate >= :start AND BookingDate < :endEx
           AND BookingStatus LIKE N'ยกเลิก%'
         ORDER BY BookingDate DESC"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $cancelList = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total FROM CarBookings WHERE BookingDate >= :start AND BookingDate < :endEx"
    );
    $stmt->execute([':start' => $start, ':endEx' => $endEx]);
    $totalBookings = (int) $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    $cancelledCount = count($cancelList);
    $rate = $totalBookings > 0 ? round($cancelledCount / $totalBookings * 100, 1) : 0;

    // ---------- 5) สรุปเชิงลึก: % การใช้งานต่อคัน / ชั่วโมงเร่งด่วน / ฝ่ายที่ใช้มากสุด / ระยะทางรวม ----------
    $insights = ['utilization' => [], 'peak_hours' => array_fill(0, 24, 0), 'top_divisions' => [], 'km_total' => 0];
    try {
        $stmt = $conn->prepare(
            "SELECT CarPlate, CONVERT(varchar(10), BookingDate, 23) AS BookingDate, OutTime,
                    CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime,
                    Department, StartMileage, EndMileage, BookingStatus
             FROM CarBookings
             WHERE BookingDate >= :start AND BookingDate < :endEx AND BookingStatus NOT LIKE N'ยกเลิก%'"
        );
        $stmt->execute([':start' => $start, ':endEx' => $endEx]);
        $days = max(1, (int) round((strtotime($end) - strtotime($start)) / 86400) + 1);
        $hoursByCar = [];
        $divs = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out = substr((string) $r['OutTime'], 0, 5);
            $ret = substr((string) $r['PlannedReturnTime'], 0, 5);
            if ($out !== '' && $ret !== '' && strpos($out, ':') !== false) {
                $m1 = (int) substr($out, 0, 2) * 60 + (int) substr($out, 3, 2);
                $m2 = (int) substr($ret, 0, 2) * 60 + (int) substr($ret, 3, 2);
                if ($m2 <= $m1) $m2 += 1440; // ข้ามคืน
                $hoursByCar[$r['CarPlate']] = ($hoursByCar[$r['CarPlate']] ?? 0) + ($m2 - $m1) / 60;
                for ($m = intdiv($m1, 60) * 60; $m < $m2; $m += 60) $insights['peak_hours'][intdiv($m, 60) % 24]++;
            }
            $div = trim(explode('/', (string) $r['Department'])[0]);
            if ($div !== '') $divs[$div] = ($divs[$div] ?? 0) + 1;
            $km = (int) $r['EndMileage'] - (int) $r['StartMileage'];
            if ($r['BookingStatus'] === 'คืนแล้ว' && $km > 0 && $km <= 1500) $insights['km_total'] += $km; // ตัดค่าเพี้ยนออก
        }
        arsort($hoursByCar);
        foreach ($hoursByCar as $plate => $h) {
            $insights['utilization'][] = ['CarPlate' => $plate, 'hours' => round($h, 1), 'percent' => round($h / ($days * 24) * 100, 1)];
        }
        arsort($divs);
        foreach (array_slice($divs, 0, 8, true) as $name => $cnt) $insights['top_divisions'][] = ['name' => $name, 'cnt' => $cnt];
    } catch (Throwable $e) {
        error_log('get_reports_data insights: ' . $e->getMessage());
    }
    // ---------- 6) ชุดข้อมูลสำหรับหน้ารายงานใหม่: KPI / ตารางต่อคัน / ผู้ขับ / ความคิดเห็น / ปัญหา ----------
    $extra = ['kpi' => [], 'per_car' => [], 'top_drivers' => [], 'comments' => [], 'problems' => []];
    try {
        require_once '../Car/geo_lib.php';
        $hasGeo = geo_columns_ok($conn);
        $hasFb = (int)$conn->query("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'SystemFeedback'")->fetchColumn() > 0;
        $cols = "BookingID, CarPlate, DriverName, EmployeeID, CONVERT(varchar(10), BookingDate, 23) AS BookingDate, OutTime,
                 CONVERT(varchar(5), PlannedReturnTime, 108) AS PlannedReturnTime, StartMileage, EndMileage, BookingStatus, ReturnRemark"
              . ($hasFb ? ", SystemFeedback" : "")
              . ($hasGeo ? ", CheckInGeo, ReturnGeo" : "");
        $stmt = $conn->prepare("SELECT $cols FROM CarBookings WHERE BookingDate >= :start AND BookingDate < :endEx ORDER BY BookingDate DESC, BookingID DESC");
        $stmt->execute([':start' => $start, ':endEx' => $endEx]);
        $all = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $days = max(1, (int) round((strtotime($end) - strtotime($start)) / 86400) + 1);
        $k = ['total' => 0, 'returned' => 0, 'active' => 0, 'cancelled' => 0, 'noshow' => 0, 'km_total' => 0, 'trips_with_km' => 0,
              'hours_total' => 0.0, 'good' => 0, 'bad' => 0, 'geo_flags' => 0];
        $cars = []; $drivers = [];
        foreach ($all as $r) {
            $k['total']++;
            $st = (string)$r['BookingStatus'];
            $cancelled = strpos($st, 'ยกเลิก') === 0;
            if ($cancelled) {
                $k['cancelled']++;
                if (strpos($st, 'ไม่มาใช้งาน') !== false) $k['noshow']++;
            } elseif ($st === 'คืนแล้ว') $k['returned']++;
            else $k['active']++;

            $plate = (string)$r['CarPlate'];
            if (!isset($cars[$plate])) $cars[$plate] = ['CarPlate' => $plate, 'trips' => 0, 'hours' => 0.0, 'km' => 0, 'cancelled' => 0];
            if ($cancelled) { $cars[$plate]['cancelled']++; continue; }

            $cars[$plate]['trips']++;
            $out = substr((string)$r['OutTime'], 0, 5); $ret = substr((string)$r['PlannedReturnTime'], 0, 5);
            $h = 0.0;
            if ($out !== '' && $ret !== '' && strpos($out, ':') !== false) {
                $m1 = (int)substr($out, 0, 2) * 60 + (int)substr($out, 3, 2);
                $m2 = (int)substr($ret, 0, 2) * 60 + (int)substr($ret, 3, 2);
                if ($m2 <= $m1) $m2 += 1440;
                $h = ($m2 - $m1) / 60;
            }
            $cars[$plate]['hours'] += $h; $k['hours_total'] += $h;

            $km = 0;
            if ($st === 'คืนแล้ว') {
                $d = (int)$r['EndMileage'] - (int)$r['StartMileage'];
                if ($d > 0 && $d <= 1500) { $km = $d; $k['km_total'] += $d; $k['trips_with_km']++; $cars[$plate]['km'] += $d; }
            }
            $name = trim((string)$r['DriverName']) ?: (string)$r['EmployeeID'];
            if (!isset($drivers[$name])) $drivers[$name] = ['name' => $name, 'trips' => 0, 'km' => 0, 'hours' => 0.0];
            $drivers[$name]['trips']++; $drivers[$name]['km'] += $km; $drivers[$name]['hours'] += $h;

            if ($hasFb) { if (($r['SystemFeedback'] ?? '') === 'good') $k['good']++; elseif (($r['SystemFeedback'] ?? '') === 'bad') $k['bad']++; }
            if ($hasGeo) {
                foreach (['CheckInGeo', 'ReturnGeo'] as $g) if (in_array($r[$g] ?? '', ['far', 'none'], true)) $k['geo_flags']++;
            }

            $remark = trim((string)($r['ReturnRemark'] ?? ''));
            if ($remark !== '' && $remark !== '-') {
                $isComment = mb_strpos($remark, '[ความคิดเห็น]') !== false;
                $item = ['date' => $r['BookingDate'], 'car' => $plate, 'driver' => $name, 'text' => mb_substr($remark, 0, 240)];
                if ($isComment) { if (count($extra['comments']) < 12) $extra['comments'][] = $item; }
                elseif (count($extra['problems']) < 12) $extra['problems'][] = $item;
            }
        }

        // repair cost per plate (already computed above as $repairCost)
        $repairByPlate = [];
        foreach ($repairCost as $rc) $repairByPlate[$rc['Plate']] = ['jobs' => (int)$rc['jobs'], 'cost' => (float)$rc['totalCost']];

        foreach ($cars as $plate => $c) {
            $c['hours'] = round($c['hours'], 1);
            $c['percent'] = round($c['hours'] / ($days * 24) * 100, 1);
            $c['repair_jobs'] = $repairByPlate[$plate]['jobs'] ?? 0;
            $c['repair_cost'] = $repairByPlate[$plate]['cost'] ?? 0;
            $extra['per_car'][] = $c;
        }
        usort($extra['per_car'], fn($x, $y) => $y['trips'] <=> $x['trips']);

        usort($drivers, fn($x, $y) => $y['trips'] <=> $x['trips']);
        foreach (array_slice($drivers, 0, 10) as $d) { $d['hours'] = round($d['hours'], 1); $extra['top_drivers'][] = $d; }

        $used = $k['total'] - $k['cancelled'];
        $k['days'] = $days;
        $k['used'] = $used;
        $k['hours_total'] = round($k['hours_total'], 1);
        $k['avg_hours'] = $used > 0 ? round($k['hours_total'] / $used, 1) : 0;
        $k['avg_km'] = $k['trips_with_km'] > 0 ? (int) round($k['km_total'] / $k['trips_with_km']) : 0;
        $k['unique_drivers'] = count($drivers);
        $k['cancel_rate'] = $k['total'] > 0 ? round($k['cancelled'] / $k['total'] * 100, 1) : 0;
        $votes = $k['good'] + $k['bad'];
        $k['satisfaction'] = $votes > 0 ? round($k['good'] / $votes * 100) : null;
        $k['votes'] = $votes;
        $fleet = max(1, count($cars));
        $k['fleet_util'] = round($k['hours_total'] / ($days * 24 * $fleet) * 100, 1);
        $extra['kpi'] = $k;
    } catch (Throwable $e) {
        error_log("get_reports_data extra: " . $e->getMessage());
    }
    echo json_encode([
        "success" => true,
        "bookings" => [
            "by_status" => $bookingByStatus,
            "by_day"    => $bookingByDay,
        ],
        "car_usage" => $carUsage,
        "insights" => $insights,
        "kpi" => $extra['kpi'],
        "per_car" => $extra['per_car'],
        "top_drivers" => $extra['top_drivers'],
        "comments" => $extra['comments'],
        "problems" => $extra['problems'],
        "repair_cost" => $repairCost,
        "cancellations" => [
            "list"            => $cancelList,
            "cancelled_count" => $cancelledCount,
            "total_count"     => $totalBookings,
            "rate"            => $rate,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_reports_data DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดรายงาน"]);
}