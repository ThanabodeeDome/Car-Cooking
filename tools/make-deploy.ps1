# สร้างโฟลเดอร์ "ชุดอัปโหลด" ที่มีเฉพาะไฟล์ที่เปลี่ยนตั้งแต่ commit ที่ระบุ (โครงสร้างโฟลเดอร์เหมือนเว็บ)
# ใช้:  powershell -ExecutionPolicy Bypass -File tools\make-deploy.ps1            (นับจาก commit 54f12ab)
#       powershell -ExecutionPolicy Bypass -File tools\make-deploy.ps1 -From abc123
# ผลลัพธ์: โฟลเดอร์ ..\car-booking_deploy  -> ก๊อปทั้งโฟลเดอร์ไปวางทับบนเซิร์ฟเวอร์ (หรือ zip แล้วแตกทับ) จบ
# ไม่ใส่: db_connect.php / uploads / ไฟล์ตั้งค่าที่เป็นความลับ  (ไม่มีวันทับของเว็บจริง)
param([string]$From = "54f12ab")

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path (Split-Path -Parent $root) "car-booking_deploy"
Set-Location $root

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$skip = @('db_connect.php', 'mail_config.php', 'ocr_config.php')
$files = git diff --name-only --diff-filter=AMR "$From" HEAD |
    Where-Object { $_ -and ($_ -notmatch '(^|/)uploads/') -and ($skip -notcontains (Split-Path $_ -Leaf)) -and ($_ -notmatch '^(tools|\.claude)/') }

foreach ($f in $files) {
    $dest = Join-Path $out $f
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $f) -Destination $dest -Force
}

Write-Host ""
Write-Host "สร้างชุดอัปโหลดแล้ว: $out"
Write-Host ("ไฟล์ทั้งหมด {0} ไฟล์" -f @($files).Count)
Write-Host "อย่าลืมรัน db\migrations\2026-10-22_system-log.sql บนฐานข้อมูลจริงก่อนอัปโหลด (ไฟล์นี้อยู่ในชุดด้วย)"
