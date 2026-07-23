/**
 * 📊 Dashboard ใหม่ — ดึงจาก get_dashboard_stats.php แล้ว render 5 ส่วน:
 * header cards / ตารางรายสัปดาห์ / รายการจองล่าสุด / สถานะรถปัจจุบัน / แจ้งเตือน
 */
function fetchDashboardStats() {
  fetch("get_dashboard_stats.php")
    .then((res) => res.text())
    .then((text) => {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // PHP fatal error มักตอบเป็น HTML ไม่ใช่ JSON — โชว์ raw response ให้เห็นเลยแทนพังเงียบๆ
        console.error("Dashboard: response ไม่ใช่ JSON:", text);
        showDashboardError(
          "เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (มักเป็น PHP error) — " +
            text.replace(/<[^>]*>/g, " ").slice(0, 300),
        );
        return;
      }

      if (!data.success) {
        console.error("Dashboard error:", data.message);
        showDashboardError(data.message || "โหลดข้อมูล Dashboard ไม่สำเร็จ");
        return;
      }

      setText("stat-available", data.counts.available);
      setText("stat-inuse", data.counts.inuse);
      setText("stat-booked", data.counts.booked);
      setText("stat-maintenance", data.counts.maintenance);

      renderFleetStatusList(data.cars);
      renderWeekTimeline(data.cars, data.week_start, data.week_bookings);
      renderRecentBookings(data.recent);
      renderAlerts(data.alerts, data.maint_due);
    })
    .catch((err) => {
      console.error("Error Dashboard:", err);
      showDashboardError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + err.message);
    });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val ?? 0;
}

function showDashboardError(message) {
  const html = `<p style="color:#ef4444; text-align:center; padding:16px;">⚠️ ${message}</p>`;
  ["fleet-status-list", "recent-bookings-list", "alerts-list"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  const table = document.getElementById("week-timeline-table");
  if (table)
    table.innerHTML = `<caption style="color:#ef4444; padding:10px;">⚠️ ${message}</caption>`;
}

// ---------- 1) สถานะรถปัจจุบัน (การ์ดฝั่งขวา) ----------
function renderFleetStatusList(cars) {
  const wrap = document.getElementById("fleet-status-list");
  if (!wrap) return;

  if (!cars || cars.length === 0) {
    wrap.innerHTML = `<p class="empty-hint">ไม่มีข้อมูลรถในระบบ</p>`;
    return;
  }

  const badgeClass = {
    ว่าง: "status-available2",
    กำลังใช้งาน: "status-inuse",
    ติดจอง: "status-booked",
    งดให้บริการ: "status-cancelled",
  };

  wrap.innerHTML = cars
    .map(
      (c) => `
      <div class="fleet-row">
        <div class="fleet-row-name">
          <strong>${c.Plate}</strong>
          <span>${c.Brand || ""} ${c.Model || ""}</span>
        </div>
        <span class="status-badge ${badgeClass[c.RealStatus] || ""}">${c.RealStatus}</span>
      </div>`,
    )
    .join("");
}

// ---------- 2) ตารางการจองรายสัปดาห์ (แถว=รถ, คอลัมน์=จ-อา) ----------
function renderWeekTimeline(cars, weekStartStr, bookings) {
  const table = document.getElementById("week-timeline-table");
  if (!table) return;

  if (!cars || cars.length === 0) {
    table.innerHTML = "";
    return;
  }

  const dayLabels = [
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัส",
    "ศุกร์",
    "เสาร์",
    "อาทิตย์",
  ];
  const start = new Date(weekStartStr + "T00:00:00");
  const dateList = dayLabels.map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
  const todayStr = new Date().toISOString().split("T")[0];

  // จัดกลุ่ม booking ตาม ทะเบียน+วันที่ เพื่อ lookup ไว
  const map = {};
  (bookings || []).forEach((bk) => {
    const key = `${bk.CarPlate}_${bk.BookingDate}`;
    if (!map[key]) map[key] = [];
    map[key].push(bk);
  });

  const thead = `<thead><tr>
      <th class="week-car-col">รถ</th>
      ${dayLabels
        .map(
          (d, i) =>
            `<th class="${dateList[i] === todayStr ? "is-today-col" : ""}">${d}<br><span class="th-date">${Number(dateList[i].split("-")[2])}</span></th>`,
        )
        .join("")}
    </tr></thead>`;

  const tbody =
    "<tbody>" +
    cars
      .map((car) => {
        const cells = dateList
          .map((dateStr) => {
            const key = `${car.Plate}_${dateStr}`;
            const items = map[key] || [];
            if (items.length === 0) return `<td></td>`;
            return `<td>${items
              .map(
                (bk) =>
                  `<span class="week-chip" title="${bk.TimeSlot || ""}">${bk.DriverName || "-"}</span>`,
              )
              .join("")}</td>`;
          })
          .join("");
        return `<tr><td class="week-car-name">${car.Plate}</td>${cells}</tr>`;
      })
      .join("") +
    "</tbody>";

  table.innerHTML = thead + tbody;
}

// ---------- 3) รายการจองล่าสุด ----------
function renderRecentBookings(list) {
  const wrap = document.getElementById("recent-bookings-list");
  if (!wrap) return;

  if (!list || list.length === 0) {
    wrap.innerHTML = `<p class="empty-hint">ยังไม่มีรายการจอง</p>`;
    return;
  }

  wrap.innerHTML = list
    .map((bk) => {
      const isCancelled =
        bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก");
      const isReturned = bk.BookingStatus === "ขากลับ";
      const cls = isCancelled
        ? "status-cancelled"
        : isReturned
          ? "status-returned"
          : "status-booked";
      return `
        <div class="recent-row">
          <div class="recent-row-main">
            <strong>${bk.DriverName || "-"}</strong>
            <span>${bk.CarPlate || "-"} • ${bk.BookingDate || "-"} (${bk.TimeSlot || "-"})</span>
          </div>
          <span class="status-badge ${cls}">${bk.BookingStatus || "-"}</span>
        </div>`;
    })
    .join("");
}

// ---------- 4) แจ้งเตือนสำคัญ (ประกัน/พ.ร.บ./เช็คระยะ ใกล้หมด) ----------
function renderAlerts(alerts, maintDue) {
  const wrap = document.getElementById("alerts-list");
  if (!wrap) return;

  if (
    (!alerts || alerts.length === 0) &&
    (!maintDue || maintDue.length === 0)
  ) {
    wrap.innerHTML = `<p class="empty-hint">ไม่มีการแจ้งเตือนตอนนี้</p>`;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = [];
  (alerts || []).forEach((a) => {
    [
      { label: "ประกันภัย", date: a.InsuranceExpiry },
      { label: "พ.ร.บ.", date: a.ActExpiry },
    ].forEach((item) => {
      if (!item.date) return;
      const d = new Date(item.date);
      const diffDays = Math.ceil((d - today) / 86400000);
      if (diffDays > 30) return;
      rows.push({
        ...item,
        plateInfo: `${a.Plate} — ${a.Brand} ${a.Model}`,
        diffDays,
      });
    });
  });

  (maintDue || []).forEach((m) => {
    if (!m.NextDueDate) return;
    const d = new Date(m.NextDueDate);
    const diffDays = Math.ceil((d - today) / 86400000);
    if (diffDays > 30) return;
    rows.push({
      label: "กำหนดเช็คระยะ",
      date: m.NextDueDate,
      plateInfo: `${m.Plate} — ${m.Brand} ${m.Model}`,
      diffDays,
    });
  });

  if (rows.length === 0) {
    wrap.innerHTML = `<p class="empty-hint">ไม่มีการแจ้งเตือนตอนนี้</p>`;
    return;
  }

  wrap.innerHTML = rows
    .map((r) => {
      const expired = r.diffDays < 0;
      return `
        <div class="alert-row ${expired ? "alert-expired" : "alert-warning"}">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>${r.plateInfo}</strong>
            <span>${r.label} ${expired ? `หมดอายุแล้ว (${r.date})` : `เหลือ ${r.diffDays} วัน (${r.date})`}</span>
          </div>
        </div>`;
    })
    .join("");
}

window.fetchDashboardStats = fetchDashboardStats;

// ---------- Realtime polling: 250-300 user พร้อมกัน ห้ามถี่ ----------
const DASHBOARD_POLL_INTERVAL_MS = 20000; // 20s
let dashboardPollTimer = null;

function startDashboardPolling() {
  if (dashboardPollTimer) return;
  dashboardPollTimer = setInterval(() => {
    const tab = document.getElementById("dashboard");
    if (tab && tab.classList.contains("active") && !document.hidden) {
      fetchDashboardStats();
    }
  }, DASHBOARD_POLL_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", startDashboardPolling);
