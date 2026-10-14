<?php
/* เทสย่อยกันบั๊กเก่ากลับมา (ไม่เรียก API) — ข้อความ OCR จำลองจากเคสที่เคยแก้ไปแล้ว */
$ROOT = str_replace('\\', '/', dirname(__DIR__, 2)); // รากโปรเจกต์ (tools/ocr/..)
$src = file_get_contents($ROOT . '/Car/ocr_odometer.php');
$from = strpos($src, 'function isScaleNumber');
$to   = strpos($src, 'try {', $from);
eval(substr($src, $from, $to - $from));

$cases = [
    // [ชื่อเคส, ข้อความ OCR, ไมล์ตอนออก|null, เลขที่ต้องได้|null]
    ['จอ LCD ช่องห่าง เลขถูกตัดคนละบรรทัด (commit 3edae5e)', "ODO\n5507\n5 0", null, '550750'],
    ['เลขอื่นอยู่ติดกันจนรวมแล้วยาวเกิน (commit 1cfe46c)', "2026\n09\n559222", null, '559222'],
    ['เลขไมล์โดดๆ ใบที่ผู้ใช้เทสเดิม', "559222", 559000, '559222'],
    ['สเกลหน้าปัดคนละบรรทัด ห้ามรวมเป็นเลขไมล์', "60\n80\n100 120\n140\n160\n180\nODO\n123073", null, '123073'],
    ['ตัวคั่นหลักพันจริง ต้องยังอ่านได้', "ODO\n185,318", null, '185318'],
    ['นาฬิกา/วันที่ ต้องไม่ถูกมองเป็นเลขไมล์', "10:45\n16/06/2026\nODO 029623", null, '029623'],
    ['trip มีทศนิยม ต้องไม่ถูกเลือก', "TRIP A 167.0\n285000", null, '285000'],
    ['ในรูปมีแต่ขีดสเกล ต้องไม่เดา', "60\n80\n100\n120\n140", null, null],
];

$fail = 0;
foreach ($cases as [$name, $text, $start, $want]) {
    $d = odometerDecide(['2' => $text], $start);
    $got = $d['digits'];
    $ok = $want === null ? $got === null : ((string)$got === (string)$want);
    if (!$ok) $fail++;
    printf("%-4s %-55s ต้องได้=%-8s ได้=%s\n", $ok ? 'OK' : 'FAIL', $name, $want ?? '(ไม่เดา)', $got ?? '(ไม่เดา)');
}
echo $fail ? "\n$fail เคสไม่ผ่าน\n" : "\nผ่านหมด\n";
exit($fail ? 1 : 0);
