<?php
header('Content-Type: application/json');
$conn = new mysqli("localhost", "root", "", "car_booking_db");

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed"]));
}

$sql = "SELECT id, plate, brand, status, current_mileage, image FROM cars";
$result = $conn->query($sql);

$cars = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $cars[] = $row;
    }
}

echo json_encode($cars);
$conn->close();
?>