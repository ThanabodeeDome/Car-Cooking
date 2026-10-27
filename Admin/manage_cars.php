<?php
require_once __DIR__ . '/../session_policy.php';
cb_session_start();
header("Content-Type: application/json; charset=utf-8");
include_once "../db_connect.php";

// 🌟 ไฟล์นี้ไม่มี auth check เลยมาก่อน! ใครก็ยิง action=delete/save ได้โดยไม่ต้อง login
require_once __DIR__ . '/../require_admin.php';
require_once __DIR__ . '/../db_error_text.php'; // แปล error ฐานข้อมูลให้คนอ่านรู้เรื่อง
requireAdminAccess();

$action = $_GET['action'] ?? '';

// 1. ดึงข้อมูลรถยนต์ไปโชว์ที่หน้าเว็บ (Fetch ครบทุกคอลัมน์)
if ($action === 'fetch') {
    try {
        $sql = "SELECT c.CarID, c.Plate, c.Brand, c.Model, c.Color, c.Mileage, c.CarImage, c.CarStatus, 
                       c.InsuranceExpiry, c.ActExpiry, c.LastMaintenance, c.NextMaintenance, 
                       c.MaintenanceStartDate, c.MaintenanceEndDate,
                       (SELECT TOP 1
                          CASE WHEN m.EndDate IS NULL
                               THEN CONVERT(varchar, m.StartDate, 23) + N' (กำลังซ่อม)'
                               ELSE CONVERT(varchar, m.StartDate, 23)
                          END
                        FROM MaintenanceHistory m
                        WHERE m.CarID = c.CarID
                        ORDER BY m.StartDate DESC) AS LastMaintenanceLog
                FROM Cars c ORDER BY c.CarID DESC";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($result);
    } catch (PDOException $e) {
        echo json_encode([]);
    }
    exit;
}

// 2. ลบข้อมูลรถยนต์
if ($action === 'delete') {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        echo json_encode(["success" => false, "message" => "ต้องใช้ POST"]);
        exit;
    }
    $id = (int)($_GET['id'] ?? 0);
    try {
        $stmt = $conn->prepare("DELETE FROM Cars WHERE CarID = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_cars delete DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => cb_db_error_message($e, "เกิดข้อผิดพลาด ไม่สามารถลบข้อมูลรถได้")]);
    }
    exit;
}

// 2.5 แอดมินยืนยัน "รถพร้อมใช้" หลังเช็คระยะ/ซ่อมเสร็จ -> เปิดให้จองได้ปกติ
if ($action === 'confirm_ready') {
    $carId = (int)($_POST['CarID'] ?? 0);
    if ($carId <= 0) {
        echo json_encode(["success" => false, "message" => "ไม่พบรถ"]);
        exit;
    }
    try {
        $stmt = $conn->prepare("UPDATE Cars SET CarStatus = N'ว่าง', LastMaintenance = CAST(GETDATE() AS DATE), MaintenanceStartDate = NULL, MaintenanceEndDate = NULL WHERE CarID = ? AND CarStatus = N'เช็คระยะ'");
        $stmt->execute([$carId]);
        if ($stmt->rowCount() === 0) {
            echo json_encode(["success" => false, "message" => "รถคันนี้ไม่ได้อยู่ในสถานะเช็คระยะ/ซ่อม (อาจยืนยันไปแล้ว)"]);
            exit;
        }
        $pl = $conn->prepare("SELECT Plate FROM Cars WHERE CarID = ?");
        $pl->execute([$carId]);
        require_once __DIR__ . '/../Car/log_lib.php';
        sl_log($conn, 'car_ready', 'แอดมินยืนยันรถพร้อมใช้ ' . (string)$pl->fetchColumn(), ['target_type' => 'car', 'target' => (string)$carId]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_cars confirm_ready: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => "ทำรายการไม่สำเร็จ"]);
    }
    exit;
}

// 3. บันทึกข้อมูล (Insert / Update ครบทุกฟิลด์วันที่)
if ($action === 'save') {
    $carID      = $_POST['CarID'] ?? '';
    $plate      = $_POST['Plate'] ?? '';
    $brand      = $_POST['Brand'] ?? '';
    $model      = $_POST['Model'] ?? '';
    $color      = $_POST['Color'] ?? '';
    $mileage    = $_POST['Mileage'] ?? 0;
    // 🌟 CarStatus จาก admin ตอนนี้มีความหมายแค่ 2 ค่า:
    //   'ว่าง'     = ปกติ ให้ระบบคำนวณ ว่าง/ไม่ว่าง เองจากตาราง CarBookings
    //   'เช็คระยะ' = แอดมิน override ปิดใช้งานรถคันนี้ (งดให้บริการ) ไม่ว่า booking จะว่างหรือไม่
    $carStatus  = $_POST['CarStatus'] ?? 'ว่าง';

    // ตรวจข้อมูลพื้นฐานก่อนบันทึก
    $plate = trim($plate);
    if ($plate === '') {
        echo json_encode(["success" => false, "message" => "กรุณากรอกทะเบียนรถ"]);
        exit;
    }
    if (!is_numeric($mileage) || $mileage < 0) {
        echo json_encode(["success" => false, "message" => "เลขไมล์ต้องเป็นตัวเลขไม่ติดลบ"]);
        exit;
    }
    if (!in_array($carStatus, ['ว่าง', 'เช็คระยะ'], true)) {
        $carStatus = 'ว่าง';
    }
    // วันที่คาดว่าเสร็จ ใช้เฉพาะสถานะ เช็คระยะ/ซ่อม (ถ้ากลับเป็น ว่าง ล้างทิ้ง)
    foreach (['MaintenanceStartDate', 'MaintenanceEndDate'] as $k) {
        if (!empty($_POST[$k]) && !preg_match('/^d{4}-d{2}-d{2}$/', $_POST[$k])) {
            echo json_encode(["success" => false, "message" => "รูปแบบวันที่เช็คระยะ/ซ่อมไม่ถูกต้อง"]);
            exit;
        }
    }
    if ($carStatus !== 'เช็คระยะ') {
        $_POST['MaintenanceStartDate'] = '';
        $_POST['MaintenanceEndDate'] = '';
    } elseif (!empty($_POST['MaintenanceStartDate']) && !empty($_POST['MaintenanceEndDate']) && $_POST['MaintenanceEndDate'] < $_POST['MaintenanceStartDate']) {
        echo json_encode(["success" => false, "message" => "วันที่คาดว่าเสร็จต้องไม่ก่อนวันเริ่ม"]);
        exit;
    }
    try { // ทะเบียนซ้ำกับรถคันอื่น
        $dup = $conn->prepare("SELECT COUNT(*) FROM Cars WHERE REPLACE(Plate, ' ', '') = REPLACE(?, ' ', '') AND CarID <> ?");
        $dup->execute([$plate, (int)$carID]);
        if ($dup->fetchColumn() > 0) {
            echo json_encode(["success" => false, "message" => "ทะเบียนนี้มีอยู่ในระบบแล้ว"]);
            exit;
        }
    } catch (PDOException $e) {
        error_log('manage_cars dup check: ' . $e->getMessage());
    }
    
    // 🌟 รับค่าข้อมูลวันที่ทั้ง 6 ช่องจากฟอร์มหน้าเว็บ (หากไม่มีการกรอก ให้บันทึกเป็น null)
    $insuranceExpiry = !empty($_POST['InsuranceExpiry']) ? $_POST['InsuranceExpiry'] : null;
    $actExpiry       = !empty($_POST['ActExpiry'])       ? $_POST['ActExpiry'] : null;
    $lastMaintenance = !empty($_POST['LastMaintenance']) ? $_POST['LastMaintenance'] : null;
    $nextMaintenance = !empty($_POST['NextMaintenance']) ? $_POST['NextMaintenance'] : null;
    $startDate       = !empty($_POST['MaintenanceStartDate']) ? $_POST['MaintenanceStartDate'] : null;
    $endDate         = !empty($_POST['MaintenanceEndDate'])   ? $_POST['MaintenanceEndDate'] : null;
   
    // จัดการอัปโหลดไฟล์รูปภาพ
    $imageName = null;
    if (isset($_FILES['CarImage']) && $_FILES['CarImage']['error'] === UPLOAD_ERR_OK) {
        // 🔒 รับเฉพาะไฟล์รูปจริง (เดิมรับนามสกุลอะไรก็ได้ = อัปโหลด .php ขึ้นเซิร์ฟเวอร์ได้)
        $ext = strtolower(pathinfo($_FILES['CarImage']['name'], PATHINFO_EXTENSION));
        $info = @getimagesize($_FILES['CarImage']['tmp_name']);
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true) || $info === false || $_FILES['CarImage']['size'] > 5 * 1024 * 1024) {
            echo json_encode(["success" => false, "message" => "รูปรถต้องเป็นไฟล์ jpg/png/webp/gif ขนาดไม่เกิน 5MB"]);
            exit;
        }
        $imageName = "car_" . time() . "_" . bin2hex(random_bytes(3)) . "." . $ext; 
        $upload_path = "../Car/assets/img-car/" . $imageName; 

        if (!move_uploaded_file($_FILES['CarImage']['tmp_name'], $upload_path)) {
            echo json_encode(["success" => false, "message" => "ไม่สามารถย้ายไฟล์รูปภาพได้"]);
            exit;
        }
    }

    try {
        if (empty($carID)) {
            // 🌟 กรณีเพิ่มข้อมูลใหม่ (Insert ครบทุกฟิลด์)
            $sql = "INSERT INTO Cars (Plate, Brand, Model, Color, Mileage, CarStatus, CarImage, 
                                      InsuranceExpiry, ActExpiry, LastMaintenance, NextMaintenance, 
                                      MaintenanceStartDate, MaintenanceEndDate) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                $plate, $brand, $model, $color, $mileage, $carStatus, $imageName, 
                $insuranceExpiry, $actExpiry, $lastMaintenance, $nextMaintenance, 
                $startDate, $endDate
            ]);
        } else {
            // 🌟 กรณีแก้ไขข้อมูลเดิม (Update ครบทุกฟิลด์)
            if ($imageName) {
                // ถ้ามีการอัปโหลดเปลี่ยนรูปใหม่ด้วย
                $sql = "UPDATE Cars SET Plate=?, Brand=?, Model=?, Color=?, Mileage=?, CarStatus=?, CarImage=?, 
                                        InsuranceExpiry=?, ActExpiry=?, LastMaintenance=?, NextMaintenance=?, 
                                        MaintenanceStartDate=?, MaintenanceEndDate=? 
                        WHERE CarID=?";
                $params = [
                    $plate, $brand, $model, $color, $mileage, $carStatus, $imageName, 
                    $insuranceExpiry, $actExpiry, $lastMaintenance, $nextMaintenance, 
                    $startDate, $endDate, $carID
                ];
            } else {
                // ถ้าใช้รูปเดิม
                $sql = "UPDATE Cars SET Plate=?, Brand=?, Model=?, Color=?, Mileage=?, CarStatus=?, 
                                        InsuranceExpiry=?, ActExpiry=?, LastMaintenance=?, NextMaintenance=?, 
                                        MaintenanceStartDate=?, MaintenanceEndDate=? 
                        WHERE CarID=?";
                $params = [
                    $plate, $brand, $model, $color, $mileage, $carStatus, 
                    $insuranceExpiry, $actExpiry, $lastMaintenance, $nextMaintenance, 
                    $startDate, $endDate, $carID
                ];
            }
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
        }
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        error_log('manage_cars save DB error: ' . $e->getMessage());
        echo json_encode(["success" => false, "message" => cb_db_error_message($e, "เกิดข้อผิดพลาด ไม่สามารถบันทึกข้อมูลรถได้")]);
    }
    exit;
}