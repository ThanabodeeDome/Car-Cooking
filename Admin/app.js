/**
 * 🧭 1. ระบบสลับหน้าเมนู (Tab Control)
 */
function switchTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".menu-link")
    .forEach((link) => link.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");

  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  }

  if (tabId === "calendar-tab" && typeof renderCalendar === "function") {
    renderCalendar();
  }
  if (tabId === "dashboard-tab" && typeof fetchDashboardStats === "function") {
    fetchDashboardStats();
  }
}

/**
 * ⚡ 2. เริ่มทำงานเมื่อหน้าเว็บโหลดเสร็จ (Initial Load)
 */
document.addEventListener("DOMContentLoaded", () => {
  loadCarsToWorkspaceTable();
  fetchDashboardStats();

  const carForm = document.getElementById("crud-car-form");
  if (carForm) {
    carForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(this);

      // 🔄 มั่นใจว่าได้ส่งข้อมูลรูปภาพแบบ Multipart แน่นอน
      fetch("manage_cars.php?action=save", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.text()) // 🌟 ปรับมาอ่านเป็น Text ก่อน เพื่อตรวจเช็กว่า PHP แอบพ่น Error อะไรหลุดมาไหม
        .then((text) => {
          try {
            const data = JSON.parse(text);
            if (data.success) {
              alert("บันทึกข้อมูลเรียบร้อย!");

              if (typeof clearToInputMode === "function") {
                clearToInputMode();
              } else {
                carForm.reset();
                const carIdInput = document.getElementById("form-car-id");
                if (carIdInput) carIdInput.value = "";
                const modeTitle = document.getElementById("action-mode-title");
                if (modeTitle)
                  modeTitle.innerHTML = `<i class="fa-solid fa-plus" style="color: #00f2fe;"></i> เพิ่มข้อมูลรถยนต์ใหม่`;
              }

              // 🔄 บังคับดึงข้อมูลตารางและแดชบอร์ดใหม่ทันทีหลังบันทึกสำเร็จ
              loadCarsToWorkspaceTable();
              fetchDashboardStats();
            } else {
              alert(
                "เกิดข้อผิดพลาดจากระบบ: " +
                  (data.message || "ไม่สามารถระบุข้อผิดพลาด"),
              );
            }
          } catch (jsonErr) {
            // 💡 ถ้ากระโดดมาตรงนี้ แปลว่า manage_cars.php มีปัญหาส่งข้อความ PHP Error รบกวนโครงสร้าง JSON
            console.error(
              "เซิร์ฟเวอร์ตอบกลับไม่ใช่รูปแบบ JSON ที่ถูกต้อง ตัวหนังสือที่หลุดมาคือ:",
            );
            console.error(text);
            alert(
              "บันทึกส่งข้อมูลแล้ว แต่ระบบหลังบ้านทำงานไม่สมบูรณ์ กรุณาเปิดหน้า Console (กด F12) เพื่อดูข้อผิดพลาดของ PHP",
            );

            // สั่งรีเฟรชข้อมูลเผื่อไว้เผื่อข้อมูลเข้าแต่ PHP พ่นประโยคเตือนธรรมดาออกมา
            loadCarsToWorkspaceTable();
            fetchDashboardStats();
          }
        })
        .catch((err) => {
          console.error("Error saving car:", err);
          alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        });
    });
  }
});

/**
 * 📊 3. ฟังก์ชันดึงรายการรถทั้งหมดมาโชว์ในตารางประวัติด้านล่าง
 */
function loadCarsToWorkspaceTable() {
  fetch("manage_cars.php?action=fetch")
    .then((res) => res.json())
    .then((cars) => {
      const tbody = document.getElementById("crud-car-tbody");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!cars || cars.length === 0 || cars.error) {
        tbody.innerHTML = `<tr><td colspan="7" style="color: #64748b; padding:30px; text-align:center;">❌ ไม่มีข้อมูลรถยนต์ในระบบ</td></tr>`;
        return;
      }

      cars.forEach((car) => {
        let statusPillClass = "pill-empty";
        if (car.CarStatus === "ไม่ว่าง") statusPillClass = "pill-busy";
        if (car.CarStatus === "เช็คระยะ" || car.CarStatus === "ซ่อมบำรุง")
          statusPillClass = "pill-maintenance";

        const tr = document.createElement("tr");
        const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

        // รูปภาพ
        const imgName = car.CarImage ? car.CarImage.trim() : "";
        const imgPath = imgName
          ? `../Car/assets/img-car/${imgName}`
          : `../Car/assets/img-car/car-placeholder.png`;

        // สร้างแถวให้ครบ 7 คอลัมน์ ตามหัวตาราง
        tr.innerHTML = `
          <td><img src="${imgPath}" width="50" height="35" style="border-radius:6px; object-fit:cover;" onerror="this.onerror=null; this.src='../Car/assets/img-car/car-placeholder.png';"></td>
          <td>${car.Plate}</td>
          <td>${car.Brand}</td>
          <td>${car.Model}</td>
          <td>${car.Color}</td>
          <td>${car.Mileage}</td>
          <td>${car.InsuranceExpiry || "-"}</td>
          <td>${car.ActExpiry || "-"}</td>
          <td>${car.LastMaintenance || "-"}</td>
          <td><span class="status-pill ${statusPillClass}">${car.CarStatus || "ว่าง"}</span></td>
          <td>
            <div class="action-buttons-group">
              <button class="op-edit" onclick="fillWorkspaceForm(${carJsonString})">แก้ไข</button>
              <button class="op-del" onclick="deleteCarFromWorkspace(${car.CarID})">ลบ</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((err) => console.error("Error loading cars:", err));
}

/**
 * 📝 4. ฟังก์ชันจัดการฟอร์มเมื่อกดแก้ไข
 */
function fillWorkspaceForm(car) {
  const modeTitle = document.getElementById("action-mode-title");
  if (modeTitle) {
    modeTitle.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #00f2fe;"></i> แก้ไขข้อมูลรถยนต์`;
  }

  if (document.getElementById("form-car-id"))
    document.getElementById("form-car-id").value = car.CarID;
  if (document.getElementById("form-car-plate"))
    document.getElementById("form-car-plate").value = car.Plate;
  if (document.getElementById("form-car-brand"))
    document.getElementById("form-car-brand").value = car.Brand;
  if (document.getElementById("form-car-model"))
    document.getElementById("form-car-model").value = car.Model;
  if (document.getElementById("form-car-color"))
    document.getElementById("form-car-color").value = car.Color || "";
  if (document.getElementById("form-car-mileage"))
    document.getElementById("form-car-mileage").value = car.Mileage || 0;
  if (document.getElementById("form-car-status"))
    document.getElementById("form-car-status").value = car.CarStatus;

  const formElement = document.getElementById("crud-car-form");
  if (formElement) formElement.scrollIntoView({ behavior: "smooth" });
}

// ซูมโค้ดตัวอย่างในฟังก์ชันแก้ไข (Edit) ฝั่ง JavaScript ของนาย
function editCar(carData) {
  // โค้ดเดิมของนายที่มีอยู่แล้ว...
  document.getElementById("CarID").value = carData.CarID;
  document.getElementById("Plate").value = carData.Plate;

  // 🌟 อย่าลืมเพิ่มส่วนนี้เข้าไป เพื่อให้เวลากด "แก้ไข" แล้ววันที่มีค่าเดิมขึ้นมาโชว์ในช่องปฏิทินด้วยครับ
  document.getElementById("InsuranceExpiry").value =
    carData.InsuranceExpiry || "";
  document.getElementById("ActExpiry").value = carData.ActExpiry || "";
  document.getElementById("LastMaintenance").value =
    carData.LastMaintenance || "";
  document.getElementById("NextMaintenance").value =
    carData.NextMaintenance || "";
  document.getElementById("MaintenanceStartDate").value =
    carData.MaintenanceStartDate || "";
  document.getElementById("MaintenanceEndDate").value =
    carData.MaintenanceEndDate || "";
}
/**
 * ❌ 5. ฟังก์ชันลบรถยนต์ออกจากระบบ
 */
function deleteCarFromWorkspace(carId) {
  if (!carId) {
    alert("ไม่พบรหัสรถยนต์ที่จะทำการลบ");
    return;
  }

  if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลรถยนต์คันนี้ออกจากระบบ?")) {
    fetch(`manage_cars.php?action=delete&id=${carId}`, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("ลบข้อมูลรถยนต์เรียบร้อยแล้ว!");
          loadCarsToWorkspaceTable();
          fetchDashboardStats();
        } else {
          alert(
            "ไม่สามารถลบข้อมูลได้: " +
              (data.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"),
          );
        }
      })
      .catch((err) => {
        console.error("Error deleting car:", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์เพื่อลบข้อมูล");
      });
  }
}

/**
 * 📊 6. ฟังก์ชันดึงสถิติ Dashboard และเรนเดอร์ Card รถยนต์ภายนอก
 */
function fetchDashboardStats() {
  fetch("get_dashboard_stats.php")
    .then((response) => response.json())
    .then((data) => {
      console.log("Data from PHP:", data);

      if (data.error) {
        console.error("PHP Error:", data.error);
        return;
      }

      if (document.getElementById("available-cars"))
        document.getElementById("available-cars").innerText =
          (data.available || 0) + " คัน";
      if (document.getElementById("busy-cars"))
        document.getElementById("busy-cars").innerText =
          (data.busy || 0) + " คัน";
      if (document.getElementById("maintenance-cars"))
        document.getElementById("maintenance-cars").innerText =
          (data.maintenance || 0) + " คัน";
      if (document.getElementById("today-bookings"))
        document.getElementById("today-bookings").innerText =
          (data.today || 0) + " รายการ";

      const cardContainer = document.querySelector(".cars-card-grid");
      if (!cardContainer) return;
      cardContainer.innerHTML = "";

      const carList = Array.isArray(data.cars) ? data.cars : [];
      if (carList.length === 0) {
        cardContainer.innerHTML = `<div class='no-data-msg' style='color:#fff; text-align:center; width:100%; padding:20px;'>❌ ยังไม่มีข้อมูลรถยนต์ในระบบในขณะนี้</div>`;
        return;
      }

      carList.forEach((car) => {
        const statusClass =
          car.CarStatus === "ว่าง" ? "pill-empty" : "pill-busy";

        const imgName = car.CarImage ? car.CarImage.trim() : "";
        const imgPath = imgName
          ? `../Car/assets/img-car/${imgName}`
          : `../Car/assets/img-car/car-placeholder.png`;

        const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

        const cardHTML = `
        <div class="car-item-card">
          <div class="car-card-image-wrapper" style="position:relative;">
            <img src="${imgPath}" alt="Car Image" class="car-thumbnail" style="width:100%; height:180px; object-fit:cover; border-radius:8px;" onerror="this.onerror=null; this.src='../Car/assets/img-car/car-placeholder.png';">
            <span class="status-pill ${statusClass}" style="position:absolute; top:10px; right:10px; padding:4px 8px; border-radius:4px; font-size:12px; color:#fff; background:${car.CarStatus === "ว่าง" ? "#2ecc71" : "#e74c3c"};">${car.CarStatus || "ว่าง"}</span>
          </div>
          <div class="car-card-body" style="padding:15px; color:#fff;">
            <div class="car-main-title" style="font-size:18px; font-weight:bold; margin-bottom:5px;">
              <span class="car-brand">${car.Brand || "-"}</span>
              <span class="car-sub-model">${car.Model || "-"}</span>
            </div>
            <div class="car-plate-badge" style="background:#34495e; padding:2px 6px; border-radius:4px; display:inline-block; font-size:14px; margin-bottom:10px;">${car.Plate || "-"}</div>
            <hr class="car-card-divider" style="border:0; border-top:1px solid #555; margin:10px 0;">
            <div class="car-details-spec" style="font-size:14px;">
              <div class="spec-row" style="margin-bottom:5px;">
                <span class="spec-label">🎨 สีตัวถัง:</span>
                <span class="spec-value">${car.Color || "-"}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">📟 เลขไมล์ล่าสุด:</span>
                <span class="spec-value">${Number(car.Mileage || 0).toLocaleString()} กม.</span>
              </div>
            </div>
          </div>
          <div class="car-card-actions" style="padding:10px 15px; display:flex; gap:10px;">
            <button class="op-edit" onclick="fillWorkspaceForm(${carJsonString})" style="flex:1; background:#3498db; color:#fff; border:none; padding:6px; border-radius:4px; cursor:pointer;">แก้ไข</button>
            <button class="op-del" onclick="deleteCarFromWorkspace(${car.CarID})" style="flex:1; background:#e74c3c; color:#fff; border:none; padding:6px; border-radius:4px; cursor:pointer;">ลบ</button>
          </div>
        </div>
        `;
        cardContainer.innerHTML += cardHTML;
      });
    })
    .catch((err) => console.error("เกิดข้อผิดพลาดในการโหลดระบบคาร์:", err));
}
