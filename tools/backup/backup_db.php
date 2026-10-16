<?php
/* สำรองฐานข้อมูล CarBookingDB — ใช้กับ Scheduled Task "CarBookingDbBackup" (ทุกวัน 00:00)
   ใช้: C:\PHP\php.exe D:\CarBooking\car-booking\tools\backup\backup_db.php
   ตัวเลือก: --dir=<โฟลเดอร์ปลายทาง>  --keep-days=30  --dry-run

   ⚠️ ทำไมถึงเขียนไฟล์นี้ขึ้นมา
   ของเดิม task สั่งรัน D:\CarBooking\backup_db.ps1 ซึ่ง "หายไปจากเครื่อง" (ไม่เคยอยู่ใน git ด้วย)
   task จึงล้มเหลวเงียบๆ ทุกคืนตั้งแต่ 12 ต.ค. 2026 กว่าจะรู้ตัวก็ 3 วันถัดมา
   คราวนี้เลยย้ายมาไว้ใน repo (มีประวัติ/กู้คืนได้) + เขียน log ทุกครั้ง + คืน exit code ให้
   Task Scheduler เห็นว่าพังจริงไหม และหน้า Dashboard แอดมินจะเตือนถ้าไฟล์สำรองเก่าเกิน 2 วัน

   ขั้นตอน: BACKUP -> RESTORE VERIFYONLY (ตรวจว่าไฟล์ใช้กู้ได้จริง) -> ลบไฟล์เก่าตามอายุ */

const BK_DEFAULT_DIR    = 'D:\\CarBooking\\Backup';
const BK_DEFAULT_KEEP   = 30;  // เก็บย้อนหลังกี่วัน
const BK_MIN_KEEP_FILES = 7;   // ต่อให้เก่าเกินกำหนด ก็ต้องเหลืออย่างน้อยเท่านี้เสมอ

$opt = function (string $name, $default = null) {
    global $argv;
    foreach ($argv as $a) {
        if ($a === "--$name") return true;
        if (strpos($a, "--$name=") === 0) return substr($a, strlen($name) + 3);
    }
    return $default;
};

$dir      = rtrim((string)$opt('dir', BK_DEFAULT_DIR), '\\/');
$keepDays = (int)$opt('keep-days', BK_DEFAULT_KEEP);
$dryRun   = (bool)$opt('dry-run', false);

require_once __DIR__ . '/../../Car/db_connect.php'; // ได้ $conn + $db + timezone ไทย

/* ⚠️ ห้ามใช้ PDO::exec() กับ BACKUP/RESTORE เด็ดขาด
   คำสั่ง BACKUP คืนผลลัพธ์มาหลายชุด (ข้อความความคืบหน้า "Processed N pages...")
   ถ้าใช้ exec() ไดรเวอร์ sqlsrv จะคืน 0 กลับมาเฉยๆ เหมือนสำเร็จ แต่ "ไม่ได้สำรองจริง"
   — ไม่มีไฟล์เกิดขึ้น และ msdb ก็ไม่มีประวัติ (ทดสอบยืนยันแล้ว 2026-10-16)
   ต้อง prepare + execute แล้วไล่ nextRowset() ให้หมดทุกชุด คำสั่งถึงจะทำงานจบจริง */
function bk_run(PDO $conn, string $sql): void
{
    $st = $conn->prepare($sql);
    $st->execute();
    do {
        // ไม่ต้องอ่านข้อมูล แค่เดินให้ครบทุก result set เพื่อให้คำสั่งทำงานจนจบ
    } while ($st->nextRowset());
    $st->closeCursor();
}

function bk_log(string $msg): void
{
    echo $msg . PHP_EOL;
    try {
        $logDir = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'logs'; // D:\CarBooking\logs
        if (!is_dir($logDir)) @mkdir($logDir, 0770, true);
        @file_put_contents(
            $logDir . DIRECTORY_SEPARATOR . 'backup-' . date('Y-m') . '.log',
            date('Y-m-d H:i:s') . '  ' . $msg . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    } catch (Throwable $e) {
        // เขียน log ไม่ได้ก็ไม่เป็นไร ไม่ควรทำให้การสำรองล้มเหลวตาม
    }
}

try {
    if (!is_dir($dir) && !@mkdir($dir, 0770, true)) {
        throw new RuntimeException("สร้างโฟลเดอร์ปลายทางไม่ได้: $dir");
    }

    $file = $dir . DIRECTORY_SEPARATOR . $db . '_' . date('Ymd_His') . '.bak';

    if ($dryRun) {
        bk_log("[dry-run] จะสำรอง $db ไปที่ $file แล้วลบไฟล์เก่ากว่า $keepDays วัน");
        exit(0);
    }

    // ชื่อไฟล์มาจาก date() ของเราเอง ไม่ได้มาจากผู้ใช้ แต่ escape ' ไว้กัน SQL พังอยู่ดี
    $disk = str_replace("'", "''", $file);

    $before = (int)$conn->query("SELECT COUNT(*) FROM msdb.dbo.backupset WHERE database_name = '$db'")->fetchColumn();

    $t0 = microtime(true);
    // CHECKSUM = ให้ SQL ตรวจความถูกต้องของแต่ละหน้าข้อมูลตอนเขียน, COMPRESSION = ไฟล์เล็กลงมาก
    // (Standard Edition รองรับ — ถ้าย้ายไป Express ต้องถอด COMPRESSION ออก)
    bk_run(
        $conn,
        "BACKUP DATABASE [$db] TO DISK = N'$disk'
         WITH INIT, COMPRESSION, CHECKSUM, FORMAT,
              NAME = N'CarBookingDB อัตโนมัติ', DESCRIPTION = N'Scheduled Task CarBookingDbBackup'"
    );
    $secs = round(microtime(true) - $t0, 1);

    // ตรวจว่าไฟล์ที่ได้ใช้กู้คืนได้จริง — สำรองไว้แล้วกู้ไม่ได้ เท่ากับไม่ได้สำรอง
    bk_run($conn, "RESTORE VERIFYONLY FROM DISK = N'$disk' WITH CHECKSUM");

    clearstatcache();
    $size = @filesize($file);
    if ($size === false || $size <= 0) {
        throw new RuntimeException("สำรองเสร็จแต่ไม่พบไฟล์ หรือไฟล์ว่าง: $file");
    }
    // กันเคส "คำสั่งผ่านแต่ไม่ได้ทำอะไร" อีกชั้น: ประวัติใน msdb ต้องเพิ่มขึ้นจริง
    $after = (int)$conn->query("SELECT COUNT(*) FROM msdb.dbo.backupset WHERE database_name = '$db'")->fetchColumn();
    if ($after <= $before) {
        throw new RuntimeException('มีไฟล์เกิดขึ้นแต่ SQL ไม่ได้บันทึกประวัติการสำรอง — ถือว่าไม่น่าเชื่อถือ');
    }
    bk_log(sprintf('สำเร็จ: %s (%s MB) ใช้เวลา %ss ตรวจไฟล์ผ่าน', basename($file), round($size / 1048576, 2), $secs));

    // ---- ลบไฟล์เก่า ----
    // ⚠️ ลบ "เฉพาะไฟล์ที่สคริปต์นี้สร้างเอง" เท่านั้น คือชื่อตรงแบบ CarBookingDB_YYYYMMDD_HHMMSS.bak เป๊ะๆ
    // ห้ามแตะไฟล์ที่คนตั้งชื่อเองเด็ดขาด เช่น CarBookingDB_BEFORE_DELETE_20260817_120109.bak
    // (บทเรียนจริง: รอบแรกใช้ glob CarBookingDB_*.bak แล้วมันกวาดไฟล์สำรองก่อนลบข้อมูลของ
    //  วันที่ 17 ส.ค. ไปด้วย ซึ่งเป็นไฟล์ที่ตั้งใจเก็บไว้ถาวร)
    $autoPattern = '/^' . preg_quote($db, '/') . '_\d{8}_\d{6}\.bak$/';
    $olds = [];
    foreach (glob($dir . DIRECTORY_SEPARATOR . $db . '_*.bak') ?: [] as $f) {
        if (!preg_match($autoPattern, basename($f))) continue; // ไฟล์ที่คนทำเอง ข้ามไป
        $olds[$f] = @filemtime($f) ?: 0;
    }
    arsort($olds); // ใหม่สุดอยู่บน
    $cut = time() - $keepDays * 86400;
    $i = 0;
    $deleted = 0;
    foreach ($olds as $f => $mtime) {
        $i++;
        if ($i <= BK_MIN_KEEP_FILES) continue;   // กันเคสเผลอตั้ง keep-days น้อยไปจนไม่เหลืออะไรเลย
        if ($mtime >= $cut) continue;
        if (@unlink($f)) $deleted++;
    }
    if ($deleted > 0) bk_log("ลบไฟล์สำรองที่เก่ากว่า $keepDays วัน: $deleted ไฟล์");

    exit(0);
} catch (Throwable $e) {
    // exit code ไม่ใช่ 0 เพื่อให้ Task Scheduler ขึ้นว่า "ล้มเหลว" จริงๆ ไม่ใช่เงียบ
    bk_log('ล้มเหลว: ' . $e->getMessage());
    exit(1);
}
