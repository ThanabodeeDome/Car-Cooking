<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header("Content-Type: application/json; charset=utf-8");
require_once 'db_connect.php';

// 🌟 ไฟล์นี้ไม่มี login check เลยมาก่อน!
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

// 🌟 รับวันที่จาก query string เพื่อเช็คสถานะ "ของวันนั้น" (ไม่ใช่ยึดวันนี้ตายตัว)
$targetDate = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $targetDate)) {
    $targetDate = date('Y-m-d');
}
$isToday = $targetDate === date('Y-m-d');

$sql = "SELECT c.CarID, c.Plate, c.Brand, c.Model, c.Color, c.Mileage, c.Carimage, c.CarStatus,
  c.InsuranceExpiry, c.ActExpiry, c.LastMaintenance, c.NextMaintenance,
  CONVERT(varchar(10), c.MaintenanceEndDate, 23) AS ServiceUntil,
  CASE 
    -- งดให้บริการ (เช็คระยะ/ซ่อม): วันก่อนวันที่คาดว่าเสร็จ = จองไม่ได้, ตั้งแต่วันเสร็จเป็นต้นไปจองล่วงหน้าได้
    -- ส่วนวันนี้ ถ้าถึงกำหนดแล้วแต่แอดมินยังไม่กดยืนยันรถพร้อม ยังถือว่าไม่พร้อม (ไม่ระบุวันเสร็จ = งดจนกว่าแอดมินยืนยัน)
    WHEN c.CarStatus = N'เช็คระยะ' AND (
         c.MaintenanceEndDate IS NULL
         OR :targetDate0 < c.MaintenanceEndDate
         OR :targetDate1 <= CAST(GETDATE() AS DATE)
    ) THEN N'งดให้บริการ'
    WHEN :isToday1 = 1 AND EXISTS (
      SELECT 1 FROM CarBookings cb 
      WHERE cb.CarPlate = c.Plate 
        AND cb.BookingStatus = N'ขาไป'
        AND cb.CheckInTime IS NOT NULL
        -- ขาไป = รถออกไปแล้วยังไม่คืน (ไม่ผูกกับวันที่จอง: ทริปข้ามคืน/เช็คอินก่อนวันจองก็ยังใช้งานอยู่)
    ) THEN N'กำลังใช้งาน'
    WHEN EXISTS (
      SELECT 1 FROM CarBookings cb
      WHERE cb.CarPlate = c.Plate
        AND cb.BookingStatus IN (N'จองแล้ว', N'ขาไป')
        AND cb.BookingDate = :targetDate2
    ) THEN N'ติดจอง'
    ELSE N'ว่าง'
  END AS RealStatus
FROM Cars c";

try {
    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ':targetDate0' => $targetDate,
        ':targetDate1' => $targetDate,
        ':isToday1'    => $isToday ? 1 : 0,
        ':targetDate2' => $targetDate,
    ]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($results, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_cars DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูลรถ"]);
}
?>