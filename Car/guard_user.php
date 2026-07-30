<?php
session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if (!isset($_SESSION['user_id'])) {
    // 🌟 จำหน้าที่ตั้งใจจะเข้าไว้ (เช่น checkin.php?plate=กข1234 จากการสแกน QR)
    // ส่งไปเป็น query string ?redirect=... ให้หน้า login อ่านแล้วส่งต่อให้ login_process.php
    $intended = $_SERVER['REQUEST_URI'] ?? '';
    $safeRedirect = ltrim($intended, '/'); // relative เท่านั้น กัน open-redirect ไปโดเมนอื่น
    header("Location: index.html?redirect=" . urlencode($safeRedirect));
    exit;
}