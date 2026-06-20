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

  // โหลดปฏิทินและสถิติต่างๆ เมื่อเปิดแท็บปฏิทินหรือหน้าหลัก
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
  // โหลดข้อมูลเข้าสู่ตารางทำงานและแดชบอร์ดทันทีเมื่อเปิดหน้าเว็บ
  loadCarsToWorkspaceTable();
  fetchDashboardStats();

  // ตัวดักเหตุการณ์กดบันทึกฟอร์มแนวตั้ง (Handle ทั้ง เพิ่ม และ แก้ไข)
  const carForm = document.getElementById("crud-car-form");
  if (carForm) {
    carForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(this);

      fetch("manage_cars.php?action=save", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            alert("บันทึกข้อมูลเรียบร้อย!");
            clearToInputMode(); // รีเซ็ตฟอร์มกลับเป็นโหมดเพิ่มรถใหม่
            loadCarsToWorkspaceTable(); // อัปเดตตารางด้านล่างทันทีโดยไม่ต้องรีเฟรชหน้า
            fetchDashboardStats(); // อัปเดตตัวเลข Dashboard และ Card รถยนต์ทันที
          } else {
            alert(
              "เกิดข้อผิดพลาด: " + (data.message || "ไม่สามารถระบุข้อผิดพลาด"),
            );
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
 * 📊 3. ฟังก์ชันดึงรายการรถทั้งหมดมาโชว์ในตารางประวัติด้านล่าง (ปรับตาม SQL Server)
 */
function loadCarsToWorkspaceTable() {
  fetch("manage_cars.php?action=fetch")
    .then((res) => res.json())
    .then((cars) => {
      const tbody = document.getElementById("crud-car-tbody");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!cars || cars.length === 0 || cars.error) {
        tbody.innerHTML = `<tr><td colspan="8" style="color: #64748b; padding:30px;">❌ ไม่มีข้อมูลหรือเกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`;
        return;
      }

      cars.forEach((car) => {
        // เปลี่ยนมาใช้ตัวพิมพ์ใหญ่ตามโครงสร้างตารางของนายเป๊ะๆ
        let statusPillClass = "pill-empty";
        if (car.CarStatus === "ไม่ว่าง") statusPillClass = "pill-busy";
        if (car.CarStatus === "เช็คระยะ" || car.CarStatus === "ซ่อมบำรุง")
          statusPillClass = "pill-maintenance";

        const tr = document.createElement("tr");
        const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

        // แมตช์ตัวแปรตามพิมพ์ใหญ่-เล็กใน SQL Server (CarImage, Plate, Brand, Model, Color, Mileage, CarStatus)
        tr.innerHTML = `
          <td><img src="../Car/assets/img-car/${car.CarImage || "car-placeholder.png"}" width="50" height="35" style="border-radius:6px; object-fit:cover;"></td>
          <td><strong>${car.Plate || "-"}</strong></td>
          <td>${car.Brand || "-"}</td>
          <td>${car.Model || "-"}</td>
          <td>${car.Color || "-"}</td>
          <td>${Number(car.Mileage || 0).toLocaleString()}</td>
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
  document.getElementById("action-mode-title").innerHTML =
    `<i class="fa-solid fa-pen-to-square" style="color: #00f2fe;"></i> แก้ไขข้อมูลรถยนต์`;

  // ดึงค่าด้วยคีย์ตัวพิมพ์ใหญ่ตาม SQL Server
  document.getElementById("form-car-id").value = car.CarID;
  document.getElementById("form-car-plate").value = car.Plate;
  document.getElementById("form-car-brand").value = car.Brand;
  document.getElementById("form-car-model").value = car.Model;
  document.getElementById("form-car-color").value = car.Color || "";
  document.getElementById("form-car-mileage").value = car.Mileage || 0;
  document.getElementById("form-car-status").value = car.CarStatus;

  document
    .getElementById("crud-car-form")
    .scrollIntoView({ behavior: "smooth" });
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

        // ตรวจสอบพาร์ทรูปภาพผ่านตัวแปรคีย์ใหญ่ CarImage
        const imgPath = car.CarImage
          ? `../Car/assets/img-car/${car.CarImage}`
          : `../Car/assets/image/car-placeholder.png`;

        const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

        const cardHTML = `
        <div class="car-item-card">
          <div class="car-card-image-wrapper" style="position:relative;">
            <img src="${imgPath}" alt="Car Image" class="car-thumbnail" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">
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
