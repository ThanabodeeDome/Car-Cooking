<?php
// save_return.php
header('Content-Type: application/json; charset=utf-8');

// 1. เชื่อมต่อ DB ผ่านไฟล์ส่วนกลาง
require_once('db_connect.php');

$data = json_decode(file_get_contents('php://input'), true);

if ($data) {
    // 2. อัปเดตข้อมูลการคืนในตารางจอง (อิงตามชื่อตาราง CarBookings ของเพื่อน)
    $sql1 = "UPDATE CarBookings 
             SET ReturnDate = ?, ReturnTime = ?, EndMile = ?, ReturnRemark = ?, BookingStatus = 'Returned' 
             WHERE CarPlate = ? AND BookingStatus = 'Checked-Out'";
             
    $params1 = array($data['date'], $data['time'], $data['return_mileage'], $data['issue_report'], $data['car_plate']);
    $stmt1 = sqlsrv_query($conn, $sql1, $params1);

    // 3. อัปเดตเลขไมล์ล่าสุดกลับไปที่ตารางรถ (อิงตามตาราง Cars และคอลัมน์ Mileage / Plate)
    $sql2 = "UPDATE Cars SET Mileage = ? WHERE Plate = ?";
    $stmt2 = sqlsrv_query($conn, $sql2, array($data['return_mileage'], $data['car_plate']));

    if ($stmt1 && $stmt2) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Query Failed", "errors" => sqlsrv_errors()]);
    }
    
    sqlsrv_close($conn);
}
?>