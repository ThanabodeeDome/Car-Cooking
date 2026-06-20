<?php
// บังคับเข้ารหัส UTF-8 ป้องกันปัญหาภาษาไทยเพี้ยนจนคิวรีไม่เจอ
ini_set('default_charset', 'utf-8');
header('Content-Type: application/json; charset=utf-8');

// 1. เชื่อมต่อฐานข้อมูล SQL Server
$serverName = "LAPTOP-2JTTL5G0\SQLEXPRESS"; 
$connectionInfo = array("Database" => "CarBookingDB", "CharacterSet" => "UTF-8");
$conn = sqlsrv_connect($serverName, $connectionInfo);

if (!$conn) {
    echo json_encode(array("error" => "Connection failed", "details" => sqlsrv_errors()));
    exit;
}

// ── PART 1: นับตัวเลข Dashboard (ใส่ N นำหน้าเพื่อรองรับสเปกภาษาไทยใน DB)
$sql_avail = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'ว่าง'";
$sql_busy  = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'ไม่ว่าง'";
$sql_maint = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'ซ่อมบำรุง'";
$sql_today = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[CarBookings] WHERE CAST([BookingDate] AS DATE) = CAST(GETDATE() AS DATE)";

$avail_count = ($stmt = sqlsrv_query($conn, $sql_avail)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$busy_count  = ($stmt = sqlsrv_query($conn, $sql_busy)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$maint_count = ($stmt = sqlsrv_query($conn, $sql_maint)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$today_count = ($stmt = sqlsrv_query($conn, $sql_today)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;

// ── PART 2: ดึงข้อมูลรถทั้งหมดออกมาทำ Card 
$sql_cars_list = "SELECT [CarID], [Plate], [Brand], [Model], [Color], [Mileage], [CarImage], [CarStatus] FROM [CarBookingDB].[dbo].[Cars]";
$stmt_list = sqlsrv_query($conn, $sql_cars_list);
$cars_array = array();

if ($stmt_list) {
    while ($row = sqlsrv_fetch_array($stmt_list, SQLSRV_FETCH_ASSOC)) {
        // แปะป้ายตัวแปรพิมพ์เล็ก เพื่อส่งให้ JavaScript (app.js) เอาไปวนลูปรอบคันรถได้ถูกต้อง
        $cars_array[] = array(
            "id"       => $row['CarID'],
            "plate"    => $row['Plate'],
            "brand"    => $row['Brand'],
            "model"    => $row['Model'],
            "color"    => $row['Color'],
            "mileage"  => $row['Mileage'],
            "image"    => $row['CarImage'], // ชื่อคีย์รูปภาพตัวพิมพ์เล็ก
            "status"   => $row['CarStatus']
        );
    }
}

// ── PART 3: มัดรวมส่งออกไปให้ JavaScript (ส่งทีเดียวท้ายไฟล์ให้เคลียร์ๆ)
$response_data = array(
    "available"   => $avail_count,
    "busy"        => $busy_count,
    "maintenance" => $maint_count,
    "today"       => $today_count,
    "cars"        => $cars_array
);

echo json_encode($response_data);
sqlsrv_close($conn);
?>