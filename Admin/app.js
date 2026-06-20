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
 * 📊 3. ฟังก์ชันดึงรายการรถทั้งหมดมาโชว์ในตารางประวัติด้านล่าง
 */
function loadCarsToWorkspaceTable() {
  fetch("manage_cars.php?action=fetch")
    .then((res) => res.json())
    .then((cars) => {
      const tbody = document.getElementById("crud-car-tbody");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!cars || cars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="color: #64748b; padding:30px;">❌ ไม่มีข้อมูลรถยนต์ในระบบตอนนี้</td></tr>`;
        return;
      }

      cars.forEach((car) => {
        // 🛠️ จุดที่ 1: ฝั่ง PHP ส่งตัวพิมพ์เล็กกลับมา (id, status, image...) ต้องปรับให้สัมพันธ์กันครับนาย
        let statusPillClass = "pill-empty";
        if (car.status === "ไม่ว่าง") statusPillClass = "pill-busy";
        if (car.status === "เช็คระยะ" || car.status === "ซ่อมบำรุง")
          statusPillClass = "pill-maintenance";

        const tr = document.createElement("tr");

        // แปลงข้อมูล Object เป็น String ที่ปลอดภัยเพื่อใช้ส่งข้ามไปฟังก์ชันแก้ไข
        const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

        tr.innerHTML = `
          <td><img src="../Car/assets/img-car/${car.image || "car-placeholder.png"}" width="50" height="35" style="border-radius:6px; object-fit:cover;"></td>
          <td><strong>${car.plate}</strong></td>
          <td>${car.brand}</td>
          <td>${car.model}</td>
          <td>${car.color || "-"}</td>
          <td>${Number(car.mileage || 0).toLocaleString()}</td>
          <td><span class="status-pill ${statusPillClass}">${car.status}</span></td>
          <td>
            <div class="action-buttons-group">
              <button class="op-edit" onclick="fillWorkspaceForm(${carJsonString})">แก้ไข</button>
              <button class="op-del" onclick="deleteCarFromWorkspace(${car.id})">ลบ</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((err) => console.error("Error loading cars:", err));
}

/**
 * 📝 4. ฟังก์ชันจัดการฟอร์ม (แก้ไขข้อมูล / ล้างฟอร์ม)
 */

// เมื่อกดแก้ไขจากตาราง: ดันข้อมูลแถวนั้นกลับขึ้นไปที่ฟอร์มด้านบนเพื่อเตรียมอัปเดต
function fillWorkspaceForm(car) {
  document.getElementById("action-mode-title").innerHTML =
    `<i class="fa-solid fa-pen-to-square" style="color: #00f2fe;"></i> แก้ไขข้อมูลรถยนต์`;

  // 🛠️ จุดที่ 2: แมตช์ตัวแปรพิมพ์เล็กจาก JSON เข้าช่อง Input ฟอร์มของนายให้ถูกต้อง
  document.getElementById("form-car-id").value = car.id;
  document.getElementById("form-car-plate").value = car.plate;
  document.getElementById("form-car-brand").value = car.brand;
  document.getElementById("form-car-model").value = car.model;
  document.getElementById("form-car-color").value = car.color || "";
  document.getElementById("form-car-mileage").value = car.mileage || 0;
  document.getElementById("form-car-status").value = car.status;

  // สโครลนุ่ม ๆ กลับขึ้นไปโฟกัสที่ฟอร์มด้านบนเพื่ออำนวยความสะดวกให้ผู้ใช้
  document
    .getElementById("crud-car-form")
    .scrollIntoView({ behavior: "smooth" });
}

// ล้างข้อมูลฟอร์ม: เปลี่ยนชื่อหัวข้อกลับเป็นโหมดเพิ่มรถใหม่ตามเดิม
function clearToInputMode() {
  const form = document.getElementById("crud-car-form");
  if (form) form.reset();

  const carIdInput = document.getElementById("form-car-id");
  if (carIdInput) carIdInput.value = "";

  document.getElementById("action-mode-title").innerHTML =
    `<i class="fa-solid fa-square-plus" style="color: #00f2fe;"></i> เพิ่มข้อมูลรถยนต์ใหม่`;
}

/**
 * 🗑️ 5. ฟังก์ชันลบข้อมูลรถยนต์ออกจากระบบ
 */
function deleteCarFromWorkspace(carId) {
  if (
    confirm(
      "คุณยืนยันต้องการลบข้อมูลรถคันนี้ออกจากระบบใช่หรือไม่? ประวัติทั้งหมดจะถูกลบถาวร",
    )
  ) {
    fetch(`manage_cars.php?action=delete&id=${carId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert("ลบข้อมูลสำเร็จ!");
          loadCarsToWorkspaceTable(); // รีโหลดตารางใหม่ทันที
          clearToInputMode(); // ป้องกันกรณีผู้ใช้กดค้างคาฟอร์มแก้ไขอยู่
          fetchDashboardStats(); // อัปเดตตัวเลขหน้าหลักและ Card
        } else {
          alert("ลบไม่สำเร็จ: " + data.message);
        }
      })
      .catch((err) => {
        console.error("Error deleting car:", err);
        alert("เกิดข้อผิดพลาดในการส่งคำสั่งลบ");
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

      // ── 1. อัปเดตตัวเลข Dashboard ──
      if (document.getElementById("available-cars")) {
        document.getElementById("available-cars").innerText =
          data.available + " คัน";
      }
      if (document.getElementById("busy-cars")) {
        document.getElementById("busy-cars").innerText = data.busy + " คัน";
      }
      if (document.getElementById("maintenance-cars")) {
        document.getElementById("maintenance-cars").innerText =
          data.maintenance + " คัน";
      }
      if (document.getElementById("today-bookings")) {
        document.getElementById("today-bookings").innerText =
          data.today + " รายการ";
      }

      // ── 2. ดึงกล่องเพื่อพ่นการ์ดรถยนต์ ──
      const cardContainer = document.querySelector(".cars-card-grid");
      if (!cardContainer) return;

      cardContainer.innerHTML = "";

      if (!data.cars || data.cars.length === 0) {
        cardContainer.innerHTML = `<div class='no-data-msg' style='color:#fff; text-align:center; width:100%; padding:20px;'>❌ ยังไม่มีข้อมูลรถยนต์ในระบบในขณะนี้</div>`;
        return;
      }

      // 🛠️ จุดที่ 3: ตรวจเช็กตัวแปรลูป (สยบ Error: forEach is not a function โดยบังคับดึงค่าอาเรย์จากคีย์ดักไว้มั่นคง)
      const carList = Array.isArray(data.cars) ? data.cars : [];

      carList.forEach((car) => {
        // เช็กสถานะเพื่อเปลี่ยนสีป้ายไฟ
        const statusClass = car.status === "ว่าง" ? "pill-empty" : "pill-busy";

        // กำหนดพาร์ทเข้าโฟลเดอร์ภาพที่ถูกต้องและตรงชื่อตัวแปรพิมพ์เล็ก (carImage)
        const carImage = car.image
          ? `../Car/assets/img-car/${car.image}`
          : "../Car/assets/image/car-placeholder.png";

        const cardHTML = `
        <div class="car-item-card">
          <div class="car-card-image-wrapper">
            <img src="${carImage}" alt="Car Image" class="car-thumbnail" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">
            <span class="status-pill ${statusClass}" style="position:absolute; top:10px; right:10px; padding:4px 8px; border-radius:4px; font-size:12px; color:#fff; background:${car.status === "ว่าง" ? "#2ecc71" : "#e74c3c"};">${car.status}</span>
          </div>
          <div class="car-card-body" style="padding:15px; color:#fff;">
            <div class="car-main-title" style="font-size:18px; font-weight:bold; margin-bottom:5px;">
              <span class="car-brand">${car.brand}</span>
              <span class="car-sub-model">${car.model}</span>
            </div>
            <div class="car-plate-badge" style="background:#34495e; padding:2px 6px; border-radius:4px; display:inline-block; font-size:14px; margin-bottom:10px;">${car.plate}</div>
            <hr class="car-card-divider" style="border:0; border-top:1px solid #555; margin:10px 0;">
            <div class="car-details-spec" style="font-size:14px;">
              <div class="spec-row" style="margin-bottom:5px;">
                <span class="spec-label">🎨 สีตัวถัง:</span>
                <span class="spec-value">${car.color}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">📟 เลขไมล์ล่าสุด:</span>
                <span class="spec-value">${Number(car.mileage).toLocaleString()} กม.</span>
              </div>
            </div>
          </div>
          <div class="car-card-actions" style="padding:10px 15px; display:flex; gap:10px;">
            <button class="op-edit" onclick="editCar(${car.id})" style="flex:1; background:#3498db; color:#fff; border:none; padding:6px; border-radius:4px; cursor:pointer;">แก้ไข</button>
            <button class="op-del" onclick="deleteCar(${car.id})" style="flex:1; background:#e74c3c; color:#fff; border:none; padding:6px; border-radius:4px; cursor:pointer;">ลบ</button>
          </div>
        </div>
    `;
        cardContainer.innerHTML += cardHTML;
      });
    })
    .catch((err) => {
      console.error("เกิดข้อผิดพลาดในการโหลดระบบคาร์:", err);
    });
}
