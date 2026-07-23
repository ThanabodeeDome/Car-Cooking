<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

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

    echo json_encode([
        "success" => true,
        "bookings" => [
            "by_status" => $bookingByStatus,
            "by_day"    => $bookingByDay,
        ],
        "car_usage" => $carUsage,
        "repair_cost" => $repairCost,
        "cancellations" => [
            "list"            => $cancelList,
            "cancelled_count" => $cancelledCount,
            "total_count"     => $totalBookings,
            "rate"            => $rate,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}