<?php
session_start();
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
  CASE 
    WHEN c.CarStatus = N'เช็คระยะ' THEN N'งดให้บริการ'
    WHEN :isToday1 = 1 AND EXISTS (
      SELECT 1 FROM CarBookings cb 
      WHERE cb.CarPlate = c.Plate 
        AND cb.BookingStatus = N'ขาไป'
        AND cb.CheckInTime IS NOT NULL
        AND cb.BookingDate = :targetDate1
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
        ':isToday1'    => $isToday ? 1 : 0,
        ':targetDate1' => $targetDate,
        ':targetDate2' => $targetDate,
    ]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($results, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_cars DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดข้อมูลรถ"]);
}
?>