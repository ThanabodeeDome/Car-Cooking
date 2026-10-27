<?php
// คำขอ "คืนรถนอกจุดบริษัท" — เก็บเป็นเหตุการณ์ 'return_request' ในตาราง SystemLog (ไม่ต้องเพิ่มตารางใหม่ ไม่ต้องรัน SQL เพิ่ม)
// รอแอดมินอนุมัติ (return_approved) หรือปฏิเสธ (return_rejected) ที่หน้าแดชบอร์ด
// คำขอยัง "รอ" อยู่ถ้า: รายการจองยังเป็น 'ขาไป' และยังไม่มี approved/rejected ของรายการนั้นที่ใหม่กว่าคำขอ
//
// detail ของ return_request (JSON): end_mile, remark, reason, return_date, return_time, odometer_photo_path,
//   condition_photo_path, geo{lat,lng,acc,geo,dist}, geo_code, ip

require_once __DIR__ . '/log_lib.php';

// คืนรายการคำขอที่รออยู่ (ใหม่สุดก่อน) แต่ละการจองมีแค่คำขอล่าสุดหนึ่งรายการ
function rr_pending(PDO $conn, int $limit = 50): array {
    if (!sl_ready($conn)) return [];
    try {
        $reqs = $conn->query(
            "SELECT TOP 300 LogID, LogTime, TargetRef, ActorUserID, ActorName, ActorEmpID, Detail, IP
             FROM SystemLog WHERE EventType = 'return_request' AND LogTime >= DATEADD(DAY, -14, GETDATE())
             ORDER BY LogID DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
        if (!$reqs) return [];

        $handled = [];
        foreach ($conn->query(
            "SELECT TargetRef, MAX(LogID) AS LastID FROM SystemLog
             WHERE EventType IN ('return_approved', 'return_rejected') AND LogTime >= DATEADD(DAY, -14, GETDATE())
             GROUP BY TargetRef"
        )->fetchAll(PDO::FETCH_ASSOC) as $h) $handled[(string)$h['TargetRef']] = (int)$h['LastID'];

        $bk = $conn->prepare(
            "SELECT BookingID, BookingNumber, CarPlate, DriverName, EmployeeID, StartMileage, BookingStatus,
                    CONVERT(varchar(16), CheckInTime, 120) AS CheckInAt
             FROM CarBookings WHERE BookingNumber = :n"
        );
        $seen = [];
        $out = [];
        foreach ($reqs as $r) {
            $no = (string)$r['TargetRef'];
            if ($no === '' || isset($seen[$no])) continue;       // เอาคำขอล่าสุดของแต่ละการจองเท่านั้น
            $seen[$no] = true;
            if (isset($handled[$no]) && $handled[$no] > (int)$r['LogID']) continue; // อนุมัติ/ปฏิเสธไปแล้ว
            $bk->execute([':n' => $no]);
            $b = $bk->fetch(PDO::FETCH_ASSOC);
            if (!$b || $b['BookingStatus'] !== 'ขาไป') continue;   // คืนไปแล้ว/ยกเลิกไปแล้ว
            $d = json_decode((string)$r['Detail'], true);
            if (!is_array($d)) continue;
            $out[] = [
                'log_id'       => (int)$r['LogID'],
                'requested_at' => (string)$r['LogTime'],
                'booking_id'   => (int)$b['BookingID'],
                'booking_no'   => (string)$b['BookingNumber'],
                'plate'        => (string)$b['CarPlate'],
                'driver_name'  => (string)$b['DriverName'],
                'employee_id'  => (string)$b['EmployeeID'],
                'start_mileage'=> (int)$b['StartMileage'],
                'end_mileage'  => (int)($d['end_mile'] ?? 0),
                'reason'       => (string)($d['reason'] ?? ''),
                'remark'       => (string)($d['remark'] ?? ''),
                'geo_code'     => (string)($d['geo_code'] ?? ''),
                'geo'          => is_array($d['geo'] ?? null) ? $d['geo'] : null,
                'odometer_photo' => (string)($d['odometer_photo_path'] ?? ''),
                'condition_photo'=> (string)($d['condition_photo_path'] ?? ''),
                'ip'           => (string)$r['IP'],
                '_detail'      => $d,
            ];
            if (count($out) >= $limit) break;
        }
        return $out;
    } catch (Throwable $e) {
        error_log('rr_pending: ' . $e->getMessage());
        return [];
    }
}
