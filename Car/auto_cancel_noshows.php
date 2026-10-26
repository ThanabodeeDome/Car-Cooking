<?php
// เรียกใช้จาก get_my_bookings.php / admin_get_bookings.php / get_overdue_returns.php ก่อนดึงข้อมูลทุกครั้ง
//
// 🔁 เปลี่ยนระบบ (จากเดิมที่ปล่อยคิวถ้าไม่เช็คอินใน 60 นาที):
//    1) ถึงเวลาออก (OutTime) แล้ว คิว 'จองแล้ว' จะถูกเช็คอินให้อัตโนมัติ เป็น 'ขาไป' — ไม่ต้องสแกน QR/ไม่ต้องรอใครกด
//       (คนขับที่ไม่ได้ใช้รถต้องกด "ไม่ได้ใช้รถ" ที่หน้าการจองของฉันเอง — ดู cancel_booking.php)
//    2) คิวที่ผ่านเวลากลับไปแล้วโดยไม่มีใครเปิดระบบเลยตลอดช่วงนั้น (ยังเป็น 'จองแล้ว') จะถูกปล่อยเป็น 'ยกเลิก (ไม่มาใช้งาน)'
//    3) รอบที่ "เช็คอินแล้วแต่ไม่คืน" ระบบไม่ปิดงานให้เองโดยเจตนา (รถอาจยังอยู่นอกสถานที่จริง ปิดเองจะได้ไมล์/รูปคืนไม่ครบ)
//       ใช้วิธีตามเตือน (notify_lib.php / notify_cron.php) และขึ้นรายชื่อ "ค้างคืนรถ" ให้ทุกคนเห็น (get_overdue_returns.php)
//    ทั้งหมดไม่แก้โครงสร้าง DB และเรียกซ้ำได้ปลอดภัย (idempotent)

// ตารางเวลาเริ่ม/จบจริงของแต่ละการจอง (จบ = เวลากลับ; ถ้าเวลากลับ <= เวลาไป ถือว่าข้ามคืน +1 วัน)
// $statusLiteral เช่น "N'จองแล้ว'" — ใส่เองจากโค้ด ห้ามรับจากผู้ใช้
function bookingTimesSql(string $statusLiteral): string {
    return "SELECT BookingID, CarPlate, StartAt, EndAt FROM (
              SELECT y.BookingID, y.CarPlate,
                     CASE WHEN ISDATE(y.OutTime) = 1 THEN CAST(y.BookingDate AS DATETIME) + CAST(y.OutTime AS DATETIME) END AS StartAt,
                     CASE WHEN ISDATE(y.OutTime) = 1 AND ISDATE(y.RT) = 1
                          THEN CAST(y.BookingDate AS DATETIME) + CAST(y.RT AS DATETIME) + CASE WHEN y.RT <= LEFT(y.OutTime, 5) THEN 1 ELSE 0 END
                     END AS EndAt
              FROM (SELECT BookingID, CarPlate, BookingDate, OutTime, CONVERT(varchar(5), PlannedReturnTime, 108) AS RT
                    FROM CarBookings WHERE BookingStatus = $statusLiteral) y
            ) z WHERE StartAt IS NOT NULL";
}

// เวลาที่ระบบกฎใหม่ "เริ่มทำงานจริง" — บันทึกไว้ในไฟล์ตอนเรียกครั้งแรกหลังอัปโหลดขึ้นเว็บจริง
// กฎปล่อยคิว/เช็คอินอัตโนมัติจะแตะเฉพาะการจองที่จบ/เริ่มหลังเวลานี้ ไม่ไปแก้ของเก่าที่ค้างมาก่อนอัปโหลด
// (กันการจองเก่าถูกเปลี่ยนสถานะพรวดเดียว โดยที่แอดมินไม่ต้องตามแก้) ลบไฟล์ auto_rules_start.txt เพื่อตั้งใหม่ได้
function autoRulesStart() {
    static $cut = null;
    if ($cut !== null) return $cut;
    $cut = '1970-01-01 00:00:00'; // ถ้าเขียนไฟล์ไม่ได้ = ไม่มีเส้นแบ่ง (ทำงานเหมือนเดิมทุกอย่าง)
    try {
        require_once __DIR__ . '/../session_policy.php';
        $dir = cb_state_dir();
        if ($dir) {
            $file = $dir . DIRECTORY_SEPARATOR . 'auto_rules_start.txt';
            $v = is_file($file) ? trim((string)@file_get_contents($file)) : '';
            if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $v)) {
                $v = date('Y-m-d H:i:s');
                @file_put_contents($file, $v, LOCK_EX);
            }
            $cut = $v;
        }
    } catch (Throwable $e) {
        error_log('autoRulesStart: ' . $e->getMessage());
    }
    return $cut;
}

function autoCancelNoShows($conn) {
    autoReleaseNoShows($conn);
    autoCheckInByTime($conn);
}

// คิวที่เลยเวลากลับแล้วแต่ยังเป็น 'จองแล้ว' (ไม่มีใครเช็คอินให้เลย) -> ปล่อยคิว
function autoReleaseNoShows($conn) {
    try {
        $where = "FROM CarBookings b
             JOIN (" . bookingTimesSql("N'จองแล้ว'") . ") t ON t.BookingID = b.BookingID
             WHERE b.BookingStatus = N'จองแล้ว' AND b.CheckInTime IS NULL
               AND t.EndAt IS NOT NULL AND t.EndAt <= GETDATE() AND t.EndAt >= '" . autoRulesStart() . "'";
        // รายชื่อที่กำลังจะถูกปล่อย (ไว้เขียน log) — ไม่มีก็ไม่ต้อง UPDATE
        $due = $conn->query("SELECT b.BookingID, b.BookingNumber, b.CarPlate, b.DriverName $where")->fetchAll(PDO::FETCH_ASSOC);
        if (!$due) return;
        $n = $conn->exec("UPDATE b SET BookingStatus = N'ยกเลิก (ไม่มาใช้งาน)' $where");
        if ($n > 0) {
            require_once __DIR__ . '/log_lib.php';
            foreach ($due as $d) {
                sl_log($conn, 'release_noshow', 'ปล่อยคิว (ไม่มาใช้งาน) ' . trim($d['CarPlate'] . ' ' . $d['DriverName']), [
                    'system' => true, 'target_type' => 'booking', 'target' => (string)$d['BookingNumber'],
                ]);
            }
        }
    } catch (Throwable $e) {
        error_log('autoReleaseNoShows: ' . $e->getMessage());
    }
}

// ถึงเวลาออกแล้ว -> เช็คอินให้ (เวลาเช็คอิน = เวลาออกตามที่จอง) เฉพาะรถที่ไม่มีใครใช้อยู่ และต่อรถ 1 คันได้ทีละ 1 คิว
function autoCheckInByTime($conn) {
    try {
        require_once __DIR__ . '/geo_lib.php';
        $mark = geo_columns_ok($conn) ? ", b.CheckInGeo = 'auto'" : ''; // ให้แอดมินเห็นว่าเป็นการเช็คอินอัตโนมัติ
        $dueSql = "FROM CarBookings b
             JOIN (SELECT BookingID, StartAt,
                          ROW_NUMBER() OVER (PARTITION BY REPLACE(CarPlate, ' ', '') ORDER BY StartAt, BookingID) AS rn
                   FROM (" . bookingTimesSql("N'จองแล้ว'") . ") t
                   WHERE StartAt <= GETDATE() AND StartAt >= '" . autoRulesStart() . "' AND (EndAt IS NULL OR EndAt > GETDATE())) d
               ON d.BookingID = b.BookingID AND d.rn = 1
             WHERE b.BookingStatus = N'จองแล้ว' AND b.CheckInTime IS NULL
               AND NOT EXISTS (SELECT 1 FROM CarBookings o
                               WHERE REPLACE(o.CarPlate, ' ', '') = REPLACE(b.CarPlate, ' ', '') AND o.BookingStatus = N'ขาไป')";
        // รายการที่กำลังจะถูกเช็คอิน (ไว้เขียน log)
        $due = $conn->query("SELECT b.BookingID, b.BookingNumber, b.CarPlate, b.DriverName $dueSql")->fetchAll(PDO::FETCH_ASSOC);
        if (!$due) return;
        $n = $conn->exec(
            "UPDATE b
             SET b.BookingStatus = N'ขาไป', b.CheckinTime = d.StartAt,
                 b.StartMileage = ISNULL((SELECT TOP 1 Mileage FROM Cars WHERE REPLACE(Plate, ' ', '') = REPLACE(b.CarPlate, ' ', '')), b.StartMileage)
                 $mark
             $dueSql"
        );
        if ($n > 0) {
            require_once __DIR__ . '/log_lib.php';
            foreach ($due as $d) {
                sl_log($conn, 'checkin_auto', 'เช็คอินอัตโนมัติตามเวลาจอง ' . trim($d['CarPlate'] . ' ' . $d['DriverName']), [
                    'system' => true, 'target_type' => 'booking', 'target' => (string)$d['BookingNumber'],
                ]);
            }
        }
    } catch (Throwable $e) {
        error_log('autoCheckInByTime: ' . $e->getMessage());
    }
}
