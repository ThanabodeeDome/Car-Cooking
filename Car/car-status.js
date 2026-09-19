/**
 * Car Status Controller
 * Handles interactive date selection, fleet status carousel, and daily schedule timeline.
 */

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const thaiMonthsShort = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const thaiWeekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// Legacy slot range mapper
const legacySlotRanges = {
  เช้า: ["08:00", "12:00"],
  บ่าย: ["13:00", "17:00"],
  ทั้งวัน: ["08:00", "17:00"],
  กลางคืน: ["17:00", "08:00"],
};

let selectedYear, selectedMonth, selectedDate;
let selectedCarPlate = null;
let selectedCarInfo = null;
let allCarBookings = [];

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  selectedYear = today.getFullYear();
  selectedMonth = today.getMonth();
  selectedDate = formatDate(today);

  populateMonthDropdown();
  renderDayStrip();
  updateDateHint();
  fetchCarsData(selectedDate);

  // Auto-refresh fleet cards every 15 seconds
  setInterval(() => fetchCarsData(selectedDate), 15000);
});

function updateDateHint() {
  const hintEl = document.getElementById("car-section-date-hint");
  if (!hintEl) return;
  const d = new Date(selectedDate);
  const dateStr = `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  hintEl.innerText = `สถานะรถประจำวันที่ ${dateStr} — คลิกเลือกรถเพื่อดูช่วงเวลาว่าง`;
}

/**
 * Dropdown Month & Year Selector
 */
function populateMonthDropdown() {
  const select = document.getElementById("month-select");
  if (!select) return;
  select.innerHTML = "";

  const base = new Date();
  base.setDate(1);

  for (let i = -1; i <= 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const opt = new Option(`${thaiMonths[m]} ${y + 543}`, `${y}-${m}`);
    if (y === selectedYear && m === selectedMonth) opt.selected = true;
    select.add(opt);
  }

  select.addEventListener("change", () => {
    const [y, m] = select.value.split("-").map(Number);
    selectedYear = y;
    selectedMonth = m;
    renderDayStrip();

    const firstDay = new Date(selectedYear, selectedMonth, 1);
    selectDate(formatDate(firstDay), document.querySelector(".day-pill"));
  });
}

/**
 * Horizontal Day Strip Ribbon
 */
function renderDayStrip() {
  const strip = document.getElementById("day-strip");
  if (!strip) return;
  strip.innerHTML = "";

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const today = formatDate(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(selectedYear, selectedMonth, day);
    const dateStr = formatDate(d);
    const weekday = thaiWeekdays[d.getDay()];
    const isToday = dateStr === today;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "day-pill" +
      (dateStr === selectedDate ? " active" : "") +
      (isToday ? " is-today" : "");
    btn.innerHTML = `<span class="day-weekday">${weekday}</span><span class="day-num">${day}</span>`;
    btn.onclick = () => selectDate(dateStr, btn);
    strip.appendChild(btn);
  }

  const activeEl = strip.querySelector(".day-pill.active");
  if (activeEl) {
    activeEl.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
  }
}

/**
 * Handle day selection
 */
function selectDate(dateStr, btnEl) {
  selectedDate = dateStr;
  document
    .querySelectorAll(".day-pill")
    .forEach((el) => el.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  updateDateHint();
  fetchCarsData(selectedDate);

  // If a car was already selected, refresh its schedule for the new date
  if (selectedCarPlate) {
    loadCarBookings(selectedCarPlate);
  } else {
    renderBookingStatusPanel();
  }
}

/**
 * Fetch cars data for selected date
 */
function fetchCarsData(dateStr) {
  const grid = document.getElementById("car-grid");
  if (!grid) return;
  const dateParam = dateStr || selectedDate;

  fetch(`get_cars.php?date=${encodeURIComponent(dateParam)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!Array.isArray(data)) return;

      grid.innerHTML = "";
      const order = { ว่าง: 1, ติดจอง: 2, กำลังใช้งาน: 3, งดให้บริการ: 4, เช็คระยะ: 5 };
      const sortedCars = data.sort(
        (a, b) => (order[a.RealStatus] || 99) - (order[b.RealStatus] || 99)
      );

      sortedCars.forEach((car) => {
        const status = car.RealStatus || "ว่าง";
        const isMaintenance = status === "เช็คระยะ" || status === "งดให้บริการ";
        const imageSrc =
          "assets/img-car/" + (car.Carimage || "car-placeholder.png");

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

        const isSelected = car.Plate === selectedCarPlate;

        const card = document.createElement("div");
        card.className = `car-card ${isMaintenance ? "is-off" : ""} ${isSelected ? "is-selected" : ""}`;
        card.onclick = () => {
          if (!isMaintenance) {
            selectCarForCalendar(car, card);
          }
        };

        card.innerHTML = `
          <div class="car-item">
            <div class="card-image">
              <img
                src="${imageSrc}"
                alt="${escapeHtml(car.Brand || 'รถยนต์')}"
                onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';"
              />
              <span class="status-tag tag-${statusClass}">
                <i class="${statusIcon}"></i>
                <span>${status}</span>
              </span>
            </div>
            <div class="card-body">
              <h4>${escapeHtml(car.Brand || "")} ${escapeHtml(car.Model || "")}</h4>
              <div>
                <span class="plate-pill">
                  <i class="fa-solid fa-id-card"></i>
                  <span>${escapeHtml(car.Plate || "-")}</span>
                </span>
              </div>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch((err) => console.error("Error loading cars:", err));
}

/**
 * Handle car selection
 */
function selectCarForCalendar(car, cardEl) {
  selectedCarPlate = car.Plate;
  selectedCarInfo = car;

  document
    .querySelectorAll(".car-card")
    .forEach((el) => el.classList.remove("is-selected"));
  if (cardEl) cardEl.classList.add("is-selected");

  // Update step indicators
  const stepCar = document.getElementById("step-badge-car");
  const stepTime = document.getElementById("step-badge-time");
  if (stepCar) stepCar.classList.add("active");
  if (stepTime) stepTime.classList.add("active");

  loadCarBookings(car.Plate);
}

/**
 * Load booking time slots for selected car
 */
function loadCarBookings(plate) {
  const panel = document.getElementById("booking-status-panel");
  if (panel) {
    panel.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #94a3b8;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 10px; color: var(--primary-color);"></i>
        <p>กำลังตรวจสอบตารางการจอง...</p>
      </div>`;
  }

  fetch(`get_car_bookings.php?plate=${encodeURIComponent(plate)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        if (panel) {
          panel.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px;">${data.message || "โหลดข้อมูลไม่สำเร็จ"}</p>`;
        }
        return;
      }
      allCarBookings = data.bookings || [];
      renderBookingStatusPanel();
    })
    .catch((err) => {
      console.error("Error loading car bookings:", err);
      if (panel) {
        panel.innerHTML = `<p style="color:#ef4444; text-align:center; padding:20px;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>`;
      }
    });
}

/**
 * Parse booking row to range object
 */
function bookingToRange(bk) {
  const outTime = (bk.OutTime || "").slice(0, 5);
  const returnTime = (bk.PlannedReturnTime || "").slice(0, 5);

  if (outTime && returnTime) {
    return {
      start: outTime,
      end: returnTime,
      overnight: returnTime <= outTime,
    };
  }

  if (bk.TimeSlot && legacySlotRanges[bk.TimeSlot]) {
    const [start, end] = legacySlotRanges[bk.TimeSlot];
    return { start, end, overnight: bk.TimeSlot === "กลางคืน" };
  }

  return null;
}

/**
 * Render time slots timeline panel
 */
function renderBookingStatusPanel() {
  const panel = document.getElementById("booking-status-panel");
  if (!panel) return;

  if (!selectedCarPlate) {
    panel.innerHTML = `
      <div class="empty-selection-placeholder">
        <i class="fa-solid fa-hand-pointer placeholder-icon"></i>
        <h3>ยังไม่ได้เลือกรถยนต์</h3>
        <p>โปรดคลิกเลือกรถยนต์จากรายการด้านบน เพื่อดูตารางเวลาการจองและคิวว่างของวันนั้น</p>
      </div>`;
    return;
  }

  const bookingsToday = allCarBookings.filter(
    (bk) => bk.BookingDate === selectedDate
  );

  const dateObj = new Date(selectedDate);
  const dateLabel = `${dateObj.getDate()} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;

  const carTitle = selectedCarInfo
    ? `${selectedCarInfo.Brand || ""} ${selectedCarInfo.Model || ""}`
    : selectedCarPlate;

  const ranges = bookingsToday
    .map((bk) => {
      const r = bookingToRange(bk);
      return r
        ? {
            ...r,
            driverName: bk.DriverName,
            destination: bk.Destination,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));

  const rangeCard = (r) => `
    <div class="slot-card slot-busy">
      <div class="slot-icon-box ${r.overnight ? "slot-icon-overnight" : ""}">
        <i class="${r.overnight ? "fa-solid fa-moon" : "fa-solid fa-car-side"}"></i>
      </div>
      <div class="slot-info">
        <h4>${r.start} - ${r.end} น. ${r.overnight ? '<span style="font-size:0.75rem; color:#a78bfa;">(ข้ามคืน)</span>' : ""}</h4>
        <p><i class="fa-solid fa-user" style="font-size:0.78rem; opacity:0.7;"></i> จองโดย <strong>${escapeHtml(r.driverName || "ไม่ระบุ")}</strong></p>
        ${r.destination ? `<p style="font-size:0.8rem; color:#f87171; margin-top:2px;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(r.destination)}</p>` : ""}
      </div>
    </div>`;

  let contentHtml = "";
  if (ranges.length > 0) {
    contentHtml = `<div class="slot-grid">${ranges.map(rangeCard).join("")}</div>`;
  } else {
    contentHtml = `
      <div class="slot-free-card">
        <div class="slot-free-left">
          <div class="slot-free-icon">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h4>ว่างตลอดทั้งวัน</h4>
            <p>ยังไม่มีคิวการจองในวันนี้ สามารถจองใช้งานได้ทันที</p>
          </div>
        </div>
        <a href="booking.html" class="btn-book-slot">
          <i class="fa-solid fa-calendar-plus"></i>
          <span>จองรถคันนี้ในวันที่เลือก</span>
        </a>
      </div>`;
  }

  const tl24Html = buildTimeline24(selectedDate);

  panel.innerHTML = `
    <div class="selected-car-header">
      <div class="selected-car-title">
        <i class="fa-solid fa-car" style="color: var(--primary-color);"></i>
        <span>${escapeHtml(carTitle)}</span>
        <span class="plate-pill">${escapeHtml(selectedCarPlate)}</span>
      </div>
      <div class="selected-car-date">
        <i class="fa-regular fa-calendar-check"></i>
        <span>วันที่ ${dateLabel}</span>
      </div>
    </div>
    ${tl24Html}
    ${contentHtml}
  `;
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
/**
 * 24-hour availability timeline: red = busy (booked / in use), green = free, grey = already passed
 */
function hourStatesForDate(dateStr) {
  const states = [];
  for (let h = 0; h < 24; h++) states.push({ busy: false, inUse: false, driver: "" });

  const prev = new Date(dateStr + "T00:00:00");
  prev.setDate(prev.getDate() - 1);
  const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;

  const toHour = (t) => {
    const p = String(t || "").split(":");
    return p.length < 2 ? null : Number(p[0]) + Number(p[1]) / 60;
  };

  allCarBookings.forEach((bk) => {
    const outH = toHour(bk.OutTime);
    const retH = toHour(bk.PlannedReturnTime);
    if (outH === null || retH === null) return;

    let range = null;
    if (bk.BookingDate === dateStr) range = [outH, retH <= outH ? retH + 24 : retH];
    else if (bk.BookingDate === prevStr && retH <= outH) range = [0, retH]; // overnight from yesterday

    if (!range) return;
    for (let h = 0; h < 24; h++) {
      if (h < range[1] && h + 1 > range[0]) {
        states[h] = { busy: true, inUse: bk.BookingStatus === "ขาไป", driver: bk.DriverName || "" };
      }
    }
  });
  return states;
}

function buildTimeline24(dateStr) {
  const states = hourStatesForDate(dateStr);
  const now = new Date();

  const cells = states
    .map((s, h) => {
      const hh = String(h).padStart(2, "0") + ":00";
      const hourEnd = new Date(`${dateStr}T${hh}:00`);
      hourEnd.setHours(hourEnd.getHours() + 1);

      if (s.busy) {
        const label = s.inUse ? "ใช้งานอยู่" : "จองแล้ว";
        return `<div class="tl24-cell is-busy" title="${escapeHtml(label + (s.driver ? " · " + s.driver : ""))}">
          <span class="tl-h">${hh}</span><span class="tl-s">${label}</span>
          <span class="tl-who">${escapeHtml(s.driver)}</span></div>`;
      }
      if (hourEnd <= now) {
        return `<div class="tl24-cell is-past"><span class="tl-h">${hh}</span><span class="tl-s">ผ่านไปแล้ว</span></div>`;
      }
      return `<a class="tl24-cell is-free" href="booking.html" title="ว่าง — แตะเพื่อไปหน้าจอง">
        <span class="tl-h">${hh}</span><span class="tl-s">ว่าง</span></a>`;
    })
    .join("");

  return `
    <div class="tl24">
      <div class="tl24-head">
        <h4><i class="fa-regular fa-clock"></i> ตารางรถ 24 ชั่วโมง</h4>
        <div class="tl24-legend">
          <span><i class="lg-free"></i>ว่าง</span>
          <span><i class="lg-busy"></i>ไม่ว่าง (จอง / ใช้งานอยู่)</span>
          <span><i class="lg-past"></i>ผ่านไปแล้ว</span>
        </div>
      </div>
      <div class="tl24-grid">${cells}</div>
    </div>`;
}
