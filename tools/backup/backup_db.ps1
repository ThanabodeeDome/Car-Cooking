# ตัวเรียกสำรองฐานข้อมูล — ต้นฉบับอยู่ใน repo: tools\backup\backup_db.ps1
# สำเนาที่ Scheduled Task "CarBookingDbBackup" เรียกใช้จริงคือ D:\CarBooking\backup_db.ps1
#
# ทำไมต้องมีไฟล์นี้: task เดิมถูกตั้งให้รัน D:\CarBooking\backup_db.ps1 และการแก้ตัว task
# ต้องใส่รหัสผ่าน Windows ของ Administrator ทุกครั้ง จึงเลือกวางไฟล์ตามที่ task เรียกหาแทน
# ส่วนตรรกะจริงทั้งหมดอยู่ใน backup_db.php (อยู่ใน git มีประวัติ กู้คืนได้ถ้าไฟล์หายอีก)
#
# ถ้าไฟล์ D:\CarBooking\backup_db.ps1 หายอีก ให้ก๊อปกลับด้วยคำสั่งเดียว:
#   Copy-Item D:\CarBooking\car-booking\tools\backup\backup_db.ps1 D:\CarBooking\backup_db.ps1

$php = 'C:\PHP\php.exe'
$script = 'D:\CarBooking\car-booking\tools\backup\backup_db.php'

if (-not (Test-Path $php))    { Write-Error "ไม่พบ $php";    exit 2 }
if (-not (Test-Path $script)) { Write-Error "ไม่พบ $script"; exit 3 }

& $php $script @args
exit $LASTEXITCODE
