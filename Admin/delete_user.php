<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

$allowed_admin_ids = require __DIR__ . '/../admin_whitelist.php';
if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin' || !in_array((int)$_SESSION['user_id'], $allowed_admin_ids, true)) {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

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
    // 🌟 กันลบ admin คนสุดท้าย (ล็อกตัวเองออกจาก Admin panel ทั้งบริษัท)
    $targetStmt = $conn->prepare("SELECT role FROM Users WHERE id = :id");
    $targetStmt->execute([':id' => $id]);
    $target = $targetStmt->fetch(PDO::FETCH_ASSOC);

    if ($target && strtolower($target['role']) === 'admin') {
        $countStmt = $conn->query("SELECT COUNT(*) FROM Users WHERE LOWER(role) = 'admin'");
        $adminCount = (int)$countStmt->fetchColumn();
        if ($adminCount <= 1) {
            echo json_encode(["success" => false, "message" => "ลบไม่ได้ ต้องมี admin เหลืออย่างน้อย 1 คนในระบบเสมอ"]);
            exit;
        }
    }

    $stmt = $conn->prepare("DELETE FROM Users WHERE id = :id");
    $stmt->execute([':id' => $id]);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    error_log('delete_user DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาด ไม่สามารถลบผู้ใช้ได้"]);
}