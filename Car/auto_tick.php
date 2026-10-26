<?php
// ตัวจับเวลาเบื้องหลัง (ไม่ส่งอีเมล ไม่กินโควต้า): ทำให้สถานะการจองขยับตามเวลาแม้ไม่มีใครเปิดแอป
//   - ถึงเวลาออก  -> เช็คอินอัตโนมัติเป็น "ขาไป"
//   - เลยเวลากลับโดยไม่มีใครมา -> ปล่อยคิวเป็น "ยกเลิก (ไม่มาใช้งาน)"
// ตั้งใน Windows Task Scheduler ให้รันทุก 5 นาที:
//   C:\PHP\php.exe D:\CarBooking\car-booking\Car\auto_tick.php
// (notify_cron.php ก็เรียกชุดเดียวกัน แต่จะหยุดทันทีถ้ายังไม่เปิดอีเมลใน mail_config.php จึงใช้ตัวนี้แทนได้)
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auto_cancel_noshows.php';

autoCancelNoShows($conn);
echo date('Y-m-d H:i:s') . " ok (กฎใหม่เริ่มตั้งแต่ " . autoRulesStart() . ")\n";
