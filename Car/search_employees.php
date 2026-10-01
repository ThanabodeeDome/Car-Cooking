<?php
// 🌟 ค้นหาพนักงานด้วยชื่อ/อีเมล สำหรับช่อง "ระบุผู้เข้าร่วมเพิ่มเติม" แบบเลือกจากลิสต์ (เหมือนจองห้องประชุม)
// ส่งกลับแค่ชื่อ+อีเมล+รหัสพนักงาน พอ ไม่ส่ง phone/password/role ออกไป
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';

try {
    if ($q === '') {
        // ไม่พิมพ์อะไร -> โชว์รายชื่อเริ่มต้นให้เลือกเร็วๆ (เรียงตามชื่อ)
        $stmt = $conn->prepare(
            "SELECT TOP 8 employee_id, first_name, last_name, email FROM Users ORDER BY first_name"
        );
        $stmt->execute();
    } else {
        // 🩹 FIX: driver sqlsrv ของ PDO ไม่รองรับใช้ named parameter ซ้ำ (:q) หลายจุดในคิวรีเดียว
        // เหมือน MySQL — ต้องประกาศแยกชื่อทุกจุดแม้ค่าจะเหมือนกัน ไม่งั้น error "COUNT field incorrect"
        $stmt = $conn->prepare(
            "SELECT TOP 20 employee_id, first_name, last_name, email FROM Users
             WHERE first_name LIKE :q1 OR last_name LIKE :q2 OR email LIKE :q3 OR employee_id LIKE :q4
             ORDER BY first_name"
        );
        $like = '%' . $q . '%';
        $stmt->execute([':q1' => $like, ':q2' => $like, ':q3' => $like, ':q4' => $like]);
    }
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = array_map(function ($r) {
        return [
            'employee_id' => $r['employee_id'],
            'name'        => trim($r['first_name'] . ' ' . $r['last_name']),
            'email'       => $r['email'],
        ];
    }, $rows);

    echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('search_employees.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ค้นหาไม่สำเร็จ']);
}
