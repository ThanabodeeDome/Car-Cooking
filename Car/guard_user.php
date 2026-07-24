<?php
session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if (!isset($_SESSION['user_id'])) {
    // ยังไม่ login -> เด้งกลับหน้า login ทันที (relative path เพราะไฟล์นี้อยู่ในโฟลเดอร์ Car/ เดียวกับ index.html)
    header("Location: index.html");
    exit;
}