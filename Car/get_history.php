<?php
header("Content-Type: application/json; charset=utf-8");
require_once 'db_connect.php';

try {
    $sql = "SELECT cb.DriverName AS driver_name, 
                   cb.EmployeeID AS employeeId, 
                   cb.CarPlate AS car_plate, 
                   CONVERT(varchar, cb.OutDate, 23) AS out_date, 
                   CONVERT(varchar, cb.OutTime, 8) AS out_time, 
                   cb.Passengers AS passengers, 
                   cb.BookingStatus AS booking_status,
                   c.Brand AS car_brand
            FROM CarBookings cb
            LEFT JOIN Cars c ON cb.CarPlate = c.Plate
            ORDER BY cb.OutDate DESC, cb.OutTime DESC";

    $stmt = $conn->query($sql);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($history, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    echo json_encode(["error" => $e->getMessage()]);
}