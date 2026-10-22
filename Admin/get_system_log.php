<?php
// ดึงบันทึกระบบ (SystemLog) สำหรับหน้า "บันทึกระบบ" ของแอดมิน + Export CSV (format=csv)
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
require_once '../Car/db_connect.php';
require_once __DIR__ . '/../require_admin.php';
require_once '../Car/log_lib.php';
requireAdminAccess();

$isCsv = ($_GET['format'] ?? '') === 'csv';
if (!$isCsv) header('Content-Type: application/json; charset=utf-8');

function sl_out_json(array $a): void {
    echo json_encode($a, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$events = sl_events();
$cats = sl_categories();

if (!sl_ready($conn)) {
    sl_out_json(['success' => true, 'ready' => false, 'message' => 'ยังไม่ได้สร้างตาราง SystemLog — รันไฟล์ db/migrations/2026-10-22_system-log.sql บนฐานข้อมูลก่อน', 'rows' => [], 'total' => 0, 'categories' => $cats, 'events' => array_map(fn($e) => $e[0], $events)]);
}

$today = date('Y-m-d');
$start = $_GET['start'] ?? date('Y-m-d', strtotime('-6 days'));
$end   = $_GET['end'] ?? $today;
// 🔒 รับเฉพาะ YYYY-MM-DD ที่เป็นวันที่จริง (ค่าแปลกๆ ใช้ค่าเริ่มต้นแทน)
$okDate = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && strtotime($d) !== false;
if (!$okDate($start)) $start = date('Y-m-d', strtotime('-6 days'));
if (!$okDate($end)) $end = $today;
$endEx = date('Y-m-d', strtotime($end . ' +1 day'));

$cat = isset($_GET['category']) && isset($cats[$_GET['category']]) ? $_GET['category'] : '';
$type = isset($_GET['type']) && isset($events[$_GET['type']]) ? $_GET['type'] : '';
$q = isset($_GET['q']) && is_string($_GET['q']) ? trim(mb_substr($_GET['q'], 0, 100)) : '';

$where = "LogTime >= :s AND LogTime < :e";
$params = [':s' => $start, ':e' => $endEx];
if ($cat !== '') { $where .= " AND Category = :c"; $params[':c'] = $cat; }
if ($type !== '') { $where .= " AND EventType = :t"; $params[':t'] = $type; }
if ($q !== '') {
    $where .= " AND (Summary LIKE :q1 OR ActorName LIKE :q2 OR TargetRef LIKE :q3 OR ActorEmpID LIKE :q4 OR IP LIKE :q5)";
    foreach (['q1', 'q2', 'q3', 'q4', 'q5'] as $k) $params[':' . $k] = '%' . $q . '%';
}

try {
    $fmtRow = function (array $r) use ($events): array {
        $ev = $events[$r['EventType']] ?? [$r['EventType'], $r['Category']];
        $detail = null;
        if (!empty($r['Detail'])) {
            $d = json_decode($r['Detail'], true);
            $detail = $d !== null ? $d : $r['Detail'];
        }
        return [
            'id' => (int)$r['LogID'], 'time' => substr((string)$r['LogTime'], 0, 19), 'type' => $r['EventType'], 'label' => $ev[0], 'category' => $r['Category'],
            'actor' => (string)$r['ActorName'], 'emp' => (string)$r['ActorEmpID'], 'actor_id' => $r['ActorUserID'] !== null ? (int)$r['ActorUserID'] : null,
            'target_type' => (string)$r['TargetType'], 'target' => (string)$r['TargetRef'], 'summary' => (string)$r['Summary'], 'detail' => $detail, 'ip' => (string)$r['IP'],
        ];
    };

    if ($isCsv) {
        $st = $conn->prepare("SELECT TOP 20000 LogID, LogTime, EventType, Category, ActorUserID, ActorName, ActorEmpID, TargetType, TargetRef, Summary, Detail, IP FROM SystemLog WHERE $where ORDER BY LogID DESC");
        $st->execute($params);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="system-log_' . $start . '_' . $end . '.csv"');
        echo "\xEF\xBB\xBF"; // BOM ให้ Excel อ่านภาษาไทยถูก
        $out = fopen('php://output', 'w');
        fputcsv($out, ['เวลา', 'ประเภท', 'หมวด', 'ผู้ทำ', 'รหัสพนักงาน', 'ชนิดรายการ', 'รายการ', 'ข้อความ', 'IP', 'รายละเอียด']);
        // 🔒 กัน CSV injection: ค่าที่ขึ้นต้นด้วย = + - @ ให้ Excel ไม่ตีเป็นสูตร
        $safe = fn($v) => (is_string($v) && $v !== '' && strpos("=+-@", $v[0]) !== false) ? "'" . $v : $v;
        while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
            $row = $fmtRow($r);
            fputcsv($out, [$row['time'], $row['label'], $cats[$row['category']] ?? $row['category'], $safe($row['actor']), $safe($row['emp']), $row['target_type'], $safe($row['target']), $safe($row['summary']), $row['ip'], is_array($row['detail']) ? json_encode($row['detail'], JSON_UNESCAPED_UNICODE) : (string)$row['detail']]);
        }
        fclose($out);
        exit;
    }

    $per = 50;
    $page = max(1, (int)($_GET['page'] ?? 1));

    $st = $conn->prepare("SELECT COUNT(*) FROM SystemLog WHERE $where");
    $st->execute($params);
    $total = (int)$st->fetchColumn();
    $pages = max(1, (int)ceil($total / $per));
    if ($page > $pages) $page = $pages;

    $st = $conn->prepare("SELECT LogID, LogTime, EventType, Category, ActorUserID, ActorName, ActorEmpID, TargetType, TargetRef, Summary, Detail, IP
                          FROM SystemLog WHERE $where ORDER BY LogID DESC OFFSET :o ROWS FETCH NEXT :n ROWS ONLY");
    foreach ($params as $k => $v) $st->bindValue($k, $v);
    $st->bindValue(':o', ($page - 1) * $per, PDO::PARAM_INT);
    $st->bindValue(':n', $per, PDO::PARAM_INT);
    $st->execute();
    $rows = array_map($fmtRow, $st->fetchAll(PDO::FETCH_ASSOC));

    // จำนวนต่อหมวดในช่วงที่เลือก (ไม่ขึ้นกับตัวกรองหมวด/ประเภท แต่ขึ้นกับช่วงวันที่และคำค้น)
    $w2 = "LogTime >= :s AND LogTime < :e";
    $p2 = [':s' => $start, ':e' => $endEx];
    if ($q !== '') {
        $w2 .= " AND (Summary LIKE :q1 OR ActorName LIKE :q2 OR TargetRef LIKE :q3 OR ActorEmpID LIKE :q4 OR IP LIKE :q5)";
        foreach (['q1', 'q2', 'q3', 'q4', 'q5'] as $k) $p2[':' . $k] = '%' . $q . '%';
    }
    $st = $conn->prepare("SELECT Category, COUNT(*) AS n FROM SystemLog WHERE $w2 GROUP BY Category");
    $st->execute($p2);
    $counts = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $counts[$r['Category']] = (int)$r['n'];

    sl_out_json([
        'success' => true, 'ready' => true, 'rows' => $rows, 'total' => $total, 'page' => $page, 'pages' => $pages, 'per' => $per,
        'start' => $start, 'end' => $end, 'counts' => $counts, 'categories' => $cats, 'events' => array_map(fn($e) => $e[0], $events),
        'retention_days' => SL_RETENTION_DAYS,
    ]);
} catch (PDOException $e) {
    error_log('get_system_log DB error: ' . $e->getMessage());
    if ($isCsv) { http_response_code(500); echo 'error'; exit; }
    sl_out_json(['success' => false, 'message' => 'โหลดบันทึกระบบไม่สำเร็จ']);
}
