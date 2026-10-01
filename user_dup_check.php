<?php
// user_dup_check.php
// ตรวจว่า username / รหัสพนักงาน / ชื่อ-นามสกุล ถูกใช้ไปแล้วหรือยัง — ใช้ร่วมกันที่เดียว
// (register_process.php, check_availability.php, Admin/update_user.php) กันคนเดียวสมัครหลายบัญชี

// รหัสพนักงานตัวเลขล้วนเติม 0 ข้างหน้าให้ครบ 5 หลัก (ตรงกับ padEmployeeId() หน้า login) เช่น 91 -> 00091
function normalizeEmployeeId(string $id): string {
    $id = trim($id);
    return (preg_match('/^\d{1,5}$/', $id)) ? str_pad($id, 5, '0', STR_PAD_LEFT) : $id;
}

// คืน ['username' => bool, 'employee_id' => bool, 'name' => bool] (true = มีคนอื่นใช้แล้ว)
// $excludeId = id ของ user ที่กำลังแก้ไข (ไม่นับตัวเอง)
// เทียบแบบไม่สนตัวพิมพ์/ช่องว่างหัวท้าย (collation ของ DB เป็น CI อยู่แล้ว)
// รหัสพนักงานตัวเลขเทียบเป็นตัวเลข: "1267" กับ "01267" ถือว่าคนเดียวกัน
function findDuplicateUser(PDO $conn, string $username, string $employeeId, string $firstName = '', string $lastName = '', int $excludeId = 0): array {
    $result = ['username' => false, 'employee_id' => false, 'name' => false];

    $username = trim($username);
    if ($username !== '') {
        $st = $conn->prepare("SELECT COUNT(*) FROM Users WHERE LTRIM(RTRIM(username)) = :u AND id <> :x");
        $st->execute([':u' => $username, ':x' => $excludeId]);
        $result['username'] = $st->fetchColumn() > 0;
    }

    $employeeId = normalizeEmployeeId($employeeId);
    if ($employeeId !== '') {
        if (ctype_digit($employeeId)) {
            $st = $conn->prepare("SELECT COUNT(*) FROM Users WHERE id <> :x AND (LTRIM(RTRIM(employee_id)) = :e OR TRY_CAST(LTRIM(RTRIM(employee_id)) AS BIGINT) = :n)");
            $st->execute([':x' => $excludeId, ':e' => $employeeId, ':n' => (int)$employeeId]);
        } else {
            $st = $conn->prepare("SELECT COUNT(*) FROM Users WHERE id <> :x AND LTRIM(RTRIM(employee_id)) = :e");
            $st->execute([':x' => $excludeId, ':e' => $employeeId]);
        }
        $result['employee_id'] = $st->fetchColumn() > 0;
    }

    $firstName = trim($firstName);
    $lastName = trim($lastName);
    if ($firstName !== '' && $lastName !== '') {
        $st = $conn->prepare("SELECT COUNT(*) FROM Users WHERE id <> :x AND LTRIM(RTRIM(first_name)) = :f AND LTRIM(RTRIM(ISNULL(last_name, ''))) = :l");
        $st->execute([':x' => $excludeId, ':f' => $firstName, ':l' => $lastName]);
        $result['name'] = $st->fetchColumn() > 0;
    }

    return $result;
}

// ข้อความแจ้งผู้ใช้ตาม field ที่ซ้ำ (null = ไม่ซ้ำเลย)
function duplicateUserMessage(array $dup): ?string {
    if ($dup['employee_id']) return 'รหัสพนักงานนี้มีบัญชีในระบบแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน"';
    if ($dup['username'])    return 'Username นี้ถูกใช้งานแล้ว ลองเปลี่ยนใหม่นะครับ';
    if ($dup['name'])        return 'ชื่อ-นามสกุลนี้มีบัญชีในระบบแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน" หรือติดต่อแอดมิน';
    return null;
}
