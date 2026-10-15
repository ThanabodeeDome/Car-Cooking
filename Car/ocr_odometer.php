<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
cb_enforce_session_policy(); // ตัด session ที่หมดอายุ/ถูก logout จากเครื่องอื่น ก่อนเช็ค $_SESSION['user_id']
header('Content-Type: application/json; charset=utf-8');

// 🩹 ต้อง login ก่อนถึงจะยิง OCR ได้ (กันคนนอกยิง endpoint ตรงๆ ใช้โควตาฟรีของเราจนหมด)
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "กรุณาเข้าสู่ระบบก่อน"]);
    exit;
}

require_once __DIR__ . '/../same_origin.php';
require_same_origin();

// 🌟 API key เก็บแยกไฟล์ ocr_config.php (ดู ocr_config.example.php เป็นแม่แบบ)
// ไม่ฝัง key ตรงๆ ในไฟล์นี้ กันหลุดถ้ามีคน commit ไฟล์นี้ขึ้น git โดยไม่ระวัง
if (!file_exists(__DIR__ . '/ocr_config.php')) {
    echo json_encode(["success" => false, "message" => "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OCR API key (ไม่พบ ocr_config.php)"]);
    exit;
}
require_once __DIR__ . '/ocr_config.php';
require_once __DIR__ . '/ocr_log.php';

if (!defined('OCR_SPACE_API_KEY') || OCR_SPACE_API_KEY === '' || strpos(OCR_SPACE_API_KEY, 'ใส่_API_KEY') !== false) {
    echo json_encode(["success" => false, "message" => "ยังไม่ได้ใส่ OCR API key จริงใน ocr_config.php"]);
    exit;
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);
$base64Image = $data['image'] ?? '';
// เลขไมล์ตอนออกของรายการนี้ (ถ้าส่งมา) ใช้เลือกตัวเลขที่ "เป็นไปได้" เมื่อในรูปมีตัวเลขหลายชุด
$startMileage = isset($data['start_mileage']) && is_numeric($data['start_mileage']) ? (int)$data['start_mileage'] : null;
// ใช้เฉพาะใน log เพื่อจับคู่กับเลขไมล์ที่ผู้ใช้ยืนยันจริง (อ่านจาก CarBookings.EndMileage ทีหลัง)
$logBookingId = isset($data['booking_id']) && is_numeric($data['booking_id']) ? (int)$data['booking_id'] : null;

// ต้องเป็น data URL รูปแบบ data:image/...;base64,xxxx (มาจาก canvas.toDataURL() ฝั่ง JS)
if (!is_string($base64Image) || !$base64Image || strpos($base64Image, 'data:image') !== 0 || strlen($base64Image) > 8 * 1024 * 1024) {
    echo json_encode(["success" => false, "message" => "ไม่พบข้อมูลรูปภาพที่ถูกต้อง"]);
    exit;
}

// 🩹 รูป PNG พื้นโปร่งใส (เช่นแคปจากบางโปรแกรม) OCR อ่านไม่ออกเลย -> ปูพื้นขาวแล้วแปลงเป็น JPEG ก่อนส่ง
function flattenTransparent(string $dataUrl): string {
    if (!function_exists('imagecreatefromstring') || strpos($dataUrl, 'data:image/png') !== 0) return $dataUrl;
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    $src = $bin !== false ? @imagecreatefromstring($bin) : false;
    if (!$src) return $dataUrl;
    $w = imagesx($src);
    $h = imagesy($src);
    $dst = imagecreatetruecolor($w, $h);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
    ob_start();
    imagejpeg($dst, null, 90);
    return 'data:image/jpeg;base64,' . base64_encode(ob_get_clean());
}

// สร้าง curl handle สำหรับยิง OCR.space 1 ครั้งด้วย engine ที่กำหนด
function ocrSpaceHandle(string $image, string $engine)
{
    $ch = curl_init('https://api.ocr.space/parse/image');
    $curlOpts = [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25, // 🌟 กันค้างนานเกินไปถ้า OCR.space ตอบช้า
        CURLOPT_POSTFIELDS => [
            'apikey' => OCR_SPACE_API_KEY,
            'base64Image' => $image,
            'OCREngine' => $engine, // 2 = แม่นกับตัวเลข/จอ digital, 1 = อีกตัวไว้ไขว้ผลกัน
            'isOverlayRequired' => 'false',
            'scale' => 'true', // 🌟 ให้ OCR.space ขยายรูปเล็กให้เองถ้าจำเป็น ช่วยเรื่องความแม่น
            'detectOrientation' => 'false',
        ],
    ];
    // 🩹 FIX: เซิร์ฟเวอร์นี้ไม่มี CA certificate bundle ที่ใช้งานได้ (เจอ error
    // "unable to get local issuer certificate" ตอนต่อ HTTPS ไปหา OCR.space) ใช้ cacert.pem ที่แนบมาแทน
    $caBundlePath = __DIR__ . '/cacert.pem';
    if (file_exists($caBundlePath)) {
        $curlOpts[CURLOPT_CAINFO] = $caBundlePath;
    }
    curl_setopt_array($ch, $curlOpts);
    return $ch;
}

// แปลง response ของ OCR.space เป็น [ข้อความ|null, ข้อความ error|null]
function ocrSpaceParse($response, string $curlErr, int $httpCode = 200): array {
    if ($response === false || $response === null) {
        error_log('ocr_odometer curl error: ' . $curlErr);
        return [null, 'เชื่อมต่อ OCR.space ไม่สำเร็จ'];
    }
    $result = json_decode((string)$response, true);

    // 🩹 FIX: ตอนโดนจำกัดโควตา (HTTP 429 E553: free plan ยิงได้ 180 ครั้ง/ชม.) OCR.space ตอบ
    // {"error": "...", "retryAfter": n} ซึ่งไม่มีทั้ง IsErroredOnProcessing และ ParsedResults
    // โค้ดเดิมจึงอ่านเป็น "ข้อความว่าง" แล้วไปบอกผู้ใช้ว่า "อ่านตัวเลขจากรูปไม่ได้ชัดเจน"
    // ทั้งที่จริงคือระบบเต็มโควตา -> แยกออกมาให้ชัด ผู้ใช้จะได้รู้ว่าให้กรอกเองไปเลย ไม่ต้องถ่ายใหม่ซ้ำๆ
    if ($httpCode >= 400 || (is_array($result) && isset($result['error']))) {
        $raw = is_array($result) ? ($result['error'] ?? '') : '';
        $raw = is_array($raw) ? implode(', ', $raw) : (string)$raw;
        error_log("ocr_odometer http $httpCode: $raw");
        if (stripos($raw, 'rate limit') !== false || $httpCode === 429) {
            $wait = isset($result['retryAfter']) ? ' (ลองใหม่ได้ในอีก ' . ceil((int)$result['retryAfter'] / 60) . ' นาที)' : '';
            return [null, 'ระบบอ่านเลขไมล์อัตโนมัติใช้งานเต็มโควตาชั่วคราว' . $wait . ' กรุณากรอกเลขไมล์เอง'];
        }
        return [null, 'อ่านรูปไม่สำเร็จ'];
    }

    if (!$result || !empty($result['IsErroredOnProcessing'])) {
        $errMsgRaw = $result['ErrorMessage'] ?? 'อ่านรูปไม่สำเร็จ';
        return [null, is_array($errMsgRaw) ? implode(', ', $errMsgRaw) : (string)$errMsgRaw];
    }
    return [(string)($result['ParsedResults'][0]['ParsedText'] ?? ''), null];
}

// 🌟 ยิงทั้ง 2 engine "พร้อมกัน" (curl_multi) เพื่อเอาผลมาไขว้กัน โดยไม่ทำให้ผู้ใช้รอนานเป็น 2 เท่า
// คืน ['texts' => ['2' => ข้อความ|null, '1' => ...], 'errors' => [engine => error]]
function ocrSpaceBoth(string $image): array {
    $mh = curl_multi_init();
    $handles = [];
    foreach (['2', '1'] as $engine) {
        $handles[$engine] = ocrSpaceHandle($image, $engine);
        curl_multi_add_handle($mh, $handles[$engine]);
    }
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 1.0);
    } while ($running > 0);

    $texts = [];
    $errors = [];
    foreach ($handles as $engine => $ch) {
        [$text, $err] = ocrSpaceParse(curl_multi_getcontent($ch), curl_error($ch), (int)curl_getinfo($ch, CURLINFO_HTTP_CODE));
        if ($text !== null) $texts[$engine] = $text; else $errors[$engine] = $err;
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return ['texts' => $texts, 'errors' => $errors];
}

// 🩹 FIX: จอ LCD ช่องห่างมาก (เช่นมีกรอบแบ่งแต่ละหลักชัดเจน) ทำให้ OCR.space บางครั้งตัดหลักเลข
// ไปคนละบรรทัดกัน (เช่น "5507" บรรทัดหนึ่ง แล้ว "5 0" อีกบรรทัด จากเลขไมล์จริง 550750)
// -> เดิมโค้ดรวมเฉพาะกรณีถูกเว้นช่องในบรรทัดเดียวกัน (ดู regex merge ด้านล่าง) พอโดนตัดคนละบรรทัด
// "5507" เลยหลุดรอดมาเป็น candidate เดี่ยวที่ "ดูเหมือนถูกต้อง" (ผ่านเกณฑ์ 3-7 หลัก) ทั้งที่เป็นเลขผิด/เลขตัดทอน
// แก้โดยรวมบรรทัดที่ "เป็นตัวเลขล้วน" (ไม่มีตัวอักษร/เครื่องหมายอื่นปน) ที่อยู่ติดกันหลายบรรทัดเข้าเป็นชุดเดียวก่อน
// ตัวเลขสั้นเกิน (<3 หลัก) ที่ไม่ได้ถูกรวมก็ถูกคัดทิ้งอยู่แล้วโดยเกณฑ์เดิมด้านล่าง จึงไม่กระทบเคสอื่น
//
// 🩹 FIX (พบจากรูปจริงที่ผู้ใช้ทดสอบ): ถ้ารวมแล้วยาวเกิน 7 หลัก แสดงว่าบรรทัดเหล่านั้น "ไม่ใช่" เลขไมล์ชุดเดียวกัน
// ที่ถูกตัดคนละบรรทัด แต่เป็นตัวเลขคนละตัวที่บังเอิญอยู่ติดกัน (เช่น UI อื่นในรูปมีปี "2026" + เลขวันที่ "09"
// ติดอยู่ใกล้ตัวเลขไมล์จริง "559222" พอดี) เดิมรวมมั่วเป็น "202609559222" (12 หลัก) ทำให้ถูกคัดทิ้งทั้งหมด
// รวมถึงเลขไมล์ที่ถูกต้อง "559222" ที่ควรจะยืนเดี่ยวเป็น candidate ได้ -> รวมเฉพาะกรณีที่ผลรวมยังอยู่ในช่วง
// ความยาวเลขไมล์ที่เป็นไปได้ (3-7 หลัก) เท่านั้น ไม่งั้นคืนบรรทัดเดิมแยกกันไว้เหมือนก่อนแก้
// 🩹 FIX (วัดจากรูปหน้าปัดจริง 14 ใบ: อ่านถูกแค่ 36% ตอนไม่มีไมล์ตอนออกมาช่วย):
// เลขสเกลความเร็วบนหน้าปัด (20/40/60/.../220) ก็เป็น "ตัวเลขล้วนคนละบรรทัด" เหมือนเลขไมล์ที่ถูกตัด
// -> โดนรวมเป็น 160180 / 6080100 ที่ยาว 6-7 หลักพอดี แล้วไปชนะเลขไมล์จริงเพราะคะแนนคิดจากความยาว
// ฟังก์ชันนี้ใช้บอกว่าเลขหน้าตาเหมือนขีดสเกลหรือเปล่า (ลงท้ายด้วย 0, ไม่เกิน 280, ไม่เกิน 3 หลัก)
function isScaleNumber(string $digits): bool {
    if (!preg_match('/^\d+$/', $digits)) return false;
    $v = (int)$digits;
    return strlen($digits) <= 3 && $v >= 10 && $v <= 280 && $v % 10 === 0;
}

// 🩹 เลขยาวที่จริงๆ แล้วเกิดจาก "ขีดสเกลหลายตัวติดกัน" ซึ่งเล็ดลอดมาได้อีก 2 ทาง นอกจากการรวมบรรทัด:
//   1) OCR อ่าน "120 140" ติดกันมาเป็นก้อนเดียว -> 120140
//   2) กฎตัวคั่นหลักพันของเราเองมอง "100 120" เป็นเลขหลักพัน -> 100120
// -> ลองแยกเป็นชิ้นละ 2-3 หลัก ถ้าทุกชิ้นหน้าตาเป็นขีดสเกลหมด ก็ไม่ใช่เลขไมล์
// (เลขไมล์จริงอย่าง 530195 / 020906 / 285000 แยกแบบนี้ไม่ลงตัว จึงไม่โดนหางเลข)
function isScaleRun(string $digits): bool {
    $n = strlen($digits);
    if ($n < 4 || $n > 7 || !preg_match('/^\d+$/', $digits)) return false;
    $split = function (string $s) use (&$split): bool {
        if ($s === '') return true;
        foreach ([2, 3] as $len) {
            if (strlen($s) < $len) continue;
            if (isScaleNumber(substr($s, 0, $len)) && $split(substr($s, $len))) return true;
        }
        return false;
    };
    return $split($digits);
}

// $mergedValues (by ref) = ชุดตัวเลขที่ "เกิดจากการรวมบรรทัด" ไว้หักคะแนนตอนให้น้ำหนัก
function mergeDigitOnlyLines(array $lines, array &$mergedValues = null): array {
    $merged = [];
    $buffer = [];
    if (!is_array($mergedValues)) $mergedValues = [];
    $flush = function () use (&$buffer, &$merged, &$mergedValues) {
        if (!$buffer) return;
        if (count($buffer) === 1) {
            $merged[] = $buffer[0];
        } else {
            // มีเลขหน้าตาเป็นสเกลตั้งแต่ 2 ตัวขึ้นไป = กลุ่มนี้คือขีดสเกลหน้าปัด ไม่ใช่เลขไมล์ที่ถูกตัด -> ห้ามรวม
            $scaleCount = 0;
            foreach ($buffer as $b) {
                foreach (preg_split('/[ \t]+/', trim($b)) as $tok) {
                    if (isScaleNumber($tok)) $scaleCount++;
                }
            }
            $joined = preg_replace('/[ \t]+/', '', implode('', $buffer));
            if ($scaleCount < 2 && strlen($joined) >= 3 && strlen($joined) <= 7) {
                $merged[] = $joined;
                $mergedValues[$joined] = true;
            } else {
                foreach ($buffer as $b) $merged[] = $b;
            }
        }
        $buffer = [];
    };
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed !== '' && preg_match('/^\d+(?:[ \t]+\d+)*$/', $trimmed)) {
            $buffer[] = $trimmed;
        } else {
            $flush();
            $merged[] = $line;
        }
    }
    $flush();
    return $merged;
}

// 🩹 FIX หลัก: เดิมเอาตัวเลข "ทุกชุด" ในรูปมาต่อกัน (เช่น ไมล์ 185318 + trip 123.4 = 1853181234,
// หรือมีนาฬิกา 10:45 ติดมาด้วย = 1045185318) -> ตอนนี้แยกเป็นตัวเลือกทีละชุด ตัดของที่ไม่ใช่เลขไมล์ทิ้ง
// แล้วเลือกชุดที่ใช่ที่สุด — คืน list เรียงจากน่าจะใช่มากสุด: [['value' => '185318', 'score' => ...], ...]
function odometerCandidates(string $text, ?int $start): array {
    $cands = [];
    $scaleFlag = [];
    $mergedValues = [];
    foreach (mergeDigitOnlyLines(preg_split('/\R/u', $text), $mergedValues) as $line) {
        $isOdoLine = (bool)preg_match('/\b(ODO|ODOMETER|TOTAL)\b|ไมล์|ระยะทางรวม/iu', $line);
        $isTripLine = (bool)preg_match('/\b(TRIP|AVG|RANGE|FUEL)\b|km\/h|km\/l|l\/100|\/min/iu', $line);
        // 🩹 "km" ลอยๆ ต่อท้ายเลข = ระยะทางสะสม (เช่น "000266 km") ส่วน km/h, km/l คือความเร็ว/อัตราสิ้นเปลือง
        // ซึ่งถูกจับเป็น $isTripLine ไปแล้ว -> ใช้ lookahead กัน "km/" ไม่ให้นับเป็นบรรทัดเลขไมล์
        $isKmLine = (bool)preg_match('/\bkm\b(?!\s*\/)/iu', $line);
        // ตัวเลขที่ OCR แยกเป็นหลักๆ "1 8 5 3 1 8" (จอ LCD ช่องห่าง) -> รวมกลับเป็นชุดเดียว
        $line = preg_replace_callback('/(?<![\d.,:])\d(?:[ \t]\d){3,}(?![\d.,:])/u', fn($m) => preg_replace('/\s+/', '', $m[0]), $line);
        // ชุดตัวเลข: แบบมีตัวคั่นหลักพัน (185,318 / 185 318) ก่อน ไม่งั้นตัวเลขต่อเนื่อง (+ ทศนิยม/เวลา ไว้คัดทิ้ง)
        preg_match_all('/\d{1,3}(?:[.,\' ]\d{3})+(?![\d.,:])|\d+(?:[.,:]\d+)*/u', $line, $mm, PREG_OFFSET_CAPTURE);
        foreach ($mm[0] as [$tok, $pos]) {
            $after = substr($line, $pos + strlen($tok), 4);
            $before = $pos > 0 ? substr($line, $pos - 1, 1) : '';
            $tok = trim($tok);
            if (strpos($tok, ':') !== false) continue;                       // เวลา 10:45
            if ($before === '/' || $before === '-' || preg_match('/^[\/\-]\d/', $after)) continue; // วันที่ 16/06/2026 (แคปจอคอมติดนาฬิกา taskbar มา)
            if (preg_match('/^\s*(°|%|℃)/u', $after)) continue;                // อุณหภูมิ / เปอร์เซ็นต์
            $nums = [];
            if (preg_match('/^\d{1,3}(?:[.,\' ]\d{3})+$/', $tok)) {           // ตัวคั่นหลักพัน 185,318 / 185 318 / 185.318
                $joined = preg_replace('/\D/', '', $tok);
                if (strlen($joined) <= 7) {
                    $nums[] = $joined;
                } else {
                    // 🩹 ยาวเกินเลขไมล์ = มีเลขอื่นติดมาในชุดเดียวกัน (เช่น OCR อ่าน "000 125 130" จากเลขไมล์ 125130
                    // ที่มีเลขสเกลรอบเครื่องติดมาข้างหน้า) เดิมทิ้งทั้งก้อนจนไม่เหลือเลขไมล์เลย
                    // -> ลองตัดเป็นช่วงย่อยของกลุ่มที่ติดกัน ไล่จากขวาสุดก่อน (เลขไมล์มักอยู่ท้ายชุด)
                    $groups = preg_split('/\D+/', $tok, -1, PREG_SPLIT_NO_EMPTY);
                    for ($end = count($groups); $end > 0; $end--) {
                        for ($head = 0; $head < $end; $head++) {
                            $win = implode('', array_slice($groups, $head, $end - $head));
                            if (strlen($win) >= 4 && strlen($win) <= 7) {
                                $nums[] = $win;
                                $mergedValues[$win] = true;                  // เป็นเลขที่ประกอบขึ้นเอง ให้เชื่อน้อยกว่าเลขที่อ่านมาเป็นชุดเดียว
                            }
                        }
                    }
                }
            } elseif (preg_match('/^\d+$/', $tok)) {
                $nums[] = $tok;
            } else {
                continue;                                                   // ทศนิยม 123.4 = trip/อัตราสิ้นเปลือง ไม่ใช่เลขไมล์
            }

            foreach ($nums as $num) {
                // เลขไมล์รถยนต์ 3-7 หลัก แต่เลข 3 หลักลอยๆ ที่ไม่มี ODO/km กำกับ ส่วนใหญ่เป็นเศษจากข้อความอื่น
                // (เช่น "x1000r/min" กลายเป็น 900) -> ใบที่ในรูปไม่มีเลขไมล์เลยจะได้ไม่เดามั่ว
                $minLen = ($isOdoLine || $isKmLine) ? 3 : 4;
                if (strlen($num) < $minLen || strlen($num) > 7) continue;
                $v = (int)$num;
                $isScale = isScaleNumber($num) || isScaleRun($num);
                $score = strlen($num) * 10
                    + ($isOdoLine ? 100 : 0)
                    + ($isKmLine ? 60 : 0)
                    - ($isTripLine ? 100 : 0)
                    - ($isScale ? 40 : 0)                                        // ขีดสเกลหน้าปัด ไม่ใช่เลขไมล์
                    - (isset($mergedValues[$num]) ? 15 : 0);                     // เกิดจากการรวมบรรทัด เชื่อได้น้อยกว่าเลขที่อ่านมาเป็นชุดเดียว
                if ($start !== null) {
                    if ($v > $start && $v <= $start + 1500) $score += 1000 - min(999, intdiv($v - $start, 2)); // อยู่ในช่วงที่เป็นไปได้ ยิ่งใกล้ยิ่งดี
                    elseif ($v === $start) $score += 300;                        // เลขเท่าตอนออก (ยังไม่ได้ขับ/รูปเก่า)
                }
                $cands[$num] = max($cands[$num] ?? PHP_INT_MIN, $score);
                $scaleFlag[$num] = $isScale;
            }
        }
    }
    arsort($cands);
    return array_map(
        fn($v, $s) => ['value' => (string)$v, 'score' => $s, 'scale' => !empty($scaleFlag[$v])],
        array_keys($cands),
        array_values($cands)
    );
}

// 🌟 รวมผลจากทั้ง 2 engine แล้วตัดสินใจ — ใช้ร่วมกันทั้ง endpoint นี้และสคริปต์วัดความแม่น
// $texts = ['2' => ข้อความ|null, '1' => ...]
// คืน ['digits' => เลขที่เลือก|null, 'candidates' => [เลขรอง...], 'agree' => true|false|null, 'reason' => ...]
//   agree = true  : ทั้ง 2 engine อ่านได้เลขเดียวกัน (มั่นใจ)
//   agree = false : อ่านได้คนละเลข -> ฝั่งหน้าเว็บจะไม่เติมให้อัตโนมัติ ให้ผู้ใช้ยืนยันเอง
//   agree = null  : มีผลจาก engine เดียว ไขว้ไม่ได้
function odometerDecide(array $texts, ?int $start): array {
    $perEngine = [];
    $all = [];
    foreach ($texts as $engine => $text) {
        if (!is_string($text) || trim($text) === '') continue;
        $c = odometerCandidates($text, $start);
        if (!$c) continue;
        $perEngine[$engine] = $c;
        foreach ($c as $item) {
            $v = $item['value'];
            if (!isset($all[$v]) || $all[$v]['score'] < $item['score']) $all[$v] = $item;
        }
    }
    if (!$all) return ['digits' => null, 'candidates' => [], 'agree' => null, 'reason' => 'no_digits'];

    uasort($all, fn($a, $b) => $b['score'] <=> $a['score']);
    $list = array_values($all);

    // เหลือแต่ขีดสเกลหน้าปัด = ในรูปไม่มีเลขไมล์ให้อ่านจริงๆ (เช่น จอตั้งโหมด TRIP อยู่) -> อย่าเดา
    $hasReal = false;
    foreach ($list as $item) if (empty($item['scale'])) { $hasReal = true; break; }
    if (!$hasReal) return ['digits' => null, 'candidates' => [], 'agree' => null, 'reason' => 'scale_only'];

    $tops = [];
    foreach ($perEngine as $engine => $c) $tops[$engine] = (int)$c[0]['value'];
    $agree = count($tops) >= 2 ? count(array_unique($tops)) === 1 : null;

    return [
        'digits' => $list[0]['value'],
        'candidates' => array_values(array_slice(array_column($list, 'value'), 1, 4)),
        'agree' => $agree,
        'reason' => null,
    ];
}

try {
    $image = flattenTransparent($base64Image);
    // 🌟 ยิง 2 engine พร้อมกันแล้วเอาผลมาไขว้กัน (engine 2 แม่นกับตัวเลข/จอ digital, engine 1 เก่งคนละแบบ)
    // ถ้าสองตัวอ่านได้คนละเลข = ไม่ชัวร์ ฝั่งหน้าเว็บจะไม่เติมให้อัตโนมัติ
    $ocr = ocrSpaceBoth($image);
    $rawTexts = $ocr['texts'];
    $lastErr = $ocr['errors'] ? end($ocr['errors']) : null;
    $parsedText = '';
    foreach ($rawTexts as $engine => $t) $parsedText .= ($parsedText === '' ? '' : "\n---\n") . "[engine $engine]\n" . $t;

    $decision = odometerDecide($rawTexts, $startMileage);

    ocr_log([
        'type' => 'read',
        'booking_id' => $logBookingId,
        'emp' => $_SESSION['employee_id'] ?? null,
        'start_mileage' => $startMileage,
        'digits' => $decision['digits'],
        'candidates' => $decision['candidates'],
        'agree' => $decision['agree'],
        'reason' => $decision['reason'],
        'errors' => $ocr['errors'] ?: null,
        'engines' => $rawTexts, // ข้อความดิบ เอาไว้รันซ้ำกับ parser ใหม่ได้โดยไม่ต้องยิง API อีก
    ]);

    if ($decision['digits'] === null) {
        $msg = $rawTexts ? "อ่านตัวเลขจากรูปไม่ได้ชัดเจน" : ($lastErr ?: "อ่านรูปไม่สำเร็จ");
        // เจอแต่ขีดสเกลบนหน้าปัด (เช่น ถ่ายตอนจอตั้งโหมด TRIP อยู่ ไม่ได้โชว์ ODO) -> บอกให้ชัดว่าไม่มีเลขให้อ่าน
        if (($decision['reason'] ?? '') === 'scale_only') $msg = "ไม่พบเลขไมล์ในรูป (เจอแต่ตัวเลขบนหน้าปัด) กรุณากรอกเอง";
        echo json_encode([
            "success" => false,
            "message" => $msg,
            "raw_text" => $parsedText,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $best = $decision['digits'];
    echo json_encode([
        "success" => true,
        "digits" => $best,
        // ตัวเลขชุดอื่นที่เจอในรูป ให้หน้าเว็บโชว์เป็นตัวเลือกเผื่อระบบเลือกผิด
        "candidates" => $decision['candidates'],
        // false = เลขที่อ่านได้ไม่อยู่ในช่วง (ไมล์ตอนออก, +1,500 กม.] ควรเตือนให้ตรวจ
        "in_range" => $startMileage === null ? null : ((int)$best > $startMileage && (int)$best <= $startMileage + 1500),
        // true = 2 engine อ่านได้เลขเดียวกัน, false = คนละเลข, null = มีผลจาก engine เดียว
        "agree" => $decision['agree'],
        // หน้าเว็บจะไม่เติมเลขให้อัตโนมัติเมื่อเป็น true แต่โชว์เป็นตัวเลือกให้กดยืนยันแทน
        "needs_confirm" => $decision['agree'] === false,
        "raw_text" => $parsedText,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('ocr_odometer error: ' . $e->getMessage());
    echo json_encode(["success" => false, "message" => "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์"]);
}
