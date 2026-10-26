<?php
// 🌟 ค้นหาพนักงานด้วยชื่อ/อีเมล สำหรับช่อง "ระบุผู้เข้าร่วมเพิ่มเติม" แบบเลือกจากลิสต์ (เหมือนจองห้องประชุม)
// ส่งกลับแค่ชื่อ+อีเมล+รหัสพนักงาน พอ ไม่ส่ง phone/password/role ออกไป
require_once 'guard_user.php';
require_once 'db_connect.php';
header('Content-Type: application/json; charset=utf-8');

$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$me  = (string)($_SESSION['employee_id'] ?? '');
$uid = (int)($_SESSION['user_id'] ?? 0);

// นับว่าแต่ละคนเคย "ไปด้วยกัน" กับฉันกี่ครั้ง: นับจากการจองที่ฉันเป็นผู้ขับ/ผู้จอง/ผู้ร่วมเดินทาง (ไม่นับที่ยกเลิก, ดูย้อนหลังล่าสุด 300 รายการ)
// คนที่ไปด้วยกัน = ผู้ร่วมเดินทางคนอื่นในรายการนั้น + ผู้ขับ (ถ้าฉันเป็นผู้ร่วมเดินทาง) ไม่นับตัวฉันเอง
$freq = [];
try {
    if ($me !== '') {
        $f = $conn->prepare(
            "SELECT TOP 300 EmployeeID, PassengerIDs FROM CarBookings
             WHERE (EmployeeID = :me1 OR BookedByUserID = :uid OR PassengerIDs LIKE :likeMe)
               AND BookingStatus NOT LIKE N'ยกเลิก%'
             ORDER BY BookingID DESC"
        );
        $f->execute([':me1' => $me, ':uid' => $uid, ':likeMe' => '%' . $me . '%']);
        foreach ($f->fetchAll(PDO::FETCH_ASSOC) as $b) {
            $ids = preg_split('/[,\s]+/u', (string)($b['PassengerIDs'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if ((string)$b['EmployeeID'] !== '') $ids[] = (string)$b['EmployeeID'];
            foreach (array_unique($ids) as $id) {
                if ($id === $me || $id === '-' ) continue;
                $freq[$id] = ($freq[$id] ?? 0) + 1;
            }
        }
        arsort($freq);
    }
} catch (PDOException $e) {
    error_log('search_employees freq: ' . $e->getMessage());
}

try {
    if ($q === '') {
        // ไม่พิมพ์อะไร -> โชว์รายชื่อเริ่มต้นให้เลือกเร็วๆ (เรียงตามชื่อ)
        $stmt = $conn->prepare(
            "SELECT TOP 40 employee_id, first_name, last_name, email FROM Users ORDER BY first_name"
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

    // ค้นหาแบบว่าง: ดึงคนที่ไปด้วยกันบ่อยมาไว้ก่อนเสมอ (ต่อให้ไม่อยู่ใน 40 รายชื่อแรก) แล้วตามด้วยรายชื่ออื่น
    if ($q === '' && $freq) {
        $top = array_slice(array_keys($freq), 0, 10);
        $ph = implode(',', array_map(fn($i) => ':f' . $i, array_keys($top)));
        $fs = $conn->prepare("SELECT employee_id, first_name, last_name, email FROM Users WHERE employee_id IN ($ph)");
        foreach ($top as $i => $id) $fs->bindValue(':f' . $i, (string)$id);
        $fs->execute();
        $have = [];
        foreach ($rows as $r) $have[$r['employee_id']] = true;
        foreach ($fs->fetchAll(PDO::FETCH_ASSOC) as $r) if (empty($have[$r['employee_id']])) $rows[] = $r;
    }

    $results = array_map(function ($r) use ($freq) {
        return [
            'employee_id' => $r['employee_id'],
            'name'        => trim($r['first_name'] . ' ' . $r['last_name']),
            'email'       => $r['email'],
            'trips'       => (int)($freq[(string)$r['employee_id']] ?? 0),
        ];
    }, $rows);
    // คนที่ไปด้วยกันบ่อยขึ้นก่อน (มากไปน้อย) ที่เหลือคงลำดับตามชื่อเดิม
    $idx = array_keys($results);
    usort($idx, fn($a, $b) => [$results[$b]['trips'], $a] <=> [$results[$a]['trips'], $b]);
    $results = array_map(fn($i) => $results[$i], $idx);

    echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('search_employees.php error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ค้นหาไม่สำเร็จ']);
}
