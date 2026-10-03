<?php
// ตัดข้อความให้พอดีคอลัมน์ nvarchar(N) ของ SQL Server — SQL Server นับความยาวเป็นหน่วย UTF-16
// emoji / อักขระพิเศษบางตัวกิน 2 หน่วย แต่ mb_substr() นับเป็น 1 ตัว ตัดแล้วยังล้นคอลัมน์ได้ (DB error "would be truncated")
function fit_nvarchar(string $s, int $max): string {
    if (strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')) <= $max * 2) return $s;
    $out = '';
    $units = 0;
    foreach (preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) as $ch) {
        $u = mb_ord($ch, 'UTF-8') > 0xFFFF ? 2 : 1;
        if ($units + $u > $max) break;
        $out .= $ch;
        $units += $u;
    }
    return $out;
}
