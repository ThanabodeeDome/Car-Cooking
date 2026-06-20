<?php
header("Content-Type: application/json; charset=utf-8");
require_once 'db_connect.php';

$stmt = $conn->query("SELECT Plate, Brand, Model, CarStatus, Carimage FROM dbo.Cars");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($results, JSON_UNESCAPED_UNICODE);
?>