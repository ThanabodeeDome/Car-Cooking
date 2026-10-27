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
        showDashboardError("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
        return;
      }

      if (!data.success) {
        console.error("Dashboard error:", data.message);
        showDashboardError("โหลดข้อมูล Dashboard ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setText("stat-available", data.counts.available);
      setText("stat-inuse", data.counts.inuse);
      setText("stat-booked", data.counts.booked);
      setText("stat-maintenance", data.counts.maintenance);

      const fbGood = data.feedback?.good || 0;
      const fbBad = data.feedback?.bad || 0;
      const fbTotal = fbGood + fbBad;
      setText("stat-feedback", fbTotal ? Math.round((fbGood / fbTotal) * 100) + "%" : "-");
      setText("stat-feedback-count", fbTotal);

      renderFleetStatusList(data.cars);
      renderWeekTimeline(data.cars, data.week_start, data.week_bookings);
      renderRecentBookings(data.recent);
      renderOverduePanel(data.overdue_returns);
      fetchReturnRequests();
      renderAlerts(data.alerts, data.maint_due, [], data.backup); // รถค้างคืนย้ายไปแผงของมันเองด้านบนแล้ว
    })
    .catch((err) => {
      console.error("Error Dashboard:", err);
      showDashboardError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
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
          <strong>${escapeHtml(c.Plate)}</strong>
          <span>${escapeHtml(c.Brand) || ""} ${escapeHtml(c.Model) || ""}</span>
        </div>
        ${statusBadge(c.RealStatus, { type: "car" })}
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
  // 🩹 toISOString() เป็นเวลา UTC — ไทย (UTC+7) เที่ยงคืนท้องถิ่นจะกลายเป็นวันก่อนหน้า ตารางเลื่อนไป 1 วัน
  // แปลงเป็นวันที่ตามเวลาเครื่องก่อน
  const localYmd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const start = new Date(weekStartStr + "T00:00:00");
  const dateList = dayLabels.map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return localYmd(d);
  });
  const todayStr = localYmd(new Date());

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
                  `<span class="week-chip" title="${escapeHtml(dashTimeRange(bk))}">${escapeHtml(bk.DriverName) || "-"}</span>`,
              )
              .join("")}</td>`;
          })
          .join("");
        return `<tr><td class="week-car-name">${escapeHtml(car.Plate)}</td>${cells}</tr>`;
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
      const isReturned = bk.BookingStatus === "คืนแล้ว";
      const cls = isCancelled
        ? "status-cancelled"
        : isReturned
          ? "status-returned"
          : bk.BookingStatus === "ขาไป"
            ? "status-inuse"
            : "status-booked";
      return `
        <div class="recent-row">
          <div class="recent-row-main">
            <strong>${escapeHtml(bk.DriverName) || "-"}</strong>
            <span>${escapeHtml(bk.CarPlate) || "-"} • ${bk.BookingDate || "-"} (${dashTimeRange(bk)})</span>
          </div>
          ${statusBadge(bk.BookingStatus, { due: bookingDue(bk.BookingDate, bk.OutTime, bk.PlannedReturnTime) })}
        </div>`;
    })
    .join("");
}

// ---------- 4) แจ้งเตือนสำคัญ (ค้างคืนรถ / ประกัน / พ.ร.บ. / เช็คระยะ ใกล้หมด) ----------
/**
 * 🚗 แผง "รถที่ยังไม่ได้คืน" — ขึ้นบนสุดของ Dashboard ตอนมีรถค้างเท่านั้น
 * แอดมินปิดงานแทนผู้ขับ (ต้องกรอกเลขไมล์คืน) หรือกด "ไม่ได้ใช้รถ" เพื่อปล่อยรถโดยไม่ต้องมีไมล์
 */
let overdueList = [];
function renderOverduePanel(list) {
  const box = document.getElementById("overdue-panel");
  if (!box) return;
  overdueList = list || [];
  box.hidden = overdueList.length === 0;
  if (!overdueList.length) {
    box.innerHTML = "";
    return;
  }
  const rows = overdueList
    .map(
      (o, i) => `
      <div class="od-row${o.stale ? " od-stale" : ""}">
        <div class="od-plate">${escapeHtml(o.plate)}</div>
        <div class="od-info">
          <b>${escapeHtml(o.driver_name) || "-"}${o.employee_id ? ` <small>#${escapeHtml(o.employee_id)}</small>` : ""}</b>
          <span>กำหนดคืน ${escapeHtml(o.due_at)} น. • ${escapeHtml(o.booking_number)}</span>
        </div>
        <div class="od-late"><i class="fa-regular fa-clock"></i> เกิน ${escapeHtml(o.late_text)}</div>
        <div class="od-actions">
          <button type="button" class="od-btn primary" data-act="close" data-i="${i}"><i class="fa-solid fa-flag-checkered"></i> ปิดงาน (คืนแล้ว)</button>
          <button type="button" class="od-btn" data-act="unused" data-i="${i}"><i class="fa-solid fa-key"></i> ไม่ได้ใช้รถ</button>
        </div>
      </div>`,
    )
    .join("");
  box.innerHTML = `
    <h2 class="panel-title od-title"><i class="fa-solid fa-car-burst"></i> รถที่เลยเวลาคืน <span class="od-count">${overdueList.length}</span></h2>
    <p class="od-hint">ผู้ใช้ทุกคนเห็นรายการนี้เป็นป้ายประกาศอยู่แล้ว • รถคันนี้ยังถูกล็อกไม่ให้คนอื่นจอง — ติดต่อผู้ขับ ปิดงานแทนเมื่อได้เลขไมล์ หรือกด "ไม่ได้ใช้รถ" ถ้ารถไม่ได้ออกไปจริง</p>
    <div class="od-list">${rows}</div>`;
  if (!box.__bound) {
    box.__bound = true;
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".od-btn");
      if (!btn) return;
      const o = overdueList[Number(btn.dataset.i)];
      if (!o) return;
      if (btn.dataset.act === "close") openOverdueCloseModal(o);
      else releaseOverdueUnused(o);
    });
  }
}

function adminUpdateBooking(body) {
  return fetch("admin_update_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

async function releaseOverdueUnused(o) {
  const ok = await AppDialog.confirm({
    title: "ปล่อยรถ: ไม่ได้ใช้รถ?",
    message: `รถ ${o.plate} (${o.driver_name || "-"}) จะถูกบันทึกเป็น "ยกเลิก (ไม่ได้ใช้รถ)" และว่างให้คนอื่นจองทันที — ไม่ต้องกรอกเลขไมล์`,
    confirmText: "ปล่อยรถ",
    cancelText: "กลับ",
    danger: true,
  });
  if (!ok) return;
  const r = await adminUpdateBooking({ booking_id: o.booking_id, booking_status: "ยกเลิก (ไม่ได้ใช้รถ)" }).catch(() => null);
  if (r && r.success) fetchDashboardStats();
  else AppDialog.alert((r && r.message) || "ทำรายการไม่สำเร็จ", { type: "error" });
}

function openOverdueCloseModal(o) {
  const ov = document.createElement("div");
  ov.className = "od-modal";
  ov.innerHTML = `
    <div class="od-modal-card" role="dialog" aria-label="ปิดงานคืนรถ">
      <h3><i class="fa-solid fa-flag-checkered"></i> ปิดงานคืนรถแทนผู้ขับ</h3>
      <p><b>${escapeHtml(o.plate)}</b> • ${escapeHtml(o.driver_name) || "-"}<br><small>เลขไมล์ตอนออก ${Number(o.start_mileage).toLocaleString("th-TH")} กม.</small></p>
      <label for="od-end-mile">เลขไมล์ตอนคืน (กม.)</label>
      <input id="od-end-mile" type="number" inputmode="numeric" min="${Number(o.start_mileage) + 1}" placeholder="ต้องมากกว่า ${Number(o.start_mileage).toLocaleString("th-TH")}" />
      <div class="od-modal-err" id="od-modal-err"></div>
      <div class="od-modal-btns">
        <button type="button" class="od-btn" id="od-cancel">ยกเลิก</button>
        <button type="button" class="od-btn primary" id="od-save">บันทึกคืนรถ</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector("#od-end-mile");
  input.focus();
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => e.target === ov && close());
  ov.querySelector("#od-cancel").addEventListener("click", close);
  const save = async () => {
    const mile = parseInt(input.value, 10);
    const err = ov.querySelector("#od-modal-err");
    if (!mile || mile <= Number(o.start_mileage)) {
      err.textContent = "เลขไมล์ตอนคืนต้องมากกว่าเลขไมล์ตอนออก (" + Number(o.start_mileage).toLocaleString("th-TH") + ")";
      return;
    }
    const btn = ov.querySelector("#od-save");
    btn.disabled = true;
    const r = await adminUpdateBooking({ booking_id: o.booking_id, booking_status: "คืนแล้ว", end_mileage: mile }).catch(() => null);
    if (r && r.success) {
      close();
      fetchDashboardStats();
    } else {
      btn.disabled = false;
      err.textContent = (r && r.message) || "บันทึกไม่สำเร็จ";
    }
  };
  ov.querySelector("#od-save").addEventListener("click", save);
  input.addEventListener("keydown", (e) => e.key === "Enter" && save());
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  });
}

function renderAlerts(alerts, maintDue, overdueReturns, backup) {
  const wrap = document.getElementById("alerts-list");
  if (!wrap) return;

  // 💾 เตือนเมื่อไฟล์สำรองฐานข้อมูลล่าสุดเก่าเกิน 2 วัน — เคยพังเงียบหลายวันโดยไม่มีใครรู้
  const backupHtml =
    backup && backup.stale
      ? `
        <div class="alert-row alert-expired">
          <i class="fa-solid fa-database"></i>
          <div>
            <strong>ระบบสำรองฐานข้อมูลอาจมีปัญหา</strong>
            <span>ไฟล์สำรองล่าสุด: ${backup.last ? escapeHtml(backup.last) + " น. (" + backup.age_hours + " ชม. ที่แล้ว)" : "ไม่พบไฟล์สำรองเลย"} — ปกติต้องมีทุกคืน กรุณาแจ้งผู้ดูแลระบบ</span>
          </div>
        </div>`
      : "";
  // รอบที่เช็คอินแล้วยังไม่ปิดงานคืนรถ — ระบบไม่ยกเลิกให้เอง แอดมินต้องตามปิดงาน
  const overdueHtml = (overdueReturns || [])
    .map(
      (o) => `
        <div class="alert-row alert-expired">
          <i class="fa-solid fa-car-burst"></i>
          <div>
            <strong>${escapeHtml(o.plate)} — ยังไม่ปิดงานคืนรถ (${escapeHtml(o.late_text)})</strong>
            <span>${escapeHtml(o.driver_name) || "-"}${o.employee_id ? ` #${escapeHtml(o.employee_id)}` : ""} • กำหนดคืน ${escapeHtml(o.due_at)} น. • ${escapeHtml(o.booking_number)}</span>
            ${o.stale ? `<span>รถยังถูกล็อกไม่ให้คนอื่นจอง — ตรวจสอบกับผู้ใช้แล้วปิดงานในแท็บจัดการการจอง</span>` : ""}
          </div>
        </div>`,
    )
    .join("");

  if (
    !backupHtml &&
    !overdueHtml &&
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
        plateInfo: `${escapeHtml(a.Plate)} — ${escapeHtml(a.Brand)} ${escapeHtml(a.Model)}`,
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
      plateInfo: `${escapeHtml(m.Plate)} — ${escapeHtml(m.Brand)} ${escapeHtml(m.Model)}`,
      diffDays,
    });
  });

  if (rows.length === 0 && !overdueHtml && !backupHtml) {
    wrap.innerHTML = `<p class="empty-hint">ไม่มีการแจ้งเตือนตอนนี้</p>`;
    return;
  }

  // เรื่องระบบสำรองข้อมูลขึ้นบนสุด เพราะกระทบทั้งระบบ ไม่ใช่แค่รถคันเดียว
  wrap.innerHTML = backupHtml + overdueHtml + rows
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


// เวลาจองแบบใหม่ (ไป HH:MM - กลับ HH:MM); แถวเก่ายังมีแค่ TimeSlot
function dashTimeRange(bk) {
  const out = (bk.OutTime || "").slice(0, 5);
  const ret = (bk.PlannedReturnTime || "").slice(0, 5);
  return out && ret ? `${out}-${ret} น.` : bk.TimeSlot || "-";
}

// ---------- คำขอคืนรถนอกจุดบริษัท (รอแอดมินอนุมัติ) ----------
let rrList = [];
function fetchReturnRequests() {
  fetch("admin_return_requests.php")
    .then((r) => r.json())
    .then((d) => renderReturnRequests(d && d.success ? d.requests : []))
    .catch(() => renderReturnRequests([]));
}

function renderReturnRequests(list) {
  const box = document.getElementById("rr-panel");
  if (!box) return;
  rrList = list || [];
  box.hidden = rrList.length === 0;
  if (!rrList.length) {
    box.innerHTML = "";
    return;
  }
  const codeText = { none: "ไม่ได้ส่งตำแหน่ง", far: "อยู่นอกจุดบริษัท", lowacc: "GPS ไม่แม่น", suspect: "ตำแหน่งผิดปกติ" };
  const photo = (p, t) => (p ? `<a href="../Car/${escapeHtml(p)}" target="_blank" rel="noopener">${t}</a>` : "");
  const rows = rrList
    .map((o, i) => {
      const g = o.geo || {};
      const map = g.lat && g.lng ? `<a href="https://maps.google.com/?q=${encodeURIComponent(g.lat + "," + g.lng)}" target="_blank" rel="noopener">ดูแผนที่</a>` : "";
      const dist = g.dist != null ? ` ห่าง ${Number(g.dist).toLocaleString("th-TH")} ม.` : "";
      return `
      <div class="od-row">
        <div class="od-plate">${escapeHtml(o.plate)}</div>
        <div class="od-info">
          <b>${escapeHtml(o.driver_name) || "-"}${o.employee_id ? ` <small>#${escapeHtml(o.employee_id)}</small>` : ""}</b>
          <span>เหตุผล: ${escapeHtml(o.reason)} • ไมล์คืน ${Number(o.end_mileage).toLocaleString("th-TH")} (ออก ${Number(o.start_mileage).toLocaleString("th-TH")})</span>
          <span>${escapeHtml(codeText[o.geo_code] || o.geo_code)}${dist} • IP ${escapeHtml(o.ip)} • ${escapeHtml(o.requested_at)} ${map} ${photo(o.odometer_photo, "รูปไมล์")} ${photo(o.condition_photo, "รูปสภาพรถ")}</span>
        </div>
        <div class="od-actions">
          <button type="button" class="od-btn primary" data-act="approve" data-i="${i}"><i class="fa-solid fa-check"></i> อนุมัติ (คืนแล้ว)</button>
          <button type="button" class="od-btn" data-act="reject" data-i="${i}"><i class="fa-solid fa-xmark"></i> ปฏิเสธ</button>
        </div>
      </div>`;
    })
    .join("");
  box.innerHTML = `
    <h2 class="panel-title od-title"><i class="fa-solid fa-location-crosshairs"></i> คำขอคืนรถนอกจุดบริษัท <span class="od-count">${rrList.length}</span></h2>
    <p class="od-hint">ผู้ขับคืนรถในจุดบริษัทไม่ได้ จึงส่งคำขอพร้อมรูปไมล์/สภาพรถ — ตรวจรูปและตำแหน่งก่อนอนุมัติ อนุมัติแล้วระบบบันทึกคืนรถให้ทันที</p>
    <div class="od-list">${rows}</div>`;
  if (!box.__bound) {
    box.__bound = true;
    box.addEventListener("click", async (e) => {
      const btn = e.target.closest(".od-btn");
      if (!btn) return;
      const o = rrList[Number(btn.dataset.i)];
      if (!o) return;
      const approve = btn.dataset.act === "approve";
      const ok = await AppDialog.confirm({
        title: approve ? "อนุมัติคืนรถนอกจุด?" : "ปฏิเสธคำขอ?",
        message: approve
          ? `บันทึกรถ ${o.plate} เป็น "คืนแล้ว" ไมล์คืน ${Number(o.end_mileage).toLocaleString("th-TH")} กม. ตามที่ผู้ขับส่งมา`
          : `ปฏิเสธคำขอของ ${o.driver_name || "-"} (รถ ${o.plate}) — ผู้ขับต้องคืนรถในจุดบริษัท`,
        confirmText: approve ? "อนุมัติ" : "ปฏิเสธ",
        cancelText: "กลับ",
        danger: !approve,
      });
      if (!ok) return;
      const r = await fetch("admin_return_requests.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: approve ? "approve" : "reject", log_id: o.log_id }),
      })
        .then((x) => x.json())
        .catch(() => null);
      if (r && r.success) fetchDashboardStats();
      else AppDialog.alert((r && r.message) || "ทำรายการไม่สำเร็จ", { type: "error" });
    });
  }
}
