<?php

header("Content-Type: application/json");

// เรียกไฟล์ต่อ Database ของมึง (เปลี่ยนชื่อไฟล์ให้ตรงกับโปรแกรมหลักนะเพื่อน)

include_once "../db_connect.php";



$action = $_GET['action'] ?? '';



// 1. ดึงข้อมูลรถยนต์ไปโชว์ที่หน้าเว็บ

if ($action === 'fetch') {

    try {

        // ดึงคอลัมน์ตามหัวตารางในรูป database ของมึงเลย

        $stmt = $conn->prepare("SELECT CarID, Plate, Brand, Model, Color, Mileage, CarImage, CarStatus FROM Cars ORDER BY CarID DESC");

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



// 3. บันทึกข้อมูล (ทั้งกรณี Insert เพิ่มใหม่ และ Update ตัวเก่า)

if ($action === 'save') {

    $carID      = $_POST['CarID'] ?? '';

    $plate      = $_POST['Plate'] ?? '';

    $brand      = $_POST['Brand'] ?? '';

    $model      = $_POST['Model'] ?? '';

    $color      = $_POST['Color'] ?? '';

    $mileage    = $_POST['Mileage'] ?? 0;

    $carStatus  = $_POST['CarStatus'] ?? 'ว่าง';

   

    // จัดการอัปโหลดไฟล์รูปภาพ (ถ้ามีเลือกไฟล์ใหม่เข้ามา)

    $imageName = null;

    if (isset($_FILES['CarImage']) && $_FILES['CarImage']['error'] === UPLOAD_ERR_OK) {

        $ext = pathinfo($_FILES['CarImage']['name'], PATHINFO_EXTENSION);

        $imageName = $plate . "." . $ext; // ตั้งชื่อรูปตามทะเบียนเพื่อความง่าย เช่น กฉ 9393.jpg

        $uploadDir = "../assets/image/";

        move_uploaded_file($_FILES['CarImage']['tmp_name'], $uploadDir . $imageName);

    }



    try {

        if (empty($carID)) {

            // กรณีไม่มีไอดี = เพิ่มข้อมูลใหม่ (Insert)

            $sql = "INSERT INTO Cars (Plate, Brand, Model, Color, Mileage, CarStatus, CarImage) VALUES (?, ?, ?, ?, ?, ?, ?)";

            $stmt = $conn->prepare($sql);

            $stmt->execute([$plate, $brand, $model, $color, $mileage, $carStatus, $imageName]);

        } else {

            // กรณีมีไอดีอยู่แล้ว = อัปเดตข้อมูลเดิม (Update)

            if ($imageName) {

                // ถ้าแก้ไขและเปลี่ยนรูปใหม่ด้วย

                $sql = "UPDATE Cars SET Plate=?, Brand=?, Model=?, Color=?, Mileage=?, CarStatus=?, CarImage=? WHERE CarID=?";

                $params = [$plate, $brand, $model, $color, $mileage, $carStatus, $imageName, $carID];

            } else {

                // ถ้าแก้ไขแต่ใช้รูปเดิม

                $sql = "UPDATE Cars SET Plate=?, Brand=?, Model=?, Color=?, Mileage=?, CarStatus=? WHERE CarID=?";

                $params = [$plate, $brand, $model, $color, $mileage, $carStatus, $carID];

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