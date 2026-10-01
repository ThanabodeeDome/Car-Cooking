/**
 * Custom Date Picker (vanilla JS, no deps)
 * ------------------------------------------------
 * แทนที่ <input type="date"> ของ browser (ตัวที่ theme ไม่ตรงกับหน้าเว็บ)
 * ด้วย custom calendar โทนมืดให้เข้ากับหน้า booking
 *
 * ออกแบบให้ "ของเดิม" (booking.js) ไม่ต้องแก้อะไรเลย เพราะ:
 *  - id ของ input เดิมยังอยู่เหมือนเดิม (document.getElementById("use-date") ใช้ได้ปกติ)
 *  - .value ยังเป็น string รูปแบบ "YYYY-MM-DD" เหมือนเดิม
 *  - เวลาเลือกวันที่ผ่าน custom picker จะ dispatch "change" event ให้เหมือน native input
 *    -> onchange="updateAvailableTimeSlots()" ที่ผูกไว้ใน HTML ทำงานเหมือนเดิมทุกอย่าง
 *  - เวลา booking.js สั่ง .value = today ตรงๆ (บรรทัด DOMContentLoaded ตอนตั้งค่าเริ่มต้น)
 *    ตัว picker ก็ยังอัปเดตหน้าตาให้ตรงกัน (ผ่าน property override ด้านล่าง)
 *
 * วิธีใช้:
 *   1. ใส่ <link rel="stylesheet" href="custom-datepicker.css">
 *   2. ใส่ <script src="custom-datepicker.js"></script> "ก่อน" booking.js เสมอ
 *   3. เรียก initCustomDatePicker("use-date") / initCustomDatePicker("return-date")
 *      (ไฟล์นี้เรียกให้อัตโนมัติท้ายไฟล์อยู่แล้วสำหรับ 2 id นี้)
 */

(function () {
  const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function toISO(y, m, d) {
    return `${y}-${pad(m + 1)}-${pad(d)}`;
  }
  function parseISO(str) {
    if (!str) return null;
    const parts = String(str).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }
  function formatDisplay(str) {
    const d = parseISO(str);
    if (!d) return "";
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function isSameDay(a, b) {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function initCustomDatePicker(inputId, options) {
    const opts = options || {};
    const input = document.getElementById(inputId);
    if (!input || input.dataset.cdpInit) return;
    input.dataset.cdpInit = "1";

    // --- ห่อ input เดิมด้วย wrapper, ตัว input เดิมกลายเป็น hidden field ---
    const wrap = document.createElement("div");
    wrap.className = "cdp-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.type = "hidden"; // เลิกใช้ native date UI แต่ id/name/value ยังอยู่เหมือนเดิม

    // --- ส่วนแสดงผล (สิ่งที่ผู้ใช้เห็นแทน input เดิม) ---
    const display = document.createElement("div");
    display.className = "cdp-display";
    display.tabIndex = 0;
    display.innerHTML =
      '<span class="cdp-text cdp-placeholder">' +
      (opts.placeholder || "เลือกวันที่") +
      '</span>' +
      '<svg class="cdp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect>' +
      '<line x1="16" y1="2" x2="16" y2="6"></line>' +
      '<line x1="8" y1="2" x2="8" y2="6"></line>' +
      '<line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    const textEl = display.querySelector(".cdp-text");

    const panel = document.createElement("div");
    panel.className = "cdp-panel hidden";
    panel.style.position = "fixed"; // 🌟 แขวนที่ body ไม่ใช่ลูก wrap เพื่อหนี .booking-card { overflow: hidden } ที่ตัด panel

    wrap.appendChild(display);
    document.body.appendChild(panel); // 🌟 ไม่ใส่ใน wrap แล้ว กัน parent overflow:hidden ตัดขอบ

    function positionPanel() {
      const rect = display.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 280;
      let left = rect.left;
      // กันล้นขวาจอ
      if (left + panelWidth > window.innerWidth - 8) {
        left = window.innerWidth - panelWidth - 8;
      }
      if (left < 8) left = 8;

      let top = rect.bottom + 6;
      const panelHeight = panel.offsetHeight || 360;
      // ถ้าล้นล่างจอ ให้เด้งขึ้นด้านบน input แทน
      if (top + panelHeight > window.innerHeight - 8) {
        top = rect.top - panelHeight - 6;
        if (top < 8) top = 8; // ถ้ายังไม่พอจริงๆ ก็ชิดขอบบนสุด
      }
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${Math.min(280, window.innerWidth - 16)}px`;
    }

    let viewDate = parseISO(input.value) || new Date();
    let viewYear = viewDate.getFullYear();
    let viewMonth = viewDate.getMonth();

    function refreshDisplay(value) {
      const formatted = formatDisplay(value);
      if (formatted) {
        textEl.textContent = formatted;
        textEl.classList.remove("cdp-placeholder");
      } else {
        textEl.textContent = opts.placeholder || "เลือกวันที่";
        textEl.classList.add("cdp-placeholder");
      }
    }

    // --- override .value เพื่อให้ picker sync หน้าตา แม้โค้ดอื่น (booking.js) สั่ง .value = xxx ตรงๆ ---
    const nativeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    );
    Object.defineProperty(input, "value", {
      configurable: true,
      get() {
        return nativeDescriptor.get.call(input);
      },
      set(v) {
        nativeDescriptor.set.call(input, v);
        refreshDisplay(v);
        const d = parseISO(v);
        if (d) {
          viewYear = d.getFullYear();
          viewMonth = d.getMonth();
        }
      },
    });

    function selectDate(y, m, d) {
      const iso = toISO(y, m, d);
      input.value = iso; // ใช้ setter ด้านบน -> อัปเดตหน้าตาให้เอง
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePanel();
    }

    function renderPanel() {
      const today = new Date();
      const selected = parseISO(input.value);
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startOffset = firstOfMonth.getDay(); // 0=อา
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      let cellsHtml = "";
      // วันของเดือนก่อนหน้า (mute)
      for (let i = startOffset - 1; i >= 0; i--) {
        cellsHtml += `<button type="button" class="cdp-day cdp-muted" disabled>${daysInPrevMonth - i}</button>`;
      }
      // วันของเดือนนี้
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(viewYear, viewMonth, d);
        const classes = ["cdp-day"];
        if (isSameDay(dateObj, today)) classes.push("cdp-today");
        if (selected && isSameDay(dateObj, selected)) classes.push("cdp-selected");
        cellsHtml += `<button type="button" class="${classes.join(" ")}" data-y="${viewYear}" data-m="${viewMonth}" data-d="${d}">${d}</button>`;
      }
      // เติมวันเดือนถัดไปให้เต็มแถวสุดท้าย
      const totalCells = startOffset + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let d = 1; d <= trailing; d++) {
        cellsHtml += `<button type="button" class="cdp-day cdp-muted" disabled>${d}</button>`;
      }

      panel.innerHTML = `
        <div class="cdp-header">
          <div class="cdp-nav">
            <button type="button" data-nav="-1" aria-label="เดือนก่อนหน้า">‹</button>
          </div>
          <div class="cdp-month-label">${THAI_MONTHS[viewMonth]} ${viewYear + 543}</div>
          <div class="cdp-nav">
            <button type="button" data-nav="1" aria-label="เดือนถัดไป">›</button>
          </div>
        </div>
        <div class="cdp-grid">
          ${THAI_DOW.map((d) => `<div class="cdp-dow">${d}</div>`).join("")}
          ${cellsHtml}
        </div>
        <div class="cdp-footer">
          <button type="button" data-action="clear">ล้างค่า</button>
          <button type="button" data-action="today">วันนี้</button>
        </div>
      `;

      panel.querySelectorAll(".cdp-nav [data-nav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          viewMonth += parseInt(btn.dataset.nav, 10);
          if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
          } else if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
          }
          renderPanel();
          positionPanel();
        });
      });

      panel.querySelectorAll(".cdp-day:not(.cdp-muted)").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectDate(
            parseInt(btn.dataset.y, 10),
            parseInt(btn.dataset.m, 10),
            parseInt(btn.dataset.d, 10)
          );
        });
      });

      panel.querySelector('[data-action="clear"]').addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        closePanel();
      });

      panel.querySelector('[data-action="today"]').addEventListener("click", (e) => {
        e.stopPropagation();
        const t = new Date();
        viewYear = t.getFullYear();
        viewMonth = t.getMonth();
        selectDate(t.getFullYear(), t.getMonth(), t.getDate());
      });
    }

    function onReposition() {
      if (!panel.classList.contains("hidden")) positionPanel();
    }

    function openPanel() {
      renderPanel();
      panel.classList.remove("hidden");
      wrap.classList.add("open");
      positionPanel();
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
    }
    function closePanel() {
      panel.classList.add("hidden");
      wrap.classList.remove("open");
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    }
    function togglePanel() {
      panel.classList.contains("hidden") ? openPanel() : closePanel();
    }

    display.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePanel();
    });
    display.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePanel();
      } else if (e.key === "Escape") {
        closePanel();
      }
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    });

    // sync ครั้งแรก (เผื่อมี value อยู่แล้วตอน init)
    refreshDisplay(input.value);
  }

  // ให้ไฟล์อื่นเรียกใช้ซ้ำได้ (เช่นถ้ามี input date อื่นในหน้าอื่น)
  window.initCustomDatePicker = initCustomDatePicker;

  document.addEventListener("DOMContentLoaded", () => {
    initCustomDatePicker("use-date");
    initCustomDatePicker("return-date");
  });
})();