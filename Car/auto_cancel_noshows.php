<?php
// เรียกใช้จาก get_my_bookings.php / get_pending_returns.php ก่อนดึงข้อมูลทุกครั้ง
// ยกเลิกอัตโนมัติถ้าเลย deadline ของ slot ไปแล้วแต่ยังไม่เช็คอิน
function autoCancelNoShows($conn) {
    $sql = "UPDATE CarBookings
            SET BookingStatus = 'ยกเลิก (ไม่มาใช้งาน)'
            WHERE BookingStatus = 'ขาไป'
            AND CheckInTime IS NULL
            AND (
                (TimeSlot = 'เช้า' AND CAST(BookingDate AS DATETIME) + '12:00' < GETDATE())
                OR (TimeSlot = 'บ่าย' AND CAST(BookingDate AS DATETIME) + '17:00' < GETDATE())
                OR (TimeSlot = 'ทั้งวัน' AND CAST(BookingDate AS DATETIME) + '17:00' < GETDATE())
            )";
    $conn->exec($sql);
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
