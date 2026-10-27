<?php
// บันทึกระบบ (Audit Log) ลงตาราง SystemLog — migration: db/migrations/2026-10-22_system-log.sql
//
// หลักการ:
//  - sl_log() ไม่เคย throw และไม่เคยทำให้งานหลักพัง: ไม่มีตาราง/DB error = เงียบ (แค่ error_log)
//  - ไม่เก็บรหัสผ่านหรือ token ใดๆ ใน summary/detail
//  - ลบข้อมูลเก่าเกิน SL_RETENTION_DAYS วันให้เองเป็นครั้งคราว

const SL_RETENTION_DAYS = 180;

// ประเภทเหตุการณ์ => [ป้ายภาษาไทย, หมวด]
function sl_events(): array {
    return [
        'login_ok'             => ['เข้าสู่ระบบ', 'auth'],
        'login_fail'           => ['เข้าสู่ระบบไม่สำเร็จ', 'auth'],
        'logout'               => ['ออกจากระบบ', 'auth'],
        'register'             => ['สมัครสมาชิก', 'user'],
        'booking_create'       => ['จองรถ', 'booking'],
        'booking_cancel'       => ['ยกเลิกการจอง', 'booking'],
        'booking_unused'       => ['ปล่อยรถ (ไม่ได้ใช้รถ)', 'booking'],
        'checkin'              => ['เช็คอินรับรถ', 'usage'],
        'checkin_auto'         => ['เช็คอินอัตโนมัติตามเวลา', 'usage'],
        'pickup_confirm'       => ['ยืนยันรับรถที่รถ', 'usage'],
        'return'               => ['คืนรถ', 'usage'],
        'return_request'       => ['ขอคืนรถนอกจุดบริษัท', 'usage'],
        'return_approved'      => ['แอดมินอนุมัติคืนรถนอกจุด', 'admin'],
        'car_ready'             => ['แอดมินยืนยันรถพร้อมใช้', 'admin'],
        'return_rejected'      => ['แอดมินปฏิเสธคำขอคืนรถ', 'admin'],
        'release_noshow'       => ['ปล่อยคิว (ไม่มาใช้งาน)', 'usage'],
        'admin_booking_edit'   => ['แอดมินแก้ไขการจอง', 'admin'],
        'admin_booking_cancel' => ['แอดมินยกเลิกการจอง', 'admin'],
        'admin_booking_delete' => ['แอดมินลบการจอง', 'admin'],
        'user_edit'            => ['แก้ไขผู้ใช้', 'user'],
        'user_delete'          => ['ลบผู้ใช้', 'user'],
        'geo_add'              => ['เพิ่มจุดตรวจพิกัด', 'admin'],
        'geo_update'           => ['แก้ไขจุดตรวจพิกัด', 'admin'],
        'geo_delete'           => ['ลบจุดตรวจพิกัด', 'admin'],
    ];
}

function sl_categories(): array {
    return ['auth' => 'เข้าสู่ระบบ', 'booking' => 'การจอง', 'usage' => 'การใช้รถ', 'admin' => 'งานแอดมิน', 'user' => 'ผู้ใช้'];
}

function sl_ready(PDO $conn): bool {
    static $ok = null;
    if ($ok === null) {
        try {
            $ok = (int)$conn->query("SELECT COUNT(*) FROM sys.tables WHERE name = 'SystemLog'")->fetchColumn() === 1;
        } catch (Throwable $e) {
            $ok = false;
        }
    }
    return $ok;
}

// IP จริงของผู้ใช้ (ผ่าน Cloudflare จะมาใน CF-Connecting-IP)
function sl_ip(): string {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
    return substr((string)$ip, 0, 64);
}

/**
 * @param string $type  คีย์จาก sl_events()
 * @param string $summary ข้อความหนึ่งบรรทัด (อ่านรู้เรื่องโดยไม่ต้องเปิดรายละเอียด)
 * @param array  $o ['actor' => ['id'=>, 'name'=>, 'emp'=>] (ไม่ใส่ = ใช้จาก session), 'system' => true (ระบบทำเอง),
 *                   'target_type' =>, 'target' =>, 'detail' => array]
 */
function sl_log(PDO $conn, string $type, string $summary, array $o = []): void {
    try {
        if (!sl_ready($conn)) return;
        $events = sl_events();
        if (!isset($events[$type])) return;

        $actorId = $actorName = $actorEmp = null;
        if (!empty($o['system'])) {
            $actorName = 'ระบบ (อัตโนมัติ)';
        } elseif (!empty($o['actor']) && is_array($o['actor'])) {
            $actorId = isset($o['actor']['id']) ? (int)$o['actor']['id'] : null;
            $actorName = isset($o['actor']['name']) ? (string)$o['actor']['name'] : null;
            $actorEmp = isset($o['actor']['emp']) ? (string)$o['actor']['emp'] : null;
        } elseif (!empty($_SESSION['user_id'])) {
            $actorId = (int)$_SESSION['user_id'];
            $actorName = (string)($_SESSION['first_name'] ?? $_SESSION['username'] ?? '');
            $actorEmp = (string)($_SESSION['employee_id'] ?? '');
        }

        $detail = null;
        if (!empty($o['detail'])) {
            $detail = is_string($o['detail']) ? $o['detail'] : json_encode($o['detail'], JSON_UNESCAPED_UNICODE);
            if ($detail !== null && mb_strlen($detail) > 4000) $detail = mb_substr($detail, 0, 4000) . '…';
        }

        $conn->prepare(
            "INSERT INTO SystemLog (EventType, Category, ActorUserID, ActorName, ActorEmpID, TargetType, TargetRef, Summary, Detail, IP)
             VALUES (:t, :c, :uid, :an, :ae, :tt, :tr, :s, :d, :ip)"
        )->execute([
            ':t'   => $type,
            ':c'   => $events[$type][1],
            ':uid' => $actorId,
            ':an'  => $actorName !== null ? mb_substr($actorName, 0, 120) : null,
            ':ae'  => $actorEmp !== null ? mb_substr($actorEmp, 0, 20) : null,
            ':tt'  => isset($o['target_type']) ? mb_substr((string)$o['target_type'], 0, 30) : null,
            ':tr'  => isset($o['target']) ? mb_substr((string)$o['target'], 0, 100) : null,
            ':s'   => mb_substr($summary, 0, 400),
            ':d'   => $detail,
            ':ip'  => sl_ip() ?: null,
        ]);

        if (random_int(1, 150) === 1) sl_purge($conn);
    } catch (Throwable $e) {
        error_log('sl_log: ' . $e->getMessage());
    }
}

// ข้อมูลการจองสั้นๆ ไว้เขียน summary: ['no' => เลขที่จอง, 'plate' => ทะเบียน, 'driver' => ชื่อผู้ขับ]
function sl_booking_info(PDO $conn, int $bookingId): array {
    try {
        $st = $conn->prepare("SELECT BookingNumber, CarPlate, DriverName FROM CarBookings WHERE BookingID = :id");
        $st->execute([':id' => $bookingId]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if ($r) return ['no' => (string)$r['BookingNumber'], 'plate' => (string)$r['CarPlate'], 'driver' => (string)$r['DriverName']];
    } catch (Throwable $e) {
    }
    return ['no' => '#' . $bookingId, 'plate' => '', 'driver' => ''];
}

// ลบ log เก่าเกิน SL_RETENTION_DAYS วัน
function sl_purge(PDO $conn): void {
    try {
        if (!sl_ready($conn)) return;
        $conn->exec("DELETE FROM SystemLog WHERE LogTime < DATEADD(DAY, -" . (int)SL_RETENTION_DAYS . ", GETDATE())");
    } catch (Throwable $e) {
        error_log('sl_purge: ' . $e->getMessage());
    }
}
