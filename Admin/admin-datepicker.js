/**
 * Custom Date Picker — Admin (โทนขาว ให้ตรงกับ style.css ของ Admin)
 * ------------------------------------------------
 * ต่างจากตัวฝั่ง booking ตรงที่:
 *  1. ธีมสีขาว ใช้ token จาก style.css (--bg-input, --text-primary, --blue ฯลฯ)
 *  2. ทำงานกับ input[type=date] "ทุกตัวในหน้า" อัตโนมัติ ไม่ต้องระบุ id ทีละตัว
 *     เพราะ Admin เป็น SPA, บาง input ไม่มี id (มีแค่ name), และบาง input ถูกสร้าง
 *     ทีหลังผ่าน innerHTML (เช่น modal เพิ่มงานซ่อม, modal แก้ไขการจอง)
 *     -> ใช้ MutationObserver เฝ้าดู DOM ทั้งหน้า เจอ input[type=date] ใหม่เมื่อไหร่ ครอบให้อัตโนมัติ
 *
 * ฟังก์ชันหลักด้านในเหมือนตัว booking ทุกอย่าง (parse/format วันที่, ปฏิทินไทย, position:fixed
 * หนี overflow:hidden ของ card) ต่างแค่ผูกกับ "element" ตรงๆ แทนที่จะผูกกับ id
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
      a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function enhanceDateInput(input, options) {
    const opts = options || {};
    if (!input || input.dataset.cdpInit) return;
    input.dataset.cdpInit = "1";

    const wrap = document.createElement("div");
    wrap.className = "cdp-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.type = "hidden"; // ยัง submit ผ่าน name เดิมได้ปกติ (ทั้ง id-based และ FormData แบบ name)

    const display = document.createElement("div");
    display.className = "cdp-display";
    display.tabIndex = 0;
    display.innerHTML =
      '<span class="cdp-text cdp-placeholder">' + (opts.placeholder || "เลือกวันที่") + '</span>' +
      '<svg class="cdp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<rect x="3" y="4" width="18" height="18" rx="2"></rect>' +
      '<line x1="16" y1="2" x2="16" y2="6"></line>' +
      '<line x1="8" y1="2" x2="8" y2="6"></line>' +
      '<line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    const textEl = display.querySelector(".cdp-text");

    const panel = document.createElement("div");
    panel.className = "cdp-panel hidden";
    panel.style.position = "fixed";

    wrap.appendChild(display);
    document.body.appendChild(panel);

    function positionPanel() {
      const rect = display.getBoundingClientRect();
      const panelWidth = panel.offsetWidth || 280;
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
      if (left < 8) left = 8;
      let top = rect.bottom + 6;
      const panelHeight = panel.offsetHeight || 360;
      if (top + panelHeight > window.innerHeight - 8) {
        top = rect.top - panelHeight - 6;
        if (top < 8) top = 8;
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

    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
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
      input.value = toISO(y, m, d);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePanel();
    }

    function renderPanel() {
      const today = new Date();
      const selected = parseISO(input.value);
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startOffset = firstOfMonth.getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

      let cellsHtml = "";
      for (let i = startOffset - 1; i >= 0; i--) {
        cellsHtml += `<button type="button" class="cdp-day cdp-muted" disabled>${daysInPrevMonth - i}</button>`;
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(viewYear, viewMonth, d);
        const classes = ["cdp-day"];
        if (isSameDay(dateObj, today)) classes.push("cdp-today");
        if (selected && isSameDay(dateObj, selected)) classes.push("cdp-selected");
        cellsHtml += `<button type="button" class="${classes.join(" ")}" data-y="${viewYear}" data-m="${viewMonth}" data-d="${d}">${d}</button>`;
      }
      const totalCells = startOffset + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let d = 1; d <= trailing; d++) {
        cellsHtml += `<button type="button" class="cdp-day cdp-muted" disabled>${d}</button>`;
      }

      panel.innerHTML = `
        <div class="cdp-header">
          <div class="cdp-nav"><button type="button" data-nav="-1" aria-label="เดือนก่อนหน้า">‹</button></div>
          <div class="cdp-month-label">${THAI_MONTHS[viewMonth]} ${viewYear + 543}</div>
          <div class="cdp-nav"><button type="button" data-nav="1" aria-label="เดือนถัดไป">›</button></div>
        </div>
        <div class="cdp-grid">
          ${THAI_DOW.map((d) => `<div class="cdp-dow">${d}</div>`).join("")}
          ${cellsHtml}
        </div>
        <div class="cdp-footer">
          <button type="button" data-action="clear">ล้างค่า</button>
          <button type="button" data-action="today">วันนี้</button>
        </div>`;

      panel.querySelectorAll(".cdp-nav [data-nav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          viewMonth += parseInt(btn.dataset.nav, 10);
          if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          renderPanel();
          positionPanel();
        });
      });
      panel.querySelectorAll(".cdp-day:not(.cdp-muted)").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectDate(parseInt(btn.dataset.y, 10), parseInt(btn.dataset.m, 10), parseInt(btn.dataset.d, 10));
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
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); }
      else if (e.key === "Escape") closePanel();
    });
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    });

    refreshDisplay(input.value);
  }

  // 🌟 สแกน root ที่ให้มา หา input[type=date] ทุกตัวที่ยังไม่ถูกครอบ แล้วครอบให้หมด
  function enhanceAllDateInputs(root) {
    (root || document).querySelectorAll('input[type="date"]:not([data-cdp-init])').forEach((el) => {
      enhanceDateInput(el, { placeholder: el.placeholder || "เลือกวันที่" });
    });
  }

  window.enhanceAllDateInputs = enhanceAllDateInputs;

  document.addEventListener("DOMContentLoaded", () => {
    enhanceAllDateInputs(document);

    // 🌟 Admin เป็น SPA: modal งานซ่อม / แก้ไขการจอง ถูกสร้างทีหลังด้วย innerHTML
    // เฝ้า DOM ทั้งหน้าไว้ เจอ input[type=date] โผล่มาใหม่เมื่อไหร่ (ทั้งจากทั้ง element ใหม่
    // หรือ subtree ที่เพิ่งถูกแทรกเข้ามา) ครอบให้อัตโนมัติทันที ไม่ต้องแก้ app.js จุดที่สร้าง modal เลย
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return; // element only
          if (node.matches && node.matches('input[type="date"]')) {
            enhanceDateInput(node, { placeholder: node.placeholder || "เลือกวันที่" });
          }
          if (node.querySelectorAll) enhanceAllDateInputs(node);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();