<?php
// API หน้า รปภ. (Admin/guard.html) — รปภ. จดเลขไมล์รถที่ขับกลับเข้ามา แทนผู้ขับ/แอดมิน
//   GET [?date=YYYY-MM-DD]  -> รถที่ยังไม่คืน (ขาไป), จองวันนี้ยังไม่มารับรถ, รายการที่คืนในวันที่เลือก (ค่าเริ่มต้นวันนี้), สรุป
//   POST multipart (photo + booking_id)                       -> อัปโหลดรูปรถ (ไม่บังคับ สูงสุด 5 รูป/รายการ)
//   POST {action:'return',      booking_id, end_mile, note?, fuel?, damage?, clean?, key_returned?, photos?, confirm_far?}
//   POST {action:'edit_return', ... เหมือนข้างบน}              -> แก้รายการที่ รปภ. จดไว้ "วันนี้"
//   POST {action:'undo_return', booking_id}                    -> ยกเลิกการจด (รถกลับเป็น 'ขาไป')
// สิทธิ์: role 'security' (รปภ.) หรือ admin เท่านั้น
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auto_cancel_noshows.php';
require_once __DIR__ . '/log_lib.php';
require_once __DIR__ . '/text_util.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'code' => 'login', 'message' => 'กรุณาเข้าสู่ระบบ']);
    exit;
}
$role = strtolower((string)($_SESSION['role'] ?? ''));
if ($role !== 'security' && $role !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'หน้านี้สำหรับ รปภ. เท่านั้น']);
    exit;
}
if ($role === 'admin') {
    $adminIds = require __DIR__ . '/../admin_whitelist.php';
    if (!in_array((int)$_SESSION['user_id'], $adminIds, true)) {
        echo json_encode(['success' => false, 'message' => 'ไม่มีสิทธิ์เข้าถึง']);
        exit;
    }
}

$isAdminUser = $role === 'admin';
$whoLabel = $isAdminUser ? 'แอดมิน' : 'รปภ.';
$guardName = trim((string)($_SESSION['first_name'] ?? ''));
if ($guardName === '' || $guardName === '-') $guardName = (string)($_SESSION['username'] ?? $whoLabel);

const GD_MAX_PHOTOS = 5;
// ตัวเลือกด่วนตอนรับรถคืน -> ข้อความที่เก็บในหมายเหตุการคืน (คั่นด้วย " | ") และใช้อ่านกลับตอนแก้ไข
const GD_FUEL   = ['full' => 'น้ำมัน: เต็มถัง', 'half' => 'น้ำมัน: ครึ่งถัง', 'low' => 'น้ำมัน: ใกล้หมด'];
const GD_DAMAGE = ['none' => 'สภาพ: ไม่มีรอยใหม่', 'new' => 'สภาพ: มีรอยใหม่'];
const GD_CLEAN  = ['ok' => 'ความสะอาด: สะอาด', 'dirty' => 'ความสะอาด: ควรล้างรถ'];
const GD_KEY    = 'กุญแจ: คืนแล้ว';

// รับ opts จาก client (ค่านอกรายการถือว่าไม่เลือก)
function gd_opts(array $data): array {
    $pick = function ($k, $map) use ($data) { $v = $data[$k] ?? ''; return is_string($v) && isset($map[$v]) ? $v : ''; };
    return [
        'fuel' => $pick('fuel', GD_FUEL), 'damage' => $pick('damage', GD_DAMAGE), 'clean' => $pick('clean', GD_CLEAN),
        'key' => !empty($data['key_returned']),
    ];
}
function gd_compose_remark(string $head, array $o, string $note): string {
    $parts = [$head];
    if ($o['fuel'] !== '')   $parts[] = GD_FUEL[$o['fuel']];
    if ($o['damage'] !== '') $parts[] = GD_DAMAGE[$o['damage']];
    if ($o['clean'] !== '')  $parts[] = GD_CLEAN[$o['clean']];
    if ($o['key'])           $parts[] = GD_KEY;
    if ($note !== '')        $parts[] = 'หมายเหตุ: ' . $note;
    return implode(' | ', $parts);
}
// อ่านหมายเหตุที่ระบบประกอบไว้กลับเป็น opts (รองรับรูปแบบเก่า "... จดเลขไมล์ — หมายเหตุ")
function gd_parse_remark(?string $remark): array {
    $r = ['fuel' => '', 'damage' => '', 'clean' => '', 'key' => false, 'note' => ''];
    $remark = (string)$remark;
    $remark = preg_replace('/ \[แก้ไข.*$/u', '', $remark);
    $segs = explode(' | ', $remark);
    $head = array_shift($segs);
    if (strpos($head, ' — ') !== false) $r['note'] = trim(substr($head, strpos($head, ' — ') + strlen(' — ')));
    foreach ($segs as $s) {
        foreach (GD_FUEL as $k => $t)   if ($s === $t) $r['fuel'] = $k;
        foreach (GD_DAMAGE as $k => $t) if ($s === $t) $r['damage'] = $k;
        foreach (GD_CLEAN as $k => $t)  if ($s === $t) $r['clean'] = $k;
        if ($s === GD_KEY) $r['key'] = true;
        if (strpos($s, 'หมายเหตุ: ') === 0) $r['note'] = substr($s, strlen('หมายเหตุ: '));
    }
    return $r;
}
function gd_head(?string $remark, string $fallback): string {
    $remark = preg_replace('/ \[แก้ไข.*$/u', '', (string)$remark);
    $h = preg_split('/ \| | — /u', $remark)[0] ?? '';
    return $h !== '' ? $h : $fallback;
}
// รายการที่ รปภ./แอดมินจดผ่านหน้านี้ (แก้ไข/ยกเลิกได้) — ดูจากหัวหมายเหตุ
function gd_by_guard(?string $remark): bool {
    return (bool)preg_match('/^(?:รปภ\.|แอดมิน) .+ จดเลขไมล์/u', (string)$remark);
}

// ---------------- GET: รายการ ----------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    try {
        autoCancelNoShows($conn); // เช็คอินตามเวลาให้ก่อน รายการที่ออกรถไปแล้วจะได้ขึ้นครบ
        $date = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$_GET['date']) ? (string)$_GET['date'] : date('Y-m-d');
        $isToday = $date === date('Y-m-d');

        $out = $conn->query(
            "SELECT b.BookingID, b.BookingNumber, b.CarPlate, b.DriverName, b.EmployeeID, b.Department, b.StartMileage, b.Destination,
                    CONVERT(varchar(10), b.BookingDate, 23) AS BookingDate,
                    CONVERT(varchar(16), b.CheckInTime, 120) AS CheckInAt,
                    CONVERT(varchar(16), t.EndAt, 120) AS DueAt,
                    DATEDIFF(MINUTE, t.EndAt, GETDATE()) AS OverdueMin,
                    c.Brand, c.Model, c.Color, du.phone AS DriverPhone
             FROM CarBookings b
             LEFT JOIN (" . bookingTimesSql("N'ขาไป'") . ") t ON t.BookingID = b.BookingID
             LEFT JOIN Cars c ON REPLACE(c.Plate, ' ', '') = REPLACE(b.CarPlate, ' ', '')
             LEFT JOIN Users du ON du.employee_id = b.EmployeeID
             WHERE b.BookingStatus = N'ขาไป'
             ORDER BY t.EndAt, b.BookingID"
        )->fetchAll(PDO::FETCH_ASSOC);

        // จองวันนี้ แต่ยังไม่มารับรถ (สถานะ จองแล้ว) — ให้ รปภ. รู้ล่วงหน้าว่าใครจะมารับคันไหนกี่โมง
        $upcoming = $conn->query(
            "SELECT b.BookingID, b.CarPlate, b.DriverName, b.EmployeeID, b.Destination, b.OutTime,
                    CONVERT(varchar(5), b.PlannedReturnTime, 108) AS PlannedReturn,
                    CASE WHEN ISDATE(b.OutTime) = 1 THEN DATEDIFF(MINUTE, GETDATE(), CAST(b.BookingDate AS DATETIME) + CAST(b.OutTime AS DATETIME)) END AS MinutesToOut,
                    c.Brand, c.Model, du.phone AS DriverPhone
             FROM CarBookings b
             LEFT JOIN Cars c ON REPLACE(c.Plate, ' ', '') = REPLACE(b.CarPlate, ' ', '')
             LEFT JOIN Users du ON du.employee_id = b.EmployeeID
             WHERE b.BookingStatus = N'จองแล้ว' AND b.BookingDate = CAST(GETDATE() AS DATE)
             ORDER BY b.OutTime, b.BookingID"
        )->fetchAll(PDO::FETCH_ASSOC);

        $dst = $conn->prepare(
            "SELECT b.BookingID, b.CarPlate, b.DriverName, b.StartMileage, b.EndMileage,
                    CONVERT(varchar(5), b.ReturnTime, 108) AS ReturnAt, b.ReturnPhotoPath, b.ReturnRemark, c.Brand, c.Model, du.phone AS DriverPhone
             FROM CarBookings b
             LEFT JOIN Cars c ON REPLACE(c.Plate, ' ', '') = REPLACE(b.CarPlate, ' ', '')
             LEFT JOIN Users du ON du.employee_id = b.EmployeeID
             WHERE b.BookingStatus = N'คืนแล้ว' AND b.ReturnDate = :d
             ORDER BY b.ReturnTime DESC, b.BookingID DESC"
        );
        $dst->execute([':d' => $date]);
        $done = $dst->fetchAll(PDO::FETCH_ASSOC);
        $km = 0;
        foreach ($done as &$d) {
            $km += max(0, (int)$d['EndMileage'] - (int)$d['StartMileage']);
            $d['by_guard'] = gd_by_guard($d['ReturnRemark']);
            $d['editable'] = $isToday && $d['by_guard'];
            $d['opts'] = gd_parse_remark($d['ReturnRemark']);
            $d['auto_closed'] = strpos((string)$d['ReturnRemark'], AUTO_CLOSE_TAG) === 0;
        }
        unset($d);
        $overdue = 0;
        foreach ($out as $o) if ((int)$o['OverdueMin'] > 60) $overdue++;

        echo json_encode([
            'success' => true, 'guard' => $guardName, 'is_admin' => $isAdminUser, 'date' => $date, 'is_today' => $isToday,
            'out' => $out, 'upcoming' => $upcoming, 'returned' => $done, 'returned_today' => $isToday ? $done : [],
            'summary' => ['returned' => count($done), 'auto' => count(array_filter($done, fn($x) => $x['auto_closed'])), 'km' => $km, 'out' => count($out), 'overdue' => $overdue, 'upcoming' => count($upcoming)],
        ], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log('guard_api list: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'โหลดข้อมูลไม่สำเร็จ']);
    }
    exit;
}

// ---------------- POST ----------------
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// ---- อัปโหลดรูปรถ (multipart: photo + booking_id) — ไม่บังคับถ่าย, ต่อรายการสูงสุด GD_MAX_PHOTOS รูป ----
if (!empty($_FILES['photo'])) {
    $pid = isset($_POST['booking_id']) && ctype_digit((string)$_POST['booking_id']) ? (int)$_POST['booking_id'] : 0;
    if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        $big = in_array($_FILES['photo']['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        echo json_encode(['success' => false, 'message' => $big ? 'ไฟล์รูปใหญ่เกินไป ลองถ่ายใหม่ด้วยความละเอียดต่ำลง' : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง']);
        exit;
    }
    // ถ่ายได้ทั้งตอนจดคืน (ขาไป) และตอนแก้ไขรายการที่จดไว้วันนี้ (คืนแล้ว)
    $chk = $pid > 0 ? $conn->prepare("SELECT BookingStatus, ReturnDate FROM CarBookings WHERE BookingID = :id") : null;
    $bk = null;
    if ($chk) { $chk->execute([':id' => $pid]); $bk = $chk->fetch(PDO::FETCH_ASSOC); }
    $okState = $bk && ($bk['BookingStatus'] === 'ขาไป' || ($bk['BookingStatus'] === 'คืนแล้ว' && substr((string)$bk['ReturnDate'], 0, 10) === date('Y-m-d')));
    if (!$okState) {
        echo json_encode(['success' => false, 'message' => 'รายการนี้ไม่อยู่ในสถานะที่ถ่ายรูปได้']);
        exit;
    }
    // 🔒 ตรวจเป็นรูปจริงจากเนื้อไฟล์ แล้วตั้งนามสกุลเอง (ไม่เชื่อชื่อไฟล์จาก client)
    $info = @getimagesize($_FILES['photo']['tmp_name']);
    $extByType = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    $ext = ($info && isset($extByType[$info[2]])) ? $extByType[$info[2]] : null;
    if (!$ext) {
        echo json_encode(['success' => false, 'message' => 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP']);
        exit;
    }
    if ($_FILES['photo']['size'] > 8 * 1024 * 1024) {
        echo json_encode(['success' => false, 'message' => 'ไฟล์ใหญ่เกินไป (สูงสุด 8MB)']);
        exit;
    }
    $dir = __DIR__ . '/uploads/return/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    // ชื่อไฟล์สั้นโดยตั้งใจ: เก็บได้ 5 รูปในคอลัมน์ ReturnPhotoPath (varchar 255) โดยไม่ต้องแก้ฐานข้อมูล
    $name = 'return_condition_g' . $pid . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!move_uploaded_file($_FILES['photo']['tmp_name'], $dir . $name)) {
        error_log('guard_api upload: move_uploaded_file failed dest=' . $dir . $name);
        echo json_encode(['success' => false, 'message' => 'บันทึกไฟล์ไม่สำเร็จ']);
        exit;
    }
    echo json_encode(['success' => true, 'photo_path' => 'uploads/return/' . $name]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$action = is_array($data) ? ($data['action'] ?? '') : '';
if (!in_array($action, ['return', 'edit_return', 'undo_return'], true)) {
    echo json_encode(['success' => false, 'message' => 'คำสั่งไม่ถูกต้อง']);
    exit;
}
$bookingId = isset($data['booking_id']) && is_scalar($data['booking_id']) && ctype_digit((string)$data['booking_id']) ? (int)$data['booking_id'] : 0;
if ($bookingId <= 0) {
    echo json_encode(['success' => false, 'message' => 'ไม่พบรายการ']);
    exit;
}

try {
    $st = $conn->prepare("SELECT BookingID, BookingNumber, CarPlate, StartMileage, EndMileage, DriverName, BookingStatus, ReturnRemark, ReturnPhotoPath, CONVERT(varchar(10), ReturnDate, 23) AS ReturnDay FROM CarBookings WHERE BookingID = :id");
    $st->execute([':id' => $bookingId]);
    $b = $st->fetch(PDO::FETCH_ASSOC);
    if (!$b) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการนี้']);
        exit;
    }

    // ================= ยกเลิกการจด =================
    if ($action === 'undo_return') {
        if ($b['BookingStatus'] !== 'คืนแล้ว' || $b['ReturnDay'] !== date('Y-m-d') || !gd_by_guard($b['ReturnRemark'])) {
            echo json_encode(['success' => false, 'code' => 'stale', 'message' => 'ยกเลิกไม่ได้ (ยกเลิกได้เฉพาะรายการที่จดวันนี้)']);
            exit;
        }
        $busy = $conn->prepare("SELECT COUNT(*) FROM CarBookings WHERE REPLACE(CarPlate, ' ', '') = REPLACE(:p, ' ', '') AND BookingStatus = N'ขาไป'");
        $busy->execute([':p' => $b['CarPlate']]);
        if ((int)$busy->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => 'รถคันนี้มีรายการอื่นกำลังใช้งานอยู่ ยกเลิกการจดไม่ได้ (แจ้งแอดมิน)']);
            exit;
        }
        $conn->beginTransaction();
        $u = $conn->prepare("UPDATE CarBookings SET BookingStatus = N'ขาไป', ReturnDate = NULL, ReturnTime = NULL, EndMileage = NULL, ReturnRemark = NULL, ReturnPhotoPath = NULL WHERE BookingID = :id AND BookingStatus = N'คืนแล้ว'");
        $u->execute([':id' => $bookingId]);
        if ($u->rowCount() === 0) { $conn->rollBack(); echo json_encode(['success' => false, 'code' => 'stale', 'message' => 'รายการเปลี่ยนไปแล้ว (รีเฟรช)']); exit; }
        // คืนเลขไมล์ล่าสุดของรถเป็นค่าตอนออก ถ้ายังเป็นค่าที่เพิ่งจดไว้ (ไม่ทับถ้ามีรายการอื่นอัปเดตไปแล้ว)
        $conn->prepare("UPDATE Cars SET Mileage = :s WHERE Plate = :p AND Mileage = :e")->execute([':s' => (int)$b['StartMileage'], ':p' => $b['CarPlate'], ':e' => (int)$b['EndMileage']]);
        $conn->commit();
        $bi = sl_booking_info($conn, $bookingId);
        sl_log($conn, 'return_undo', $whoLabel . ' ยกเลิกการจดคืนรถ ' . trim($bi['plate'] . ' ' . $bi['driver']), [
            'target_type' => 'booking', 'target' => $bi['no'], 'detail' => ['guard' => $guardName, 'was_end_mileage' => (int)$b['EndMileage']],
        ]);
        echo json_encode(['success' => true, 'message' => 'ยกเลิกการจดแล้ว รถกลับไปอยู่ในรายการ "ยังไม่คืน"'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ================= จด / แก้ไข =================
    $isEdit = $action === 'edit_return';
    $endMile = isset($data['end_mile']) && is_scalar($data['end_mile']) && preg_match('/^\d{1,7}$/', (string)$data['end_mile']) ? (int)$data['end_mile'] : 0;
    $note = isset($data['note']) && is_string($data['note']) ? fit_nvarchar(trim($data['note']), 200) : '';
    $opts = gd_opts($data);
    if ($endMile <= 0) {
        echo json_encode(['success' => false, 'message' => 'กรุณากรอกเลขไมล์ให้ถูกต้อง']);
        exit;
    }
    // รูปรถ (ไม่บังคับ สูงสุด 5): ต้องเป็น path ที่ระบบออกให้ของรายการนี้และมีไฟล์อยู่จริง
    $photos = [];
    $hasPhotosKey = is_array($data) && array_key_exists('photos', $data);
    if (!empty($data['photos'])) {
        if (!is_array($data['photos']) || count($data['photos']) > GD_MAX_PHOTOS) {
            echo json_encode(['success' => false, 'message' => 'แนบรูปได้สูงสุด ' . GD_MAX_PHOTOS . ' รูป']);
            exit;
        }
        foreach ($data['photos'] as $p) {
            if (!is_string($p) || !preg_match('#^uploads/return/return_condition_g' . $bookingId . '_[0-9a-f]{8}\.(?:jpg|png|webp)$#D', $p) || !is_file(__DIR__ . '/' . $p)) {
                echo json_encode(['success' => false, 'message' => 'รูปที่แนบไม่ถูกต้อง กรุณาถ่ายใหม่']);
                exit;
            }
            $photos[$p] = true;
        }
        $photos = array_keys($photos);
    }
    $photoValue = $photos ? implode('|', $photos) : null; // หลายรูปคั่นด้วย | (ช่องแรกคือรูปหลักที่หน้าอื่นอ่านอยู่แล้ว)

    if ($isEdit) {
        if ($b['BookingStatus'] !== 'คืนแล้ว' || $b['ReturnDay'] !== date('Y-m-d') || !gd_by_guard($b['ReturnRemark'])) {
            echo json_encode(['success' => false, 'code' => 'stale', 'message' => 'แก้ไขไม่ได้ (แก้ได้เฉพาะรายการที่จดวันนี้)']);
            exit;
        }
    } elseif ($b['BookingStatus'] !== 'ขาไป') {
        echo json_encode(['success' => false, 'code' => 'stale', 'message' => 'รถคันนี้คืนไปแล้ว หรือไม่ได้อยู่ในสถานะที่คืนได้ (รีเฟรชรายการ)']);
        exit;
    }
    $startMile = (int)$b['StartMileage'];
    if ($endMile <= $startMile) {
        echo json_encode(['success' => false, 'message' => 'เลขไมล์ต้องมากกว่าตอนออก (' . number_format($startMile) . ' กม.) — ตรวจเลขที่จดอีกครั้ง']);
        exit;
    }
    $dist = $endMile - $startMile;
    if ($dist > 1500 && empty($data['confirm_far'])) {
        echo json_encode(['success' => false, 'code' => 'far_distance', 'message' => 'ระยะทาง ' . number_format($dist) . ' กม. ดูผิดปกติ (เกิน 1,500) ตรวจเลขไมล์ให้แน่ใจ']);
        exit;
    }

    $conn->beginTransaction();
    if ($isEdit) {
        $head = gd_head($b['ReturnRemark'], $whoLabel . ' ' . $guardName . ' จดเลขไมล์');
        $remark = gd_compose_remark($head, $opts, $note) . ' [แก้ไขโดย ' . $whoLabel . ' ' . $guardName . ' ' . date('H:i') . ']';
        // ส่งรายการรูปมา = แทนที่ทั้งชุด (ว่าง = ลบรูปทั้งหมด) ไม่ส่งมา = คงรูปเดิม
        $up = $conn->prepare("UPDATE CarBookings SET EndMileage = :m, ReturnRemark = :r" . ($hasPhotosKey ? ", ReturnPhotoPath = :ph" : "") . " WHERE BookingID = :id AND BookingStatus = N'คืนแล้ว'");
        $args = [':m' => $endMile, ':r' => fit_nvarchar($remark, 500), ':id' => $bookingId];
        if ($hasPhotosKey) $args[':ph'] = $photoValue;
        $up->execute($args);
        // ซิงก์เลขไมล์ล่าสุดของรถ ถ้ายังเป็นค่าที่จดไว้เดิม
        $conn->prepare("UPDATE Cars SET Mileage = :n WHERE Plate = :p AND Mileage = :o")->execute([':n' => $endMile, ':p' => $b['CarPlate'], ':o' => (int)$b['EndMileage']]);
    } else {
        $remark = gd_compose_remark($whoLabel . ' ' . $guardName . ' จดเลขไมล์', $opts, $note);
        $up = $conn->prepare(
            "UPDATE CarBookings SET BookingStatus = N'คืนแล้ว', ReturnDate = CAST(GETDATE() AS DATE), ReturnTime = CONVERT(varchar(8), GETDATE(), 108),
                    EndMileage = :m, ReturnRemark = :r, ReturnPhotoPath = COALESCE(:ph, ReturnPhotoPath)
             WHERE BookingID = :id AND BookingStatus = N'ขาไป'"
        );
        $up->execute([':m' => $endMile, ':r' => fit_nvarchar($remark, 500), ':ph' => $photoValue, ':id' => $bookingId]);
        if ($up->rowCount() === 0) {
            $conn->rollBack();
            echo json_encode(['success' => false, 'code' => 'stale', 'message' => 'รถคันนี้คืนไปแล้ว (รีเฟรชรายการ)']);
            exit;
        }
        $conn->prepare("UPDATE Cars SET Mileage = :m WHERE Plate = :p")->execute([':m' => $endMile, ':p' => $b['CarPlate']]);
    }
    $conn->commit();

    $bi = sl_booking_info($conn, $bookingId);
    sl_log($conn, $isEdit ? 'return_edit' : 'return', $whoLabel . ($isEdit ? ' แก้ไขรายการคืนรถ ' : ' จดคืนรถ ') . trim($bi['plate'] . ' ' . $bi['driver']) . ' ไมล์คืน ' . number_format($endMile) . ' กม.', [
        'target_type' => 'booking', 'target' => $bi['no'],
        'detail' => ['start_mileage' => $startMile, 'end_mileage' => $endMile, 'by' => 'security', 'guard' => $guardName, 'photos' => count($photos),
                     'fuel' => $opts['fuel'], 'damage' => $opts['damage'], 'clean' => $opts['clean'], 'key' => $opts['key'], 'old_end_mileage' => $isEdit ? (int)$b['EndMileage'] : null],
    ]);
    echo json_encode(['success' => true, 'plate' => $b['CarPlate'], 'driver' => $b['DriverName'], 'distance' => $dist, 'photos' => count($photos), 'message' => $isEdit ? 'แก้ไขแล้ว' : 'บันทึกคืนรถแล้ว'], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    error_log('guard_api ' . $action . ': ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง กรุณาลองใหม่']);
}
