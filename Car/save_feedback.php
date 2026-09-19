<?php
// 🌟 feedback "ระบบดีไหม" (ปุ่มเดียว good/bad) ถามหลังคืนรถเสร็จ — ข้ามได้อิสระ ไม่บังคับ
// เก็บผูกกับ booking (BookingID) ให้สืบย้อนได้ (กันสแปม) แต่หน้าแอดมินโชว์แบบสรุปรวม ไม่ระบุตัวคนตอบ
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connect.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'กรุณาเข้าสู่ระบบก่อน']);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$bookingId = isset($data['booking_id']) ? (int)$data['booking_id'] : 0;
$feedback = isset($data['feedback']) ? trim($data['feedback']) : '';
$comment = isset($data['comment']) ? trim(mb_substr((string)$data['comment'], 0, 300)) : '';

if (!$bookingId || ($feedback === '' && $comment === '') || ($feedback !== '' && !in_array($feedback, ['good', 'bad'], true))) {
    echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ถูกต้อง']);
    exit;
}

try {
    // ต้องเป็นเจ้าของการจองเท่านั้น (หรือแอดมิน) กันคนอื่นยัดความเห็นใส่ booking คนอื่น
    $own = $conn->prepare("SELECT EmployeeID FROM CarBookings WHERE BookingID = :id");
    $own->execute([':id' => $bookingId]);
    $owner = $own->fetchColumn();
    if ($owner === false || (strtolower($_SESSION['role'] ?? '') !== 'admin' && ($_SESSION['employee_id'] ?? '') !== $owner)) {
        echo json_encode(['success' => false, 'message' => 'ไม่มีสิทธิ์']);
        exit;
    }
    if ($feedback !== '') {
        $conn->prepare("UPDATE CarBookings SET SystemFeedback = :fb WHERE BookingID = :id")
             ->execute([':fb' => $feedback, ':id' => $bookingId]);
    }
    if ($comment !== '') {
        // ไม่แก้โครงสร้าง DB: เก็บต่อท้าย ReturnRemark ด้วยป้าย [ความคิดเห็น] (แอดมินเห็นในรายละเอียดการจอง, ไม่นับเป็น "แจ้งปัญหา")
        $conn->prepare(
            "UPDATE CarBookings SET ReturnRemark = LEFT(
                CASE WHEN ReturnRemark IS NULL OR LTRIM(RTRIM(ReturnRemark)) IN (N'', N'-')
                     THEN N'[ความคิดเห็น] ' + :c1
                     ELSE ReturnRemark + N' | [ความคิดเห็น] ' + :c2 END, 1000)
             WHERE BookingID = :id"
        )->execute([':c1' => $comment, ':c2' => $comment, ':id' => $bookingId]);
    }    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    error_log('save_feedback.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาด']);
}
