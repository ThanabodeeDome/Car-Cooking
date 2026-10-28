<?php
// สร้างคู่มือแบบ "ไฟล์เดียว" (ฝังรูปทั้งหมดลงในไฟล์) ไว้ส่งต่อให้คนอื่นได้โดยไม่ต้องแนบโฟลเดอร์ img
// ใช้: C:\PHP\php.exe tools\manual\build-single.php
$dir = __DIR__;
$src = $dir . '/คู่มือการใช้งานระบบจองรถ.html';
$out = $dir . '/คู่มือการใช้งานระบบจองรถ (ไฟล์เดียว).html';
$html = file_get_contents($src);
$html = preg_replace_callback('~src="img/([A-Za-z0-9_-]+\.jpg)"~', function ($m) use ($dir) {
    return 'src="data:image/jpeg;base64,' . base64_encode(file_get_contents($dir . '/img/' . $m[1])) . '"';
}, $html);
file_put_contents($out, $html);
echo "สร้างแล้ว: " . basename($out) . " (" . round(filesize($out) / 1024) . " KB)\n";
