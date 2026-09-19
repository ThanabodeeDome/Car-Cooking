<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

$start = $_GET['start'] ?? date('Y-m-d', strtotime('-30 days'));
$end   = $_GET['end'] ?? date('Y-m-d');
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
    echo json_encode([
        "success" => true,
        "bookings" => [
            "by_status" => $bookingByStatus,
            "by_day"    => $bookingByDay,
        ],
        "car_usage" => $carUsage,
        "insights" => $insights,
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