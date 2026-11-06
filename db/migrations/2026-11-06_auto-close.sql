-- รันบน CarBookingDB จริง (SSMS) ก่อนอัปโหลดไฟล์ PHP ชุดปิดรายการอัตโนมัติ — รันซ้ำได้ปลอดภัย
-- เพิ่มคอลัมน์สำหรับ: สถานะ 'ปิดโดยระบบ' (เหตุผล/เวลาที่ปิด), ป้าย "เลขไมล์เริ่มเป็นค่าประมาณ", ธง "รอรถ" (คิวถัดไปกด รถยังไม่มา)
USE CarBookingDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'ClosedReason')
    ALTER TABLE CarBookings ADD ClosedReason VARCHAR(20) NULL;      -- 'next_queue' | 'timeout'
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'ClosedAt')
    ALTER TABLE CarBookings ADD ClosedAt DATETIME NULL;             -- เวลาที่ระบบถือว่าปิดรายการ
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'StartMileageEst')
    ALTER TABLE CarBookings ADD StartMileageEst BIT NULL;           -- 1 = เลขไมล์เริ่มเป็นค่าประมาณ (ระบบเติมให้)
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'WaitingCarAt')
    ALTER TABLE CarBookings ADD WaitingCarAt DATETIME NULL;         -- ไม่ว่าง = ผู้ใช้กด "รถยังไม่มา" (หยุดนับเวลาปิดรายการ)
GO

-- ตรวจผล: ต้องได้ 4 แถว
SELECT name FROM sys.columns
WHERE object_id = OBJECT_ID('CarBookings') AND name IN ('ClosedReason','ClosedAt','StartMileageEst','WaitingCarAt');
