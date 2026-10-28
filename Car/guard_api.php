<?php
// API หน้า รปภ. (/guard) — รปภ. จดเลขไมล์รถที่ขับกลับเข้ามา แทนผู้ขับ/แอดมิน
//   GET            -> รายการรถที่ยังไม่คืน (ขาไป) + รายการที่คืนวันนี้
//   POST {action:'return', booking_id, end_mile, note?, confirm_far?} -> บันทึกคืนรถ (เวลาคืน = ตอนนี้)
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

// ---------------- GET: รายการ ----------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    try {
        autoCancelNoShows($conn); // เช็คอินตามเวลาให้ก่อน รายการที่ออกรถไปแล้วจะได้ขึ้นครบ
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
        $done = $conn->query(
            "SELECT b.BookingID, b.CarPlate, b.DriverName, b.StartMileage, b.EndMileage,
                    CONVERT(varchar(5), b.ReturnTime, 108) AS ReturnAt, b.ReturnPhotoPath, c.Brand, c.Model
             FROM CarBookings b
             LEFT JOIN Cars c ON REPLACE(c.Plate, ' ', '') = REPLACE(b.CarPlate, ' ', '')
             WHERE b.BookingStatus = N'คืนแล้ว' AND b.ReturnDate = CAST(GETDATE() AS DATE)
             ORDER BY b.ReturnTime DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'guard' => $guardName, 'is_admin' => $isAdminUser, 'out' => $out, 'returned_today' => $done], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log('guard_api list: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'โหลดข้อมูลไม่สำเร็จ']);
    }
    exit;
}

// ---------------- POST: บันทึกคืนรถ ----------------
require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// ---- อัปโหลดรูปรถ (multipart: photo + booking_id) — ไม่บังคับถ่าย, ต่อรายการสูงสุด GD_MAX_PHOTOS รูป ----
const GD_MAX_PHOTOS = 5;
if (!empty($_FILES['photo'])) {
    $pid = isset($_POST['booking_id']) && ctype_digit((string)$_POST['booking_id']) ? (int)$_POST['booking_id'] : 0;
    if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        $big = in_array($_FILES['photo']['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        echo json_encode(['success' => false, 'message' => $big ? 'ไฟล์รูปใหญ่เกินไป ลองถ่ายใหม่ด้วยความละเอียดต่ำลง' : 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง']);
        exit;
    }
    $chk = $pid > 0 ? $conn->prepare("SELECT BookingStatus FROM CarBookings WHERE BookingID = :id") : null;
    if ($chk) { $chk->execute([':id' => $pid]); }
    if (!$chk || $chk->fetchColumn() !== 'ขาไป') {
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
if (!is_array($data) || ($data['action'] ?? '') !== 'return') {
    echo json_encode(['success' => false, 'message' => 'คำสั่งไม่ถูกต้อง']);
    exit;
}
$bookingId = isset($data['booking_id']) && is_scalar($data['booking_id']) && ctype_digit((string)$data['booking_id']) ? (int)$data['booking_id'] : 0;
$endMile = isset($data['end_mile']) && is_scalar($data['end_mile']) && preg_match('/^\d{1,7}$/', (string)$data['end_mile']) ? (int)$data['end_mile'] : 0;
$note = isset($data['note']) && is_string($data['note']) ? fit_nvarchar(trim($data['note']), 200) : '';
// รูปรถ (ไม่บังคับ สูงสุด 5): ต้องเป็น path ที่ระบบออกให้ของรายการนี้และมีไฟล์อยู่จริง
$photos = [];
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
if ($bookingId <= 0 || $endMile <= 0) {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกเลขไมล์ให้ถูกต้อง']);
    exit;
}

try {
    $st = $conn->prepare("SELECT BookingID, BookingNumber, CarPlate, StartMileage, DriverName, BookingStatus, CONVERT(varchar(16), CheckInTime, 120) AS CheckInAt FROM CarBookings WHERE BookingID = :id");
    $st->execute([':id' => $bookingId]);
    $b = $st->fetch(PDO::FETCH_ASSOC);
    if (!$b) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบรายการนี้']);
        exit;
    }
    if ($b['BookingStatus'] !== 'ขาไป') {
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

    $remark = $whoLabel . ' ' . $guardName . ' จดเลขไมล์' . ($note !== '' ? ' — ' . $note : '');
    $conn->beginTransaction();
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
    $conn->commit();

    $bi = sl_booking_info($conn, $bookingId);
    sl_log($conn, 'return', $whoLabel . ' จดคืนรถ ' . trim($bi['plate'] . ' ' . $bi['driver']) . ' ไมล์คืน ' . number_format($endMile) . ' กม.', [
        'target_type' => 'booking', 'target' => $bi['no'],
        'detail' => ['start_mileage' => $startMile, 'end_mileage' => $endMile, 'by' => 'security', 'guard' => $guardName, 'photos' => count($photos)],
    ]);
    echo json_encode(['success' => true, 'plate' => $b['CarPlate'], 'driver' => $b['DriverName'], 'distance' => $dist, 'photos' => count($photos), 'message' => 'บันทึกคืนรถแล้ว'], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    error_log('guard_api return: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'ระบบขัดข้อง กรุณาลองใหม่']);
}
