<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

// 🌟 ไฟล์นี้ไม่มี auth check เลยมาก่อน! ข้อมูลรถ+การจองทั้งบริษัทเปิดโล่งให้ใครก็ดูได้
require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

try {
    // ---------- 1) สถานะรถแบบ real-time (logic เดียวกับ get_cars.php ฝั่ง user) ----------
    $sqlCars = "SELECT c.CarID, c.Plate, c.Brand, c.Model, c.CarStatus,
      CASE 
        WHEN c.CarStatus = N'เช็คระยะ' THEN N'งดให้บริการ'
        WHEN EXISTS (
          SELECT 1 FROM MaintenanceHistory m
          WHERE m.CarID = c.CarID
            AND m.EndDate IS NULL
            AND m.StartDate <= CAST(GETDATE() AS DATE)
        ) THEN N'งดให้บริการ'
        WHEN EXISTS (
          SELECT 1 FROM CarBookings cb 
          WHERE cb.CarPlate = c.Plate 
            AND cb.BookingStatus = N'ขาไป'
            AND cb.CheckInTime IS NOT NULL
            AND cb.BookingDate = CAST(GETDATE() AS DATE)
        ) THEN N'กำลังใช้งาน'
        WHEN EXISTS (
          SELECT 1 FROM CarBookings cb
          WHERE cb.CarPlate = c.Plate
            AND cb.BookingStatus = N'ขาไป'
            AND cb.BookingDate = CAST(GETDATE() AS DATE)
        ) THEN N'ติดจอง'
        ELSE N'ว่าง'
      END AS RealStatus
    FROM Cars c
    ORDER BY c.Plate";
    $cars = $conn->query($sqlCars)->fetchAll(PDO::FETCH_ASSOC);

    $counts = ['ว่าง' => 0, 'กำลังใช้งาน' => 0, 'ติดจอง' => 0, 'งดให้บริการ' => 0];
    foreach ($cars as $car) {
        if (isset($counts[$car['RealStatus']])) $counts[$car['RealStatus']]++;
    }

    // ---------- 2) ตารางรายสัปดาห์ (จันทร์-อาทิตย์ ของสัปดาห์นี้) ----------
    // ⚠️ 'monday this week' ของ PHP มี bug: ถ้าวันนี้เป็นอาทิตย์จะได้จันทร์ "สัปดาห์หน้า" แทน
    // คำนวณเองด้วย ISO weekday (1=จันทร์...7=อาทิตย์) กันเคสนี้ไว้
    $today = new DateTime();
    $isoDow = (int) $today->format('N');
    $weekStart = (clone $today)->modify('-' . ($isoDow - 1) . ' days');
    $weekEnd   = (clone $weekStart)->modify('+6 days');
    $sqlWeek = "SELECT CarPlate, DriverName, BookingDate, TimeSlot, BookingStatus
                FROM CarBookings
                WHERE BookingDate BETWEEN :start AND :end
                  AND BookingStatus NOT LIKE N'ยกเลิก%'
                ORDER BY CarPlate, BookingDate";
    $stmtWeek = $conn->prepare($sqlWeek);
    $stmtWeek->execute([':start' => $weekStart->format('Y-m-d'), ':end' => $weekEnd->format('Y-m-d')]);
    $weekBookings = $stmtWeek->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 3) รายการจองล่าสุด ----------
    $sqlRecent = "SELECT TOP 5 BookingNumber, DriverName, CarPlate, BookingDate, TimeSlot, BookingStatus
                  FROM CarBookings ORDER BY BookingID DESC";
    $recent = $conn->query($sqlRecent)->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 4) รายการจองวันนี้ (ไม่นับที่ยกเลิก) ----------
    $sqlToday = "SELECT COUNT(*) as total FROM CarBookings 
                 WHERE CAST(BookingDate AS DATE) = CAST(GETDATE() AS DATE)
                   AND BookingStatus NOT LIKE N'ยกเลิก%'";
    $todayCount = $conn->query($sqlToday)->fetch(PDO::FETCH_ASSOC)['total'];

    // ---------- 5) แจ้งเตือน: ประกัน/พ.ร.บ. ใกล้หมด (≤30 วัน) หรือหมดแล้ว ----------
    $sqlAlerts = "SELECT Plate, Brand, Model, InsuranceExpiry, ActExpiry
                  FROM Cars
                  WHERE (InsuranceExpiry IS NOT NULL AND InsuranceExpiry <= DATEADD(day, 30, CAST(GETDATE() AS DATE)))
                     OR (ActExpiry IS NOT NULL AND ActExpiry <= DATEADD(day, 30, CAST(GETDATE() AS DATE)))";
    $alerts = $conn->query($sqlAlerts)->fetchAll(PDO::FETCH_ASSOC);

    // ---------- 5.1) แจ้งเตือน: ถึงกำหนดเช็คระยะครั้งถัดไป (≤30 วัน) — เอาเฉพาะ record ล่าสุดต่อคัน ----------
    $sqlMaintDue = "SELECT c.Plate, c.Brand, c.Model, m.NextDueDate
                     FROM Cars c
                     JOIN MaintenanceHistory m ON m.CarID = c.CarID
                     WHERE m.NextDueDate IS NOT NULL
                       AND m.NextDueDate <= DATEADD(day, 30, CAST(GETDATE() AS DATE))
                       AND m.MaintenanceID = (
                           SELECT TOP 1 m2.MaintenanceID
                           FROM MaintenanceHistory m2
                           WHERE m2.CarID = c.CarID
                           ORDER BY m2.StartDate DESC
                       )";
    $maintDue = $conn->query($sqlMaintDue)->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "counts" => [
            "available"   => (int)$counts['ว่าง'],
            "inuse"       => (int)$counts['กำลังใช้งาน'],
            "booked"      => (int)$counts['ติดจอง'],
            "maintenance" => (int)$counts['งดให้บริการ'],
        ],
        "today"         => (int)$todayCount,
        "cars"          => $cars,
        "week_start"    => $weekStart->format('Y-m-d'),
        "week_bookings" => $weekBookings,
        "recent"        => $recent,
        "alerts"        => $alerts,
        "maint_due"     => $maintDue,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_dashboard_stats DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูล"]);
}