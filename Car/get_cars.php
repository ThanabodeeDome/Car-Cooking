<?php
header("Content-Type: application/json; charset=utf-8");
require_once 'db_connect.php';

$sql = "SELECT c.CarID, c.Plate, c.Brand, c.Model, c.Color, c.Mileage, c.Carimage, c.CarStatus,
  CASE 
    WHEN c.CarStatus = N'เช็คระยะ' THEN N'งดให้บริการ'
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
        AND cb.BookingDate >= CAST(GETDATE() AS DATE)
    ) THEN N'ติดจอง'
    ELSE N'ว่าง'
  END AS RealStatus
FROM Cars c";

$stmt = $conn->query($sql);
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($results, JSON_UNESCAPED_UNICODE);
?>