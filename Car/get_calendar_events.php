<?php
header('Content-Type: application/json');
$conn = mysqli_connect("localhost", "root", "", "car_booking_db");

// 1. หาจำนวนรถทั้งหมดที่มีในระบบก่อน
$sql_total_cars = "SELECT COUNT(*) as total FROM cars";
$res_total = mysqli_query($conn, $sql_total_cars);
$total_cars = mysqli_fetch_assoc($res_total)['total'];

// 2. ดึงข้อมูลการจอง โดยนับว่าแต่ละวันมีรถถูกจองไปกี่คัน
$sql = "SELECT out_date, COUNT(*) as booked_count 
        FROM bookings 
        GROUP BY out_date";
$result = mysqli_query($conn, $sql);

$events = array();
while($row = mysqli_fetch_assoc($result)) {
    $booked = $row['booked_count'];
    
    if ($booked >= $total_cars) {
        // ถ้ารถถูกใช้ครบทุกคัน
        $events[] = [
            'title' => '❌ เต็มแล้ว',
            'start' => $row['out_date'],
            'color' => '#ff4d4d', // สีแดง
            'allDay' => true
        ];
    } else {
        // ถ้ายังมีรถเหลือ
        $available = $total_cars - $booked;
        $events[] = [
            'title' => "✅ ว่าง ($available คัน)",
            'start' => $row['out_date'],
            'color' => '#2ecc71', // สีเขียว
            'allDay' => true
        ];
    }
}

echo json_encode($events);
?>