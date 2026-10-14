<?php
// เรียกใช้จาก get_my_bookings.php / admin_get_bookings.php ก่อนดึงข้อมูลทุกครั้ง
//
// 🩹 เอา UPDATE ชุดเดิมที่อิง TimeSlot (เช้า/บ่าย/ทั้งวัน) ออก — เป็นโค้ดตายที่ทำงานไม่ได้เลย:
//    1) เงื่อนไข BookingStatus = 'ขาไป' AND CheckInTime IS NULL ไม่มีทางจริง เพราะ confirm_checkin.php
//       เซ็ตสถานะ 'ขาไป' พร้อม CheckinTime ในคำสั่งเดียวกัน
//    2) save_booking.php ไม่ได้บันทึก TimeSlot แล้ว (ระบบย้ายไปใช้ OutTime/PlannedReturnTime) ค่าเลยเป็น NULL ทุกแถว
//
// ⚠️ รอบที่ "เช็คอินแล้วแต่ไม่คืน" ระบบจะไม่ยกเลิก/ปิดงานให้เองโดยเจตนา เพราะรถอาจยังอยู่นอกสถานที่จริง
//    (ปิดงานเองจะได้ไมล์/รูปคืนไม่ครบ และปล่อยให้คนอื่นจองรถที่ยังไม่กลับ) — ใช้วิธีตามเตือนแทน:
//    notify_lib.php / notify_cron.php เตือนผู้ขับ + แอดมินซ้ำวันละครั้งจนกว่าจะปิดงาน
//    และ Admin/get_dashboard_stats.php ขึ้นรายการค้างให้แอดมินกดปิดงานเอง
function autoCancelNoShows($conn) {
    autoReleaseNoShows($conn);
}

// ระบบเวลาอิสระ (OutTime): ปล่อยคิวถ้าเลยเวลาออก 60 นาทีแล้วยังไม่เช็คอิน (สถานะยังเป็น 'จองแล้ว')
// ไม่แก้โครงสร้าง DB — แค่เปลี่ยนสถานะแถวเดิม. เรียกซ้ำได้ปลอดภัย (idempotent)
function autoReleaseNoShows($conn, int $graceMinutes = 60) {
    try {
        $stmt = $conn->prepare(
            "UPDATE CarBookings
             SET BookingStatus = 'ยกเลิก (ไม่มาใช้งาน)'
             WHERE BookingStatus = 'จองแล้ว'
               AND CheckInTime IS NULL
               AND OutTime IS NOT NULL AND LEN(OutTime) >= 4 AND ISDATE(OutTime) = 1
               AND DATEADD(MINUTE, CAST(:grace AS INT), CAST(BookingDate AS DATETIME) + CAST(OutTime AS DATETIME)) < GETDATE()"
        );
        $stmt->execute([':grace' => $graceMinutes]);
    } catch (Throwable $e) {
        error_log('autoReleaseNoShows: ' . $e->getMessage());
    }
}
