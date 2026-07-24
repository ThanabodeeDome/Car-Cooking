<?php
// get_user_status.php
// 🌟 เขียนใหม่ทั้งไฟล์ — ของเดิมใช้ sqlsrv_* function แต่ $conn ที่ include มาเป็น PDO object
// เรียก sqlsrv_query($conn, ...) กับ PDO object รันจริง fatal error ทันที ใช้งานไม่ได้อยู่แล้ว
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

// 🌟 เพิ่ม login check ที่หายไป (ของเดิมไม่มีเลย ใครก็ query สถานะพนักงานคนไหนก็ได้)
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["lastStatus" => null, "message" => "กรุณาเข้าสู่ระบบก่อน"], JSON_UNESCAPED_UNICODE);
    exit;
}

$id = $_GET['id'] ?? '';
if (empty($id)) {
    echo json_encode(["lastStatus" => null, "message" => "ไม่พบรหัสพนักงาน"], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // ดึงสถานะล่าสุดรายการเดียวของพนักงานคนนี้ (แปลง sqlsrv syntax เดิม -> PDO ให้ตรงกับทั้งระบบ)
    $stmt = $conn->prepare(
        "SELECT TOP 1 BookingStatus FROM CarBookings WHERE EmployeeID = :emp ORDER BY OutDate DESC, OutTime DESC"
    );
    $stmt->execute([':emp' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $lastStatus = "ขากลับ"; // ค่าเริ่มต้น (ถ้าไม่เคยจองให้ถือว่าว่างพร้อมจองใหม่)
    if ($row) {
        // แปลงคำให้แมตช์กับ JS เดิม (ถ้าเป็น Checked-Out แปลว่ากำลังขับขาไปอยู่)
        $lastStatus = ($row['BookingStatus'] === 'Checked-Out') ? "ขาไป" : "ขากลับ";
    }

    echo json_encode(["lastStatus" => $lastStatus], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('get_user_status DB error: ' . $e->getMessage());
    echo json_encode(["lastStatus" => null, "message" => "เกิดข้อผิดพลาด"], JSON_UNESCAPED_UNICODE);
}