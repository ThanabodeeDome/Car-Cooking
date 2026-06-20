<?php
session_start();

// ทำลาย Session ทั้งหมดในเครื่อง
session_unset();
session_destroy();

// เด้งกลับไปที่หน้า Login หลักทันที (เปลี่ยนชื่อไฟล์เป็นชื่อหน้า Login ของเพื่อนได้เลย)
header("Location: Car/index.html");
exit;
?>