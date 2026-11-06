<?php
// Web Push (RFC 8030 + VAPID RFC 8292 + เข้ารหัส aes128gcm RFC 8291) เขียนเองด้วย openssl/curl ของ PHP — ไม่ต้องลง library
// ต้องรัน db/migrations/2026-11-06_push.sql (ตาราง PushSubscriptions); ไม่มีตาราง = ฟีเจอร์ปิดเงียบๆ
// คีย์ VAPID สร้างเองครั้งแรกแล้วเก็บใน <logs>/vapid.json (หรือกำหนดเองใน Car/push_config.php: ['pem'=>..., 'pub'=>...])
// ถ้าคีย์หาย/เปลี่ยน อุปกรณ์เดิมต้องกด "เปิดแจ้งเตือน" ใหม่ (หน้าเว็บ resubscribe ให้เองเมื่อโหลดหน้า)

require_once __DIR__ . '/../session_policy.php';

function push_b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function push_unb64u(string $s): string { return (string)base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

function push_ready(PDO $conn): bool {
    static $ok = null;
    if ($ok === null) {
        try { $ok = (int)$conn->query("SELECT COUNT(*) FROM sys.tables WHERE name = 'PushSubscriptions'")->fetchColumn() === 1; }
        catch (Throwable $e) { $ok = false; }
    }
    return $ok;
}

// openssl.cnf ขั้นต่ำ (Windows/IIS มักไม่มีไฟล์ config ทำให้สร้างคีย์ EC ไม่ได้)
function push_ssl_opts(array $extra = []): array {
    $dir = cb_state_dir() ?: sys_get_temp_dir();
    $cnf = $dir . DIRECTORY_SEPARATOR . 'push_openssl_v2.cnf';
    $txt = "[req]\ndefault_bits=2048\ndistinguished_name=dn\n[dn]\n";
    if (!is_file($cnf) || @file_get_contents($cnf) !== $txt) @file_put_contents($cnf, $txt);
    return $extra + ['config' => $cnf];
}

// ['pem' => private key PEM, 'pub' => base64url 65 ไบต์ (uncompressed point)] หรือ null
function push_vapid(): ?array {
    static $v = false;
    if ($v !== false) return $v;
    $v = null;
    $cfgFile = __DIR__ . '/push_config.php';
    if (is_file($cfgFile)) { $c = require $cfgFile; if (!empty($c['pem']) && !empty($c['pub'])) return $v = $c; }
    $dir = cb_state_dir();
    $file = $dir ? $dir . DIRECTORY_SEPARATOR . 'vapid.json' : null;
    if ($file && is_file($file)) {
        $c = json_decode((string)file_get_contents($file), true);
        if (!empty($c['pem']) && !empty($c['pub'])) return $v = $c;
    }
    $k = @openssl_pkey_new(push_ssl_opts(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]));
    if (!$k) { error_log('push: สร้างคีย์ VAPID ไม่สำเร็จ'); return null; }
    $d = openssl_pkey_get_details($k);
    @openssl_pkey_export($k, $pem, null, push_ssl_opts());
    if (!$pem || empty($d['ec']['x'])) return null;
    $v = ['pem' => $pem, 'pub' => push_b64u("\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT))];
    if ($file) @file_put_contents($file, json_encode($v));
    return $v;
}

function push_der_to_raw(string $der): string {
    $p = 2;
    if (ord($der[1]) & 0x80) $p += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        $len = ord($der[$p + 1]);
        $int = substr($der, $p + 2, $len);
        $p += 2 + $len;
        $out .= str_pad(ltrim($int, "\0"), 32, "\0", STR_PAD_LEFT);
    }
    return $out;
}

function push_vapid_header(string $endpoint): ?string {
    $v = push_vapid();
    if (!$v) return null;
    $u = parse_url($endpoint);
    if (empty($u['scheme']) || empty($u['host'])) return null;
    $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    require_once __DIR__ . '/mailer.php';
    $from = mail_cfg()['from_email'] ?? '';
    $sub = filter_var($from, FILTER_VALIDATE_EMAIL) ? 'mailto:' . $from : 'mailto:admin@example.com';
    $in = push_b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . push_b64u(json_encode(['aud' => $aud, 'exp' => time() + 43200, 'sub' => $sub]));
    $key = openssl_pkey_get_private($v['pem']);
    if (!$key) return null;
    if (!openssl_sign($in, $der, $key, OPENSSL_ALGO_SHA256)) return null;
    return 'vapid t=' . $in . '.' . push_b64u(push_der_to_raw($der)) . ', k=' . $v['pub'];
}

// เข้ารหัส payload ให้ผู้รับ (p256dh/auth แบบ base64url) -> body พร้อมส่ง หรือ null
function push_encrypt(string $payload, string $p256dh, string $auth): ?string {
    $uaPub = push_unb64u($p256dh);
    $authSecret = push_unb64u($auth);
    if (strlen($uaPub) !== 65 || $uaPub[0] !== "\x04") return null;
    $spki = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $uaPub;
    $uaKey = openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n");
    $eph = @openssl_pkey_new(push_ssl_opts(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]));
    if (!$uaKey || !$eph) return null;
    $d = openssl_pkey_get_details($eph);
    $asPub = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
    $secret = openssl_pkey_derive($uaKey, $eph, 32);
    if ($secret === false) return null;
    $prk = hash_hkdf('sha256', $secret, 32, "WebPush: info\0" . $uaPub . $asPub, $authSecret);
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\0", $salt);
    $tag = '';
    $ct = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($ct === false) return null;
    return $salt . pack('N', 4096) . chr(65) . $asPub . $ct . $tag;
}

// ส่ง 1 อุปกรณ์: true = ส่งได้, false = ล้มเหลวชั่วคราว, 'gone' = อุปกรณ์เลิกใช้แล้ว (ลบทิ้งได้)
function push_send_one(array $sub, array $payload) {
    $body = push_encrypt(json_encode($payload, JSON_UNESCAPED_UNICODE), $sub['P256dh'], $sub['Auth']);
    $auth = push_vapid_header($sub['Endpoint']);
    if ($body === null || $auth === null) return false;
    $ch = curl_init($sub['Endpoint']);
    $opt = [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_HTTPHEADER => ['Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'TTL: 3600', 'Urgency: high', 'Authorization: ' . $auth],
    ];
    if (is_file(__DIR__ . '/cacert.pem')) $opt[CURLOPT_CAINFO] = __DIR__ . '/cacert.pem';
    curl_setopt_array($ch, $opt);
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($code === 0) error_log('push send: ' . curl_error($ch));
    curl_close($ch);
    if ($code >= 200 && $code < 300) return true;
    if ($code === 404 || $code === 410) return 'gone';
    error_log("push send: HTTP $code");
    return false;
}

function push_subs(PDO $conn, ?array $employees = null): array {
    if (!push_ready($conn)) return [];
    try {
        $rows = $conn->query("SELECT s.Id, s.EmployeeID, s.Endpoint, s.P256dh, s.Auth, u.id AS UserID, u.role AS Role
                              FROM PushSubscriptions s JOIN Users u ON u.employee_id = s.EmployeeID")->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { error_log('push_subs: ' . $e->getMessage()); return []; }
    if ($employees !== null) $rows = array_values(array_filter($rows, fn($r) => in_array($r['EmployeeID'], $employees, true)));
    return $rows;
}

function push_state_file(): string {
    return (cb_state_dir() ?: sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'push_sent.json';
}
function push_state_load(): array {
    $f = push_state_file();
    $s = is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
    $cut = time() - 3 * 86400;
    return array_filter($s, fn($t) => $t > $cut);
}

// รายการแจ้งเตือนของคนนี้ที่ควร "เด้ง" ถึงเครื่อง (ระดับ warn/danger — เหมือนที่กระดิ่งแสดง)
function push_items_for(PDO $conn, array $subRow): array {
    require_once __DIR__ . '/notify_lib.php';
    $adminIds = require __DIR__ . '/../admin_whitelist.php';
    $role = strtolower((string)$subRow['Role']);
    $isAdmin = $role === 'admin' && in_array((int)$subRow['UserID'], $adminIds, true);
    $items = nt_collect_for_user($conn, (string)$subRow['EmployeeID'], $isAdmin, $role === 'security');
    return array_values(array_filter($items, fn($i) => $i['level'] === 'warn' || $i['level'] === 'danger'));
}

// ส่งแจ้งเตือนใหม่ (ที่ยังไม่เคยส่ง) ถึงทุกอุปกรณ์ของพนักงานที่ระบุ (null = ทุกคน)
// เรียกจาก notify_cron.php (ทุก 5 นาที) และทันทีหลังผู้ใช้กด "รถยังไม่มา"
function push_dispatch(PDO $conn, ?array $employees = null): int {
    $subs = push_subs($conn, $employees);
    if (!$subs) return 0;
    $sent = push_state_load();
    $byEmp = [];
    foreach ($subs as $s) $byEmp[$s['EmployeeID']][] = $s;
    $n = 0;
    foreach ($byEmp as $emp => $list) {
        try { $items = push_items_for($conn, $list[0]); } catch (Throwable $e) { error_log('push items: ' . $e->getMessage()); continue; }
        foreach ($items as $it) {
            $key = "$emp|{$it['id']}";
            if (isset($sent[$key])) continue;
            foreach ($list as $s) {
                $r = push_send_one($s, ['title' => $it['title'], 'body' => $it['body'], 'url' => $it['link'], 'tag' => $it['id']]);
                if ($r === 'gone') {
                    try { $conn->prepare("DELETE FROM PushSubscriptions WHERE Id = :i")->execute([':i' => $s['Id']]); } catch (Throwable $e) {}
                } elseif ($r === true) {
                    $n++;
                }
            }
            $sent[$key] = time();
        }
    }
    @file_put_contents(push_state_file(), json_encode($sent));
    return $n;
}

// ตอนเพิ่งเปิดแจ้งเตือน: ถือว่ารายการที่มีอยู่แล้วเห็นไปแล้ว (ไม่ส่งรายการเก่าย้อนหลังรัวๆ)
function push_mark_current(PDO $conn, string $employeeId): void {
    $subs = push_subs($conn, [$employeeId]);
    if (!$subs) return;
    try {
        $sent = push_state_load();
        foreach (push_items_for($conn, $subs[0]) as $it) $sent["$employeeId|{$it['id']}"] = time();
        @file_put_contents(push_state_file(), json_encode($sent));
    } catch (Throwable $e) { error_log('push mark: ' . $e->getMessage()); }
}
