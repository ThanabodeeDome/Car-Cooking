<?php
// สร้างคู่มือแยกเป็นหน้า: index.html / user.html / security.html / admin.html (ใช้รูปจาก img/ และวิดีโอจาก video/)
// และชุด standalone/ ที่ฝังรูป+วิดีโอลงในแต่ละไฟล์ (ส่งไฟล์เดียวต่อให้คนอื่นได้)
// ต้นฉบับ: src/manual.src.html  (เขียนเนื้อหาที่นี่ที่เดียว)
// ใช้: C:\PHP\php.exe tools\manual\build.php
$dir = __DIR__;
$tpl = file_get_contents($dir . '/src/manual.src.html');

$pages = [
    'user' => ['file' => 'user.html', 'name' => 'พนักงาน / ผู้ขับ', 'long' => 'สำหรับพนักงาน / ผู้ขับ', 'sections' => ['overview', 'user', 'auto', 'trouble', 'checklist']],
    'security' => ['file' => 'security.html', 'name' => 'เจ้าหน้าที่ รปภ.', 'long' => 'สำหรับเจ้าหน้าที่ รปภ.', 'sections' => ['overview', 'guard', 'auto', 'trouble', 'checklist']],
    'admin' => ['file' => 'admin.html', 'name' => 'แอดมิน', 'long' => 'สำหรับผู้ดูแลระบบ (แอดมิน)', 'sections' => ['overview', 'admin', 'auto', 'trouble', 'checklist']],
];
// แถวในตาราง "แก้ปัญหา" ที่ใช้เฉพาะบางกลุ่ม (ไม่อยู่ในรายการ = แสดงทุกหน้า)
$troubleRows = [
    'จองรถไม่ได้ ขึ้นว่ารถไม่ว่าง' => ['user'],
    'รถขึ้นว่าว่างแต่จองไม่ได้' => ['user', 'admin'],
    'คืนรถไม่ได้ ขึ้น' => ['user'],
    'ปุ่ม "ยืนยันการคืนรถ" กดไม่ได้' => ['user'],
    'ระบบอ่านเลขไมล์จากรูปผิด' => ['user'],
    'บอกเลขไมล์ รปภ. ผิด' => ['user', 'security'],
    'รปภ. จดรถผิดคัน' => ['security', 'admin'],
    'รายการถูกปิดโดยระบบ' => ['security', 'admin'],
    'ลืมรหัสผ่าน' => ['user', 'admin'],
    'เข้าหน้าแอดมินไม่ได้' => ['admin'],
    'มือถือไม่ถามขอตำแหน่ง' => ['user'],
];
$numbered = ['user', 'guard', 'admin'];

function embedAssets(string $html, string $dir): string {
    return preg_replace_callback('~src="(img|video)/([A-Za-z0-9_-]+\.(jpg|webm))"~', function ($m) use ($dir) {
        $f = $dir . '/' . $m[1] . '/' . $m[2];
        if (!is_file($f)) return $m[0];
        $mime = $m[3] === 'jpg' ? 'image/jpeg' : 'video/webm';
        return 'src="data:' . $mime . ';base64,' . base64_encode(file_get_contents($f)) . '"';
    }, $html);
}

function nav(array $pages, string $cur): string {
    $h = '<div class="pagenav"><div><span class="lbl">คู่มือ:</span><a href="index.html"' . ($cur === 'index' ? ' class="cur"' : '') . '>หน้าแรก</a>';
    foreach ($pages as $k => $p) $h .= '<a href="' . $p['file'] . '"' . ($cur === $k ? ' class="cur"' : '') . '>' . $p['name'] . '</a>';
    return $h . '</div></div>';
}

$pre = substr($tpl, 0, strpos($tpl, '{{HEADER}}'));
$post = substr($tpl, strpos($tpl, '{{HEADER}}') + strlen('{{HEADER}}'));
// เอา <title> ของหน้าไปเปลี่ยนต่อหน้า
$out = [];
foreach ($pages as $key => $pg) {
    // ดึงเฉพาะ section ที่ต้องใช้ตามลำดับ
    preg_match_all('~<section id="(\w+)"[^>]*>.*?</section>~s', $post, $mm, PREG_SET_ORDER);
    $byId = [];
    foreach ($mm as $m) $byId[$m[1]] = $m[0];
    $body = '';
    $toc = '';
    $n = 0;
    foreach ($pg['sections'] as $sid) {
        if (!isset($byId[$sid])) continue;
        $sec = $byId[$sid];
        // ตัดแถวตารางแก้ปัญหาที่ไม่เกี่ยวกับกลุ่มนี้
        if ($sid === 'trouble') {
            $lines = explode("\n", $sec);
            $lines = array_filter($lines, function ($ln) use ($troubleRows, $key) {
                if (strpos($ln, '<tr><td>') === false) return true;
                foreach ($troubleRows as $needle => $aud) if (strpos($ln, $needle) !== false) return in_array($key, $aud, true);
                return true;
            });
            $sec = implode("\n", $lines);
        }
        // บล็อกเฉพาะกลุ่ม
        $sec = preg_replace_callback('~[ \t]*<!--for:([a-z,]+)-->\n?(.*?)[ \t]*<!--/for-->\n?~s', function ($m) use ($key) {
            return in_array($key, explode(',', $m[1]), true) ? $m[2] : '';
        }, $sec);
        $n++;
        $sec = preg_replace('~<h2>~', '<h2>' . $n . '. ', $sec, 1);
        if (in_array($sid, $numbered, true)) {
            $k = 0;
            $sec = preg_replace_callback('~<h3>~', function () use (&$k, $n) { $k++; return '<h3>' . $n . '.' . $k . ' '; }, $sec);
        }
        preg_match('~<h2>(.*?)</h2>~s', $sec, $t);
        $toc .= '<a href="#' . $sid . '">' . trim($t[1]) . '</a>';
        $body .= $sec . "\n\n";
    }
    $title = 'คู่มือการใช้งานระบบจองรถ — ' . $pg['name'];
    $head = preg_replace('~<title>.*?</title>~', '<title>' . $title . '</title>', $pre);
    $header = '<header class="top"><h1>คู่มือการใช้งานระบบจองรถ</h1><p>' . $pg['long'] . '</p>'
        . '<p style="opacity:.8;font-size:13px;margin-top:6px">ภาพและวิดีโอประกอบใช้ข้อมูลตัวอย่างสมมติ (ชื่อ เบอร์โทร และทะเบียนที่ขึ้นต้น 9กก)</p></header>';
    $html = $head . nav($pages, $key) . "\n" . $header . "\n<nav class=\"toc\">" . $toc . "</nav>\n\n<main>\n\n" . $body . "</main>\n</body>\n</html>\n";
    $out[$pg['file']] = $html;
}

// หน้าแรก
$cards = '';
$desc = [
    'user' => 'สมัคร เข้าสู่ระบบ เช็กคิว จองรถ รับรถ คืนรถ ยกเลิกการจอง การแจ้งเตือน',
    'security' => 'จดเลขไมล์และสภาพรถตอนรถกลับ แก้ไข/ยกเลิกการจด ดูย้อนหลัง พิมพ์สรุป',
    'admin' => 'Dashboard จัดการรถและซ่อม จัดการการจอง บัญชีผู้ใช้ จุดพิกัด รายงาน บันทึกระบบ',
];
foreach ($pages as $k => $p) {
    $cards .= '<a class="hc" href="' . $p['file'] . '"><h2>' . $p['name'] . '</h2><p>' . $desc[$k] . '</p><span>เปิดคู่มือ →</span></a>';
}
$idx = preg_replace('~<title>.*?</title>~', '<title>คู่มือการใช้งานระบบจองรถ</title>', $pre);
$idx = str_replace('</style>', '  .hcs { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; max-width:960px; margin:24px auto; padding:0 16px; }
  .hc { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px; text-decoration:none; color:var(--ink); box-shadow:0 2px 10px rgba(15,23,42,.06); }
  .hc:hover { border-color:var(--brand); }
  .hc h2 { border:none; margin:0 0 6px; font-size:22px; }
  .hc p { margin:0 0 12px; color:var(--mute); font-size:15px; }
  .hc span { color:var(--brand); font-weight:700; }
</style>', $idx);
$idxBody = nav($pages, 'index') . '<header class="top"><h1>คู่มือการใช้งานระบบจองรถ</h1><p>เลือกคู่มือตามหน้าที่ของคุณ</p></header>'
    . '<div class="hcs">' . $cards . '</div>'
    . '<main><section><h2>ในคู่มือมีอะไรบ้าง</h2><ul><li><b>ภาพประกอบ</b> หน้าจอจริงทุกขั้นตอนสำคัญ (ใช้ข้อมูลตัวอย่างสมมติ)</li>'
    . '<li><b>วิดีโอสาธิต</b> ขั้นตอนหลักของแต่ละกลุ่ม มีคำบรรยายบนจอ (ไม่มีเสียง) กดเล่น/หยุดได้</li>'
    . '<li><b>ตารางกติกาและข้อความแจ้งเตือน</b> พร้อมวิธีแก้ และเช็กลิสต์ประจำวัน</li></ul>'
    . '<p class="demo">ส่วนที่ใช้ร่วมกันทุกกลุ่ม (สถานะการจอง กติกา กฎอัตโนมัติ) อยู่ต้นและท้ายของแต่ละคู่มือ</p></section></main></body></html>';
$out['index.html'] = $idx . "\n" . $idxBody . "\n";

@mkdir($dir . '/standalone');
foreach ($out as $file => $html) {
    file_put_contents($dir . '/' . $file, $html);
    file_put_contents($dir . '/standalone/' . $file, embedAssets($html, $dir));
    printf("%-14s %6d KB  | standalone %6d KB\n", $file, filesize($dir . '/' . $file) / 1024, filesize($dir . '/standalone/' . $file) / 1024);
}
