/**
 * ส่วนที่ 1: ตัวควบคุมหลัก (Main Controller)
 * รวม Event Listener ให้เหลือจุดเดียวเพื่อประสิทธิภาพ
 */
document.addEventListener("DOMContentLoaded", () => {
  fetchCarsData(); // ดึงข้อมูลรถยนต์มาโชว์
  renderCalendar(); // สร้าง/แสดงปฏิทิน
  fetchBookingHistory(); // ดึงประวัติการจองมาโชว์ในตาราง
});

/**
 * ส่วนที่ 2: ฟังก์ชันดึงข้อมูลรถยนต์ (Car Data)
 */
function fetchCarsData() {
  const grid = document.getElementById("car-grid");
  if (!grid) return;

  fetch("get_cars.php")
    .then((res) => res.json())
    .then((data) => {
      console.log("ข้อมูลรถจาก PHP:", data);
      grid.innerHTML = "";

      // 1. เรียงลำดับข้อมูล: ว่าง (available) > ไม่ว่าง (busy/repair) > พัง (broken)
      const sortedCars = data.sort((a, b) => {
        const order = { available: 1, busy: 2, repair: 3, broken: 4 };
        return (order[a.status] || 99) - (order[b.status] || 99);
      });

      sortedCars.forEach((car) => {
        const card = document.createElement("div");

        // 2. เช็กสถานะเพื่อกำหนดการ "ดับไฟ" และ "ห้ามกด"
        const isBroken =
          car.status === "broken" || car.status === "out_of_service";
        const isRepair = car.status === "repair";
        const canClick = !isBroken && !isRepair;

        // เพิ่ม Class 'is-off' สำหรับรถที่พังเพื่อให้ CSS ดับไฟ
        card.className = `car-card ${isBroken ? "is-off" : ""}`;

        // 3. กำหนด Path รูปภาพไปยังโฟลเดอร์ img-car
        // แก้ไขบรรทัดที่ 42 เป็นแบบนี้ครับ
        const imageSrc = `/img-car/${car.image}`;

        card.innerHTML = `
                    <div class="car-item" ${canClick ? `onclick="filterCalendar('${car.plate}')"` : ""}>
                        <div class="card-image">
                            <!-- ใช้ onerror เพื่อหยุด loop หากหารูปไม่เจอจริง ๆ -->
                            <img src="${imageSrc}" alt="${car.brand}" onerror="this.onerror=null; this.src='../img-car/default.png';">
                            <span class="status-tag tag-${car.status}">${getStatusText(car.status)}</span>
                        </div>
                        ...
                `;
        grid.appendChild(card);
      });
    })
    .catch((err) => console.error("Error loading cars:", err));
}

/**
 * ฟังก์ชันช่วยแปลง Status เป็นข้อความภาษาไทย
 */
function getStatusText(status) {
  const statusMap = {
    available: "ว่าง",
    busy: "กำลังใช้งาน",
    repair: "กำลังซ่อม",
    broken: "ใช้งานไม่ได้",
  };
  return statusMap[status] || status;
}

// 1. ประกาศตัวแปร Global เพื่อให้ฟังก์ชันรู้จักกัน
let monthlyCalendar;
let timelineCalendar;

// --- ส่วนที่ 4: ฟังก์ชันจัดการปฏิทินรายเดือน (ด้านบน) ---
function renderCalendar() {
  const calendarEl = document.getElementById("calendar-full");
  if (!calendarEl) return;

  monthlyCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "th",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    selectable: true, // ทำให้เลือกวันที่ได้

    // **จุดสำคัญ: เมื่อคลิกวันที่ในปฏิทินรายเดือน**
    dateClick: function (info) {
      if (timelineCalendar) {
        // สั่งให้ตารางรายชั่วโมงด้านล่าง เปลี่ยนไปเป็นวันที่ที่กด
        timelineCalendar.gotoDate(info.dateStr);

        // (เสริม) เลื่อนหน้าจอลงไปที่ตารางรายชั่วโมงอัตโนมัติเพื่อให้เห็นข้อมูล
        document
          .getElementById("calendar-timeline")
          .scrollIntoView({ behavior: "smooth" });
      }
    },

    events: "get_calendar_events.php", // ดึงข้อมูลสถานะว่าง/เต็ม
  });

  monthlyCalendar.render();
}

// --- ส่วนที่ 5: ฟังก์ชันตารางรายชั่วโมง (ด้านล่าง) ---
// ค้นหาฟังก์ชัน renderTimelineCalendar แล้วแก้โค้ดข้างในตามนี้ครับ
function renderTimelineCalendar() {
  const timelineEl = document.getElementById("calendar-timeline");
  if (!timelineEl) return;

  timelineCalendar = new FullCalendar.Calendar(timelineEl, {
    initialView: "listDay", // *** เปลี่ยนเป็นโหมดรายการ (List) ***
    locale: "th",
    headerToolbar: false, // *** ปิดแถบเมนูเดิมเพื่อความสะอาด ***

    // กำหนดข้อความเมื่อไม่มีการจอง
    noEventsContent: "ไม่มีรายการจองในวันนี้",

    // แหล่งข้อมูล
    events: "get_timeline_events.php",

    // ตกแต่งส่วนหัวของรายการ
    listDaySideFormat: false, // ปิดตัวเลขวันที่ด้านข้างให้เหลือแค่ชื่อวัน

    eventDidMount: function (info) {
      // ปรับแต่งสีจุดกลมหน้าชื่อ (ถ้าต้องการเปลี่ยนตามสถานะ)
      const dot = info.el.querySelector(".fc-list-event-dot");
      if (dot) dot.style.borderColor = "#00c853"; // สีเขียวสว่างแบบในรูป
    },
  });
  timelineCalendar.render();
}

// เรียกใช้งานพร้อมกันตอนโหลดหน้า
document.addEventListener("DOMContentLoaded", () => {
  fetchCarsData();
  renderCalendar(); // ปฏิทินเดือน
  renderTimelineCalendar(); // ตารางรายชั่วโมง
  fetchBookingHistory();
});

/**
 * ฟังก์ชันสำหรับ Filter เมื่อกดเลือกรถ
 */
function filterCalendar(carPlate) {
  if (!calendar) return;

  const newSource = `get_calendar_events.php?plate=${carPlate}`;

  // ลบ Source ข้อมูลเก่าและโหลดข้อมูลใหม่เฉพาะรถคันที่เลือก
  const oldSources = calendar.getEventSources();
  oldSources.forEach((source) => source.remove());
  calendar.addEventSource(newSource);

  alert("กำลังแสดงปฏิทินของรถทะเบียน: " + carPlate);
}
