<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';

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
    $targetStmt = $conn->prepare("SELECT role FROM Users WHERE id = :id");
    $targetStmt->execute([':id' => $id]);
    $target = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if ($target && strtolower($target['role']) === 'admin') {
        echo json_encode(["success" => false, "message" => "ลบบัญชี admin ผ่านแอปไม่ได้ ต้องลบผ่าน Database โดยตรงเท่านั้น"]);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM Users WHERE id = :id");
    $stmt->execute([':id' => $id]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('delete_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถลบผู้ใช้ได้"]);
}