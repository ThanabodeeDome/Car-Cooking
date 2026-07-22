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
  if (tabId === "bookings-tab") {
    loadAdminBookings();
  }
}

/**
 * ⚡ 2. เริ่มทำงานเมื่อหน้าเว็บโหลดเสร็จ (Initial Load)
 */
document.addEventListener("DOMContentLoaded", () => {
  // โหลดข้อมูลตารางจัดการรถยนต์
  loadCarsToWorkspaceTable();
  fetchDashboardStats();

  // 🛠️ เช็คและสั่งดึงข้อมูลสถิติจากไฟล์ dashboard.js ทันทีเมื่อเปิดหน้าแรก
  if (typeof window.fetchDashboardStats === "function") {
    window.fetchDashboardStats();
  } else if (typeof fetchDashboardStats === "function") {
    fetchDashboardStats();
  }

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
  if (document.getElementById("form-car-status")) {
    // dropdown ใหม่มีแค่ "ว่าง" กับ "งดให้บริการ" (admin คุมเอง)
    // ส่วน "ไม่ว่าง" มาจาก booking ล้วนๆ ไม่ใช่ค่าที่ admin ตั้ง เลยไม่มีใน dropdown แล้ว
    let statusToShow = car.CarStatus;
    if (statusToShow === "ไม่ว่าง") {
      statusToShow = "ว่าง"; // ค่าที่ admin ตั้งไว้จริงคือว่าง แค่ตอนนี้มีคนจองอยู่
    } else if (statusToShow === "เช็คระยะ" || statusToShow === "ซ่อมบำรุง") {
      statusToShow = "งดให้บริการ"; // ค่าเก่ารวมเป็นค่าใหม่ตัวเดียว
    }
    document.getElementById("form-car-status").value = statusToShow;
  }

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
 * 🧹 ฟังก์ชันสำหรับล้างข้อมูลในฟอร์มทั้งหมดและกลับสู่โหมดเพิ่มข้อมูลใหม่
 */
function clearToInputMode() {
  const carForm = document.getElementById("crud-car-form");
  if (carForm) {
    carForm.reset(); // ล้างช่องกรอกข้อความทั่วไป
  }

  // 1. ล้าง ID ซ่อน (เพื่อไม่ให้ระบบจำว่าเป็นโหมดแก้ไข)
  const carIdInput = document.getElementById("form-car-id");
  if (carIdInput) carIdInput.value = "";

  // 2. ล้างช่องที่เป็นประเภท Date (ปฏิทิน) ทั้งหมดให้กลับเป็นว่างเปล่า (mm/dd/yyyy)
  const dateInputs = document.querySelectorAll(
    "#crud-car-form input[type='date']",
  );
  dateInputs.forEach((input) => (input.value = ""));

  // 3. รีเซ็ตสถานะตัวเลือกกลับไปที่ค่าแรก ("ว่าง")
  const statusSelect = document.getElementById("form-car-status");
  if (statusSelect) statusSelect.selectedIndex = 0;

  // 4. เปลี่ยนหัวข้อฟอร์มกลับมาเป็นโหมดเพิ่มรถใหม่
  const modeTitle = document.getElementById("action-mode-title");
  if (modeTitle) {
    modeTitle.innerHTML = `<i class="fa-solid fa-square-plus" style="color: #00f2fe"></i> เพิ่มข้อมูลรถยนต์ใหม่`;
  }
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

function loadAdminBookings() {
  const tbody = document.getElementById("admin-bookings-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">กำลังโหลด...</td></tr>`;

  fetch("admin_get_bookings.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">${data.message}</td></tr>`;
        return;
      }

      if (!data.bookings || data.bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">ไม่มีรายการจอง</td></tr>`;
        return;
      }

      tbody.innerHTML = data.bookings
        .map((bk) => {
          const canCancel = bk.BookingStatus === "ขาไป";
          // ใช้ badge ชุดเดียวกับ homepage.js/.css (.status-badge + .status-xxx)
          // map ให้ตรงกับตรรกะเดียวกับหน้า user: ขากลับ = คืนแล้ว(purple), ไม่ใช่ inuse
          let statusClass = "status-booked"; // default: "ขาไป" ยังไม่เช็คอิน = ติดจอง
          if (bk.BookingStatus === "ขากลับ") statusClass = "status-returned";
          else if (bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก"))
            statusClass = "status-cancelled";
          else if (bk.CheckInTime) statusClass = "status-inuse"; // เช็คอินแล้ว = กำลังใช้งาน

          return `
            <tr>
              <td>${bk.BookingNumber}</td>
              <td>${bk.DriverName}</td>
              <td>${bk.CarPlate}</td>
              <td>${bk.BookingDate || "-"}</td>
              <td>${bk.TimeSlot || "-"}</td>
              <td><span class="status-badge ${statusClass}">${bk.BookingStatus || "-"}</span></td>
              <td>
                ${
                  canCancel
                    ? `<button class="op-del" onclick="adminCancelBooking(${bk.BookingID})">ยกเลิก</button>`
                    : `<span style="color:#64748b;">-</span>`
                }
              </td>
            </tr>`;
        })
        .join("");
    })
    .catch((err) => {
      console.error("Error loading admin bookings:", err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</td></tr>`;
    });
}

function adminCancelBooking(bookingId) {
  if (!confirm("ยืนยันยกเลิกการจองนี้ในนามแอดมิน?")) return;

  fetch("admin_cancel_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        alert("ยกเลิกการจองสำเร็จ");
        loadAdminBookings();
      } else {
        alert("ยกเลิกไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อ Server ไม่ได้"));
}
