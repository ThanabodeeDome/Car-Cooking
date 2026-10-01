/**
 * 📊 reports.js — หน้ารายงาน (ออกแบบใหม่)
 * KPI + กราฟ (Chart.js) + ตารางรายคัน/ผู้ใช้ + ความคิดเห็น/ปัญหา + Export Excel (SheetJS)
 * ข้อมูลมาจาก get_reports_data.php (ช่วงวันที่เดียวกันทั้งหน้า)
 */
const RP_COLORS = { blue: "#2563eb", sky: "#0ea5e9", green: "#10b981", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", slate: "#94a3b8" };
const RP_STATUS_COLOR = {
  คืนแล้ว: RP_COLORS.green,
  ขาไป: RP_COLORS.blue,
  จองแล้ว: RP_COLORS.amber,
  ยกเลิก: RP_COLORS.red,
  "ยกเลิก (ไม่มาใช้งาน)": RP_COLORS.violet,
};
const rpCharts = {};
let rpData = null;

const rpNum = (n) => Number(n || 0).toLocaleString("th-TH");
const rpEsc = (s) => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? ""));
const rpYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rpThai = (ymd) => {
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  const mo = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return y ? `${d} ${mo[m - 1]} ${String(y + 543).slice(2)}` : "-";
};

// ---------- ช่วงวันที่ ----------
function initReportDates() {
  const s = document.getElementById("report-start");
  const e = document.getElementById("report-end");
  if (!s || !e) return;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  s.value = rpYmd(start);
  e.value = rpYmd(end);
  markPreset("30d");
}

function markPreset(name) {
  document.querySelectorAll(".rp-pill").forEach((b) => b.classList.toggle("on", b.dataset.preset === name));
}

function setReportRange(preset) {
  const s = document.getElementById("report-start");
  const e = document.getElementById("report-end");
  if (!s || !e) return;
  const end = new Date();
  const start = new Date();
  if (preset === "7d") start.setDate(start.getDate() - 6);
  else if (preset === "30d") start.setDate(start.getDate() - 29);
  else if (preset === "90d") start.setDate(start.getDate() - 89);
  else if (preset === "month") start.setDate(1);
  s.value = rpYmd(start);
  e.value = rpYmd(end);
  markPreset(preset);
  fetchReports();
}

// ---------- Realtime polling ----------
let reportsPollTimer = null;
function startReportsPolling() {
  if (reportsPollTimer) return;
  reportsPollTimer = setInterval(() => {
    const tab = document.getElementById("reports-tab");
    if (tab && tab.classList.contains("active") && !document.hidden) fetchReports(true);
  }, 20000);
}
document.addEventListener("DOMContentLoaded", startReportsPolling);

function fetchReports(silent) {
  if (!document.getElementById("report-start")?.value) initReportDates(); // เปิดหน้ารายงานตรงๆ (ลิงก์ #reports-tab) ก่อนตั้งวันที่
  const start = document.getElementById("report-start")?.value;
  const end = document.getElementById("report-end")?.value;
  if (!start || !end) return;
  if (start > end) {
    if (!silent) AppDialog.alert("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด", { type: "warning", title: "ช่วงวันที่ไม่ถูกต้อง" });
    return;
  }
  document.querySelectorAll(".rp-pill").forEach((b) => {
    const t = new Date();
    const e = rpYmd(t);
    const back = { today: 0, "7d": 6, "30d": 29, "90d": 89 }[b.dataset.preset];
    let expect = null;
    if (back !== undefined) {
      const d = new Date();
      d.setDate(d.getDate() - back);
      expect = rpYmd(d);
    } else if (b.dataset.preset === "month") {
      expect = rpYmd(new Date(t.getFullYear(), t.getMonth(), 1));
    }
    b.classList.toggle("on", expect === start && end === e);
  });

  fetch(`get_reports_data.php?start=${start}&end=${end}`)
    .then((r) => r.json())
    .then((d) => {
      if (!d.success) {
        if (!silent) AppDialog.alert(d.message || "โหลดรายงานไม่สำเร็จ", { type: "error" });
        return;
      }
      rpData = d;
      renderReports(d, start, end);
    })
    .catch((err) => {
      console.error("Error loading reports:", err);
      if (!silent) AppDialog.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", { type: "error" });
    });
}

// ---------- render ----------
function renderReports(d, start, end) {
  const k = d.kpi || {};
  const label = document.getElementById("rp-range-label");
  if (label) label.textContent = `ข้อมูลตั้งแต่ ${rpThai(start)} ถึง ${rpThai(end)} (${k.days || 0} วัน)`;

  renderAlert(k);
  renderKpis(d, k);
  renderTrend(d.bookings?.by_day || []);
  renderStatus(d.bookings?.by_status || []);
  renderBar("rp-c-util", (d.per_car || []).map((c) => c.CarPlate), (d.per_car || []).map((c) => c.percent), RP_COLORS.blue, "% ใช้งาน", { max: 100, suffix: "%" });
  renderBar("rp-c-peak", (d.insights?.peak_hours || []).map((_, h) => String(h).padStart(2, "0")), d.insights?.peak_hours || [], RP_COLORS.amber, "จำนวนการจองที่คร่อมชั่วโมงนี้");
  renderBar("rp-c-div", (d.insights?.top_divisions || []).map((r) => r.name), (d.insights?.top_divisions || []).map((r) => r.cnt), RP_COLORS.violet, "ครั้ง", { horizontal: true });
  renderBar("rp-c-repair", (d.repair_cost || []).map((r) => r.Plate), (d.repair_cost || []).map((r) => Number(r.totalCost || 0)), RP_COLORS.red, "ค่าซ่อม (บาท)");
  renderCarTable(d.per_car || []);
  renderDrivers(d.top_drivers || []);
  renderFeed("rp-comments", d.comments || [], "ยังไม่มีความคิดเห็นในช่วงนี้", true);
  renderFeed("rp-problems", d.problems || [], "ไม่มีการแจ้งปัญหาในช่วงนี้ 🎉", false);
  renderCancel(d.cancellations || {});

  const fb = document.getElementById("rp-fb-sum");
  if (fb) fb.textContent = k.votes ? `👍 ${k.good} · 👎 ${k.bad}` : "";
  const rs = (d.repair_cost || []).reduce((s, r) => s + Number(r.totalCost || 0), 0);
  const rj = (d.repair_cost || []).reduce((s, r) => s + Number(r.jobs || 0), 0);
  const rsEl = document.getElementById("rp-repair-sum");
  if (rsEl) rsEl.textContent = rj ? `รวม ${rpNum(rs)} บาท · ${rj} งาน` : "";
}

function renderAlert(k) {
  const el = document.getElementById("rp-alert");
  if (!el) return;
  const msgs = [];
  if (k.geo_flags) msgs.push(`<i class="fa-solid fa-location-crosshairs"></i> พิกัดผิดปกติ ${k.geo_flags} ครั้ง (เช็คอิน/คืนรถนอกจุดบริษัทหรือไม่มีพิกัด)`);
  if (k.noshow) msgs.push(`<i class="fa-solid fa-user-clock"></i> จองแล้วไม่มาใช้งาน ${k.noshow} รายการ`);
  el.hidden = msgs.length === 0;
  el.innerHTML = msgs.map((m) => `<span>${m}</span>`).join("");
}

function kpiCard(icon, tone, value, label, sub) {
  return `<div class="rp-kpi tone-${tone}"><div class="rp-kpi-ic"><i class="fa-solid ${icon}"></i></div>
    <div class="rp-kpi-tx"><strong>${value}</strong><span>${label}</span>${sub ? `<em>${sub}</em>` : ""}</div></div>`;
}
function renderKpis(d, k) {
  const repair = (d.repair_cost || []).reduce((s, r) => s + Number(r.totalCost || 0), 0);
  const jobs = (d.repair_cost || []).reduce((s, r) => s + Number(r.jobs || 0), 0);
  const el = document.getElementById("rp-kpis");
  if (!el) return;
  el.innerHTML = [
    kpiCard("fa-clipboard-list", "blue", rpNum(k.total), "การจองทั้งหมด", `${rpNum(k.unique_drivers)} ผู้ใช้`),
    kpiCard("fa-circle-check", "green", rpNum(k.returned), "คืนรถแล้ว", `ระหว่างดำเนินการ ${rpNum(k.active)}`),
    kpiCard("fa-ban", "red", `${k.cancel_rate ?? 0}%`, "อัตราการยกเลิก", `${rpNum(k.cancelled)} รายการ`),
    kpiCard("fa-route", "sky", rpNum(k.km_total), "ระยะทางรวม (กม.)", `เฉลี่ย ${rpNum(k.avg_km)} กม./ทริป`),
    kpiCard("fa-clock", "amber", rpNum(k.hours_total), "ชั่วโมงใช้รถ", `เฉลี่ย ${k.avg_hours ?? 0} ชม./ทริป`),
    kpiCard("fa-gauge-high", "violet", `${k.fleet_util ?? 0}%`, "การใช้งานรวมทั้งกอง", `${rpNum((d.per_car || []).length)} คัน`),
    kpiCard("fa-thumbs-up", "green", k.satisfaction == null ? "-" : `${k.satisfaction}%`, "ความพอใจต่อระบบ", k.votes ? `${k.votes} โหวต` : "ยังไม่มีโหวต"),
    kpiCard("fa-screwdriver-wrench", "amber", rpNum(repair), "ค่าซ่อม (บาท)", `${jobs} งานซ่อม`),
  ].join("");
}

function baseOpts(extra) {
  return Object.assign(
    {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef0f4" } }, x: { grid: { display: false } } },
    },
    extra || {},
  );
}
function mkChart(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx || typeof Chart === "undefined") return;
  if (rpCharts[id]) rpCharts[id].destroy();
  rpCharts[id] = new Chart(ctx, cfg);
}
function emptyState(id, on) {
  const box = document.getElementById(id)?.parentElement;
  if (!box) return;
  let e = box.querySelector(".rp-empty");
  if (on && !e) {
    e = document.createElement("div");
    e.className = "rp-empty";
    e.innerHTML = '<i class="fa-solid fa-inbox"></i><span>ไม่มีข้อมูลในช่วงนี้</span>';
    box.appendChild(e);
  }
  if (e) e.style.display = on ? "flex" : "none";
}

function renderTrend(byDay) {
  emptyState("rp-c-trend", byDay.length === 0);
  mkChart("rp-c-trend", {
    type: "line",
    data: {
      labels: byDay.map((r) => rpThai(r.BookingDate)),
      datasets: [{ label: "การจอง", data: byDay.map((r) => Number(r.cnt)), borderColor: RP_COLORS.blue, backgroundColor: "rgba(37,99,235,.12)", fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: RP_COLORS.blue }],
    },
    options: baseOpts(),
  });
}

function renderStatus(list) {
  const total = list.reduce((s, r) => s + Number(r.total), 0);
  const n = document.getElementById("rp-donut-n");
  if (n) n.textContent = rpNum(total);
  const legend = document.getElementById("rp-legend");
  if (legend) {
    legend.innerHTML = list.length
      ? list
          .map((r) => `<li><i style="background:${RP_STATUS_COLOR[r.BookingStatus] || RP_COLORS.slate}"></i><span>${rpEsc(r.BookingStatus || "-")}</span><b>${rpNum(r.total)}</b><em>${total ? Math.round((r.total / total) * 100) : 0}%</em></li>`)
          .join("")
      : '<li class="rp-none">ไม่มีข้อมูลในช่วงนี้</li>';
  }
  mkChart("rp-c-status", {
    type: "doughnut",
    data: { labels: list.map((r) => r.BookingStatus), datasets: [{ data: list.map((r) => Number(r.total)), backgroundColor: list.map((r) => RP_STATUS_COLOR[r.BookingStatus] || RP_COLORS.slate), borderWidth: 2, borderColor: "#fff" }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { display: false } } },
  });
}

function renderBar(id, labels, values, color, label, opt) {
  opt = opt || {};
  emptyState(id, !labels.length || values.every((v) => !v));
  const scales = baseOpts().scales;
  if (opt.max) scales.y.max = opt.max;
  if (opt.suffix) scales.y.ticks.callback = (v) => v + opt.suffix;
  const cfg = {
    type: "bar",
    data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 38 }] },
    options: baseOpts({ scales }),
  };
  if (opt.horizontal) {
    cfg.options.indexAxis = "y";
    cfg.options.scales = { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef0f4" } }, y: { grid: { display: false } } };
  }
  mkChart(id, cfg);
}

function renderCarTable(list) {
  const tb = document.getElementById("rp-t-car");
  if (!tb) return;
  tb.innerHTML = list.length
    ? list
        .map(
          (c) => `<tr><td><b>${rpEsc(c.CarPlate)}</b></td><td>${rpNum(c.trips)}</td><td>${c.hours}</td>
        <td><div class="rp-bar"><i style="width:${Math.min(100, c.percent)}%"></i></div><small>${c.percent}%</small></td>
        <td>${rpNum(c.km)}</td><td>${c.cancelled ? `<span class="rp-tag red">${c.cancelled}</span>` : "-"}</td>
        <td>${c.repair_cost ? rpNum(c.repair_cost) : "-"}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="rp-td-empty">ไม่มีข้อมูลในช่วงนี้</td></tr>';
}

function renderDrivers(list) {
  const tb = document.getElementById("rp-t-drv");
  if (!tb) return;
  tb.innerHTML = list.length
    ? list.map((r, i) => `<tr><td><span class="rp-rank r${i + 1}">${i + 1}</span></td><td>${rpEsc(r.name)}</td><td>${rpNum(r.trips)}</td><td>${rpNum(r.km)}</td></tr>`).join("")
    : '<tr><td colspan="4" class="rp-td-empty">ไม่มีข้อมูลในช่วงนี้</td></tr>';
}

function renderFeed(id, list, emptyText, isComment) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = list.length
    ? list
        .map((r) => {
          const txt = String(r.text || "").replace(/\[ความคิดเห็น\]/g, "").replace(/^\s*\|\s*/, "").trim();
          return `<li><div class="rp-feed-ic ${isComment ? "c" : "p"}"><i class="fa-solid ${isComment ? "fa-comment" : "fa-triangle-exclamation"}"></i></div>
            <div><p>${rpEsc(txt)}</p><small>${rpEsc(r.driver)} · ${rpEsc(r.car)} · ${rpThai(r.date)}</small></div></li>`;
        })
        .join("")
    : `<li class="rp-none">${emptyText}</li>`;
}

function renderCancel(c) {
  const tb = document.getElementById("rp-t-cancel");
  if (!tb) return;
  tb.innerHTML = (c.list || []).length
    ? c.list
        .map((r) => `<tr><td>${rpThai(r.BookingDate)}</td><td>${rpEsc(r.CarPlate) || "-"}</td><td>${rpEsc(r.DriverName) || "-"}</td><td><span class="rp-tag ${String(r.BookingStatus).includes("ไม่มา") ? "violet" : "red"}">${rpEsc(r.BookingStatus)}</span></td></tr>`)
        .join("")
    : '<tr><td colspan="4" class="rp-td-empty">ไม่มีการยกเลิกในช่วงนี้</td></tr>';
  const s = document.getElementById("rp-cancel-sum");
  if (s) s.textContent = c.total_count ? `${c.cancelled_count}/${c.total_count} รายการ (${c.rate}%)` : "";
}

// ---------- Export Excel: ทุกชุดข้อมูลในไฟล์เดียว (หลาย sheet) ----------
function exportAllReports() {
  if (typeof XLSX === "undefined") return AppDialog.alert("โหลดตัว export ไม่สำเร็จ ลองรีเฟรชหน้าใหม่", { type: "error" });
  if (!rpData) return AppDialog.alert("ยังไม่มีข้อมูลรายงานให้ export", { type: "warning" });
  const d = rpData;
  const k = d.kpi || {};
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ ข้อมูล: "ไม่มีข้อมูลในช่วงนี้" }]), name);

  add("สรุป", [
    { หัวข้อ: "การจองทั้งหมด", ค่า: k.total }, { หัวข้อ: "คืนรถแล้ว", ค่า: k.returned }, { หัวข้อ: "ระหว่างดำเนินการ", ค่า: k.active },
    { หัวข้อ: "ยกเลิก", ค่า: k.cancelled }, { หัวข้อ: "อัตราการยกเลิก %", ค่า: k.cancel_rate }, { หัวข้อ: "ไม่มาใช้งาน", ค่า: k.noshow },
    { หัวข้อ: "ระยะทางรวม (กม.)", ค่า: k.km_total }, { หัวข้อ: "ชั่วโมงใช้รถรวม", ค่า: k.hours_total }, { หัวข้อ: "การใช้งานรวมทั้งกอง %", ค่า: k.fleet_util },
    { หัวข้อ: "ความพอใจ %", ค่า: k.satisfaction ?? "-" }, { หัวข้อ: "พิกัดผิดปกติ (ครั้ง)", ค่า: k.geo_flags },
  ]);
  add("สถานะการจอง", (d.bookings?.by_status || []).map((r) => ({ สถานะ: r.BookingStatus, จำนวน: Number(r.total) })));
  add("แนวโน้มรายวัน", (d.bookings?.by_day || []).map((r) => ({ วันที่: String(r.BookingDate).slice(0, 10), จำนวน: Number(r.cnt) })));
  add("สรุปรายคัน", (d.per_car || []).map((c) => ({ ทะเบียน: c.CarPlate, ครั้ง: c.trips, ชั่วโมง: c.hours, "% ใช้งาน": c.percent, "ระยะทาง (กม.)": c.km, ยกเลิก: c.cancelled, "ค่าซ่อม (บาท)": c.repair_cost })));
  add("ผู้ใช้รถมากสุด", (d.top_drivers || []).map((r, i) => ({ อันดับ: i + 1, ชื่อ: r.name, ครั้ง: r.trips, ชั่วโมง: r.hours, "ระยะทาง (กม.)": r.km })));
  add("ฝ่ายที่ใช้รถ", (d.insights?.top_divisions || []).map((r) => ({ ฝ่าย: r.name, ครั้ง: r.cnt })));
  add("ค่าซ่อม", (d.repair_cost || []).map((r) => ({ ทะเบียน: r.Plate, งานซ่อม: r.jobs, "ค่าใช้จ่าย (บาท)": Number(r.totalCost || 0) })));
  add("ความคิดเห็น", (d.comments || []).map((r) => ({ วันที่: r.date, รถ: r.car, ผู้ใช้: r.driver, ข้อความ: String(r.text).replace(/\[ความคิดเห็น\]/g, "").trim() })));
  add("ปัญหาที่แจ้ง", (d.problems || []).map((r) => ({ วันที่: r.date, รถ: r.car, ผู้ใช้: r.driver, ข้อความ: r.text })));
  add("การยกเลิก", (d.cancellations?.list || []).map((r) => ({ วันที่: String(r.BookingDate).slice(0, 10), รถ: r.CarPlate, ผู้จอง: r.DriverName, สถานะ: r.BookingStatus })));

  const start = document.getElementById("report-start")?.value || "";
  const end = document.getElementById("report-end")?.value || "";
  XLSX.writeFile(wb, `รายงานระบบจองรถ_${start}_ถึง_${end}.xlsx`);
}
window.exportAllReports = exportAllReports;
window.setReportRange = setReportRange;
window.fetchReports = fetchReports;
window.initReportDates = initReportDates;
