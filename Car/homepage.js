window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});
/* =========================================
   0. Helper: format datetime string เป็นเวลาไทย HH:MM
   ========================================= */
function formatThaiTime(dateTimeStr) {
  if (!dateTimeStr) return "-";
  const d = new Date(dateTimeStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateTimeStr; // fallback ถ้า parse ไม่ได้
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

/* =========================================
   1. ฟังก์ชันดึงประวัติการจอง (ตารางด้านล่าง)
   ========================================= */
// 🔒 กัน Stored XSS: ชื่อผู้ขับ/ผู้ร่วมทางมาจากที่ผู้ใช้กรอกเอง ต้อง escape ก่อนแปะลง innerHTML
function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function updateHistoryTable() {
  const tableBody = document.getElementById("history-table-body");
  if (!tableBody) return;

  fetch("get_history.php")
    .then((res) => res.json())
    .then((data) => {
      if (data && data.error) {
        console.error("get_history.php error:", data.error);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">เกิดข้อผิดพลาด: ${escHtml(data.error)}</td></tr>`;
        return;
      }

      const bookings = Array.isArray(data) ? data : [];
      bookings.sort((a, b) => (b.booking_id || 0) - (a.booking_id || 0));
      if (bookings.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="9" style="text-align:center;">ไม่พบประวัติการจอง</td></tr>';
        return;
      }

      tableBody.innerHTML = bookings
        .map((item) => {
          const status = item.booking_status || "";
          const isCancelled = status.includes("ยกเลิก");
          const isReturned = status === "คืนแล้ว" || status === "ปิดโดยระบบ";

          let badgeClass, badgeText;
          if (isCancelled) {
            badgeClass = "status-cancelled";
            badgeText = "ยกเลิก";
          } else if (isReturned) {
            badgeClass = "status-returned";
            badgeText = status === "ปิดโดยระบบ" ? "ปิดโดยระบบ" : "คืนแล้ว";
          } else if (item.checkin_time) {
            badgeClass = "status-inuse";
            badgeText = "กำลังใช้งาน";
          } else {
            badgeClass = "status-booked";
            badgeText = "ติดจอง";
          }
          // สถานะดิบสำหรับป้ายกลาง: ยกเลิก/คืนแล้ว ใช้ค่าจริง, ที่เหลือดูจากเวลาเช็คอิน
          const rawStatus = isCancelled || isReturned ? status : item.checkin_time ? "ขาไป" : "จองแล้ว";
          return `
      <tr>
          <td data-label="วันที่">${escHtml(item.out_date || "-")}</td>
          <td data-label="เวลาเช็คอิน">${escHtml(formatThaiTime(item.checkin_time))}</td>
          <td data-label="เวลาคืนรถ">${escHtml(item.return_time || "-")}</td>
          <td data-label="สถานะ">${statusBadge(rawStatus, { due: bookingDue(item.booking_date || item.out_date, item.out_time, item.planned_return), returned: bookingReturned(item.return_date, item.return_time) })}</td>
          <td data-label="ทะเบียน">${escHtml(item.car_plate || "-")}</td>
          <td data-label="คนขับ">${escHtml(item.driver_name || "-")}</td>
          <td data-label="รหัสพนักงานคนขับ">${escHtml(item.employeeId || "-")}</td>
          <td data-label="ผู้ร่วมเดินทาง">${escHtml(item.passengers || "-")}</td>
          <td data-label="รหัสพนักงานผู้ร่วมเดินทาง">${escHtml(item.passenger_ids || "-")}</td>
      </tr>`;
        })
        .join("");
    })
    .catch((error) => {
      console.error("Error History Table:", error);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">ไม่สามารถดึงข้อมูลประวัติได้</td></tr>`;
    });
}

/* =========================================
   2. ฟังก์ชันดึงข้อมูลรถยนต์ (Card Grid)
   ========================================= */
function loadCarData(statusFilter = "all", btn = null) {
  const grid = document.getElementById("car-list-grid");

  // ถ้าหน้านี้ไม่มีที่แสดงรถ (id="car-list-grid") ให้หยุดทำงาน
  if (!grid) return;

  grid.innerHTML = `<p style="color: #666; padding: 20px;">กำลังโหลดข้อมูลรถ...</p>`;

  // จัดการปุ่ม Filter (Slice effect)
  if (btn) {
    document
      .querySelectorAll(".slice")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  fetch("get_all_cars.php")
    .then((response) => response.json())
    .then((data) => {
      let filtered = data;
      if (statusFilter !== "all") {
        filtered = data.filter((car) => car.status === statusFilter);
      }

      if (filtered.length === 0) {
        grid.innerHTML = `<p style="color: #888; padding: 20px;">ไม่พบข้อมูลรถยนต์</p>`;
        return;
      }

      grid.innerHTML = filtered
        .map(
          (car) => `
                <div class="car-card">
                    <img src="${car.image}" class="card-img" onerror="this.src='assets/img-car/car-placeholder.png'">
                    <div class="card-content">
                        <h3 class="car-plate">${car.plate}</h3>
                        <p class="car-brand">${car.brand}</p>
                        <div class="car-info">
                            ${statusBadge(car.status === "available" ? "ว่าง" : "ไม่ว่าง", { type: "car" })}
                            <span style="color: #888;">ไมล์: ${Number(car.current_mileage).toLocaleString()} กม.</span>
                        </div>
                    </div>
                </div>`,
        )
        .join("");
    })
    .catch((error) => {
      console.error("Error Cars:", error);
      grid.innerHTML = `<p style="color: red; padding: 20px;">ไม่สามารถดึงข้อมูลได้</p>`;
    });
}

/* =========================================
   3. ส่วนควบคุมการทำงาน (Event Listeners)
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("Homepage JS Loaded...");

  // ดึงข้อมูลรถ (ถ้ามี grid)
  loadCarData("all");

  // ดึงข้อมูลประวัติ (ถ้ามีตาราง)
  updateHistoryTable();

  // ตั้งเวลาอัปเดตประวัติทุก 5 วินาที
  setInterval(updateHistoryTable, 5000);
});

/* =========================================
   4. ฟังก์ชันคำนวณและอัปเดตตัวเลขสถิติ (Stats Counter)
   ========================================= */
function updateStatsCounters(bookings) {
  const totalElement = document.getElementById("stat-total"); // ช่องรวมการจอง
  const activeElement = document.getElementById("stat-active"); // ช่องกำลังใช้งาน
  const completeElement = document.getElementById("stat-complete"); // ช่องเสร็จสิ้น

  if (!totalElement || !activeElement || !completeElement) return;

  const total = bookings.length;
  const active = bookings.filter(
    (item) => item.booking_status === "ขาไป",
  ).length;
  const complete = bookings.filter(
    (item) => item.booking_status === "คืนแล้ว" || item.booking_status === "ปิดโดยระบบ",
  ).length;

  totalElement.innerText = total;
  activeElement.innerText = active;
  completeElement.innerText = complete;
}

/* =========================================
   สแกน QR แล้วถูกส่งมาหน้านี้ (scan.php) — บอกเหตุผลให้ผู้ใช้รู้ แล้วล้าง ?msg ออกจาก URL
   ========================================= */
(function showScanMessage() {
  const params = new URLSearchParams(window.location.search);
  const msg = params.get("msg");
  if (!msg) return;
  const plate = params.get("plate") || "";
  const texts = {
    no_active_booking: ["warning", "ไม่พบรายการจองที่ใช้งานอยู่ของรถ" + (plate ? " " + plate : "") + " (อาจสแกนผิดคัน หรือคืนรถไปแล้ว)"],
    system_error: ["error", "ระบบขัดข้องชั่วคราว กรุณาลองสแกนใหม่อีกครั้ง"],
  };
  if (!texts[msg]) return;
  if (typeof showToast === "function") showToast(texts[msg][0], texts[msg][1], 6000);
  params.delete("msg");
  params.delete("plate");
  const qs = params.toString();
  history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
})();

/* =========================================
   งานของฉันตอนนี้ — การ์ดบนหน้าหลัก: เช็คอิน/ยืนยันรับรถ/รถยังไม่มา/คืนรถ ได้เลยโดยไม่ต้องสแกน QR
   (ลิงก์ไป scan.php?plate=… ซึ่งเป็นหน้าเดียวกับที่ QR บนรถเปิด)
   ========================================= */
(function () {
  const box = document.getElementById("my-active");
  if (!box) return;
  const ask = async (title, message, confirmText, danger) => {
    if (window.AppDialog) return window.AppDialog.confirm({ title, message, confirmText, cancelText: "กลับ", danger: !!danger });
    return window.confirm(title);
  };
  const toast = (type, msg) => { if (typeof showToast === "function") showToast(type, msg, 4000); };
  const post = (url, body) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  function cardHtml(o) {
    const q = encodeURIComponent(o.CarPlate || "");
    const plate = escHtml(o.CarPlate);
    const who = escHtml(o.DriverName || "-");
    if (o.kind === "pickup") {
      return `<div class="ma-card ma-pickup" data-id="${o.BookingID}">
        <div class="ma-head"><span class="ma-tag">ถึงเวลารับรถ</span><b class="ma-plate">${plate}</b></div>
        <p>${who} · เวลาจอง ${escHtml(o.OutHM)}–${escHtml(o.DueHM)} น.${o.Destination ? " · " + escHtml(o.Destination) : ""}</p>
        <div class="ma-btns"><a class="ma-main ma-blue" href="scan.php?plate=${q}"><i class="fa-solid fa-key"></i> เช็คอินรับรถ</a></div>
      </div>`;
    }
    const tag = o.waiting ? "รอรถอยู่" : o.overdue ? "เลยเวลาคืน" : "กำลังใช้งาน";
    const note = o.auto
      ? `ระบบเช็คอินให้ ${escHtml(o.CheckinHM || "-")} น. ตามเวลาจอง · กำหนดคืน ${escHtml(o.DueHM)} น.`
      : `กำหนดคืน ${escHtml(o.DueHM)} น.${o.overdue ? " (เลยกำหนดแล้ว)" : ""}`;
    let sec = "";
    if (o.waiting) {
      sec = `<div class="ma-sub"><span>แจ้ง "รถยังไม่มา" แล้ว ระบบกำลังแจ้งคนที่ถือรถ</span>
        <button type="button" class="ma-ghost ma-ok" data-act="got">ได้รับรถแล้ว</button>
        <button type="button" class="ma-ghost ma-danger" data-act="unused-wait">ไม่ได้รับรถ ยกเลิก</button></div>`;
    } else if (o.auto) {
      sec = `<div class="ma-sub"><a class="ma-ghost ma-ok" href="checkin.html?plate=${q}&picked=1">ยืนยันรับรถ</a>
        <button type="button" class="ma-ghost ma-wait" data-act="wait"><i class="fa-solid fa-hourglass-half"></i> รถยังไม่มา</button>
        <button type="button" class="ma-ghost" data-act="unused">ไม่ได้ใช้รถ</button></div>`;
    }
    return `<div class="ma-card ma-inuse${o.overdue ? " ma-late" : ""}" data-id="${o.BookingID}">
      <div class="ma-head"><span class="ma-tag">${tag}</span><b class="ma-plate">${plate}</b></div>
      <p>${who} · ${note}</p>
      <div class="ma-btns"><a class="ma-main ma-green" href="return_scan.html?plate=${q}"><i class="fa-solid fa-flag-checkered"></i> คืนรถ (ถ่ายรูปเลขไมล์)</a></div>
      ${sec}
    </div>`;
  }

  function load() {
    fetch("get_my_active.php", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const items = (d && d.items) || [];
        box.hidden = items.length === 0;
        box.innerHTML = items.map(cardHtml).join("");
      })
      .catch(() => {});
  }

  box.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = Number(btn.closest(".ma-card").dataset.id);
    const act = btn.dataset.act;
    try {
      if (act === "wait") {
        if (!(await ask("แจ้งว่ารถยังไม่มา?", "ระบบจะหยุดปิดรายการของคุณชั่วคราว และแจ้ง รปภ. แอดมิน และคนที่ยังถือรถอยู่ให้นำรถกลับมา", "แจ้งรถยังไม่มา"))) return;
        const r = await post("car_waiting.php", { booking_id: id, action: "wait" });
        toast(r.success ? "success" : "error", r.success ? "แจ้งแล้ว ระบบกำลังแจ้งคนที่ถือรถอยู่" : r.message || "ทำรายการไม่สำเร็จ");
      } else if (act === "got") {
        const r = await post("car_waiting.php", { booking_id: id, action: "got" });
        toast(r.success ? "success" : "error", r.success ? "บันทึกว่าได้รับรถแล้ว" : r.message || "ทำรายการไม่สำเร็จ");
      } else {
        if (!(await ask(act === "unused-wait" ? "ไม่ได้รับรถ ยกเลิกรายการนี้?" : "ไม่ได้ใช้รถคันนี้จริงใช่ไหม?", "ระบบจะปล่อยรถให้คนอื่นจองได้ทันที", "ไม่ได้ใช้รถ", true))) return;
        const r = await post("cancel_booking.php", { booking_id: id, unused: true });
        toast(r.success ? "success" : "error", r.success ? "ปล่อยรถเรียบร้อยแล้ว" : r.message || "ทำรายการไม่สำเร็จ");
      }
    } catch (err) {
      toast("error", "ติดต่อ Server ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    }
    load();
  });

  load();
  setInterval(() => { if (!document.hidden) load(); }, 60000); // ถึงเวลาเช็คอิน/ระบบเช็คอินให้ การ์ดขึ้นเองโดยไม่ต้องรีเฟรช
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
})();
