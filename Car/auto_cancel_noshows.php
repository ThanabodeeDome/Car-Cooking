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
}