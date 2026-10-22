-- บันทึกระบบ (System Log / Audit Log) — เพิ่มตาราง SystemLog
-- รันบน PRODUCTION CarBookingDB หนึ่งครั้ง (รันซ้ำได้ปลอดภัย: ตรวจก่อนสร้างทุกอย่าง)
-- โค้ดฝั่งเว็บ (Car/log_lib.php) ทำงานได้แม้ยังไม่ได้รันไฟล์นี้ แค่จะยังไม่บันทึกอะไร
--
-- ไม่ผูก FOREIGN KEY กับ Users/CarBookings โดยตั้งใจ: log ต้องอยู่ต่อแม้ผู้ใช้/การจองถูกลบ
-- (เก็บชื่อผู้ทำและเลขที่อ้างอิงเป็นข้อความไว้ในแถวเลย) — ไม่เก็บรหัสผ่านใดๆ
-- ข้อมูลเก่าเกิน 180 วันถูกลบอัตโนมัติโดยโค้ด (Car/log_lib.php : SL_RETENTION_DAYS)
USE CarBookingDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SystemLog')
BEGIN
    CREATE TABLE SystemLog (
        LogID       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SystemLog PRIMARY KEY,
        LogTime     DATETIME      NOT NULL CONSTRAINT DF_SystemLog_LogTime DEFAULT GETDATE(),
        EventType   VARCHAR(40)   NOT NULL,           -- เช่น login_ok, booking_create, checkin_auto (ดูรายการใน log_lib.php)
        Category    VARCHAR(20)   NOT NULL,           -- auth | booking | usage | admin | user
        ActorUserID INT           NULL,               -- NULL = ระบบทำเอง (เช่นเช็คอินอัตโนมัติ) หรือยังไม่ทราบตัวตน
        ActorName   NVARCHAR(120) NULL,
        ActorEmpID  VARCHAR(20)   NULL,
        TargetType  VARCHAR(30)   NULL,               -- booking | user | geo | ...
        TargetRef   NVARCHAR(100) NULL,               -- เช่น เลขที่จอง / username / ชื่อจุด
        Summary     NVARCHAR(400) NOT NULL,           -- ข้อความอ่านง่ายหนึ่งบรรทัด
        Detail      NVARCHAR(MAX) NULL,               -- JSON รายละเอียด (เช่นค่าก่อน/หลังแก้ไข)
        IP          VARCHAR(64)   NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemLog_LogTime' AND object_id = OBJECT_ID('SystemLog'))
    CREATE INDEX IX_SystemLog_LogTime ON SystemLog (LogTime DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemLog_Category_Time' AND object_id = OBJECT_ID('SystemLog'))
    CREATE INDEX IX_SystemLog_Category_Time ON SystemLog (Category, LogTime DESC);
GO

-- ลบข้อมูลเก่าเกิน 180 วันด้วยมือ (ปกติโค้ดทำให้เองอยู่แล้ว):
-- DELETE FROM SystemLog WHERE LogTime < DATEADD(DAY, -180, GETDATE());
