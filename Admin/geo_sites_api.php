<?php
// จัดการจุดบริษัทที่ใช้ตรวจพิกัด (เก็บเป็น Car/geo_sites.json ไม่ใช้ DB) — เฉพาะแอดมิน
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
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
$sitesBefore = $sites; // ไว้ใช้เขียน log ตอนลบ/แก้ไข

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
} elseif (($in['action'] ?? '') === 'update') {
    // ย้ายหมุด/แก้รัศมีของจุดเดิม (ลากหมุดบนแผนที่หน้า geo-setup.php)
    $i = (int)($in['index'] ?? -1);
    $lat = $in['lat'] ?? null; $lng = $in['lng'] ?? null;
    if (!isset($sites[$i])) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบจุดนี้']);
        exit;
    }
    if (!is_numeric($lat) || !is_numeric($lng) || abs($lat) > 90 || abs($lng) > 180) {
        echo json_encode(['success' => false, 'message' => 'พิกัดไม่ถูกต้อง']);
        exit;
    }
    $sites[$i]['lat'] = round((float)$lat, 6);
    $sites[$i]['lng'] = round((float)$lng, 6);
    if (isset($in['radius'])) $sites[$i]['radius'] = max(50, min(5000, (int)$in['radius']));
    if (isset($in['name']) && trim((string)$in['name']) !== '') $sites[$i]['name'] = mb_substr(trim((string)$in['name']), 0, 60);
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
// 📝 บันทึกระบบ: จัดการจุดตรวจพิกัด
try {
    require_once __DIR__ . '/../Car/db_connect.php';
    require_once __DIR__ . '/../Car/log_lib.php';
    $act = $in['action'] ?? '';
    $i = (int)($in['index'] ?? -1);
    if ($act === 'add') {
        $s = end($sites);
        sl_log($conn, 'geo_add', 'เพิ่มจุดตรวจพิกัด "' . $s['name'] . '" รัศมี ' . $s['radius'] . ' ม.', ['target_type' => 'geo', 'target' => $s['name'], 'detail' => ['lat' => $s['lat'], 'lng' => $s['lng'], 'radius' => $s['radius']]]);
    } elseif ($act === 'update' && isset($sites[$i])) {
        $b = $sitesBefore[$i] ?? [];
        sl_log($conn, 'geo_update', 'แก้ไขจุดตรวจพิกัด "' . $sites[$i]['name'] . '" รัศมี ' . ($b['radius'] ?? '?') . ' → ' . $sites[$i]['radius'] . ' ม.', [
            'target_type' => 'geo', 'target' => $sites[$i]['name'],
            'detail' => ['จาก' => $b, 'เป็น' => $sites[$i]],
        ]);
    } elseif ($act === 'delete' && isset($sitesBefore[$i])) {
        sl_log($conn, 'geo_delete', 'ลบจุดตรวจพิกัด "' . $sitesBefore[$i]['name'] . '"', ['target_type' => 'geo', 'target' => $sitesBefore[$i]['name'], 'detail' => $sitesBefore[$i]]);
    }
} catch (Throwable $e) {
    error_log('geo_sites_api log: ' . $e->getMessage());
}

echo json_encode(['success' => true, 'sites' => $sites], JSON_UNESCAPED_UNICODE);
