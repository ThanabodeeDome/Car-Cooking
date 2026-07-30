<?php
$host = "LAPTOP-2JTTL5G0\SQLEXPRESS";
$db   = "CarBookingDB";
$user = "car_app_user";
$pass = "CAR@bk!n";

try {
    $conn = new PDO("sqlsrv:Server=$host;Database=$db", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(constant('PDO::SQLSRV_ATTR_ENCODING'), constant('PDO::SQLSRV_ENCODING_UTF8'));
} catch (PDOException $e) {
    error_log('db_connect.php error: ' . $e->getMessage());
    die("ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ");
}
?>