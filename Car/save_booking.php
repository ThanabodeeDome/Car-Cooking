<?php
header('Content-Type: application/json'); // บอกว่าเราจะส่ง JSON กลับไป
$serverName = ".\SQLEXPRESS";
$connectionInfo = array("Database"=>"CarBookingDB", "UID"=>"sa", "PWD"=>"รหัสผ่านพี่", "CharacterSet"=>"UTF-8");
$conn = sqlsrv_connect($serverName, $connectionInfo);

// --- แก้จุดนี้: รับข้อมูลแบบ JSON ---
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if ($data) {
    $sql = "INSERT INTO CarBookings (DriverName, EmployeeID, MainDept, SubDept, Section, CarPlate, OutDate, OutTime, StartMile, Destination, JobDetail, OutRemark, Passengers, BookingStatus) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Checked-Out')";
    
    $params = array(
        $data['driver_name'], $data['employee_id'], $data['main_dept'], 
        $data['sub_dept'], $data['section'], $data['car_plate'],
        $data['use_date'], $data['out_time'], $data['start_mile'],
        $data['destination'], $data['work_type'], $data['out_remark'], 
        $data['passengers']
    );
    
    $stmt = sqlsrv_query($conn, $sql, $params);
    
    if($stmt) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => sqlsrv_errors()]);
    }
}
?>