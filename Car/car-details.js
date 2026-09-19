/**
 * Car Details Controller
 * Handles live fleet status display, specs, compliance chips, filtering, and search.
 */

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let allCars = [];
let currentCarFilter = "all";
let currentCarSearch = "";

document.addEventListener("DOMContentLoaded", function () {
  loadCars();
  // Auto-refresh fleet status every 15 seconds
  setInterval(loadCars, 15000);
});

/**
 * Brand icon mapper
 */
function brandIcon(brand) {
  const b = (brand || "").toLowerCase();
  if (b.includes("toyota")) return '<i class="fa-solid fa-car-side"></i>';
  if (b.includes("chevrolet") || b.includes("isuzu") || b.includes("ford")) {
    return '<i class="fa-solid fa-truck-pickup"></i>';
  }
  if (b.includes("mazda") || b.includes("honda") || b.includes("nissan")) {
    return '<i class="fa-solid fa-car"></i>';
  }
  return '<i class="fa-solid fa-car-side"></i>';
}

/**
 * Format YYYY-MM-DD -> Thai Buddhist Date (e.g. 15 ส.ค. 2569)
 */
const thaiMonthsShort = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function formatThaiDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getDate()} ${thaiMonthsShort[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function daysUntil(dateStr) {
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Build compliance badge for Insurance, Act, Maintenance
 */
function complianceChip({ icon, label, dateStr, fallback, mode }) {
  const formatted = formatThaiDate(dateStr);

  if (!formatted) {
    return `
      <div class="compliance-chip chip-none">
        <div class="chip-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="chip-body">
          <span class="chip-label">${label}</span>
          <span class="chip-value">${fallback}</span>
        </div>
      </div>`;
  }

  if (mode === "expiry") {
    const days = daysUntil(dateStr);
    let statusClass = "chip-ok";
    let badge = `เหลือ ${days} วัน`;
    if (days < 0) {
      statusClass = "chip-overdue";
      badge = `เกินกำหนด ${Math.abs(days)} วัน`;
    } else if (days <= 30) {
      statusClass = "chip-soon";
      badge = `ใกล้หมดอายุ (เหลือ ${days} วัน)`;
    }
    return `
      <div class="compliance-chip ${statusClass}">
        <div class="chip-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="chip-body">
          <span class="chip-label">${label}</span>
          <span class="chip-value">${formatted}</span>
          <span class="chip-badge">${badge}</span>
        </div>
      </div>`;
  }

  // mode === "history" (e.g. Last Maintenance)
  return `
    <div class="compliance-chip chip-neutral">
      <div class="chip-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="chip-body">
        <span class="chip-label">${label}</span>
        <span class="chip-value">${formatted}</span>
      </div>
    </div>`;
}

/**
 * Load cars from backend
 */
function loadCars() {
  fetch("get_cars.php")
    .then((response) => response.json())
    .then((data) => {
      const container = document.getElementById("car-list-display");
      if (!container) return;

      if (!Array.isArray(data)) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3>ไม่สามารถโหลดข้อมูลรถยนต์ได้</h3>
            <p>${data.message || "เกิดข้อผิดพลาดในการติดต่อฐานข้อมูล"}</p>
          </div>`;
        return;
      }

      allCars = data;
      updateFleetMetrics(allCars);
      applyCarFilterAndRender();
    })
    .catch((error) => {
      console.error("Error loading cars:", error);
      const container = document.getElementById("car-list-display");
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-plug-circle-xmark"></i></div>
            <h3>ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</h3>
            <p>โปรดตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง</p>
          </div>`;
      }
    });
}

/**
 * Update summary counters & tab badges
 */
function updateFleetMetrics(cars) {
  let countAvailable = 0;
  let countInUse = 0;
  let countMaintenance = 0;

  cars.forEach((car) => {
    const s = car.RealStatus;
    if (s === "ว่าง") {
      countAvailable++;
    } else if (s === "ติดจอง" || s === "กำลังใช้งาน") {
      countInUse++;
    } else {
      countMaintenance++;
    }
  });

  const total = cars.length;

  const setVal = (id, num) => {
    const el = document.getElementById(id);
    if (el) el.innerText = num.toLocaleString("th-TH");
  };

  setVal("car-count-all", total);
  setVal("car-count-available", countAvailable);
  setVal("car-count-inuse", countInUse);
  setVal("car-count-maintenance", countMaintenance);

  setVal("tab-badge-all", total);
  setVal("tab-badge-available", countAvailable);
  setVal("tab-badge-inuse", countInUse);
  setVal("tab-badge-maintenance", countMaintenance);
}

/**
 * Filter cars and render list
 */
function applyCarFilterAndRender() {
  const container = document.getElementById("car-list-display");
  if (!container) return;

  container.innerHTML = "";

  const q = currentCarSearch.trim().toLowerCase();

  const filtered = allCars.filter((car) => {
    const s = car.RealStatus;
    const isAvailable = s === "ว่าง";
    const isInUse = s === "ติดจอง" || s === "กำลังใช้งาน";
    const isMaintenance = s === "งดให้บริการ" || s === "เช็คระยะ";

    // Tab filter
    if (currentCarFilter === "available" && !isAvailable) return false;
    if (currentCarFilter === "inuse" && !isInUse) return false;
    if (currentCarFilter === "maintenance" && !isMaintenance) return false;

    // Search query filter
    if (q) {
      const searchTarget = `
        ${car.Brand || ""}
        ${car.Model || ""}
        ${car.Plate || ""}
        ${car.Color || ""}
      `.toLowerCase();
      if (!searchTarget.includes(q)) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    if (allCars.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-car-rear"></i></div>
          <h3>ยังไม่มีข้อมูลรถยนต์ในระบบ</h3>
          <p>ขณะนี้ยังไม่มีรถยนต์ถูกบันทึกในฐานข้อมูลระบบ</p>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-car-burst"></i></div>
          <h3>ไม่พบรถยนต์ที่ตรงกับเงื่อนไขการค้นหา</h3>
          <p>โปรดลองเปลี่ยนคำค้นหา หรือเลือกแท็บสถานะอื่น</p>
          <button type="button" class="tab-pill" onclick="resetCarFilters()">
            <i class="fa-solid fa-arrow-rotate-left"></i> ล้างตัวกรองทั้งหมด
          </button>
        </div>`;
    }
    return;
  }

  filtered.forEach((car) => {
    const imgPath = "assets/img-car/" + (car.Carimage || "car-placeholder.png");
    const status = car.RealStatus || "ว่าง";

    let statusClass = "available";
    let statusIcon = "fa-solid fa-circle-check";

    if (status === "ว่าง") {
      statusClass = "available";
      statusIcon = "fa-solid fa-circle-check";
    } else if (status === "ติดจอง") {
      statusClass = "booked";
      statusIcon = "fa-solid fa-hourglass-half";
    } else if (status === "กำลังใช้งาน") {
      statusClass = "inuse";
      statusIcon = "fa-solid fa-car-side";
    } else {
      statusClass = "maintenance";
      statusIcon = "fa-solid fa-screwdriver-wrench";
    }

    const isAvailable = status === "ว่าง";

    // Action button
    const bookButton = isAvailable
      ? `<a href="booking.html" class="btn-card-book">
           <i class="fa-solid fa-calendar-plus"></i> จองรถคันนี้
         </a>`
      : `<span class="btn-card-book-disabled" title="รถอยู่ในสถานะ ${status}">
           <i class="fa-solid fa-lock"></i> ไม่พร้อมจอง (${status})
         </span>`;

    const cardHTML = `
      <article class="car-row-card">
        <!-- Car Image & Status -->
        <div class="car-row-img-wrap">
          <img
            src="${imgPath}"
            alt="${escapeHtml(car.Model || 'รถยนต์')}"
            onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';"
          />
          <span class="car-status-badge status-${statusClass}">
            <i class="${statusIcon}"></i>
            <span>${status}</span>
          </span>
        </div>

        <!-- Car Body & Specs -->
        <div class="car-row-body">
          <div>
            <!-- Top: Brand & Title -->
            <div class="car-row-top">
              <div class="car-title-wrapper">
                <span class="car-brand-icon">${brandIcon(car.Brand)}</span>
                <h3>${escapeHtml(car.Brand || "")} ${escapeHtml(car.Model || "")}</h3>
              </div>
            </div>

            <!-- Specs Chips -->
            <div class="car-specs-row">
              <span class="spec-plate-badge">
                <i class="fa-solid fa-id-card"></i>
                <span>${escapeHtml(car.Plate || "-")}</span>
              </span>

              <span class="spec-chip">
                <i class="fa-solid fa-palette"></i>
                <span>สี${escapeHtml(car.Color || "-")}</span>
              </span>

              <span class="spec-chip">
                <i class="fa-solid fa-gauge-high"></i>
                <span>${car.Mileage ? Number(car.Mileage).toLocaleString("th-TH") + " กม." : "-"}</span>
              </span>
            </div>

            <!-- Compliance Grid -->
            <div class="compliance-grid">
              ${complianceChip({
                icon: "fa-shield-halved",
                label: "ประกันภัยหมดอายุ",
                dateStr: car.InsuranceExpiry,
                fallback: "ไม่มีข้อมูล",
                mode: "expiry",
              })}
              ${complianceChip({
                icon: "fa-file-shield",
                label: "พ.ร.บ. หมดอายุ",
                dateStr: car.ActExpiry,
                fallback: "ไม่มีข้อมูล",
                mode: "expiry",
              })}
              ${complianceChip({
                icon: "fa-screwdriver-wrench",
                label: "เช็คระยะล่าสุด",
                dateStr: car.LastMaintenance,
                fallback: "ยังไม่มีประวัติ",
                mode: "history",
              })}
              ${complianceChip({
                icon: "fa-calendar-check",
                label: "เช็คระยะครั้งถัดไป",
                dateStr: car.NextMaintenance,
                fallback: "ไม่มีกำหนด",
                mode: "expiry",
              })}
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="car-card-bottom-actions">
            <div class="car-action-links">
              <a href="car-status.html" class="btn-card-queue" title="ตรวจสอบตารางคิวรถ">
                <i class="fa-solid fa-calendar-week"></i>
                <span>ดูคิวรถ</span>
              </a>
            </div>

            <div>
              ${bookButton}
            </div>
          </div>
        </div>
      </article>`;

    container.innerHTML += cardHTML;
  });
}

/**
 * Filter Tabs Controller
 */
function filterCarsByTab(tabKey) {
  currentCarFilter = tabKey;

  document.querySelectorAll("#car-filter-tabs .tab-pill").forEach((btn) => {
    if (btn.dataset.filter === tabKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  applyCarFilterAndRender();
}

/**
 * Search Controller
 */
function filterCarSearch(keyword) {
  currentCarSearch = keyword || "";
  const clearBtn = document.getElementById("clear-search-btn");
  if (clearBtn) {
    clearBtn.style.display = currentCarSearch.trim() ? "flex" : "none";
  }
  applyCarFilterAndRender();
}

function clearCarSearch() {
  const input = document.getElementById("car-search");
  if (input) input.value = "";
  filterCarSearch("");
}

function resetCarFilters() {
  clearCarSearch();
  filterCarsByTab("all");
}

/**
 * HTML Escaper
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