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
  if (tabId === "dashboard" && typeof fetchDashboardStats === "function") {
    fetchDashboardStats();
  }
  if (tabId === "bookings-tab") {
    loadAdminBookings();
  }
  if (tabId === "users-tab") {
    loadUsers();
  }
  if (tabId === "reports-tab" && typeof fetchReports === "function") {
    fetchReports();
  }
}

/**
 * 👤 บัญชีผู้ใช้ (ดูอย่างเดียว)
 */
let allUsersCache = [];

function loadUsers() {
  const tbody = document.getElementById("users-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">กำลังโหลด...</td></tr>`;

  fetch("get_users.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">${data.message}</td></tr>`;
        return;
      }
      allUsersCache = data.users || [];
      renderUsersTable(allUsersCache);
    })
    .catch((err) => {
      console.error("Error loading users:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</td></tr>`;
    });
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-tbody");
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">ไม่มีข้อมูลผู้ใช้</td></tr>`;
    return;
  }

  const roleLabel = { admin: "🛡️ Admin", user: "👤 พนักงาน" };

  tbody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${u.employee_id || "-"}</td>
        <td>${u.username || "-"}</td>
        <td>${u.first_name || "-"}</td>
        <td>${roleLabel[u.role] || u.role || "-"}</td>
        <td>
          <div class="action-buttons-group">
            <button class="op-edit" onclick='openUserEditModal(${JSON.stringify(u).replace(/'/g, "&apos;")})'>แก้ไข</button>
            <button class="op-del" onclick="deleteUser(${u.id}, '${(u.username || "").replace(/'/g, "")}')">ลบ</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");
}

function filterUsersTable(keyword) {
  const q = (keyword || "").trim().toLowerCase();
  if (!q) return renderUsersTable(allUsersCache);
  const filtered = allUsersCache.filter((u) =>
    `${u.username} ${u.first_name} ${u.employee_id}`.toLowerCase().includes(q),
  );
  renderUsersTable(filtered);
}
document.addEventListener("DOMContentLoaded", () => {
  // โหลดข้อมูลตารางจัดการรถยนต์
  loadCarsToWorkspaceTable();
  fetchDashboardStats();

  if (typeof initReportDates === "function") {
    initReportDates();
  }

  startBookingsPolling();

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
        tbody.innerHTML = `<tr><td colspan="9" style="color: #64748b; padding:30px; text-align:center;">❌ ไม่มีข้อมูลรถยนต์ในระบบ</td></tr>`;
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
          <td>${car.Model}</td>
          <td>${car.Mileage}</td>
          <td>${car.InsuranceExpiry || "-"}</td>
          <td>${car.ActExpiry || "-"}</td>
          <td>${car.LastMaintenanceLog || car.LastMaintenance || "-"}</td>
          <td><span class="status-pill ${statusPillClass}">${car.CarStatus || "ว่าง"}</span></td>
          <td>
            <div class="action-buttons-group">
              <button class="op-edit" onclick="fillWorkspaceForm(${carJsonString})">แก้ไข</button>
              <button class="op-del" onclick="deleteCarFromWorkspace(${car.CarID})">ลบ</button>
              <button class="op-edit" onclick="openMaintenanceModal(${car.CarID}, '${(car.Plate || "").replace(/'/g, "")}')">ประวัติซ่อม</button>
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

  // 🩹 แก้บั๊ก: ช่องวันที่ 3 อันนี้ไม่มี id มีแต่ name เลยไม่เคยถูกเติมค่าตอนกด "แก้ไข"
  // ผลคือกดบันทึกทีไร ค่าเดิมของ ประกัน/พ.ร.บ./เช็คระยะ หายหมดเพราะส่งค่าว่างทับ
  const carForm = document.getElementById("crud-car-form");
  if (carForm) {
    const insuranceInput = carForm.querySelector('[name="InsuranceExpiry"]');
    if (insuranceInput) insuranceInput.value = car.InsuranceExpiry || "";

    const actInput = carForm.querySelector('[name="ActExpiry"]');
    if (actInput) actInput.value = car.ActExpiry || "";

    const lastMaintInput = carForm.querySelector('[name="LastMaintenance"]');
    if (lastMaintInput) lastMaintInput.value = car.LastMaintenance || "";
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

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">กำลังโหลด...</td></tr>`;

  fetch("admin_get_bookings.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">${data.message}</td></tr>`;
        return;
      }

      if (!data.bookings || data.bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">ไม่มีรายการจอง</td></tr>`;
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

          const passengerNames = (bk.Passengers || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const passengerIds = (bk.PassengerIDs || "")
            .split(",")
            .map((s) => s.trim());
          const passengerChips = passengerNames
            .map((name, i) => {
              const pid = passengerIds[i];
              return `<span class="passenger-chip">👥 ${name}${pid ? ` <span class="emp-id-tag">#${pid}</span>` : ""}</span>`;
            })
            .join("");

          return `
            <tr>
              <td>${bk.BookingNumber}</td>
              <td>${bk.DriverName} ${bk.EmployeeID ? `<span class="emp-id-tag">#${bk.EmployeeID}</span>` : ""}</td>
              <td>
                ${
                  passengerChips
                    ? `<div style="display:flex; flex-direction:column; gap:3px;">${passengerChips}</div>`
                    : `<span style="color:#cbd5e1;">-</span>`
                }
              </td>
              <td>${bk.CarPlate}</td>
              <td>${bk.BookingDate || "-"}</td>
              <td>${bk.TimeSlot || "-"}</td>
              <td class="status-cell"><span class="status-badge no-glow ${statusClass}">${bk.BookingStatus || "-"}</span></td>
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</td></tr>`;
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

// ---------- Realtime polling: ตารางจัดการการจอง (250-300 user ห้ามถี่เกิน) ----------
const BOOKINGS_POLL_INTERVAL_MS = 20000; // 20s
let bookingsPollTimer = null;

function startBookingsPolling() {
  if (bookingsPollTimer) return;
  bookingsPollTimer = setInterval(() => {
    const tab = document.getElementById("bookings-tab");
    if (tab && tab.classList.contains("active") && !document.hidden) {
      loadAdminBookings();
    }
  }, BOOKINGS_POLL_INTERVAL_MS);
}

/**
 * 📅 5. ปฏิทินงานวิ่งรถ (FullCalendar) — ของเดิม div #calendar มีอยู่แต่ไม่เคย init
 */
let calendarInstance = null;

function renderCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  if (calendarInstance) {
    calendarInstance.refetchEvents();
    return;
  }

  calendarInstance = new FullCalendar.Calendar(calendarEl, {
    locale: "th",
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    initialView: "dayGridMonth",
    dayMaxEvents: 3, // เกินนี้พับเป็น "+more" กันรกจอ
    displayEventTime: false, // ปิดเวลาดิบ (08:00) ที่ทำให้งง ใช้ label ในชื่อ event แทน
    events: "get_calendar_events.php",
    eventClick: function (info) {
      const p = info.event.extendedProps;
      alert(
        `เลขที่จอง: ${p.bookingNumber || "-"}\n` +
          `${info.event.title}\n` +
          `ช่วงเวลา: ${p.timeSlot || "-"}\n` +
          `สถานะ: ${p.status || "-"}`,
      );
    },
  });

  calendarInstance.render();
}

/**
 * 🛠️ 6. ประวัติซ่อม / เช็คระยะ (Modal ต่อคัน)
 */
let currentMaintCarId = null;

function openMaintenanceModal(carId, plate) {
  currentMaintCarId = carId;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "maint-modal-overlay";
  overlay.innerHTML = `
    <div class="modal-content" style="width: 820px; max-width: 95vw; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column;">
      <h2 style="margin-top:0; margin-bottom:14px;">
        <i class="fa-solid fa-screwdriver-wrench"></i> ประวัติซ่อม — ${plate}
      </h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; overflow: hidden;">
        <div style="overflow-y: auto; max-height: 70vh; padding-right: 6px;">
          <h3 style="margin-top:0;">รายการที่ผ่านมา</h3>
          <div id="maint-history-list">
            <p class="empty-hint">กำลังโหลด...</p>
          </div>
        </div>

        <div>
          <h3 style="margin-top:0;">+ เพิ่มรายการซ่อม/เช็คระยะ</h3>
          <form id="maint-add-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px 12px;">
            <div style="grid-column: span 2;">
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">ประเภท</label>
              <input type="text" id="maint-type" placeholder="เช่น เช็คระยะ, เปลี่ยนยาง" required style="margin-bottom:0;">
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">วันที่เริ่ม *</label>
              <input type="date" id="maint-start" required style="margin-bottom:0;">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">วันที่เสร็จ</label>
              <input type="date" id="maint-end" style="margin-bottom:0;">
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">เลขไมล์</label>
              <input type="number" id="maint-mileage" style="margin-bottom:0;">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">ค่าใช้จ่าย</label>
              <input type="number" step="0.01" id="maint-cost" style="margin-bottom:0;">
            </div>

            <div style="grid-column: span 2;">
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">กำหนดเช็คครั้งถัดไป</label>
              <input type="date" id="maint-next-due" style="margin-bottom:0;">
            </div>

            <div style="grid-column: span 2;">
              <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">หมายเหตุ</label>
              <input type="text" id="maint-note" style="margin-bottom:0;">
            </div>

            <div style="grid-column: span 2; display:flex; justify-content:flex-end; gap:10px; margin-top:4px;">
              <button type="button" class="btn-clear" onclick="closeMaintenanceModal()">ปิด</button>
              <button type="submit" class="btn btn-primary">บันทึก</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("maint-add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitMaintenanceRecord();
  });

  loadMaintenanceHistory(carId);
}

function closeMaintenanceModal() {
  const overlay = document.getElementById("maint-modal-overlay");
  if (overlay) overlay.remove();
  currentMaintCarId = null;
}

function loadMaintenanceHistory(carId) {
  const wrap = document.getElementById("maint-history-list");
  if (!wrap) return;

  fetch(`get_maintenance_history.php?car_id=${carId}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        wrap.innerHTML = `<p style="color:#ef4444;">${data.message}</p>`;
        return;
      }
      const rows = data.history || [];
      if (rows.length === 0) {
        wrap.innerHTML = `<p class="empty-hint">ยังไม่มีประวัติซ่อม</p>`;
        return;
      }
      wrap.innerHTML = rows
        .map((r) => {
          const isOpen = !r.EndDate;
          return `
          <div class="fleet-row" style="align-items:flex-start;">
            <div class="fleet-row-name">
              <strong>${r.MaintenanceType || "-"}</strong>
              <span>${r.StartDate} → ${r.EndDate || "ยังไม่เสร็จ"}${r.Cost ? " • " + r.Cost + " บาท" : ""}</span>
              ${r.Note ? `<span>${r.Note}</span>` : ""}
              ${r.NextDueDate ? `<span>เช็คถัดไป: ${r.NextDueDate}</span>` : ""}
            </div>
            ${
              isOpen
                ? `<button class="op-edit" onclick="closeMaintenanceRecord(${r.MaintenanceID})">ปิดงาน</button>`
                : ""
            }
            <button class="op-del" onclick="deleteMaintenanceRecord(${r.MaintenanceID})">ลบ</button>
          </div>`;
        })
        .join("");
    })
    .catch((err) => {
      console.error("Error loading maintenance history:", err);
      wrap.innerHTML = `<p style="color:#ef4444;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>`;
    });
}

function submitMaintenanceRecord() {
  const payload = {
    action: "add",
    car_id: currentMaintCarId,
    maintenance_type: document.getElementById("maint-type").value,
    start_date: document.getElementById("maint-start").value,
    end_date: document.getElementById("maint-end").value,
    mileage: document.getElementById("maint-mileage").value,
    cost: document.getElementById("maint-cost").value,
    next_due_date: document.getElementById("maint-next-due").value,
    note: document.getElementById("maint-note").value,
  };

  fetch("manage_maintenance.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        document.getElementById("maint-add-form").reset();
        loadMaintenanceHistory(currentMaintCarId);
        loadCarsToWorkspaceTable();
        fetchDashboardStats();
      } else {
        alert("บันทึกไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อเซิร์ฟเวอร์ไม่ได้"));
}

function closeMaintenanceRecord(maintenanceId) {
  if (!confirm("ยืนยันปิดงานซ่อมนี้? (รถจะกลับมาสถานะว่างอัตโนมัติ)")) return;

  fetch("manage_maintenance.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "close",
      maintenance_id: maintenanceId,
      end_date: new Date().toISOString().split("T")[0],
    }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        loadMaintenanceHistory(currentMaintCarId);
        loadCarsToWorkspaceTable();
        fetchDashboardStats();
      } else {
        alert("ปิดงานไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อเซิร์ฟเวอร์ไม่ได้"));
}

function deleteMaintenanceRecord(maintenanceId) {
  if (!confirm("ยืนยันลบรายการนี้?")) return;

  fetch("manage_maintenance.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", maintenance_id: maintenanceId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        loadMaintenanceHistory(currentMaintCarId);
        loadCarsToWorkspaceTable();
        fetchDashboardStats();
      } else {
        alert("ลบไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อเซิร์ฟเวอร์ไม่ได้"));
}

/**
 * 👤 7. แก้ไขข้อมูลผู้ใช้ (Modal)
 */
function openUserEditModal(user) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "user-edit-modal-overlay";
  overlay.innerHTML = `
    <div class="modal-content" style="width: 420px;">
      <h2 style="margin-top:0;"><i class="fa-solid fa-user-pen"></i> แก้ไขผู้ใช้</h2>
      <form id="user-edit-form">
        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">รหัสพนักงาน</label>
        <input type="text" id="edit-employee-id" value="${(user.employee_id || "").replace(/"/g, "&quot;")}">

        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Username *</label>
        <input type="text" id="edit-username" value="${(user.username || "").replace(/"/g, "&quot;")}" required>

        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">ชื่อ-นามสกุล</label>
        <input type="text" id="edit-first-name" value="${(user.first_name || "").replace(/"/g, "&quot;")}">

        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">สิทธิ์ (Role)</label>
        <select id="edit-role" class="ctrl-select" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #cbd5e1; border-radius:6px;">
          <option value="user" ${user.role === "user" ? "selected" : ""}>พนักงาน</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
        </select>

        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)</label>
        <input type="password" id="edit-new-password" placeholder="เว้นว่างไว้ถ้าไม่เปลี่ยน">

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button type="button" class="btn-clear" onclick="closeUserEditModal()">ยกเลิก</button>
          <button type="submit" class="btn btn-primary">บันทึก</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("user-edit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    saveUserEdit(user.id);
  });
}

function closeUserEditModal() {
  const overlay = document.getElementById("user-edit-modal-overlay");
  if (overlay) overlay.remove();
}

function saveUserEdit(userId) {
  const payload = {
    id: userId,
    employee_id: document.getElementById("edit-employee-id").value,
    username: document.getElementById("edit-username").value,
    first_name: document.getElementById("edit-first-name").value,
    role: document.getElementById("edit-role").value,
    new_password: document.getElementById("edit-new-password").value,
  };

  fetch("update_user.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        closeUserEditModal();
        loadUsers();
      } else {
        alert("บันทึกไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อเซิร์ฟเวอร์ไม่ได้"));
}

function deleteUser(userId, username) {
  if (!confirm(`ยืนยันลบผู้ใช้ "${username}" ออกจากระบบ?`)) return;

  fetch("delete_user.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        loadUsers();
      } else {
        alert("ลบไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อเซิร์ฟเวอร์ไม่ได้"));
}
