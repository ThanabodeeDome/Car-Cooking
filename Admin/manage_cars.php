<?php
header("Content-Type: application/json");
include_once "../db_connect.php";

$action = $_GET['action'] ?? '';

// 1. ดึงข้อมูลรถยนต์ไปโชว์ที่หน้าเว็บ (Fetch ครบทุกคอลัมน์)
if ($action === 'fetch') {
    try {
        $sql = "SELECT CarID, Plate, Brand, Model, Color, Mileage, CarImage, CarStatus, 
                       InsuranceExpiry, ActExpiry, LastMaintenance, NextMaintenance, 
                       MaintenanceStartDate, MaintenanceEndDate 
                FROM Cars ORDER BY CarID DESC";
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
    $id = $_GET['id'] ?? 0;
    try {
        $stmt = $conn->prepare("DELETE FROM Cars WHERE CarID = ?");
        $stmt->execute([$id]);
        echo json_encode(["success" => true]);
    } catch (PDOException $e) {
        echo json_encode(["success" => false, "message" => $e->getMessage()]);
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
    $carStatus  = $_POST['CarStatus'] ?? 'ว่าง';
    
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
        $ext = pathinfo($_FILES['CarImage']['name'], PATHINFO_EXTENSION);
        $imageName = "car_" . time() . "." . $ext; 
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
        echo json_encode(["success" => false, "message" => $e->getMessage()]);
    }
    exit;
}