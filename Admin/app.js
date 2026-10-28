/**
 * 🧭 1. ระบบสลับหน้าเมนู (Tab Control)
 */
/**
 * 🛡️ กัน Stored XSS — ใช้ครอบทุกค่าที่มาจาก "คนกรอกเอง" ก่อนแปะลง innerHTML
 * (ชื่อผู้ขับ, สถานที่ไป, ข้อความแจ้งปัญหา ฯลฯ) กันมีคนแอบฝัง <script> ผ่านช่องกรอกข้อความ
 * แล้วโค้ดไปรันตอน Admin เปิดดูรายการ
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🌟 ระยะทางที่ขับจริง = เลขไมล์ตอนคืน - เลขไมล์ตอนยืม (มีข้อมูลพร้อมอยู่แล้ว ไม่ต้องพึ่ง API แผนที่)
function adminDistanceText(bk) {
  const start = Number(bk.StartMileage);
  const end = Number(bk.EndMileage);
  if (!end || !start || end <= start) return "-";
  return (end - start).toLocaleString("th-TH") + " กม.";
}

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
  if (tabId === "log-tab" && typeof fetchSystemLog === "function") {
    fetchSystemLog(1);
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">${escapeHtml(data.message)}</td></tr>`;
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
  const countEl = document.getElementById("users-count");
  if (countEl) countEl.textContent = `${(users || []).length.toLocaleString("th-TH")} คน${users && users.length !== allUsersCache.length ? ` (จากทั้งหมด ${allUsersCache.length.toLocaleString("th-TH")})` : ""}`;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">ไม่มีข้อมูลผู้ใช้</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((u) => {
      const full = ((u.first_name || "") + " " + (u.last_name || "")).trim() || u.username || "-";
      const initial = Array.from(String(u.first_name || u.username || "?"))[0].toUpperCase();
      const isAdmin = u.role === "admin";
      return `
      <tr class="clickable-row" style="cursor:pointer;" onclick="openUserEditModal(allUsersCache.find((x) => Number(x.id) === ${Number(u.id)}))">
        <td><span class="us-emp">${escapeHtml(u.employee_id) || "-"}</span></td>
        <td>
          <div class="us-who">
            <span class="us-av${isAdmin ? " admin" : ""}">${escapeHtml(initial)}</span>
            <span class="us-name"><b>${escapeHtml(full)}</b><small>@${escapeHtml(u.username) || "-"}</small></span>
          </div>
        </td>
        <td class="us-mail">${escapeHtml(u.email) || '<span style="color:#cbd5e1;">-</span>'}</td>
        <td><span class="us-role ${isAdmin ? "admin" : "user"}">${isAdmin ? '<i class="fa-solid fa-shield-halved"></i> Admin' : '<i class="fa-solid fa-user"></i> พนักงาน'}</span></td>
        <td class="op-cell" onclick="event.stopPropagation()">
          <button type="button" class="row-menu-btn" aria-label="เมนูจัดการ" onclick="openUserMenu(event, ${Number(u.id)})"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        </td>
      </tr>`;
    })
    .join("");
}

// เมนู ⋮ ของแถวผู้ใช้ (ใช้สไตล์เดียวกับเมนูในตารางจัดการการจอง)
function openUserMenu(ev, id) {
  ev.stopPropagation();
  const had = document.getElementById("row-menu");
  closeRowMenu();
  const u = allUsersCache.find((x) => Number(x.id) === Number(id));
  if (!u || had) return;
  const canDelete = u.role !== "admin" && Number(u.id) !== Number(window.currentAdminId);
  const m = document.createElement("div");
  m.id = "row-menu";
  m.className = "row-menu";
  m.innerHTML = `
    <button type="button" data-a="edit"><i class="fa-solid fa-user-pen"></i> แก้ไขผู้ใช้</button>
    ${canDelete ? `<hr /><button type="button" data-a="del" class="danger"><i class="fa-solid fa-trash"></i> ลบผู้ใช้</button>` : ""}`;
  document.body.appendChild(m);
  const r = ev.currentTarget.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
  m.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  m.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    closeRowMenu();
    if (b.dataset.a === "edit") openUserEditModal(u);
    else if (b.dataset.a === "del") deleteUser(Number(u.id), u.username || "");
  });
  setTimeout(() => {
    document.addEventListener("click", closeRowMenu, { once: true });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { closeRowMenu(); document.removeEventListener("keydown", esc); }
    });
    window.addEventListener("scroll", closeRowMenu, { once: true, capture: true });
  }, 0);
}

function filterUsersTable(keyword) {
  const q = (keyword || "").trim().toLowerCase();
  if (!q) return renderUsersTable(allUsersCache);
  const filtered = allUsersCache.filter((u) =>
    `${u.username} ${u.first_name} ${u.last_name || ""} ${u.employee_id} ${u.email || ""}`.toLowerCase().includes(q),
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
const carMap = {};

// วันครบกำหนด (ประกัน/พ.ร.บ.) เป็นป้ายสี: แดง = หมดอายุแล้ว, เหลือง = ภายใน 30 วัน, เทา = ปกติ
function expiryChip(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '<span style="color:#cbd5e1;">-</span>';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  const txt = `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
  if (days < 0) return `<span class="exp-chip red" title="หมดอายุแล้ว">${txt}<small>หมดอายุ</small></span>`;
  if (days <= 30) return `<span class="exp-chip amber" title="ใกล้หมดอายุ">${txt}<small>อีก ${days} วัน</small></span>`;
  return `<span class="exp-chip">${txt}</span>`;
}

// วันที่ธรรมดา (เช็กระยะล่าสุด) เป็นป้ายหน้าตาเดียวกับป้ายประกัน/พ.ร.บ. — ถ้ากำลังซ่อมอยู่ (\"2026-10-19 (กำลังซ่อม)\") ขึ้นป้ายเหลืองพร้อมคำว่า กำลังซ่อม
function dateChip(raw) {
  const str = String(raw || "");
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '<span style="color:#cbd5e1;">-</span>';
  const txt = `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
  return /กำลังซ่อม/.test(str) ? `<span class="exp-chip amber">${txt}<small>กำลังซ่อม</small></span>` : `<span class="exp-chip">${txt}</span>`;
}

function openCarMenu(ev, id) {
  ev.stopPropagation();
  const had = document.getElementById("row-menu");
  closeRowMenu();
  const car = carMap[id];
  if (!car || had) return;
  const m = document.createElement("div");
  m.id = "row-menu";
  m.className = "row-menu";
  m.innerHTML = `
    <button type="button" data-a="edit"><i class="fa-solid fa-pen"></i> แก้ไขข้อมูลรถ</button>
    <button type="button" data-a="maint"><i class="fa-solid fa-screwdriver-wrench"></i> ประวัติซ่อมบำรุง</button>
    <hr />
    <button type="button" data-a="del" class="danger"><i class="fa-solid fa-trash"></i> ลบรถ</button>`;
  document.body.appendChild(m);
  const r = ev.currentTarget.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
  m.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  m.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    closeRowMenu();
    if (b.dataset.a === "edit") fillWorkspaceForm(car);
    else if (b.dataset.a === "maint") { fillWorkspaceForm(car); switchCarView("svc"); }
    else if (b.dataset.a === "del") deleteCarFromWorkspace(car.CarID);
  });
  setTimeout(() => {
    document.addEventListener("click", closeRowMenu, { once: true });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { closeRowMenu(); document.removeEventListener("keydown", esc); }
    });
    window.addEventListener("scroll", closeRowMenu, { once: true, capture: true });
  }, 0);
}

// ตัวอย่างรูปในฟอร์ม (รูปที่เลือกใหม่ / รูปเดิมของรถ)
function previewCarImage(input) {
  const img = document.getElementById("car-img-preview");
  const name = document.getElementById("car-img-name");
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e) => (img.src = e.target.result);
  reader.readAsDataURL(f);
  if (name) name.textContent = f.name;
}
function setCarPreview(imgName) {
  const img = document.getElementById("car-img-preview");
  const name = document.getElementById("car-img-name");
  if (!img) return;
  const n = (imgName || "").trim();
  img.onerror = () => { img.onerror = null; img.src = "../Car/assets/img-car/car-placeholder.png"; };
  img.src = n ? `../Car/assets/img-car/${encodeURIComponent(n)}` : "../Car/assets/img-car/car-placeholder.png";
  if (name) name.textContent = n ? "รูปปัจจุบัน — เลือกรูปใหม่เพื่อเปลี่ยน" : "ยังไม่ได้เลือกรูป";
}

function loadCarsToWorkspaceTable() {
  fetch("manage_cars.php?action=fetch")
    .then((res) => res.json())
    .then((cars) => {
      const tbody = document.getElementById("crud-car-tbody");
      if (!tbody) return;
      tbody.innerHTML = "";
      const countEl = document.getElementById("cars-count");

      if (!cars || cars.length === 0 || cars.error) {
        if (countEl) countEl.textContent = "";
        tbody.innerHTML = `<tr><td colspan="8" style="color: #94a3b8; padding:30px; text-align:center;">ไม่มีข้อมูลรถยนต์ในระบบ</td></tr>`;
        return;
      }
      if (countEl) countEl.textContent = cars.length + " คัน";

      cars.forEach((car) => {
        carMap[car.CarID] = car;
        const isOff = car.CarStatus === "เช็คระยะ" || car.CarStatus === "ซ่อมบำรุง";
        const statusPill = statusBadge(isOff ? "งดให้บริการ" : car.CarStatus === "ไม่ว่าง" ? "ไม่ว่าง" : "ใช้งานได้", { type: "car" });

        const imgName = car.CarImage ? car.CarImage.trim() : "";
        const imgPath = imgName ? `../Car/assets/img-car/${encodeURIComponent(imgName)}` : "../Car/assets/img-car/car-placeholder.png";
        const maint = car.LastMaintenanceLog || car.LastMaintenance;

        const tr = document.createElement("tr");
        tr.className = "clickable-row";
        tr.style.cursor = "pointer";
        tr.onclick = () => fillWorkspaceForm(car);
        tr.innerHTML = `
          <td><img class="car-thumb" src="${imgPath}" alt="" onerror="this.onerror=null; this.src='../Car/assets/img-car/car-placeholder.png';"></td>
          <td><div class="car-cell"><b>${escapeHtml(car.Plate)}</b><small>${escapeHtml(((car.Brand || "") + " " + (car.Model || "")).trim())}</small></div></td>
          <td class="car-num">${car.Mileage != null && car.Mileage !== "" ? Number(car.Mileage).toLocaleString("th-TH") + " กม." : "-"}</td>
          <td>${expiryChip(car.InsuranceExpiry)}</td>
          <td>${expiryChip(car.ActExpiry)}</td>
          <td>${dateChip(maint)}</td>
          <td>${statusPill}</td>
          <td class="op-cell" onclick="event.stopPropagation()">
            <button type="button" class="row-menu-btn" aria-label="เมนูจัดการ" onclick="openCarMenu(event, ${Number(car.CarID)})"><i class="fa-solid fa-ellipsis-vertical"></i></button>
          </td>`;
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
    modeTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลรถยนต์`;
  }
  setCarPreview(car.CarImage);
  const fileInput = document.getElementById("form-car-image");
  if (fileInput) fileInput.value = "";

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
      statusToShow = "เช็คระยะ"; // ค่าเก่ารวมเป็นค่าใหม่ตัวเดียว
    }
    document.getElementById("form-car-status").value = statusToShow;
  }
  syncSvcDates();
  const svcS = document.getElementById("MaintenanceStartDate");
  const svcE = document.getElementById("MaintenanceEndDate");
  if (svcS) svcS.value = (car.MaintenanceStartDate || "").slice(0, 10);
  if (svcE) svcE.value = (car.MaintenanceEndDate || "").slice(0, 10);
  syncSvcDates();

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

  if (carView === "svc") switchCarView("svc"); // อยู่แท็บเช็คระยะ/ซ่อม -> เปลี่ยนไปของรถคันที่เลือกใหม่
  const tabs = document.querySelector(".cv-tabs");
  if (tabs) tabs.scrollIntoView({ behavior: "smooth" });
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
  if (statusSelect) statusSelect.selectedIndex = 0; syncSvcDates();

  // 4. เปลี่ยนหัวข้อฟอร์มกลับมาเป็นโหมดเพิ่มรถใหม่
  const modeTitle = document.getElementById("action-mode-title");
  if (modeTitle) {
    modeTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> เพิ่มข้อมูลรถยนต์ใหม่`;
  }
  setCarPreview("");
}

/**
 * ❌ 5. ฟังก์ชันลบรถยนต์ออกจากระบบ
 */
async function deleteCarFromWorkspace(carId) {
  if (!carId) {
    alert("ไม่พบรหัสรถยนต์ที่จะทำการลบ");
    return;
  }

  if (await AppDialog.confirm({ title: "ยืนยันการลบรถ", message: "คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลรถยนต์คันนี้ออกจากระบบ?", danger: true })) {
    fetch(`manage_cars.php?action=delete&id=${encodeURIComponent(carId)}`, {
      method: "POST", // ลบต้องเป็น POST (GET ถูกหลอกให้ลบผ่านลิงก์/รูปจากเว็บอื่นได้)
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

// 🩹 FIX: ระบบเปลี่ยนจาก TimeSlot คงที่ (เช้า/บ่าย/ทั้งวัน/กลางคืน) มาเป็นเวลาอิสระ
// (OutTime/PlannedReturnTime) แล้ว แต่หน้า Admin ยังอ่านแค่ TimeSlot เดิม -> โชว์ "-" ทุกแถว
// ฟังก์ชันนี้โชว์ "ไป HH:MM - กลับ HH:MM" ถ้ามีเวลาแบบใหม่ ถ้าไม่มี (booking เก่า) fallback ไป TimeSlot
function formatBookingTimeRange(bk) {
  const out = (bk.OutTime || "").slice(0, 5);
  const ret = (bk.PlannedReturnTime || "").slice(0, 5);
  if (out && ret) return `ไป ${out} - กลับ ${ret}`;
  return bk.TimeSlot || "-";
}

// รอบที่เช็คอินแล้ว (ขาไป) แต่เลยกำหนดคืนไปแล้ว — ระบบไม่ยกเลิกให้เอง ต้องให้แอดมินเห็นว่าค้าง
// คืนค่าเป็นข้อความสั้นๆ เช่น "เลยกำหนด 2 วัน 3 ชม." หรือ "" ถ้ายังไม่เลย
function bookingOverdueText(bk) {
  if (bk.BookingStatus !== "ขาไป") return "";
  const date = (bk.BookingDate || "").slice(0, 10);
  const out = (bk.OutTime || "").slice(0, 5);
  const ret = (bk.PlannedReturnTime || "").slice(0, 5);
  if (!date || !out || !ret) return "";
  const end = new Date(`${date}T${ret}:00`);
  if (isNaN(end)) return "";
  if (ret <= out) end.setDate(end.getDate() + 1); // จองข้ามคืน: กำหนดคืนอยู่วันถัดไป
  const minLate = Math.floor((Date.now() - end.getTime()) / 60000);
  if (minLate <= 15) return "";
  if (minLate >= 1440) {
    const d = Math.floor(minLate / 1440);
    const h = Math.floor((minLate % 1440) / 60);
    return `เลยกำหนด ${d} วัน${h > 0 ? ` ${h} ชม.` : ""}`;
  }
  const h = Math.floor(minLate / 60);
  const m = minLate % 60;
  return `เลยกำหนด ${h > 0 ? `${h} ชม. ` : ""}${m} นาที`;
}

// เก็บรายการจองล่าสุดตาม BookingID ไว้ให้เมนู ⋮ / ปุ่มในหน้ารายละเอียดเรียกใช้ (ไม่ต้องยัด JSON ลง onclick)
const adminBookingMap = {};

function closeRowMenu() {
  const m = document.getElementById("row-menu");
  if (m) m.remove();
}

function openRowMenu(ev, id) {
  ev.stopPropagation();
  const had = document.getElementById("row-menu");
  closeRowMenu();
  const bk = adminBookingMap[id];
  if (!bk || had) return; // กดปุ่มเดิมซ้ำ = ปิดเมนู
  const canCancel = bk.BookingStatus === "จองแล้ว" || bk.BookingStatus === "ขาไป";
  const m = document.createElement("div");
  m.id = "row-menu";
  m.className = "row-menu";
  m.innerHTML = `
    <button type="button" data-a="detail"><i class="fa-solid fa-clipboard-list"></i> ดูรายละเอียด</button>
    <button type="button" data-a="edit"><i class="fa-solid fa-pen"></i> แก้ไข</button>
    ${canCancel ? `<button type="button" data-a="cancel"><i class="fa-solid fa-ban"></i> ยกเลิกการจอง</button>` : ""}
    <hr />
    <button type="button" data-a="del" class="danger"><i class="fa-solid fa-trash"></i> ลบถาวร</button>`;
  document.body.appendChild(m);
  const r = ev.currentTarget.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
  m.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
  m.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    closeRowMenu();
    if (b.dataset.a === "detail") openBookingDetailModal(bk);
    else if (b.dataset.a === "edit") openBookingEditModal(bk);
    else if (b.dataset.a === "cancel") adminCancelBooking(bk.BookingID);
    else if (b.dataset.a === "del") adminDeleteBooking(bk.BookingID);
  });
  setTimeout(() => {
    document.addEventListener("click", closeRowMenu, { once: true });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { closeRowMenu(); document.removeEventListener("keydown", esc); }
    });
    window.addEventListener("scroll", closeRowMenu, { once: true, capture: true });
  }, 0);
}

function loadAdminBookings() {
  const tbody = document.getElementById("admin-bookings-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">กำลังโหลด...</td></tr>`;

  fetch("admin_get_bookings.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">${escapeHtml(data.message)}</td></tr>`;
        return;
      }

      if (!data.bookings || data.bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">ไม่มีรายการจอง</td></tr>`;
        return;
      }

      tbody.innerHTML = data.bookings
        .map((bk) => {
          // ยกเลิกได้ทั้งที่ยังไม่เช็คอิน (จองแล้ว) และที่ใช้งานอยู่ (ขาไป) — เดิมยกเลิกได้เฉพาะ "ขาไป" ทำให้ยกเลิกรายการที่ยังไม่เช็คอินไม่ได้เลย
          const canCancel = bk.BookingStatus === "จองแล้ว" || bk.BookingStatus === "ขาไป";
          // ใช้ badge ชุดเดียวกับ homepage.js/.css (.status-badge + .status-xxx)
          // สถานะจริงในระบบ: จองแล้ว(ติดจอง) → ขาไป(กำลังใช้งาน) → คืนแล้ว | ยกเลิก | ยกเลิก (ไม่มาใช้งาน)
          let statusClass = "status-booked";
          if (bk.BookingStatus === "คืนแล้ว" || bk.BookingStatus === "ขากลับ") statusClass = "status-returned";
          else if (bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก")) statusClass = "status-cancelled";
          else if (bk.BookingStatus === "ขาไป") statusClass = "status-inuse";

          const overdueText = bookingOverdueText(bk);

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
              return `<span class="passenger-chip">👥 ${escapeHtml(name)}${pid ? ` <span class="emp-id-tag">#${escapeHtml(pid)}</span>` : ""}</span>`;
            })
            .join("");

          const bkJson = JSON.stringify(bk).replace(/'/g, "&apos;");
          adminBookingMap[bk.BookingID] = bk;

          return `
            <tr class="clickable-row" style="cursor:pointer;" onclick='openBookingDetailModal(${bkJson})'>
              <td>${bk.BookingNumber}</td>
              <td>${escapeHtml(bk.DriverName)} ${bk.EmployeeID ? `<span class="emp-id-tag">#${escapeHtml(bk.EmployeeID)}</span>` : ""}</td>
              <td>
                ${
                  passengerChips
                    ? `<div style="display:flex; flex-direction:column; gap:3px;">${passengerChips}</div>`
                    : `<span style="color:#cbd5e1;">-</span>`
                }
              </td>
              <td>${escapeHtml(bk.CarPlate)}</td>
              <td>${bk.BookingDate || "-"}</td>
              <td>${formatBookingTimeRange(bk)}</td>
              <td class="status-cell">${statusBadge(bk.BookingStatus, { overdue: !!overdueText, due: bookingDue(bk.BookingDate, bk.OutTime, bk.PlannedReturnTime), returned: bookingReturned(bk.ReturnDate, bk.ReturnTime) })}${
                overdueText
                  ? `<div style="margin-top:4px; color:#ef4444; font-size:11px; font-weight:600;">⚠️ ${escapeHtml(overdueText)}</div>`
                  : ""
              }</td>
              <td class="op-cell" onclick="event.stopPropagation()">
                <button type="button" class="row-menu-btn" aria-label="เมนูจัดการ" onclick="openRowMenu(event, ${Number(bk.BookingID)})"><i class="fa-solid fa-ellipsis-vertical"></i></button>
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

async function adminDeleteBooking(bookingId) {
  if (!(await AppDialog.confirm({ title: "ยืนยันการลบ", message: "ยืนยันลบรายการจองนี้ถาวร? ข้อมูลจะหายไปทั้งหมดกู้คืนไม่ได้", danger: true }))) return;

  fetch("admin_delete_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        alert("ลบรายการจองสำเร็จ");
        loadAdminBookings();
      } else {
        alert("ลบไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch((err) => {
      console.error("adminDeleteBooking error:", err);
      alert("ติดต่อเซิร์ฟเวอร์ไม่ได้");
    });
}

async function adminCancelBooking(bookingId) {
  if (!(await AppDialog.confirm({ title: "ยืนยันการทำรายการ", message: "ยืนยันยกเลิกการจองนี้ในนามแอดมิน?", danger: false }))) return;

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
    buttonText: { today: "วันนี้", month: "เดือน", week: "สัปดาห์", day: "วัน" },
    fixedWeekCount: false, // ไม่เติมแถวว่างท้ายเดือน
    dayMaxEvents: 3, // เกินนี้พับเป็น "+N รายการ" กันรกจอ
    moreLinkContent: (a) => "+" + a.num + " รายการ",
    displayEventTime: false, // ปิดเวลาดิบ (08:00) ที่ทำให้งง ใช้ label ในชื่อ event แทน
    eventClassNames: (arg) => {
      const st = (arg.event.extendedProps && arg.event.extendedProps.status) || "";
      return ["cal-ev", st === "คืนแล้ว" ? "cal-st-done" : st === "ขาไป" ? "cal-st-out" : "cal-st-booked"];
    },
    eventContent: (arg) => {
      const p = arg.event.extendedProps || {};
      if (!p.plate) return undefined; // ข้อมูลเก่า -> ใช้หัวข้อเดิม
      const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      return {
        html: `<div class="cal-chip"><span class="cal-plate">${esc(p.plate)}</span><span class="cal-time">${esc(p.out)}–${esc(p.ret)}</span><span class="cal-name">${esc(p.driver)}</span></div>`,
      };
    },
    eventDidMount: (info) => {
      const p = info.event.extendedProps || {};
      info.el.title = `${p.plate || ""} • ${p.driver || ""}\n${p.timeSlot || ""} • ${p.status || ""}`;
    },
    events: "get_calendar_events.php",
    eventClick: function (info) {
      const p = info.event.extendedProps;
      // 🩹 FIX: เดิมใช้ alert() ดิบๆ ของเบราว์เซอร์ (เห็นเป็นกล่อง "carbooking.chshiftgo.uk says"
      // ไม่ตรงธีมเว็บเลย) เปลี่ยนมาใช้ modal เดียวกับที่ใช้ทั่วทั้งระบบ (.modal-overlay/.modal-content)
      openCalendarEventModal({
        bookingNumber: p.bookingNumber || "-",
        title: info.event.title || "-",
        timeSlot: p.timeSlot || "-",
        status: p.status || "-",
      });
    },
  });

  calendarInstance.render();
}

// 🌟 popup รายละเอียด event ปฏิทิน — แทนที่ alert() เดิม ให้เข้าธีมเว็บเหมือน modal อื่นในระบบ
function openCalendarEventModal(ev) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "calendar-event-modal-overlay";
  overlay.innerHTML = `
    <div class="modal-content" style="width: 420px; max-width: 92vw;">
      <h2 style="margin-top:0; margin-bottom:14px;">
        <i class="fa-solid fa-calendar-day"></i> รายละเอียดการจอง
      </h2>
      <div style="display:grid; grid-template-columns: auto 1fr; gap: 10px 14px; font-size:14px;">
        <strong>เลขที่จอง:</strong><span>${escapeHtml(ev.bookingNumber)}</span>
        <strong>รายการ:</strong><span>${escapeHtml(ev.title)}</span>
        <strong>ช่วงเวลา:</strong><span>${escapeHtml(ev.timeSlot)}</span>
        <strong>สถานะ:</strong><span>${escapeHtml(ev.status)}</span>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <button type="button" class="btn-clear" onclick="closeCalendarEventModal()">ปิด</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCalendarEventModal();
  });
}

function closeCalendarEventModal() {
  const overlay = document.getElementById("calendar-event-modal-overlay");
  if (overlay) overlay.remove();
}

/**
 * 🛠️ 6. ประวัติซ่อม / เช็คระยะ (Modal ต่อคัน)
 */
let currentMaintCarId = null;

function openMaintenanceModal(carId, plate) {
  maintOpenRecord = null;
  maintCar = null;
  currentMaintCarId = carId;
  maintPlate = plate;
  const host = document.getElementById("svc-inline");
  if (!host) return;
  host.innerHTML = `
    <div class="mt-wrap">
      <div class="mt-main">
        <div id="mt-status"></div>
        <div id="mt-body"></div>
      </div>
      <aside class="mt-side">
        <div class="mt-sec">ประวัติเช็คระยะ / ซ่อม</div>
        <div id="maint-history-list" class="mt-history"><p class="empty-hint">กำลังโหลด...</p></div>
      </aside>
    </div>`;
  loadMaintenanceHistory(carId);
}

function closeMaintenanceModal() {
  switchCarView("car");
}

// สลับมุมมองในหน้าจัดการรถ: ข้อมูลรถ <-> เช็คระยะ/ซ่อม (ของรถที่เลือกอยู่ในฟอร์ม)
let carView = "car";
function switchCarView(view) {
  carView = view;
  const form = document.getElementById("crud-car-form");
  const host = document.getElementById("svc-inline");
  const tc = document.getElementById("cv-tab-car");
  const ts = document.getElementById("cv-tab-svc");
  if (!form || !host) return;
  const svc = view === "svc";
  form.style.display = svc ? "none" : "";
  host.hidden = !svc;
  if (tc) tc.classList.toggle("on", !svc);
  if (ts) ts.classList.toggle("on", svc);
  if (!svc) return;
  const id = Number(document.getElementById("form-car-id")?.value || 0);
  if (!id) {
    currentMaintCarId = null;
    host.innerHTML = '<p class="svc-pick">เลือกรถก่อน — คลิกแถวรถในตารางด้านล่าง แล้วกลับมาที่แท็บนี้</p>';
    return;
  }
  openMaintenanceModal(id, document.getElementById("form-car-plate")?.value || "");
}

/**
 * 📋 6.5 รายละเอียดการจอง (ขาไป/ขากลับ) — โชว์เลขไมล์ + เวลาเช็คอิน/คืน + รูปถ่ายทั้ง 3 จุด
 */
// พิกัดจาก GPS มือถือตอนเช็คอิน/คืนรถ: ok=อยู่ในจุด far=นอกจุด none=ไม่มีพิกัด nosite=ยังไม่ได้ตั้งจุดบริษัท
function geoLine(label, geo, lat, lng, dist, happened) {
  if (!happened) return "";
  const map = lat && lng ? ` <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">เปิดแผนที่</a>` : "";
  const txt = {
    ok: `<span style="color:#16a34a">อยู่ในจุดบริษัท</span>${dist != null ? ` (ห่าง ${dist} ม.)` : ""}`,
    far: `<span style="color:#dc2626">นอกจุดบริษัท ห่าง ${dist ?? "?"} ม.</span>`,
    none: `<span style="color:#d97706">ไม่ได้ยืนยันพิกัด</span>`,
    auto: `<span style="color:#2563eb">เช็คอินอัตโนมัติตามเวลาจอง</span>`,
    nosite: "บันทึกพิกัดแล้ว (ยังไม่ได้ตั้งจุดบริษัท)",
  }[geo] || "-";
  return `<div style="grid-column: span 2;"><strong>${label}:</strong> ${txt}${map}</div>`;
}

function openBookingDetailModal(bk) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "booking-detail-modal-overlay";

  // 🌟 path รูปเก็บใน DB แบบ relative จากโฟลเดอร์ Car/ (เช่น "uploads/checkin/xxx.jpg")
  // ไฟล์นี้รันอยู่ใน Admin/ ต้องถอยไป ../Car/ ก่อนถึงจะเจอไฟล์จริง
  const photoUrl = (path) => (path ? `../Car/${path}` : null);

  // 🌟 ชี้แจง: booking มี 2 ทางคืนรถ — สแกน QR (มีรูปเสมอ) กับแท็บคืนรถมือใน booking.html (ไม่บังคับถ่ายรูป)
  // ข้อความเดิม "ไม่มีรูป" เฉยๆ ทำให้ดูเหมือนระบบพัง ทั้งที่บาง booking ตั้งใจไม่มีรูปตามดีไซน์
  const photoBlock = (label, path, isCheckin) => {
    const url = photoUrl(path);
    const emptyMsg = isCheckin
      ? "ไม่มีรูป (ไม่บังคับถ่ายก่อนออกรถ)"
      : "ไม่มีรูป (คืนผ่านฟอร์มมือ ไม่ได้สแกน QR)";
    return `
      <div style="text-align:center;">
        <p style="font-size:13px; font-weight:600; margin-bottom:6px;">${label}</p>
        ${
          url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; cursor:pointer;" /></a>`
            : `<div style="height:120px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; border-radius:8px; color:#94a3b8; font-size:12px; padding:0 8px; text-align:center;">${emptyMsg}</div>`
        }
      </div>`;
  };

  overlay.innerHTML = `
    <div class="modal-content" style="width: 720px; max-width: 95vw; max-height: 92vh; overflow-y: auto;">
      <h2 style="margin-top:0; margin-bottom:14px;">
        <i class="fa-solid fa-clipboard-list"></i> รายละเอียดการจอง — ${bk.BookingNumber}
      </h2>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 18px;">
        <div><strong>ผู้ขับ:</strong> ${escapeHtml(bk.DriverName) || "-"} ${bk.EmployeeID ? `#${escapeHtml(bk.EmployeeID)}` : ""}</div>
        <div><strong>หน่วยงาน:</strong> ${escapeHtml(bk.Department) || "-"}</div>
        <div><strong>ทะเบียนรถ:</strong> ${escapeHtml(bk.CarPlate) || "-"}</div>
        <div><strong>สถานที่ไป:</strong> ${escapeHtml(bk.Destination) || "-"}</div>
        <div><strong>วันที่ / ช่วงเวลา:</strong> ${bk.BookingDate || "-"} (${formatBookingTimeRange(bk)})</div>
        <div><strong>สถานะ:</strong> ${bk.BookingStatus || "-"}</div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 18px; padding: 12px; background:#f8fafc; border-radius:8px;">
        <div><strong>เวลาเช็คอิน:</strong> ${bk.CheckInTime || "ยังไม่เช็คอิน"}</div>
        <div><strong>เลขไมล์ตอนออก:</strong> ${bk.StartMileage ?? "-"}</div>
        <div><strong>วันที่/เวลาคืน:</strong> ${bk.ReturnDate ? `${bk.ReturnDate} ${bk.ReturnTime || ""}` : "ยังไม่คืน"}</div>
        <div><strong>เลขไมล์ตอนคืน:</strong> ${bk.EndMileage ?? "-"}</div>
        <div><strong>ระยะทางที่ใช้:</strong> ${adminDistanceText(bk)}</div>
        ${geoLine("พิกัดเช็คอิน", bk.CheckInGeo, bk.CheckInLat, bk.CheckInLng, bk.CheckInDist, !!bk.CheckInTime)}
        ${geoLine("พิกัดตอนคืน", bk.ReturnGeo, bk.ReturnLat, bk.ReturnLng, bk.ReturnDist, !!bk.ReturnDate)}
        ${bk.ReturnRemark && bk.ReturnRemark !== "-" ? `<div style="grid-column: span 2;"><strong>ปัญหาที่แจ้ง:</strong> ${escapeHtml(bk.ReturnRemark)}</div>` : ""}
      </div>

      <h3 style="margin-bottom:10px;">รูปถ่ายประกอบ</h3>
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px;">
        ${photoBlock("ก่อนออก (ถ้ามีตำหนิ)", bk.CheckinPhotoPath, true)}
        ${photoBlock("เลขไมล์ตอนคืน", bk.OdometerPhotoPath, false)}
        ${photoBlock("สภาพรถตอนคืน", bk.ReturnPhotoPath, false)}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn-clear" onclick="closeBookingDetailModal()">ปิด</button>
        <button type="button" class="btn btn-primary" onclick="closeBookingDetailModal(); openBookingEditModal(adminBookingMap[${Number(bk.BookingID)}])"><i class="fa-solid fa-pen"></i> แก้ไขรายการนี้</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeBookingDetailModal() {
  const overlay = document.getElementById("booking-detail-modal-overlay");
  if (overlay) overlay.remove();
}

/**
 * ✏️ 6.6 แก้ไขข้อมูลการจอง — แอดมินแก้ผู้ขับ/รถ/วันเวลา/เลขไมล์/สถานะได้ตรงๆ
 */
// ช่องเลือกเวลา 24 ชม. (ชั่วโมง : นาที) — แทน <input type="time"> ที่โชว์ AM/PM ตามเครื่อง
function bookingTimeSelects(id, value) {
  const parts = String(value || "").slice(0, 5).split(":");
  const h = parts[0] || "";
  const m = parts[1] || "";
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = [...new Set(["00", "15", "30", "45", ...(m ? [m] : [])])].sort();
  const opt = (v, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`;
  return `<div class="ef-time">
    <select id="${id}-h" aria-label="ชั่วโมง">${hours.map((x) => opt(x, h)).join("")}</select>
    <b>:</b>
    <select id="${id}-m" aria-label="นาที">${mins.map((x) => opt(x, m)).join("")}</select>
    <span>น.</span>
  </div>`;
}
function readBookingTime(id) {
  return document.getElementById(id + "-h").value + ":" + document.getElementById(id + "-m").value;
}

function openBookingEditModal(bk) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "booking-edit-modal-overlay";
  overlay.addEventListener("mousedown", (e) => e.target === overlay && closeBookingEditModal());

  const statuses = ["จองแล้ว", "ขาไป", "คืนแล้ว", "ยกเลิก", "ยกเลิก (ไม่มาใช้งาน)", "ยกเลิก (ไม่ได้ใช้รถ)"];
  const statusClass = (bk.BookingStatus || "").includes("ยกเลิก") ? "status-cancelled" : bk.BookingStatus === "คืนแล้ว" ? "status-returned" : bk.BookingStatus === "ขาไป" ? "status-inuse" : "status-booked";

  overlay.innerHTML = `
    <div class="modal-content ef-modal">
      <div class="ef-head">
        <div>
          <h2><i class="fa-solid fa-pen-to-square"></i> แก้ไขการจอง</h2>
          <p>${escapeHtml(bk.BookingNumber)} • ${statusBadge(bk.BookingStatus)}</p>
        </div>
        <button type="button" class="ef-x" aria-label="ปิด" onclick="closeBookingEditModal()"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="booking-edit-form" class="ef">
        <div class="ef-sec">ผู้ขับและรถ</div>
        <div class="ef-grid">
          <label class="ef-f"><span>รหัสพนักงานผู้ขับ</span><input type="text" id="edit-employee-id" value="${escapeHtml(bk.EmployeeID)}" /></label>
          <label class="ef-f"><span>ทะเบียนรถ</span><input type="text" id="edit-car-plate" value="${escapeHtml(bk.CarPlate)}" /></label>
        </div>

        <div class="ef-sec">วันและเวลา</div>
        <div class="ef-grid ef-grid-3">
          <label class="ef-f"><span>วันที่ใช้งาน</span><input type="date" id="edit-booking-date" value="${bk.BookingDate || ""}" /></label>
          <div class="ef-f"><span>เวลาไป</span>${bookingTimeSelects("edit-out-time", bk.OutTime)}</div>
          <div class="ef-f"><span>เวลากลับ (โดยประมาณ)</span>${bookingTimeSelects("edit-return-time", bk.PlannedReturnTime)}</div>
        </div>

        <div class="ef-sec">เส้นทางและเลขไมล์</div>
        <div class="ef-grid">
          <label class="ef-f ef-span"><span>สถานที่ไป</span><input type="text" id="edit-destination" value="${escapeHtml(bk.Destination)}" /></label>
          <label class="ef-f"><span>เลขไมล์ตอนออก (กม.)</span><input type="number" id="edit-start-mileage" value="${bk.StartMileage ?? ""}" /></label>
          <label class="ef-f"><span>เลขไมล์ตอนคืน (กม.)</span><input type="number" id="edit-end-mileage" value="${bk.EndMileage ?? ""}" /></label>
        </div>

        <div class="ef-sec">สถานะ</div>
        <label class="ef-f"><select id="edit-booking-status">${statuses.map((s) => `<option value="${s}" ${bk.BookingStatus === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <p class="ef-note"><i class="fa-solid fa-circle-info"></i> ถ้าตั้งเป็น "คืนแล้ว" ต้องกรอกเลขไมล์ตอนคืนให้มากกว่าเลขไมล์ตอนออก</p>

        <div class="ef-actions">
          <button type="button" class="btn-clear" onclick="closeBookingEditModal()">ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> บันทึก</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("booking-edit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitBookingEdit(bk.BookingID);
  });
}

function submitBookingEdit(bookingId) {
  const payload = {
    booking_id: bookingId,
    employee_id: document.getElementById("edit-employee-id").value.trim(),
    car_plate: document.getElementById("edit-car-plate").value.trim(),
    booking_date: document.getElementById("edit-booking-date").value,
    out_time: readBookingTime("edit-out-time"),
    planned_return_time: readBookingTime("edit-return-time"),
    destination: document.getElementById("edit-destination").value.trim(),
    start_mileage: document.getElementById("edit-start-mileage").value,
    end_mileage: document.getElementById("edit-end-mileage").value,
    booking_status: document.getElementById("edit-booking-status").value,
  };

  fetch("admin_update_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        closeBookingEditModal();
        loadAdminBookings();
      } else {
        alert(result.message || "บันทึกไม่สำเร็จ");
      }
    })
    .catch((err) => {
      console.error("submitBookingEdit error:", err);
      alert("ติดต่อเซิร์ฟเวอร์ไม่ได้");
    });
}

function closeBookingEditModal() {
  const overlay = document.getElementById("booking-edit-modal-overlay");
  if (overlay) overlay.remove();
}

let maintOpenRecord = null; // รายการเช็ค/ซ่อมที่ยังเปิดอยู่ของรถที่เลือก
let maintCar = null; // { status, until } ของรถที่เลือก
let maintPlate = "";

function maintToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}
function maintAddDays(days) {
  const d = new Date(maintToday() + "T00:00:00");
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}
function maintFmt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "-";
  const mons = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return Number(m[3]) + " " + mons[Number(m[2]) - 1] + " " + (Number(m[1]) + 543);
}
// ช่องตัวเลขที่ใส่ , ให้อัตโนมัติ (1,234 / 1,234.50) — ส่งไปเซิร์ฟเวอร์เป็นตัวเลขล้วน
function maintNum(id) {
  const v = String(document.getElementById(id).value || "").replace(/,/g, "").trim();
  return v === "" || isNaN(Number(v)) ? "" : v;
}
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.dataset || !el.dataset.num) return;
  const dec = el.dataset.num === "dec";
  let v = el.value.replace(dec ? /[^\d.]/g : /\D/g, "");
  if (dec) {
    const p = v.split(".");
    v = p[0] + (p.length > 1 ? "." + p.slice(1).join("").slice(0, 2) : "");
  }
  const [i, d] = v.split(".");
  const fmt = (i ? Number(i).toLocaleString("en-US") : "") + (d !== undefined ? "." + d : "");
  el.value = fmt;
});

function maintDaysLeft(iso) {
  return Math.round((new Date(iso + "T00:00:00") - new Date(maintToday() + "T00:00:00")) / 86400000);
}

function loadMaintenanceHistory(carId) {
  fetch(`get_maintenance_history.php?car_id=${carId}`)
    .then((res) => res.json())
    .then((data) => {
      if (carId !== currentMaintCarId) return; // เปลี่ยนไปดูรถคันอื่นแล้ว
      const rows = data.success ? data.history || [] : [];
      maintOpenRecord = rows.find((r) => !r.EndDate) || null;
      maintCar = data.car || null;
      renderMaintPanel();
      renderMaintHistory(rows, data.success ? "" : data.message || "โหลดประวัติไม่สำเร็จ");
    })
    .catch(() => {
      const w = document.getElementById("maint-history-list");
      if (w) w.innerHTML = '<p class="empty-hint" style="color:#ef4444;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>';
    });
}

function renderMaintHistory(rows, err) {
  const wrap = document.getElementById("maint-history-list");
  if (!wrap) return;
  if (err) return (wrap.innerHTML = `<p class="empty-hint" style="color:#ef4444;">${escapeHtml(err)}</p>`);
  if (!rows.length) return (wrap.innerHTML = '<p class="empty-hint">ยังไม่มีประวัติ</p>');
  wrap.innerHTML = rows
    .map((r) => {
      const open = !r.EndDate;
      const bits = [];
      if (r.Mileage) bits.push(Number(r.Mileage).toLocaleString("th-TH") + " กม.");
      if (r.Cost) bits.push(Number(r.Cost).toLocaleString("th-TH") + " บาท");
      if (r.NextDueDate) bits.push("เช็คถัดไป " + maintFmt(r.NextDueDate));
      if (r.Note) bits.push(escapeHtml(r.Note));
      return `
      <div class="mt-item${open ? " open" : ""}">
        <span class="mt-dot"></span>
        <div class="mt-item-main">
          <b>${escapeHtml(r.MaintenanceType) || "-"}</b>
          <span class="mt-when">${maintFmt(r.StartDate)} → ${open ? "ยังไม่เสร็จ" : maintFmt(r.EndDate)}</span>
          ${bits.length ? `<span class="mt-meta">${bits.join(" • ")}</span>` : ""}
        </div>
        <button type="button" class="mt-del" title="ลบรายการนี้" onclick="deleteMaintenanceRecord(${r.MaintenanceID})"><i class="fa-regular fa-trash-can"></i></button>
      </div>`;
    })
    .join("");
}

// แผงหลัก: ขึ้นกับสถานะรถ (พร้อมใช้ / อยู่ระหว่างเช็คระยะ-ซ่อม)
function renderMaintPanel() {
  const st = document.getElementById("mt-status");
  const body = document.getElementById("mt-body");
  if (!st || !body) return;
  const inService = !!maintOpenRecord || (maintCar && maintCar.status === "เช็คระยะ");
  if (!inService) {
    st.innerHTML = `
      <div class="mt-card free">
        <i class="fa-solid fa-circle-check"></i>
        <div><b>${escapeHtml(maintPlate)} พร้อมใช้งาน</b><span>เปิดให้จองตามปกติ</span></div>
      </div>`;
    body.innerHTML = `
      <form id="mt-send" class="mt-panel">
        <h4>ส่งรถเข้าเช็คระยะ / ซ่อม</h4>
        <div class="mt-pills" id="mt-pills">
          <button type="button" class="on" data-v="เช็คระยะ">เช็คระยะ</button>
          <button type="button" data-v="ซ่อม">ซ่อม</button>
          <button type="button" data-v="เปลี่ยนยาง">เปลี่ยนยาง</button>
          <button type="button" data-v="">อื่นๆ</button>
        </div>
        <input type="text" id="ms-type" value="เช็คระยะ" hidden placeholder="ระบุงาน เช่น ตรวจสภาพ/ต่อภาษี" />
        <div class="ef-grid">
          <label class="ef-f"><span>คาดว่าเสร็จวันที่</span><input type="date" id="ms-end" min="${maintToday()}" /></label>
          <label class="ef-f"><span>หมายเหตุ (ไม่บังคับ)</span><input type="text" id="ms-note" /></label>
        </div>
        <div class="mt-quick"><span>เสร็จอีก</span>
          <button type="button" data-d="1">1 วัน</button><button type="button" data-d="3">3 วัน</button><button type="button" data-d="7">1 สัปดาห์</button><button type="button" data-d="14">2 สัปดาห์</button>
        </div>
        <p class="mt-hint"><i class="fa-solid fa-circle-info"></i> ระหว่างนี้รถปิดการจอง — ผู้ใช้จองล่วงหน้าได้ตั้งแต่วันที่คาดว่าเสร็จ ไม่ระบุวันก็ได้ (ปิดจองจนกว่าจะกดว่ารถเสร็จ)</p>
        <button type="submit" class="mt-btn warn"><i class="fa-solid fa-screwdriver-wrench"></i> ส่งรถเข้าเช็ค/ซ่อม</button>
      </form>
      <details class="mt-retro">
        <summary>บันทึกงานที่เสร็จไปแล้ว (ย้อนหลัง)</summary>
        <form id="mt-retro" class="ef-grid">
          <label class="ef-f"><span>ทำอะไร</span><input type="text" id="rt-type" value="เช็คระยะ" /></label>
          <label class="ef-f"><span>เลขไมล์ (กม.)</span><input type="text" inputmode="numeric" data-num="int" id="rt-mileage" /></label>
          <label class="ef-f"><span>วันที่เริ่ม</span><input type="date" id="rt-start" required /></label>
          <label class="ef-f"><span>เสร็จวันที่</span><input type="date" id="rt-end" required /></label>
          <label class="ef-f"><span>ค่าใช้จ่าย (บาท)</span><input type="text" inputmode="decimal" data-num="dec" id="rt-cost" /></label>
          <label class="ef-f"><span>กำหนดเช็คครั้งถัดไป</span><input type="date" id="rt-next" /></label>
          <button type="submit" class="mt-btn ef-span">บันทึกประวัติ</button>
        </form>
      </details>`;
    document.getElementById("mt-send").addEventListener("submit", (e) => { e.preventDefault(); submitMaintSend(); });
    document.getElementById("mt-retro").addEventListener("submit", (e) => { e.preventDefault(); submitMaintRetro(); });
    document.getElementById("mt-pills").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      document.querySelectorAll("#mt-pills button").forEach((x) => x.classList.toggle("on", x === b));
      const inp = document.getElementById("ms-type");
      inp.value = b.dataset.v;
      inp.hidden = b.dataset.v !== "";
      if (b.dataset.v === "") inp.focus();
    });
    body.querySelector(".mt-quick").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) document.getElementById("ms-end").value = maintAddDays(Number(b.dataset.d));
    });
    return;
  }

  // อยู่ระหว่างเช็คระยะ/ซ่อม
  const until = maintCar && maintCar.until;
  const left = until ? maintDaysLeft(until) : null;
  const leftTxt = left === null ? "ยังไม่ระบุวันเสร็จ" : left > 0 ? "อีก " + left + " วัน" : left === 0 ? "ครบกำหนดวันนี้" : "เลยกำหนด " + -left + " วัน";
  const what = (maintOpenRecord && maintOpenRecord.MaintenanceType) || "เช็คระยะ/ซ่อม";
  st.innerHTML = `
    <div class="mt-card busy">
      <i class="fa-solid fa-screwdriver-wrench"></i>
      <div>
        <b>${escapeHtml(maintPlate)} กำลัง${escapeHtml(what)}</b>
        <span>${maintOpenRecord ? "ส่งรถ " + maintFmt(maintOpenRecord.StartDate) + " • " : ""}${until ? "คาดว่าเสร็จ " + maintFmt(until) + " (" + leftTxt + ")" : leftTxt}</span>
      </div>
      <form id="mt-extend" class="mt-extend">
        <input type="date" id="mt-ext-date" value="${until || ""}" min="${maintToday()}" aria-label="วันที่คาดว่าเสร็จ" />
        <button type="submit">เปลี่ยนวัน</button>
      </form>
    </div>`;
  body.innerHTML = `
    <form id="mt-done" class="mt-panel">
      <h4>รถเสร็จแล้วใช่ไหม?</h4>
      <div class="ef-grid ef-grid-3">
        <label class="ef-f"><span>เสร็จวันที่</span><input type="date" id="md-end" value="${maintToday()}" required /></label>
        <label class="ef-f"><span>เลขไมล์ (กม.)</span><input type="text" inputmode="numeric" data-num="int" id="md-mileage" value="${maintCar && maintCar.mileage ? Number(maintCar.mileage).toLocaleString("en-US") : ""}" placeholder="ล่าสุดจากการคืนรถ" /></label>
        <label class="ef-f"><span>ค่าใช้จ่าย (บาท)</span><input type="text" inputmode="decimal" data-num="dec" id="md-cost" /></label>
      </div>
      <details class="mt-more">
        <summary>เพิ่มเติม (กำหนดเช็คครั้งถัดไป / หมายเหตุ)</summary>
        <div class="ef-grid">
          <label class="ef-f"><span>กำหนดเช็คครั้งถัดไป</span><input type="date" id="md-next" /></label>
          <label class="ef-f"><span>หมายเหตุ</span><input type="text" id="md-note" /></label>
        </div>
      </details>
      <button type="submit" class="mt-btn ok"><i class="fa-solid fa-circle-check"></i> รถเสร็จแล้ว — เปิดให้จอง</button>
    </form>`;
  document.getElementById("mt-done").addEventListener("submit", (e) => { e.preventDefault(); submitMaintDone(); });
  document.getElementById("mt-extend").addEventListener("submit", (e) => { e.preventDefault(); submitMaintExtend(); });
}

function maintAfterSave() {
  loadMaintenanceHistory(currentMaintCarId);
  loadCarsToWorkspaceTable();
  fetchDashboardStats();
}

function maintPost(payload) {
  return fetch("manage_maintenance.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .catch(() => ({ success: false, message: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
}

async function submitMaintSend() {
  const type = (document.getElementById("ms-type").value || "").trim();
  if (!type) return alert("กรุณาระบุว่าส่งรถไปทำอะไร");
  const r = await maintPost({
    action: "add",
    car_id: currentMaintCarId,
    hold_car: true,
    maintenance_type: type,
    start_date: maintToday(),
    end_date: document.getElementById("ms-end").value,
    note: document.getElementById("ms-note").value,
  });
  if (!r.success) return alert("บันทึกไม่สำเร็จ: " + (r.message || ""));
  maintAfterSave();
}

async function submitMaintDone() {
  const r = await maintPost({
    action: "close",
    maintenance_id: maintOpenRecord ? maintOpenRecord.MaintenanceID : 0,
    car_id: currentMaintCarId,
    end_date: document.getElementById("md-end").value,
    mileage: maintNum("md-mileage"),
    cost: maintNum("md-cost"),
    next_due_date: document.getElementById("md-next").value,
    note: document.getElementById("md-note").value,
  });
  if (!r.success) return alert("บันทึกไม่สำเร็จ: " + (r.message || ""));
  maintAfterSave();
}

async function submitMaintRetro() {
  const r = await maintPost({
    action: "add",
    car_id: currentMaintCarId,
    hold_car: false,
    maintenance_type: document.getElementById("rt-type").value || "เช็คระยะ",
    start_date: document.getElementById("rt-start").value,
    end_date: document.getElementById("rt-end").value,
    mileage: maintNum("rt-mileage"),
    cost: maintNum("rt-cost"),
    next_due_date: document.getElementById("rt-next").value,
  });
  if (!r.success) return alert("บันทึกไม่สำเร็จ: " + (r.message || ""));
  maintAfterSave();
}

async function submitMaintExtend() {
  const r = await maintPost({ action: "extend", car_id: currentMaintCarId, end_date: document.getElementById("mt-ext-date").value });
  if (!r.success) return alert("เปลี่ยนวันไม่สำเร็จ: " + (r.message || ""));
  maintAfterSave();
}

async function closeMaintenanceRecord(maintenanceId) {
  if (!(await AppDialog.confirm({ title: "ยืนยันการทำรายการ", message: "ยืนยันปิดงานซ่อมนี้? (รถจะกลับมาสถานะว่างอัตโนมัติ)", danger: false }))) return;

  fetch("manage_maintenance.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "close",
      maintenance_id: maintenanceId,
      end_date: ((d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0])(new Date()), // วันที่ท้องถิ่น ไม่ใช่ UTC
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

async function deleteMaintenanceRecord(maintenanceId) {
  if (!(await AppDialog.confirm({ title: "ยืนยันการลบ", message: "ยืนยันลบรายการนี้?", danger: true }))) return;

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
  if (!user) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "user-edit-modal-overlay";
  overlay.addEventListener("mousedown", (e) => e.target === overlay && closeUserEditModal());

  // 🌟 รหัสผ่านของ admin ต้องไปเปลี่ยนใน DB โดยตรงเท่านั้น ไม่ให้ตั้งผ่านหน้าเว็บนี้
  // (กันกรณีบัญชี Admin คนหนึ่งไปตั้งรหัสให้ Admin อีกคนได้ตามใจชอบผ่าน UI)
  const isAdminRow = user.role === "admin";
  const full = ((user.first_name || "") + " " + (user.last_name || "")).trim() || user.username || "-";
  const passwordFieldHtml = isAdminRow
    ? `<p class="ef-note"><i class="fa-solid fa-lock"></i> บัญชี Admin ต้องเปลี่ยนรหัสผ่านผ่านฐานข้อมูลโดยตรงเท่านั้น (ไม่รองรับตั้งผ่านหน้านี้)</p>`
    : `<label class="ef-f"><span>ตั้งรหัสผ่านใหม่ <small style="font-weight:400;color:#94a3b8">(เว้นว่าง = ไม่เปลี่ยน)</small></span>
         <input type="password" id="edit-new-password" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="new-password" /></label>`;

  overlay.innerHTML = `
    <div class="modal-content ef-modal" style="width: 520px !important;">
      <div class="ef-head">
        <div>
          <h2><i class="fa-solid fa-user-pen"></i> แก้ไขผู้ใช้</h2>
          <p>${escapeHtml(full)} • <span class="us-role ${isAdminRow ? "admin" : "user"}">${isAdminRow ? "Admin" : "พนักงาน"}</span></p>
        </div>
        <button type="button" class="ef-x" aria-label="ปิด" onclick="closeUserEditModal()"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="user-edit-form" class="ef">
        <div class="ef-sec">ข้อมูลบัญชี</div>
        <div class="ef-grid">
          <label class="ef-f"><span>รหัสพนักงาน</span><input type="text" id="edit-employee-id" value="${escapeHtml(user.employee_id)}" /></label>
          <label class="ef-f"><span>Username *</span><input type="text" id="edit-username" value="${escapeHtml(user.username)}" required /></label>
          <label class="ef-f ef-span"><span>ชื่อ</span><input type="text" id="edit-first-name" value="${escapeHtml(user.first_name)}" /></label>
        </div>

        <div class="ef-sec">สิทธิ์และรหัสผ่าน</div>
        <label class="ef-f"><span>สิทธิ์ (Role)</span>
          <select id="edit-role">
            <option value="user" ${user.role === "user" ? "selected" : ""}>พนักงาน</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </label>
        <div style="height:12px"></div>
        ${passwordFieldHtml}

        <div class="ef-actions">
          <button type="button" class="btn-clear" onclick="closeUserEditModal()">ยกเลิก</button>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> บันทึก</button>
        </div>
      </form>
    </div>`;
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
  const passwordInput = document.getElementById("edit-new-password");
  const payload = {
    id: userId,
    employee_id: document.getElementById("edit-employee-id").value,
    username: document.getElementById("edit-username").value,
    first_name: document.getElementById("edit-first-name").value,
    role: document.getElementById("edit-role").value,
    // 🌟 ไม่มีช่องนี้เลยสำหรับแถว admin (ซ่อนไว้ตั้งแต่ modal) -> ส่งค่าว่างไป ไม่แตะรหัสผ่าน
    new_password: passwordInput ? passwordInput.value : "",
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

async function deleteUser(userId, username) {
  if (!(await AppDialog.confirm({ title: "ยืนยันการลบ", message: `ยืนยันลบผู้ใช้ "${username}" ออกจากระบบ?`, danger: true }))) return;

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
// แสดงช่อง "เริ่ม/คาดว่าเสร็จ" เฉพาะตอนเลือกสถานะ เช็คระยะ/ซ่อม
function syncSvcDates() {
  const sel = document.getElementById("form-car-status");
  const box = document.getElementById("svc-dates");
  if (box && sel) box.hidden = sel.value !== "เช็คระยะ";
}
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "form-car-status") syncSvcDates();
});
