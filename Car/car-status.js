document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  selectedYear = today.getFullYear();
  selectedMonth = today.getMonth();
  selectedDate = formatDate(today);

  populateMonthDropdown();
  renderDayStrip();
  fetchCarsData(selectedDate);
  setInterval(() => fetchCarsData(selectedDate), 15000); // 🌟 รีเฟรชการ์ดรถทุก 15 วิ (ของวันที่กำลังดูอยู่)
});

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const thaiWeekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

let selectedYear,
  selectedMonth,
  selectedDate,
  selectedCarPlate = null;
let allCarBookings = [];

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------- Dropdown เดือน ----------
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

    // 🌟 เปลี่ยนเดือนแล้ว วันเดิมอาจไม่มีอยู่ในเดือนใหม่ → ตั้งเป็นวันที่ 1 ของเดือนนั้นแทน
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    selectDate(formatDate(firstDay), document.querySelector(".day-pill"));
  });
}

// ---------- แถบวันเลื่อนแนวนอน ----------
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
  if (activeEl)
    activeEl.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
}

function selectDate(dateStr, btnEl) {
  selectedDate = dateStr;
  document
    .querySelectorAll(".day-pill")
    .forEach((el) => el.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  // 🌟 เปลี่ยนวัน → สถานะรถ (ว่าง/ติดจอง/กำลังใช้งาน) เปลี่ยนตามวันนั้นด้วย ต้องโหลดใหม่
  fetchCarsData(selectedDate);

  // เคลียร์รถที่เคยเลือกไว้ เพราะบริบท "วันนี้" เปลี่ยนไปแล้ว ให้ผู้ใช้กดเลือกใหม่
  selectedCarPlate = null;
  document
    .querySelectorAll(".car-item")
    .forEach((el) => el.classList.remove("is-selected"));
  renderBookingStatusPanel();
}

// ---------- การ์ดรถ ----------
function fetchCarsData(dateStr) {
  const grid = document.getElementById("car-grid");
  if (!grid) return;
  const dateParam = dateStr || selectedDate;

  fetch(`get_cars.php?date=${encodeURIComponent(dateParam)}`)
    .then((res) => res.json())
    .then((data) => {
      grid.innerHTML = "";
      const order = { ว่าง: 1, ติดจอง: 2, กำลังใช้งาน: 3, งดให้บริการ: 4 };
      const sortedCars = data.sort(
        (a, b) => (order[a.RealStatus] || 99) - (order[b.RealStatus] || 99),
      );

      sortedCars.forEach((car) => {
        const status = car.RealStatus;
        const isMaintenance = status === "เช็คระยะ";
        const imageSrc =
          "assets/img-car/" + (car.Carimage || "car-placeholder.png");
        const statusClass =
          status === "ว่าง"
            ? "available"
            : status === "ติดจอง"
              ? "booked"
              : status === "กำลังใช้งาน"
                ? "inuse"
                : "maintenance";

        const card = document.createElement("div");
        card.className = `car-card ${isMaintenance ? "is-off" : ""}`;
        card.innerHTML = `
          <div class="car-item ${car.Plate === selectedCarPlate ? "is-selected" : ""}" onclick="selectCarForCalendar('${car.Plate}', this)">
            <div class="card-image">
              <img src="${imageSrc}" alt="${car.Brand}" onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';">
              <span class="status-tag tag-${statusClass}">${status}</span>
            </div>
            <div class="card-body">
              <h4>${car.Brand} ${car.Model}</h4>
              <p>${car.Plate}</p>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch((err) => console.error("Error loading cars:", err));
}

function selectCarForCalendar(plate, cardEl) {
  selectedCarPlate = plate;
  document
    .querySelectorAll(".car-item")
    .forEach((el) => el.classList.remove("is-selected"));
  if (cardEl) cardEl.classList.add("is-selected");
  loadCarBookings(plate);
}

function loadCarBookings(plate) {
  const panel = document.getElementById("booking-status-panel");
  if (panel)
    panel.innerHTML = `<p style="color:#94a3b8; text-align:center;">กำลังโหลดข้อมูล...</p>`;

  fetch(`get_car_bookings.php?plate=${encodeURIComponent(plate)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        if (panel)
          panel.innerHTML = `<p style="color:#ef4444; text-align:center;">${data.message || "โหลดข้อมูลไม่สำเร็จ"}</p>`;
        return;
      }
      allCarBookings = data.bookings || [];
      renderBookingStatusPanel();
    })
    .catch((err) => {
      console.error("Error loading car bookings:", err);
      if (panel)
        panel.innerHTML = `<p style="color:#ef4444; text-align:center;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>`;
    });
}

// ---------- แผงสถานะเช้า/บ่าย ----------
function renderBookingStatusPanel() {
  const panel = document.getElementById("booking-status-panel");
  if (!panel) return;

  if (!selectedCarPlate) {
    panel.innerHTML = `<p style="color:#94a3b8; text-align:center;">👆 กรุณาเลือกรถด้านบนก่อน</p>`;
    return;
  }

  const bookingsToday = allCarBookings.filter(
    (bk) => bk.BookingDate === selectedDate,
  );
  const findSlot = (slot) =>
    bookingsToday.find(
      (bk) => bk.TimeSlot === slot || bk.TimeSlot === "ทั้งวัน",
    );

  const morning = findSlot("เช้า");
  const afternoon = findSlot("บ่าย");

  const dateObj = new Date(selectedDate);
  const dateLabel = `${dateObj.getDate()} ${thaiMonths[dateObj.getMonth()]} ${dateObj.getFullYear() + 543}`;

  panel.innerHTML = `
    <h3 style="color:#fff; margin-bottom:15px;">📅 ${selectedCarPlate} — วันที่ ${dateLabel}</h3>
    <div class="slot-grid">
      <div class="slot-card ${morning ? "slot-busy" : "slot-free"}">
        <div class="slot-icon">🌅</div>
        <div class="slot-info">
          <h4>เช้า (08:00-12:00)</h4>
          ${morning ? `<p>ไม่ว่าง — จองโดย ${morning.DriverName}</p>` : `<p>ว่าง</p>`}
        </div>
      </div>
      <div class="slot-card ${afternoon ? "slot-busy" : "slot-free"}">
        <div class="slot-icon">☀️</div>
        <div class="slot-info">
          <h4>บ่าย (13:00-17:00)</h4>
          ${afternoon ? `<p>ไม่ว่าง — จองโดย ${afternoon.DriverName}</p>` : `<p>ว่าง</p>`}
        </div>
      </div>
    </div>
  `;
}
