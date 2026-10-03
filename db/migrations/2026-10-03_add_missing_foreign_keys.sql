-- บันทึกการแก้ schema ของ CarBookingDB เมื่อ 2026-10-03
-- รันผ่านไปแล้วจริงบน production (PAPYRUS-DB / CarBookingDB) ก่อนไฟล์นี้ถูก commit
-- ไฟล์นี้มีไว้เป็นบันทึก/อ้างอิง เผื่อต้องรันกับ environment อื่น (เช่น dev/staging) ในอนาคต
--
-- ที่มา: รีวิว schema พบว่าความสัมพันธ์หลายจุดที่โค้ดพึ่งพาอยู่จริง (CarBookings.CarPlate,
-- CarBookings.EmployeeID, CarBookings.BookedByUserID, MaintenanceHistory.CreatedBy)
-- ไม่มี FOREIGN KEY บังคับไว้ที่ DB เลย -- ตรวจแล้วไม่มีแถวกำพร้า (orphan) ก่อนเพิ่มทุกจุด
-- และทดสอบ query จริงของแอป (จองรถ/แก้ไข/ปิดงานคืนรถ) ผ่านทั้ง rollback test และผ่าน UI จริงแล้ว

-- 1) Cars.Plate ต้องมี unique constraint ก่อน จึงจะใช้เป็น FK target ได้
ALTER TABLE Cars ADD CONSTRAINT UQ_Cars_Plate UNIQUE (Plate);

-- 2) CarBookings.CarPlate -> Cars.Plate
ALTER TABLE CarBookings ADD CONSTRAINT FK_CarBookings_Cars_Plate
    FOREIGN KEY (CarPlate) REFERENCES Cars(Plate);

-- 3) CarBookings.BookedByUserID -> Users.id
ALTER TABLE CarBookings ADD CONSTRAINT FK_CarBookings_Users_BookedByUserID
    FOREIGN KEY (BookedByUserID) REFERENCES Users(id);

-- 4) MaintenanceHistory.CreatedBy -> Users.id
ALTER TABLE MaintenanceHistory ADD CONSTRAINT FK_MaintenanceHistory_Users_CreatedBy
    FOREIGN KEY (CreatedBy) REFERENCES Users(id);

-- 5) Users.employee_id เดิมมีแค่ filtered unique index (UX_Users_employee_id,
--    WHERE employee_id IS NOT NULL) ซึ่ง SQL Server ไม่อนุญาตให้เป็น FK target ได้
--    คอลัมน์นี้เป็น NOT NULL อยู่แล้ว เงื่อนไข filter จึงไม่มีผลจริง -- แทนที่ด้วย
--    unique constraint ปกติ
DROP INDEX UX_Users_employee_id ON Users;

-- 6) ก่อนเพิ่ม FK ต้องให้ CarBookings.EmployeeID และ Users.employee_id ยาวเท่ากันเป๊ะ
--    (ข้อบังคับของ SQL Server สำหรับ FK) เดิม CarBookings.EmployeeID คือ varchar(10)
--    แต่ register_process.php ยอมรับรหัสพนักงานยาวได้ถึง 20 ตัวอักษรอยู่แล้ว (regex {1,20})
--    -- เป็นบั๊กแฝง: รหัสพนักงานยาว 11-20 ตัวจะ insert booking ไม่ได้เพราะ column เดิมแค่ 10
--    แก้โดยขยาย CarBookings.EmployeeID เป็น varchar(20) และย่อ Users.employee_id จาก
--    varchar(50) ลงมาเป็น varchar(20) ให้ตรงกัน (ข้อมูลจริงยาวสุดแค่ 8 ตัว ปลอดภัย)
ALTER TABLE CarBookings ALTER COLUMN EmployeeID varchar(20) NULL;
ALTER TABLE Users ALTER COLUMN employee_id varchar(20) NOT NULL;

ALTER TABLE Users ADD CONSTRAINT UQ_Users_employee_id UNIQUE (employee_id);

-- 7) CarBookings.EmployeeID -> Users.employee_id
ALTER TABLE CarBookings ADD CONSTRAINT FK_CarBookings_Users_EmployeeID
    FOREIGN KEY (EmployeeID) REFERENCES Users(employee_id);
