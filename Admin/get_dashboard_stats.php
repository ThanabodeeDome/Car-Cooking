<?php
ini_set('default_charset', 'utf-8');
header('Content-Type: application/json; charset=utf-8');

$serverName = "LAPTOP-2JTTL5G0\SQLEXPRESS"; 
$connectionInfo = array("Database" => "CarBookingDB", "CharacterSet" => "UTF-8");
$conn = sqlsrv_connect($serverName, $connectionInfo);

if (!$conn) {
    echo json_encode(array("error" => "Connection failed", "details" => sqlsrv_errors()));
    exit;
}

// ── PART 1: นับตัวเลข Dashboard
$sql_avail = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'ว่าง'";
$sql_busy  = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'ไม่ว่าง'";
$sql_maint = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[Cars] WHERE [CarStatus] = N'เช็คระยะ'"; // 🌟 แก้ตรงนี้
$sql_today = "SELECT COUNT(*) as total FROM [CarBookingDB].[dbo].[CarBookings] WHERE CAST([BookingDate] AS DATE) = CAST(GETDATE() AS DATE)";

$avail_count = ($stmt = sqlsrv_query($conn, $sql_avail)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$busy_count  = ($stmt = sqlsrv_query($conn, $sql_busy)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$maint_count = ($stmt = sqlsrv_query($conn, $sql_maint)) ? sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC)['total'] : 0;
$today_count = 0;

// ── PART 2: ดึงข้อมูลรถทั้งหมด
$sql_cars_list = "SELECT [CarID], [Plate], [Brand], [Model], [Color], [Mileage], [CarImage], [CarStatus] FROM [CarBookingDB].[dbo].[Cars]";
$stmt_list = sqlsrv_query($conn, $sql_cars_list);
$cars_array = array();

if ($stmt_list) {
    while ($row = sqlsrv_fetch_array($stmt_list, SQLSRV_FETCH_ASSOC)) {
        // 🌟 แก้ key ให้เป็นตัวใหญ่ ตรงกับที่ dashboard.js เรียกใช้ (car.CarStatus, car.Plate, ฯลฯ)
        $cars_array[] = array(
            "CarID"     => $row['CarID'],
            "Plate"     => $row['Plate'],
            "Brand"     => $row['Brand'],
            "Model"     => $row['Model'],
            "Color"     => $row['Color'],
            "Mileage"   => $row['Mileage'],
            "CarImage"  => $row['CarImage'],
            "CarStatus" => $row['CarStatus']
        );
    }
}

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