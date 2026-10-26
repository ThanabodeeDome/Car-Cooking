<?php
// แปลข้อผิดพลาดจากฐานข้อมูลให้เป็นภาษาที่คนอ่านรู้เรื่อง
//
// 🩹 ปัญหาที่แก้: ทุกจุดจับ PDOException แล้วตอบข้อความกลางๆ เหมือนกันหมด
// ("เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลรถได้") คนใช้จึงไม่รู้ว่าติดอะไรและต้องทำอะไรต่อ
// เคสจริงที่เจอใน log: 21 ต.ค. 2026 09:50 แอดมินกดบันทึกข้อมูลรถสองครั้งแล้วไม่ผ่าน
// สาเหตุจริงคือ FK_CarBookings_Cars_Plate — เปลี่ยนทะเบียนรถที่มีใบจองผูกอยู่ไม่ได้
// แต่หน้าเว็บไม่เคยบอก
//
// ใช้: echo json_encode(['success' => false, 'message' => cb_db_error_message($e, 'ข้อความสำรอง')]);

function cb_db_error_message(Throwable $e, string $fallback): string
{
    $m = $e->getMessage();

    // 1) ติด foreign key — มีข้อมูลอื่นอ้างอิงแถวนี้อยู่ บอกให้รู้ว่าใครอ้างอิง
    if (stripos($m, 'REFERENCE constraint') !== false || stripos($m, 'FOREIGN KEY constraint') !== false) {
        if (stripos($m, 'FK_CarBookings_Cars_Plate') !== false) {
            return 'เปลี่ยนทะเบียนหรือลบรถคันนี้ไม่ได้ เพราะมีใบจองที่ใช้ทะเบียนนี้อยู่ในระบบ '
                 . '(แก้ยี่ห้อ/รุ่น/สี/สถานะ/เลขไมล์ได้ตามปกติ) — ถ้าจำเป็นต้องเปลี่ยนทะเบียนจริง ให้แจ้งผู้ดูแลระบบย้ายประวัติการจองให้';
        }
        if (stripos($m, 'Maintenan') !== false && stripos($m, 'CarID') !== false) {
            return 'ลบรถคันนี้ไม่ได้ เพราะมีประวัติซ่อมบำรุงผูกอยู่ ให้ลบประวัติซ่อมบำรุงของรถคันนี้ก่อน';
        }
        if (stripos($m, 'FK_CarBookings_Users_EmployeeID') !== false || stripos($m, 'FK_CarBookings_Users_BookedByUserID') !== false) {
            return 'ลบบัญชีนี้หรือเปลี่ยนรหัสพนักงานไม่ได้ เพราะมีใบจองที่ผูกกับบัญชีนี้อยู่ '
                 . '(ถ้าต้องการปิดการใช้งาน ให้แก้ข้อมูลบัญชีแทนการลบ)';
        }
        if (stripos($m, 'FK_MaintenanceHistory_Users_CreatedBy') !== false) {
            return 'ลบบัญชีนี้ไม่ได้ เพราะเคยเป็นผู้บันทึกประวัติซ่อมบำรุงไว้ในระบบ';
        }
        return 'ทำรายการไม่ได้ เพราะมีข้อมูลอื่นในระบบอ้างอิงรายการนี้อยู่';
    }

    // 2) ข้อความยาวเกินที่ช่องนั้นรับได้ — บอกชื่อช่องที่ล้น
    if (stripos($m, 'would be truncated') !== false) {
        return preg_match("/column '([^']+)'/", $m, $c)
            ? 'ข้อความในช่อง "' . $c[1] . '" ยาวเกินที่ระบบรับได้ กรุณาพิมพ์ให้สั้นลง'
            : 'ข้อความที่กรอกยาวเกินที่ระบบรับได้ กรุณาพิมพ์ให้สั้นลง';
    }

    // 3) วันที่/เวลาผิดรูปแบบ
    if (stripos($m, 'Conversion failed when converting date') !== false || stripos($m, 'out-of-range datetime') !== false) {
        return 'รูปแบบวันที่หรือเวลาไม่ถูกต้อง กรุณาเลือกวันและเวลาใหม่อีกครั้ง';
    }

    // 4) ค่าซ้ำใน unique index
    if (stripos($m, 'duplicate key') !== false || stripos($m, 'UNIQUE KEY constraint') !== false) {
        return 'ข้อมูลนี้มีอยู่ในระบบแล้ว (ค่าซ้ำ) กรุณาตรวจสอบอีกครั้ง';
    }

    // 5) ฐานข้อมูลหลุด/ติดต่อไม่ได้ — บอกให้ลองใหม่ ไม่ใช่ให้แก้ข้อมูล
    if (stripos($m, 'Communication link failure') !== false || stripos($m, 'TCP Provider') !== false || stripos($m, 'Login timeout') !== false) {
        return 'ติดต่อฐานข้อมูลไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่';
    }

    return $fallback;
}
