@echo off
title Car Booking dev server (ปิดหน้าต่างนี้ = หยุด server)
cd /d "%~dp0"
start "" http://localhost:8000/Car/index.html
C:\PHP\php.exe -S localhost:8000 router.php
pause
