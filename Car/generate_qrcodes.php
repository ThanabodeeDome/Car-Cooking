<?php
// generate_qrcodes.php
// รันครั้งเดียว (หรือรันซ้ำได้ทุกครั้งที่เพิ่มรถใหม่) เพื่อสร้าง QR ทุกคันอัตโนมัติ
// ต้องมี library phpqrcode วางไว้ที่ Car/lib/phpqrcode/qrlib.php ก่อน
// (ดาวน์โหลดจาก https://github.com/t0k4rt/phpqrcode)

require_once __DIR__ . '/lib/phpqrcode/qrlib.php';
require_once __DIR__ . '/db_connect.php';

// 🌟 แก้ตรงนี้เป็นโดเมนจริงหลังตั้ง Cloudflare Tunnel เสร็จแล้ว
// ห้ามใช้ localhost เด็ดขาด เพราะมือถือคนสแกนจะเข้า localhost ของตัวเอง ไม่ใช่ server จริง
define('BASE_URL', 'http://192.168.5.52/car-booking/Car/scan.php');

$outputDir = __DIR__ . '/assets/QRcode/';
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

try {
    $stmt = $conn->query("SELECT Plate FROM Cars");
    $cars = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($cars)) {
        die("ไม่พบข้อมูลรถในตาราง Cars เลย ตรวจสอบ DB ก่อน\n");
    }

    $count = 0;
    foreach ($cars as $car) {
        $plate = $car['Plate'];

        // 🌟 urlencode ทะเบียนไทยกันปัญหาอักขระพิเศษตอนสแกนจากมือถือบางรุ่น
        $url = BASE_URL . '?plate=' . urlencode($plate);

        // ชื่อไฟล์ผลลัพธ์ตรงกับทะเบียน (ตรงกับที่เจ้ามีอยู่แล้วในโฟลเดอร์ QRcode)
        $safeFilename = preg_replace('/[^\p{L}\p{N}]/u', '', $plate); // กันอักขระแปลกปนในชื่อไฟล์
        $outputPath = $outputDir . $safeFilename . '.png';

        // ขนาด QR: errorCorrection ระดับ H (ทนต่อรอยเปื้อน/รอยขีดข่วนบนสติ๊กเกอร์รถได้ดีสุด)
        QRcode::png($url, $outputPath, QR_ECLEVEL_H, 8, 2);

        echo "สร้างแล้ว: {$plate} -> {$outputPath}\n";
        $count++;
    }

    echo "\nเสร็จสิ้น สร้าง QR ทั้งหมด {$count} คัน ในโฟลเดอร์ assets/QRcode/\n";
} catch (PDOException $e) {
    die("DB error: " . $e->getMessage() . "\n");
}