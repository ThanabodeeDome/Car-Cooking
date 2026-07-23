<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../Car/db_connect.php';

if (!isset($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "ไม่มีสิทธิ์เข้าถึง"]);
    exit;
}

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
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}