<?php
// 🌟 ตั้ง timezone ทั้งระบบเป็นไทยตรงนี้ที่เดียว — กันปัญหา date()/time() เพี้ยน
// (php.ini เดิมไม่ได้ตั้งไว้ ใช้ UTC default เวลาที่บันทึกลง DB เลยเพี้ยนไปหลายชั่วโมง)
date_default_timezone_set('Asia/Bangkok');

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