<?php
$host = "LAPTOP-2JTTL5G0\SQLEXPRESS";
$db   = "CarBookingDB";
$user = "sa";
$pass = "123456";

try {
    $conn = new PDO("sqlsrv:Server=$host;Database=$db", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("เชื่อมต่อล้มเหลว: " . $e->getMessage());
}
?>