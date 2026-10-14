<?php
// บันทึก log การอ่านเลขไมล์ด้วย OCR + เลขที่ผู้ใช้ยืนยันจริงตอนกดบันทึกคืนรถ
// เอาไว้ตอบคำถามว่า "ของจริงหน้างาน ระบบอ่านพลาดกี่ %" ซึ่งชุดรูปทดสอบใน tools/ocr ตอบแทนไม่ได้
// (รูปชุดนั้นส่วนใหญ่โหลดมาจากเว็บ สว่าง/ตรง/คมชัดกว่าของจริงมาก)
//
// - เขียนเป็น JSONL เดือนละไฟล์ ไม่แตะ DB
// - เก็บไว้ "นอก" โฟลเดอร์ที่ IIS เสิร์ฟ (D:\CarBooking\logs) จะได้ไม่มีใครเปิดดูผ่านเว็บได้
//   ถ้าเขียนที่นั่นไม่ได้ (สิทธิ์ไม่พอ) ค่อยตกไปใช้ temp dir ของระบบ
// - ห้ามทำให้ flow ผู้ใช้พังเด็ดขาด: ทุกอย่างอยู่ใน try/catch เงียบๆ

function ocr_log_dir(): ?string {
    static $dir = null;
    if ($dir !== null) return $dir ?: null;

    $candidates = [
        dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'logs',   // D:\CarBooking\logs (นอก webroot)
        sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'carbooking_logs',
    ];
    foreach ($candidates as $c) {
        if (!is_dir($c)) @mkdir($c, 0770, true);
        if (is_dir($c) && is_writable($c)) return $dir = $c;
    }
    $dir = '';
    return null;
}

function ocr_log(array $entry): void {
    try {
        $dir = ocr_log_dir();
        if (!$dir) return;
        $entry = ['ts' => date('c')] + $entry;
        $line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($line === false) return;
        @file_put_contents($dir . DIRECTORY_SEPARATOR . 'ocr-' . date('Y-m') . '.jsonl', $line . "\n", FILE_APPEND | LOCK_EX);
    } catch (Throwable $e) {
        // log ไม่ได้ก็ช่างมัน ห้ามทำให้การคืนรถพัง
    }
}
