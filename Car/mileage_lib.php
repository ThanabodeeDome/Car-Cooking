<?php
// เลขไมล์ตอนออกเป็น "ค่าประมาณ" หรือไม่ (CarBookings.StartMileageEst = 1)
// เกิดเมื่อรอบก่อนหน้าของรถคันนี้ถูกระบบปิดให้ (ปิดโดยระบบ) และยังไม่มีใครกรอกเลขไมล์คืน -> เลขตอนออกที่ดึงจาก Cars.Mileage อาจเก่ากว่าเลขจริงมาก
// กรณีนี้ห้ามบล็อก/เตือน "ระยะทางเกิน 1,500 กม." เพราะผู้ขับกรอกถูกต้องแล้วแต่เลขเริ่มต้นเก่า ให้คืนรถได้ตามเลขที่กรอก

// มีคอลัมน์ StartMileageEst แล้วหรือไม่ (ยังไม่ได้รัน SQL อัปเดตฐานข้อมูล = ไม่มี)
function mileage_est_col_ok($conn): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    try {
        $ok = (int)$conn->query("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name = 'StartMileageEst'")->fetchColumn() === 1;
    } catch (Throwable $e) {
        $ok = false;
    }
    return $ok;
}

function startMileageIsEstimate($conn, int $bookingId): bool {
    try {
        if (!mileage_est_col_ok($conn) || $bookingId <= 0) return false;
        $st = $conn->prepare("SELECT StartMileageEst FROM CarBookings WHERE BookingID = :id");
        $st->execute([':id' => $bookingId]);
        return (int)$st->fetchColumn() === 1;
    } catch (Throwable $e) {
        return false;
    }
}
