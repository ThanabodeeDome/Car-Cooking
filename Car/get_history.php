<?php
ob_start(); // เปิดการดักข้อมูลหลุด
header("Content-Type: application/json; charset=utf-8");
error_reporting(0);
ini_set('display_errors', 0);

// เปลี่ยนค่าตามการเชื่อมต่อจริงของเครื่องเพื่อน
$serverName = ".\SQLEXPRESS"; 
$connectionInfo = array("Database"=>"CarBookingDB", "CharacterSet"=>"UTF-8");
$conn = sqlsrv_connect($serverName, $connectionInfo);

if (!$conn) {
    if (ob_get_length()) ob_clean();
    echo json_encode(["error" => "Connection Failed"]);
    exit;
}

// คิวรี่ข้อมูลแบบดึงยี่ห้อและประเภทรถมาจากตาราง Cars ด้วย
$sql = "SELECT cb.DriverName AS driver_name, 
               cb.EmployeeID AS employeeId, 
               cb.CarPlate AS car_plate, 
               CONVERT(varchar, cb.OutDate, 23) AS out_date, 
               CONVERT(varchar, cb.OutTime, 8) AS out_time, 
               cb.Passengers AS passengers, 
               cb.BookingStatus AS booking_status,
               c.CarType AS car_type,
               c.Brand AS car_brand
        FROM dbo.CarBookings cb
        LEFT JOIN dbo.Cars c ON cb.CarPlate = c.Plate
        ORDER BY cb.OutDate DESC, cb.OutTime DESC";

$stmt = sqlsrv_query($conn, $sql);

if ($stmt === false) {
    if (ob_get_length()) ob_clean();
    echo json_encode(["error" => "Query Failed"]);
    exit;
}

$history = [];
while ($row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)) {
    $history[] = $row;
}

// ล้างสิ่งที่อาจตกค้างในระบบออกให้หมดก่อนส่ง JSON
if (ob_get_length()) ob_clean();
echo json_encode($history, JSON_UNESCAPED_UNICODE);
?>