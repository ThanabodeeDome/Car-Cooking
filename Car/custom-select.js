/**
 * Custom Select Dropdown (vanilla JS, no deps)
 * ------------------------------------------------
 * แทนที่ native <select> (dropdown เบราว์เซอร์ ธีมไม่ตรง แต่งไม่ได้)
 * ด้วย dropdown โทนมืดของเว็บเอง รองรับ:
 *   - รูปภาพ thumbnail ต่อ option (อ่านจาก option.dataset.image)
 *   - ไอคอน emoji นำหน้าข้อความ option (ดึงอัตโนมัติจากตัวอักษรแรกถ้าเป็น emoji)
 *
 * เข้ากันได้กับโค้ดเดิม (booking.js) เพราะ:
 *  - select ต้นฉบับยังอยู่ใน DOM เหมือนเดิม (id/name/value เดิมทั้งหมด)
 *  - .value ยังอ่าน/set ได้ตามปกติ, เวลาเลือกจะ dispatch "change" event ให้
 *    -> onchange="updateCarDetails(this.value)" / showStartMileHint(this.value) ทำงานเหมือนเดิม
 *  - รองรับ select ที่เติม <option> "แบบ dynamic ทีหลัง" (fetch แล้ว .add(opt))
 *    ผ่าน MutationObserver คอย sync รายการใหม่ให้ dropdown เองอัตโนมัติ
 *
 * วิธีใช้:
 *   1. ใส่ <link rel="stylesheet" href="custom-select.css">
 *   2. ใส่ <script src="custom-select.js"></script> ก่อน booking.js
 *   3. ไฟล์นี้ init ให้อัตโนมัติท้ายไฟล์สำหรับ car-plate-select, return-car-plate, time-slot
 */

(function () {
  const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u;

  function extractIcon(text) {
    const m = text.match(EMOJI_RE);
    if (!m) return { icon: null, label: text };
    return { icon: m[1], label: text.slice(m[0].length) };
  }

  function initCustomSelect(selectId, options) {
    const opts = options || {};
    const select = document.getElementById(selectId);
    if (!select || select.dataset.cselInit) return;
    select.dataset.cselInit = "1";

    const wrap = document.createElement("div");
    wrap.className = "csel-wrap";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("csel-native"); // ซ่อนของเดิม แต่ยัง submit ได้ตามปกติ

    const trigger = document.createElement("div");
    trigger.className = "csel-trigger";
    trigger.tabIndex = select.disabled ? -1 : 0;
    trigger.innerHTML =
      '<span class="csel-trigger-content"><span class="csel-placeholder">' +
      (opts.placeholder || "-- เลือก --") +
      '</span></span>' +
      '<svg class="csel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<polyline points="6 9 12 15 18 9"></polyline></svg>';
    const triggerContent = trigger.querySelector(".csel-trigger-content");

    const panel = document.createElement("div");
    panel.className = "csel-panel hidden";
    panel.style.position = "fixed"; // หนี overflow:hidden ของ .booking-card เหมือน datepicker
    if (opts.grid) panel.classList.add("csel-gridmode"); // แสดงตัวเลือกเป็นตารางช่อง (ไม่ต้องเลื่อน) เหมาะกับรายการเวลา

    wrap.appendChild(trigger);
    document.body.appendChild(panel);

    function optionVisual(optionEl) {
      const img = optionEl.dataset.image;
      if (img) {
        return `<img class="csel-thumb" src="${img}" alt="" onerror="this.style.visibility='hidden'">`;
      }
      const { icon } = extractIcon(optionEl.textContent || "");
      if (icon) return `<span class="csel-emoji">${icon}</span>`;
      if (opts.fallbackIcon) return `<span class="csel-emoji">${opts.fallbackIcon}</span>`;
      return "";
    }

    function renderTrigger() {
      const selected = select.options[select.selectedIndex];
      if (!selected || !selected.value) {
        triggerContent.innerHTML =
          '<span class="csel-placeholder">' + (opts.placeholder || "-- เลือก --") + "</span>";
        return;
      }
      const { label } = extractIcon(selected.textContent || "");
      triggerContent.innerHTML = `${optionVisual(selected)}<span class="csel-label">${label}</span>`;
    }

    // ตั้งค่าเวลา HH:MM ที่ไม่มีใน <select> เดิม (เช่น 09:30) — เพิ่ม option ให้ แล้วส่ง change เหมือนเลือกปกติ
    function setTimeValue(v) {
      if (!Array.from(select.options).some((o) => o.value === v)) select.add(new Option(v, v));
      select.value = v;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      renderTrigger();
    }

    function renderPanel() {
      const curHH = (select.value || "").slice(0, 2);
      const curMM = (select.value || "").slice(3, 5);
      const rows = Array.from(select.options)
        .filter((o) => !o.disabled && (!opts.minutes || /:00$/.test(o.value)))
        .map((o) => {
          const { label } = extractIcon(o.textContent || "");
          const selectedClass = (opts.minutes ? o.value.slice(0, 2) === curHH : o.value === select.value) ? " csel-selected" : "";
          return `<div class="csel-option${selectedClass}" data-value="${o.value.replace(/"/g, "&quot;")}">
            ${optionVisual(o)}<span class="csel-option-label">${label}</span>
          </div>`;
        })
        .join("");
      // โหมดเลือกนาที: ใต้ตารางชั่วโมงมีแถวนาที (ทีละ 5) + ปุ่ม "เสร็จ" — เลือกชั่วโมงแล้วค้างแผงไว้ให้เลือกนาทีต่อ
      let minutesHtml = "";
      if (opts.minutes) {
        const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
        minutesHtml =
          '<div class="csel-minutes-title">นาที</div><div class="csel-minutes">' +
          mins.map((m) => `<div class="csel-min${m === curMM ? " csel-selected" : ""}" data-min="${m}">${m}</div>`).join("") +
          '</div><div class="csel-done" role="button">เสร็จ</div>';
      }
      panel.innerHTML = rows ? (opts.grid ? '<div class="csel-grid">' + rows + "</div>" + minutesHtml : rows) : '<div class="csel-empty">ไม่มีตัวเลือก</div>';

      if (opts.minutes) {
        panel.querySelectorAll(".csel-min").forEach((m) =>
          m.addEventListener("click", (e) => {
            e.stopPropagation();
            const hh = (select.value || "").slice(0, 2);
            if (!hh) return; // ยังไม่ได้เลือกชั่วโมง
            setTimeValue(hh + ":" + m.dataset.min);
            closePanel();
          }),
        );
        const done = panel.querySelector(".csel-done");
        if (done) done.addEventListener("click", (e) => { e.stopPropagation(); closePanel(); });
        panel.querySelectorAll(".csel-option").forEach((row) =>
          row.addEventListener("click", (e) => {
            e.stopPropagation();
            const mm = (select.value || "").slice(3, 5) || "00"; // เปลี่ยนชั่วโมง คงนาทีเดิมไว้
            setTimeValue(row.dataset.value.slice(0, 2) + ":" + mm);
            renderPanel(); // อัปเดตไฮไลต์ ค้างแผงไว้ให้เลือกนาที
          }),
        );
        return;
      }

      panel.querySelectorAll(".csel-option").forEach((row) => {
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          select.value = row.dataset.value;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          renderTrigger();
          closePanel();
        });
      });
    }

    function positionPanel() {
      const rect = trigger.getBoundingClientRect();
      // โหมดตาราง: กว้างอย่างน้อย 248px (ช่องเวลา 4 คอลัมน์) แต่ไม่ล้นจอ
      const panelWidth = opts.grid ? Math.min(Math.max(rect.width, 248), window.innerWidth - 16) : rect.width;
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
      if (left < 8) left = 8;

      let top = rect.bottom + 6;
      const panelHeight = panel.offsetHeight || 240;
      if (top + panelHeight > window.innerHeight - 8) {
        top = rect.top - panelHeight - 6;
        if (top < 8) top = 8;
      }
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${panelWidth}px`;
    }

    function onReposition() {
      if (!panel.classList.contains("hidden")) positionPanel();
    }

    function openPanel() {
      if (select.disabled) return;
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

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePanel();
    });
    trigger.addEventListener("keydown", (e) => {
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

    // sync หน้าตา trigger เวลาโค้ดอื่น (booking.js) สั่ง select.value = xxx ตรงๆ (ไม่ผ่าน UI)
    const nativeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value"
    );
    Object.defineProperty(select, "value", {
      configurable: true,
      get() {
        return nativeDescriptor.get.call(select);
      },
      set(v) {
        nativeDescriptor.set.call(select, v);
        renderTrigger();
      },
    });

    // 🌟 booking.js โหลด option ใหม่แบบ dynamic (fetch แล้ว .innerHTML=... / .add(opt))
    // คอยสังเกตแล้ว re-render trigger/panel ให้เองอัตโนมัติ ไม่ต้องแก้ตรงนั้นเลย
    const mo = new MutationObserver(() => {
      renderTrigger();
      if (!panel.classList.contains("hidden")) renderPanel();
    });
    mo.observe(select, { childList: true, subtree: true });

    renderTrigger();
  }

  window.initCustomSelect = initCustomSelect;

  document.addEventListener("DOMContentLoaded", () => {
    initCustomSelect("car-plate-select", { placeholder: "เลือกทะเบียนรถ", fallbackIcon: "🚗" });
    initCustomSelect("return-car-plate", { placeholder: "-- เลือกรถที่ต้องการคืน --", fallbackIcon: "🚗" });
    // 🌟 "time-slot" เดิมถูกแทนที่ด้วยเวลาไป/เวลากลับแบบ 24 ชม.ในเวอร์ชันนี้ อัปเดต id ตาม
    // เวลาเป็น "ตารางช่อง" 4 คอลัมน์ เห็นครบ 24 ชม. ในหน้าเดียว ไม่ต้องเลื่อน
    initCustomSelect("out-time-select", { placeholder: "-- เลือกเวลาไป --", grid: true, minutes: true });
    initCustomSelect("return-time-select", { placeholder: "-- เลือกเวลากลับ --", grid: true, minutes: true });
    initCustomSelect("return-time", { placeholder: "-- เลือกเวลาที่คืน --", grid: true, minutes: true });
  });
})();