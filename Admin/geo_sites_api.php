<?php
// จัดการจุดบริษัทที่ใช้ตรวจพิกัด (เก็บเป็น Car/geo_sites.json ไม่ใช้ DB) — เฉพาะแอดมิน
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../require_admin.php';
requireAdminAccess();
require_once __DIR__ . '/../Car/geo_lib.php';

$file = geo_sites_file();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['success' => true, 'sites' => geo_sites()], JSON_UNESCAPED_UNICODE);
    exit;
}

$in = json_decode(file_get_contents('php://input'), true) ?: [];
$sites = geo_sites();

if (($in['action'] ?? '') === 'add') {
    $lat = $in['lat'] ?? null; $lng = $in['lng'] ?? null;
    if (!is_numeric($lat) || !is_numeric($lng) || abs($lat) > 90 || abs($lng) > 180) {
        echo json_encode(['success' => false, 'message' => 'พิกัดไม่ถูกต้อง']);
        exit;
    }
    $sites[] = [
        'name'   => mb_substr(trim((string)($in['name'] ?? '')) ?: 'จุดบริษัท', 0, 60),
        'lat'    => round((float)$lat, 6),
        'lng'    => round((float)$lng, 6),
        'radius' => max(50, min(5000, (int)($in['radius'] ?? 300))),
    ];
} elseif (($in['action'] ?? '') === 'delete') {
    $i = (int)($in['index'] ?? -1);
    if (!isset($sites[$i])) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบจุดนี้']);
        exit;
    }
    array_splice($sites, $i, 1);
} else {
    echo json_encode(['success' => false, 'message' => 'คำสั่งไม่ถูกต้อง']);
    exit;
}

if (file_put_contents($file, json_encode(array_values($sites), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) {
    echo json_encode(['success' => false, 'message' => 'บันทึกไฟล์ไม่ได้ (สิทธิ์เขียนโฟลเดอร์ Car)']);
    exit;
}
echo json_encode(['success' => true, 'sites' => $sites], JSON_UNESCAPED_UNICODE);
