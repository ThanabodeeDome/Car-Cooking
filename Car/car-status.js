document.addEventListener("DOMContentLoaded", () => {
  fetchCarsData();
  renderCalendar();
});

let selectedCarPlate = null;
let monthlyCalendar;

// ---------- การ์ดรถ ----------
function fetchCarsData() {
  const grid = document.getElementById("car-grid");
  if (!grid) return;

  fetch("get_cars.php")
    .then((res) => res.json())
    .then((data) => {
      grid.innerHTML = "";

      const order = { ว่าง: 1, ไม่ว่าง: 2, เช็คระยะ: 3 };
      const sortedCars = data.sort(
        (a, b) => (order[a.CarStatus] || 99) - (order[b.CarStatus] || 99),
      );

      sortedCars.forEach((car) => {
        const isMaintenance = car.CarStatus === "เช็คระยะ";
        const imageSrc =
          "assets/img-car/" + (car.Carimage || "car-placeholder.png");
        const statusClass =
          car.CarStatus === "ว่าง"
            ? "available"
            : car.CarStatus === "ไม่ว่าง"
              ? "busy"
              : "repair";

        const card = document.createElement("div");
        card.className = `car-card ${isMaintenance ? "is-off" : ""}`;
        card.innerHTML = `
          <div class="car-item" onclick="selectCarForCalendar('${car.Plate}', this)">
            <div class="card-image">
              <img src="${imageSrc}" alt="${car.Brand}" onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';">
              <span class="status-tag tag-${statusClass}">${car.CarStatus}</span>
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

// ---------- เลือกรถ -> โหลดปฏิทิน ----------
function selectCarForCalendar(plate, cardEl) {
  selectedCarPlate = plate;

  document
    .querySelectorAll(".car-item")
    .forEach((el) => el.classList.remove("is-selected"));
  if (cardEl) cardEl.classList.add("is-selected");

  const label = document.getElementById("calendar-selected-car-label");
  if (label) label.innerText = `📅 กำลังแสดงตารางของรถ: ${plate}`;

  loadCarBookingsForCalendar(plate);
}

function loadCarBookingsForCalendar(plate) {
  fetch(`get_car_bookings.php?plate=${encodeURIComponent(plate)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        alert(data.message || "โหลดข้อมูลการจองไม่สำเร็จ");
        return;
      }
      updateCalendarEvents(data.bookings.map(bookingToEvent));
    })
    .catch((err) => console.error("Error loading car bookings:", err));
}

function bookingToEvent(bk) {
  let start, end, color;

  if (bk.TimeSlot === "เช้า") {
    start = `${bk.BookingDate}T08:00:00`;
    end = `${bk.BookingDate}T12:00:00`;
    color = "#3b82f6";
  } else if (bk.TimeSlot === "บ่าย") {
    start = `${bk.BookingDate}T13:00:00`;
    end = `${bk.BookingDate}T17:00:00`;
    color = "#f59e0b";
  } else {
    start = `${bk.BookingDate}T08:00:00`;
    end = `${bk.BookingDate}T17:00:00`;
    color = "#ef4444";
  }

  return {
    title: `${bk.TimeSlot || "-"} • ${bk.DriverName}`,
    start,
    end,
    color,
  };
}

// ---------- ปฏิทิน ----------
function renderCalendar() {
  const calendarEl = document.getElementById("calendar-full");
  if (!calendarEl) return;

  monthlyCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "th",
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    events: [],
    eventDidMount: (info) => (info.el.title = info.event.title),
  });

  monthlyCalendar.render();
}

function updateCalendarEvents(events) {
  if (!monthlyCalendar) return;
  monthlyCalendar.removeAllEvents();
  events.forEach((ev) => monthlyCalendar.addEvent(ev));
}
