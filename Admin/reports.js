/**
 * 📊 Reports.js — รายงาน 4 หมวด: การจอง / การใช้รถ / ค่าซ่อม / การยกเลิก
 * Export Excel (SheetJS) + PDF (print CSS)
 */
let chartBookings = null;
let chartCarUsage = null;
let chartRepairCost = null;
let chartCancelRate = null;
const FX_COLORS = [
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];

function initReportDates() {
  const startInput = document.getElementById("report-start");
  const endInput = document.getElementById("report-end");
  if (!startInput || !endInput) return;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  startInput.value = start.toISOString().split("T")[0];
  endInput.value = end.toISOString().split("T")[0];
}

// ---------- Quick preset ช่วงวันที่ ----------
function setReportRange(preset) {
  const startInput = document.getElementById("report-start");
  const endInput = document.getElementById("report-end");
  if (!startInput || !endInput) return;

  const end = new Date();
  const start = new Date();

  if (preset === "today") {
    // start = end = วันนี้
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (preset === "month") {
    start.setDate(1);
  }

  startInput.value = start.toISOString().split("T")[0];
  endInput.value = end.toISOString().split("T")[0];
  fetchReports();
}

// ---------- Realtime แบบ polling: ดึงข้อมูลใหม่อัตโนมัติตอนอยู่แท็บรายงาน ----------
const REPORTS_POLL_INTERVAL_MS = 20000; // 20s — เท่ากับ dashboard/bookings กัน server รับ load ไม่เท่ากัน
let reportsPollTimer = null;

function startReportsPolling() {
  if (reportsPollTimer) return;
  reportsPollTimer = setInterval(() => {
    const tab = document.getElementById("reports-tab");
    if (tab && tab.classList.contains("active") && !document.hidden) {
      fetchReports();
    }
  }, REPORTS_POLL_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
  startReportsPolling();
});

function fetchReports() {
  const start = document.getElementById("report-start")?.value;
  const end = document.getElementById("report-end")?.value;
  if (!start || !end) return;

  fetch(`get_reports_data.php?start=${start}&end=${end}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        alert(data.message || "โหลดรายงานไม่สำเร็จ");
        return;
      }
      renderBookingReport(data.bookings);
      renderCarUsageReport(data.car_usage);
      renderRepairCostReport(data.repair_cost);
      renderCancellationReport(data.cancellations);
    })
    .catch((err) => {
      console.error("Error loading reports:", err);
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    });
}

// ---------- 1) การจอง ----------
function renderBookingReport(b) {
  const tbody = document.getElementById("report-booking-tbody");
  const byStatus = b.by_status || [];
  tbody.innerHTML =
    byStatus
      .map(
        (r) => `<tr><td>${r.BookingStatus || "-"}</td><td>${r.total}</td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="2" style="text-align:center;">ไม่มีข้อมูลในช่วงนี้</td></tr>`;

  const statsBox = document.getElementById("booking-status-stats");
  if (statsBox) {
    statsBox.innerHTML = byStatus.length
      ? byStatus
          .map(
            (r, i) => `
        <div class="fx-num-item">
          <strong style="color:${FX_COLORS[i % FX_COLORS.length]}">${r.total}</strong>
          <span>${r.BookingStatus || "-"}</span>
        </div>`,
          )
          .join("")
      : `<div class="fx-empty"><i class="fa-solid fa-inbox"></i><span>ไม่มีข้อมูลในช่วงนี้</span></div>`;
  }

  const byDay = b.by_day || [];
  const labels = byDay.map((r) => r.BookingDate);
  const values = byDay.map((r) => r.cnt);

  if (chartBookings) chartBookings.destroy();
  const ctx = document.getElementById("chart-bookings");
  if (!ctx || typeof Chart === "undefined") return;
  chartBookings = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "จำนวนการจอง/วัน",
          data: values,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2,132,199,0.15)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// ---------- 2) การใช้รถ ----------
function renderCarUsageReport(list) {
  const tbody = document.getElementById("report-car-usage-tbody");
  tbody.innerHTML =
    (list || [])
      .map((r) => `<tr><td>${r.CarPlate || "-"}</td><td>${r.cnt}</td></tr>`)
      .join("") ||
    `<tr><td colspan="2" style="text-align:center;">ไม่มีข้อมูลในช่วงนี้</td></tr>`;

  const labels = (list || []).map((r) => r.CarPlate);
  const values = (list || []).map((r) => r.cnt);

  if (chartCarUsage) chartCarUsage.destroy();
  const ctx = document.getElementById("chart-car-usage");
  if (!ctx || typeof Chart === "undefined") return;
  chartCarUsage = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "จำนวนครั้งที่ใช้งาน",
          data: values,
          backgroundColor: "#00b09b",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// ---------- 3) ค่าซ่อม ----------
function renderRepairCostReport(list) {
  const tbody = document.getElementById("report-repair-cost-tbody");
  let sum = 0;
  tbody.innerHTML =
    (list || [])
      .map((r) => {
        const cost = Number(r.totalCost || 0);
        sum += cost;
        return `<tr><td>${r.Plate || "-"}</td><td>${r.jobs}</td><td>${cost.toLocaleString()}</td></tr>`;
      })
      .join("") ||
    `<tr><td colspan="3" style="text-align:center;">ไม่มีข้อมูลในช่วงนี้</td></tr>`;

  const totalEl = document.getElementById("report-repair-cost-total");
  if (totalEl) totalEl.innerText = sum.toLocaleString() + " บาท";

  const totalV2 = document.getElementById("report-repair-cost-total-v2");
  if (totalV2) totalV2.innerText = sum.toLocaleString() + " บาท";
  const jobsTotal = (list || []).reduce((s, r) => s + Number(r.jobs || 0), 0);
  const jobsEl = document.getElementById("report-repair-jobs-total");
  if (jobsEl) jobsEl.innerText = jobsTotal.toLocaleString() + " งานซ่อม";

  const labels = (list || []).map((r) => r.Plate);
  const values = (list || []).map((r) => Number(r.totalCost || 0));

  if (chartRepairCost) chartRepairCost.destroy();
  const ctx = document.getElementById("chart-repair-cost");
  if (!ctx || typeof Chart === "undefined") return;
  chartRepairCost = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "ค่าซ่อม (บาท)", data: values, backgroundColor: "#f59e0b" },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// ---------- 4) การยกเลิก ----------
function renderCancellationReport(c) {
  const tbody = document.getElementById("report-cancel-tbody");
  tbody.innerHTML =
    (c.list || [])
      .map(
        (r) =>
          `<tr><td>${r.BookingDate || "-"}</td><td>${r.CarPlate || "-"}</td><td>${r.DriverName || "-"}</td><td>${r.BookingStatus || "-"}</td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="4" style="text-align:center;">ไม่มีการยกเลิกในช่วงนี้</td></tr>`;

  const summaryEl = document.getElementById("report-cancel-summary");
  if (summaryEl) {
    summaryEl.innerText = `ยกเลิก ${c.cancelled_count} จากทั้งหมด ${c.total_count} รายการ (${c.rate}%)`;
  }

  const rateTextEl = document.getElementById("cancel-rate-text");
  const rateSubEl = document.getElementById("cancel-rate-sub");
  if (rateTextEl) rateTextEl.innerText = `${c.rate}%`;
  if (rateSubEl)
    rateSubEl.innerText = `${c.cancelled_count} / ${c.total_count} รายการ`;

  const notCancelled = Math.max(
    (c.total_count || 0) - (c.cancelled_count || 0),
    0,
  );
  if (chartCancelRate) chartCancelRate.destroy();
  const dctx = document.getElementById("chart-cancel-rate");
  if (!dctx || typeof Chart === "undefined") return;
  chartCancelRate = new Chart(dctx, {
    type: "doughnut",
    data: {
      labels: ["ยกเลิก", "ไม่ยกเลิก"],
      datasets: [
        {
          data: [c.cancelled_count || 0, notCancelled],
          backgroundColor: ["#ef4444", "#10b981"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });
}

// ---------- Export Excel (ใช้ SheetJS อ่านตาราง HTML ตรงๆ) ----------
function exportTableExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table || typeof XLSX === "undefined") {
    alert("โหลดตัว export ไม่สำเร็จ ลองรีเฟรชหน้าใหม่");
    return;
  }
  const wb = XLSX.utils.table_to_book(table, { sheet: "รายงาน" });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ---------- Export PDF (พิมพ์เฉพาะ panel ที่เลือก ผ่าน print dialog ของเบราว์เซอร์) ----------
function printReportSection(sectionId) {
  document
    .querySelectorAll(".print-target")
    .forEach((el) => el.classList.remove("print-target"));
  const el = document.getElementById(sectionId);
  if (el) el.classList.add("print-target");
  window.print();
}

window.addEventListener("afterprint", () => {
  document
    .querySelectorAll(".print-target")
    .forEach((el) => el.classList.remove("print-target"));
});
