<?php
// 🌟 ตัวนับความพยายามล็อกอิน / รีเซ็ตรหัสผ่าน (กัน brute-force) ใช้ร่วมกันทุกไฟล์
//
// 🩹 FIX: เดิมนับตาม "IP" เพียวๆ ไฟล์เดียวต่อ IP — แต่ผู้ใช้ทั้งออฟฟิศออกเน็ตผ่าน
// IP สาธารณะตัวเดียวกัน (NAT) หรือเน็ตมือถือค่ายเดียวกัน (CGNAT) พอมีคนหนึ่ง
// พิมพ์รหัสผิด 5 ครั้ง -> ตัวนับของ IP นั้นเต็ม -> "ทุกคนที่ใช้เน็ตวงเดียวกัน
// ถูกล็อก 15 นาทีไปด้วย" ทั้งที่ไม่ได้ทำอะไรผิด
// แก้เป็น 2 ชั้น:
//   - ชั้นบัญชี (acct:<username>|<ip>) 5 ครั้ง -> ล็อกแค่บัญชีนั้นจากเน็ตวงนั้น คนอื่นเข้าได้ปกติ
//   - ชั้น IP (ip:<ip>) 30 ครั้ง -> เผื่อกรณีถูกยิงเดารหัสหลายบัญชีจาก IP เดียวจริงๆ
// และลดโทษจาก 15 นาที เหลือ 5 นาทีเท่ากันทุกคนทุกครั้ง (ตามที่สั่ง)

// โทษเมื่อใส่ผิดเกินโควตา — 5 นาทีเท่ากันหมด ไม่ว่าจะผิดครั้งที่เท่าไหร่
const RL_LOCK_SECONDS = 300; // 5 นาที
// ไม่ได้ลองผิดเลยนานเท่านี้ (วินาที) = เริ่มนับใหม่จาก 0
// ตั้งเท่ากับโทษ เพื่อให้พอรอครบ 5 นาที ตัวนับเคลียร์ ได้โอกาสลองใหม่เต็มโควตา
const RL_IDLE_RESET = RL_LOCK_SECONDS;

// 🩹 ระบบรันอยู่หลัง Cloudflare Tunnel — REMOTE_ADDR ที่เซิร์ฟเวอร์เห็นเป็น IP ของตัว
// tunnel เอง (::1) เหมือนกันหมดทุกเครื่อง ต้องอ่าน IP จริงจาก header ที่ Cloudflare ใส่มา
function getClientIp(): string {
    $remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    // 🔒 เชื่อ header จาก proxy เฉพาะเมื่อ request มาจาก tunnel/proxy ในเครื่องหรือวง LAN เท่านั้น
    // ถ้ายิงตรงเข้า IIS จาก IP สาธารณะ คนร้ายปลอม header นี้เปลี่ยน IP ทุกครั้งเพื่อหลบ rate limit ได้
    $fromProxy = filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    if ($fromProxy) {
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP']) && filter_var(trim($_SERVER['HTTP_CF_CONNECTING_IP']), FILTER_VALIDATE_IP)) {
            return trim($_SERVER['HTTP_CF_CONNECTING_IP']);
        }
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // อาจมีหลาย IP คั่นด้วยจุลภาคถ้าผ่านหลายชั้น proxy เอาตัวแรกสุด (client จริง)
            $first = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
        }
    }
    return $remote;
}

function rl_file(string $scope, string $key): string {
    $dir = sys_get_temp_dir() . '/' . $scope;
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    return $dir . '/' . md5($key) . '.json';
}

function rl_load(string $scope, string $key): array {
    $data = ['count' => 0, 'last' => 0];
    $file = rl_file($scope, $key);
    if (is_file($file)) {
        $json = json_decode((string) file_get_contents($file), true);
        if (is_array($json)) {
            $data = ['count' => (int) ($json['count'] ?? 0), 'last' => (int) ($json['last'] ?? 0)];
        }
    }
    if (time() - $data['last'] > RL_IDLE_RESET) $data = ['count' => 0, 'last' => 0]; // เงียบมานาน เริ่มนับใหม่
    return $data;
}

// โทษคงที่ 5 นาที (เก็บพารามิเตอร์ไว้เผื่ออยากกลับไปใช้แบบขั้นบันไดในอนาคต)
function rl_penalty_seconds(int $count, int $max): int {
    return RL_LOCK_SECONDS;
}

// เหลือเวลาที่ต้องรออีกกี่วินาที (0 = ลองได้เลย)
function rl_retry_after(string $scope, string $key, int $max): int {
    $data = rl_load($scope, $key);
    if ($data['count'] < $max) return 0;
    return max(0, rl_penalty_seconds($data['count'], $max) - (time() - $data['last']));
}

// นับเพิ่ม 1 ครั้ง คืนค่าจำนวนครั้งล่าสุด
function rl_fail(string $scope, string $key): int {
    $data = rl_load($scope, $key);
    $data['count']++;
    $data['last'] = time();
    file_put_contents(rl_file($scope, $key), json_encode($data), LOCK_EX);
    rl_gc($scope);
    return $data['count'];
}

function rl_clear(string $scope, string $key): void {
    $file = rl_file($scope, $key);
    if (is_file($file)) @unlink($file);
}

// เก็บกวาดไฟล์ตัวนับที่ค้างเกิน 1 วัน (สุ่มทำ ไม่ให้หนักทุก request)
function rl_gc(string $scope): void {
    if (random_int(1, 20) !== 1) return;
    foreach (glob(sys_get_temp_dir() . '/' . $scope . '/*.json') ?: [] as $file) {
        if (@filemtime($file) < time() - 86400) @unlink($file);
    }
}

// แปลงวินาทีเป็นข้อความบอกผู้ใช้
function rl_wait_text(int $seconds): string {
    return $seconds >= 60 ? 'ประมาณ ' . ceil($seconds / 60) . ' นาที' : max(1, $seconds) . ' วินาที';
}
