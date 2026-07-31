<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();

try {
    // ไม่ select password ออกมาเด็ดขาด แม้เป็น hash ก็ตาม
    $sql = "SELECT id, employee_id, username, first_name, role FROM Users
            ORDER BY
              CASE WHEN TRY_CAST(employee_id AS INT) IS NULL THEN 1 ELSE 0 END,
              TRY_CAST(employee_id AS INT) ASC,
              employee_id ASC";
    $users = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["success" => true, "users" => $users]);
} catch (PDOException $e) {
    error_log('get_users DB error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดในการโหลดรายชื่อผู้ใช้"]);
}