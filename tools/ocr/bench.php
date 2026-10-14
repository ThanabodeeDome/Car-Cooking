<?php
/* OCR bench — วัดความแม่นของตัวอ่านเลขไมล์กับรูปจริง
   ใช้: php bench.php <truth.csv>   (คอลัมน์: ไฟล์รูป,เลขไมล์จริง|-,ไมล์ตอนออก|-)
        เลขไมล์จริง = "-" หมายถึงในรูปไม่มีเลข ODO -> ถือว่าถูกเมื่อระบบไม่เดาเลขออกมา
   - จำลอง pipeline เดียวกับหน้าเว็บ: ย่อรูปด้านยาวสุด <=1000px, JPEG q80 แล้วส่ง base64
   - เรียก OCR.space ครั้งเดียวต่อรูป/engine แล้ว cache ข้อความดิบไว้ (รันซ้ำไม่กินโควตา)
   - ใช้ odometerDecide() ตัวจริงจาก Car/ocr_odometer.php (ดึง source มา eval ไม่ก๊อปโค้ด) */
$ROOT = str_replace('\\', '/', dirname(__DIR__, 2)); // รากโปรเจกต์ (tools/ocr/..)
$CACHE = __DIR__ . '/raw_cache.json';

require_once $ROOT . '/Car/ocr_config.php';

// ---- ดึงฟังก์ชัน parser ตัวจริงออกมาใช้ (ไฟล์ต้นทางมี session/exit อยู่ จึง include ตรงๆ ไม่ได้) ----
$src = file_get_contents($ROOT . '/Car/ocr_odometer.php');
$from = strpos($src, 'function isScaleNumber');
$to   = strpos($src, 'try {', $from);
if ($from === false || $to === false) { fwrite(STDERR, "extract parser failed\n"); exit(1); }
eval(substr($src, $from, $to - $from));

function prepImage(string $path): string {
    $img = imagecreatefromstring(file_get_contents($path));
    $w = imagesx($img); $h = imagesy($img);
    $longest = max($w, $h);
    $scale = $longest > 1000 ? 1000 / $longest : ($longest < 800 ? min(3, 800 / $longest) : 1);
    $nw = max(1, (int)round($w * $scale)); $nh = max(1, (int)round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
    ob_start(); imagejpeg($dst, null, 80);
    return 'data:image/jpeg;base64,' . base64_encode(ob_get_clean());
}

function ocrSpaceRaw(string $image, string $engine): array {
    $ch = curl_init('https://api.ocr.space/parse/image');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40,
        CURLOPT_CAINFO => $GLOBALS['ROOT'] . '/Car/cacert.pem',
        CURLOPT_POSTFIELDS => [
            'apikey' => OCR_SPACE_API_KEY, 'base64Image' => $image, 'OCREngine' => $engine,
            'isOverlayRequired' => 'false', 'scale' => 'true', 'detectOrientation' => 'false',
        ],
    ]);
    $res = curl_exec($ch); $err = curl_error($ch); curl_close($ch);
    if ($res === false) return [null, "curl: $err"];
    $j = json_decode($res, true);
    if (!$j || !empty($j['IsErroredOnProcessing'])) {
        $m = $j['ErrorMessage'] ?? 'parse error';
        return [null, is_array($m) ? implode(', ', $m) : (string)$m];
    }
    return [(string)($j['ParsedResults'][0]['ParsedText'] ?? ''), null];
}

$cache = is_file($CACHE) ? json_decode(file_get_contents($CACHE), true) : [];
$rows = array_filter(array_map('str_getcsv', file($argv[1] ?? 'truth.csv')), fn($r) => $r && trim($r[0]) !== '' && $r[0][0] !== '#');

$total = 0; $ok = 0; $fails = []; $apiCalls = 0; $confirmCount = 0;
foreach ($rows as $r) {
    [$file, $expect] = [trim($r[0]), trim($r[1])];
    $start = isset($r[2]) && trim($r[2]) !== '' && trim($r[2]) !== '-' ? (int)trim($r[2]) : null;
    $path = $file[1] === ':' ? $file : "$ROOT/$file";
    if (!is_file($path)) { echo "SKIP (ไม่พบไฟล์) $file\n"; continue; }
    $image = prepImage($path);

    $texts = [];
    foreach (['2', '1'] as $engine) {
        $ck = md5_file($path) . "|e$engine";
        if (!array_key_exists($ck, $cache)) {
            [$t, $e] = ocrSpaceRaw($image, $engine);
            $cache[$ck] = ['text' => $t, 'err' => $e];
            file_put_contents($CACHE, json_encode($cache, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            $apiCalls++;
            usleep(400000);
        }
        if ($cache[$ck]['text'] !== null) $texts[$engine] = $cache[$ck]['text'];
    }

    $d = odometerDecide($texts, $start);
    $got = $d['digits'];
    $total++;
    $hit = $expect === '-' ? ($got === null) : ($got !== null && (int)$got === (int)$expect);
    if ($hit) $ok++;
    if ($d['agree'] === false) $confirmCount++;
    $flag = $d['agree'] === false ? ' [ต้องยืนยัน]' : ($d['agree'] === true ? ' [ตรงกัน]' : '');
    printf("%-48s จริง=%-8s ได้=%-9s %-4s%s%s\n", basename($file), $expect, $got ?? '(ไม่เดา)', $hit ? 'OK' : 'MISS', $flag,
        $d['candidates'] ? '  รอง: ' . implode(',', $d['candidates']) : '');
    if (!$hit) $fails[] = ['file' => basename($file), 'expect' => $expect, 'got' => $got, 'raw' => $texts, 'reason' => $d['reason'] ?? null];
}

printf("\n=== ถูก %d/%d (%.1f%%) | ผิด %d | ต้องให้ผู้ใช้ยืนยัน %d | เรียก API เพิ่มรอบนี้ %d ครั้ง ===\n",
    $ok, $total, $total ? $ok / $total * 100 : 0, $total - $ok, $confirmCount, $apiCalls);
foreach ($fails as $f) {
    echo "\n--- MISS {$f['file']} (จริง {$f['expect']}, ได้ " . ($f['got'] ?? 'ไม่เดา') . ($f['reason'] ? " reason={$f['reason']}" : '') . ")\n";
    foreach ($f['raw'] as $eng => $t) echo "  [engine $eng] " . str_replace("\n", " ⏎ ", trim($t)) . "\n";
}
