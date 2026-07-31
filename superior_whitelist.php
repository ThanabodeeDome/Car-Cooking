<?php
// superior_whitelist.php
// วางไว้ root เดียวกับ admin_whitelist.php และ auth_check.php
// รวม id ที่มี role='superioradmin' ที่อนุญาตจริงไว้ที่เดียว
// 🌟 ห้ามเพิ่ม id เข้านี้ผ่านแอป/หน้าเว็บเด็ดขาด แก้ไฟล์นี้ตรงบน server เท่านั้น (เหมือน admin_whitelist.php)

return [
    2, // Dome — superioradmin
];