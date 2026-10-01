<?php
// 🔒 ไฟล์เก่าสมัยใช้ MySQL (mysqli + root ไม่มีรหัส) — ระบบย้ายไป SQL Server แล้ว ไฟล์นี้พังทุกครั้ง
// และโชว์ error พร้อม path เต็มของเซิร์ฟเวอร์ให้คนนอกเห็น (ไม่มี login check ด้วย)
// ข้อมูลรถจริงใช้ get_cars.php แทน — ตรงนี้คืน array ว่างเพื่อไม่ให้ homepage.js เดิมพัง
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode([]);
    exit;
}

echo json_encode([]);
