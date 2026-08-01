<?php
// admin_whitelist.php
// วางไว้ root เดียวกับ auth_check.php (ข้าง Car/ กับ Admin/)
// รวม id admin ที่อนุญาตจริงไว้ที่เดียว กันแก้คนละที่แล้วลืมซิงค์กัน

return [1009]; // 👉 adminCHR (ยืนยันจาก SQL แล้ว) — เพิ่ม id อื่นในนี้ได้ถ้ามี admin คนที่ 2 ในอนาคต