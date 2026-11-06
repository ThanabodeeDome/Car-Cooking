-- Web Push (แจ้งเตือนในเครื่อง): เก็บอุปกรณ์ที่ผู้ใช้กดเปิดแจ้งเตือน — รันใน SSMS บน CarBookingDB (รันซ้ำได้)
IF OBJECT_ID('dbo.PushSubscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PushSubscriptions (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeID NVARCHAR(30)   NOT NULL,
        Endpoint   NVARCHAR(1000) NOT NULL,
        P256dh     NVARCHAR(200)  NOT NULL,
        Auth       NVARCHAR(80)   NOT NULL,
        UserAgent  NVARCHAR(300)  NULL,
        CreatedAt  DATETIME NOT NULL DEFAULT GETDATE(),
        LastSeen   DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_PushSubscriptions_Emp ON dbo.PushSubscriptions (EmployeeID);
END
GO
-- ตรวจผล: ต้องได้ 1 แถว
SELECT name FROM sys.tables WHERE name = 'PushSubscriptions';
