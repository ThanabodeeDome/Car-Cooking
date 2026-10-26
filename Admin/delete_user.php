<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';
require_once __DIR__ . '/../db_error_text.php'; // แปล error ฐานข้อมูลให้คนอ่านรู้เรื่อง

requireAdminAccess();

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$id = $data['id'] ?? 0;

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "ไม่พบ user"]);
    exit;
}

if ((int)$id === (int)$_SESSION['user_id']) {
    echo json_encode(["success" => false, "message" => "ลบบัญชีตัวเองไม่ได้"]);
    exit;
}

try {
    // 🌟 กันลบ admin ผ่านแอปเด็ดขาด (ต้องลบผ่าน Database โดยตรงเท่านั้น
    // สอดคล้องกับกฎเดียวกับตอนเพิ่ม/แก้ role — ลด single point of failure จากหน้าเว็บ)
    $targetStmt = $conn->prepare("SELECT role, username, employee_id FROM Users WHERE id = :id");
    $targetStmt->execute([':id' => $id]);
    $target = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if ($target && strtolower($target['role']) === 'admin') {
        echo json_encode(["success" => false, "message" => "ลบบัญชี admin ผ่านแอปไม่ได้ ต้องลบผ่าน Database โดยตรงเท่านั้น"]);
        exit;
    }

    try { // ตารางนี้อาจยังไม่มีบน DB ที่ยังไม่รัน migration
        $conn->prepare("DELETE FROM RememberTokens WHERE user_id = :id")->execute([':id' => $id]);
    } catch (PDOException $e) {
        // ไม่มีตาราง = ไม่มี token ให้ลบ
    }
    $stmt = $conn->prepare("DELETE FROM Users WHERE id = :id");
    $stmt->execute([':id' => $id]);
    if ($stmt->rowCount() > 0 && $target) {
        require_once __DIR__ . '/../Car/log_lib.php';
        sl_log($conn, 'user_delete', 'ลบผู้ใช้ ' . $target['username'] . ' (รหัสพนักงาน ' . $target['employee_id'] . ')', ['target_type' => 'user', 'target' => (string)$target['username']]);
    }
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('delete_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => cb_db_error_message($e, "เกิดข้อผิดพลาด ไม่สามารถลบผู้ใช้ได้")]);
}