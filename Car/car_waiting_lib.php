<?php
// "รถยังไม่มา" — ผู้ใช้ที่ถูกเช็คอินให้แล้วแต่ยังไม่ได้รับรถ กดแจ้ง (CarBookings.WaitingCarAt)
// - หยุดนับเวลาปิดรายการอัตโนมัติของรอบนั้นชั่วคราว (ดู autoCloseOverdueReturns)
// - แจ้งเตือน รปภ./แอดมิน (กระดิ่ง + Web Push) และอีเมลถึงคนที่ยังถือรถอยู่ (notify_cron.php)
// ต้องรัน db/migrations/2026-11-06_auto-close.sql ก่อน (ไม่มีคอลัมน์ = ฟีเจอร์ปิดเงียบๆ)
require_once __DIR__ . '/auto_cancel_noshows.php';

const CW_REMIND_MINUTES = 60; // เตือนซ้ำคนถือรถ/รปภ./แอดมินทุกกี่นาที ระหว่างที่ยังรออยู่

// รอบที่กำลังรอรถ + คนที่ถือรถอยู่ (รอบก่อนหน้าของรถคันเดียวกันที่ยังไม่มีเลขไมล์คืน: ปิดโดยระบบ หรือยังขาไป)
function cw_waiting_list(PDO $conn): array {
    if (!autoCloseColumnsOk($conn)) return [];
    try {
        return $conn->query(
            "SELECT b.BookingID, b.BookingNumber, b.CarPlate, b.DriverName, b.EmployeeID, b.Destination,
                    CONVERT(varchar(16), b.WaitingCarAt, 120) AS WaitingAt,
                    DATEDIFF(MINUTE, b.WaitingCarAt, GETDATE()) AS WaitMin,
                    wu.phone AS WaiterPhone,
                    h.BookingID AS HolderBookingID, h.DriverName AS HolderName, h.EmployeeID AS HolderEmp,
                    h.BookingStatus AS HolderStatus, hu.phone AS HolderPhone, hu.email AS HolderEmail
             FROM CarBookings b
             LEFT JOIN Users wu ON wu.employee_id = b.EmployeeID
             OUTER APPLY (
                 SELECT TOP 1 p.BookingID, p.DriverName, p.EmployeeID, p.BookingStatus
                 FROM CarBookings p
                 WHERE p.BookingID <> b.BookingID
                   AND REPLACE(p.CarPlate, ' ', '') = REPLACE(b.CarPlate, ' ', '')
                   AND p.BookingStatus IN (N'" . AUTO_CLOSE_STATUS . "', N'ขาไป')
                   AND (p.EndMileage IS NULL OR p.EndMileage <= 0)
                   AND p.CheckInTime IS NOT NULL AND p.CheckInTime <= b.CheckInTime
                 ORDER BY p.CheckInTime DESC, p.BookingID DESC
             ) h
             LEFT JOIN Users hu ON hu.employee_id = h.EmployeeID
             WHERE b.BookingStatus = N'ขาไป' AND b.WaitingCarAt IS NOT NULL
             ORDER BY b.WaitingCarAt"
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        error_log('cw_waiting_list: ' . $e->getMessage());
        return [];
    }
}
