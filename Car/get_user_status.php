<?php
// get_user_status.php
header('Content-Type: application/json; charset=utf-8');
require_once('db_connect.php');

$id = $_GET['id']; // รับค่ารหัสพนักงานจาก JavaScript

// ดึงสถานะล่าสุดรายการเดียวของพนักงานคนนี้
$sql = "SELECT TOP 1 BookingStatus FROM CarBookings WHERE EmployeeID = ? ORDER BY OutDate DESC, OutTime DESC";
$params = array($id);
$stmt = sqlsrv_query($conn, $sql, $params);

$lastStatus = "ขากลับ"; // ค่าเริ่มต้น (ถ้าไม่เคยจองให้ถือว่าว่างพร้อมจองใหม่)

if ($stmt && sqlsrv_has_rows($stmt)) {
    $row = sqlsrv_fetch_array($stmt, SQLSRV_FETCH_ASSOC);
    // แปลงคำให้แมตช์กับ JS เดิม (ถ้าเป็น Checked-Out แปลว่ากำลังขับขาไปอยู่)
    $lastStatus = ($row['BookingStatus'] === 'Checked-Out') ? "ขาไป" : "ขากลับ";
}

echo json_encode(["lastStatus" => $lastStatus], JSON_UNESCAPED_UNICODE);

sqlsrv_free_stmt($stmt);
sqlsrv_close($conn);
?>