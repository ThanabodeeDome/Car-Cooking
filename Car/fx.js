/* fx.js — กิมมิกเล็กๆ ให้ปุ่มทั้งระบบ (ทำงานเองทุกหน้าที่โหลดไฟล์นี้ ไม่ต้องแก้ปุ่มทีละอัน)
   - กดแล้วมีคลื่นน้ำ (ripple) จากจุดที่แตะ
   - ชี้เมาส์: ยกขึ้นเล็กน้อย / ไอคอนลูกศรขยับ / ไอคอน + และ × หมุน
   - ปุ่มที่ถูกปิดพร้อมข้อความ "กำลัง..." จะมีวงกลมหมุนนำหน้าให้เอง
   - ปุ่ม "+" กลางแถบล่างมือถือ หมุนตอนกด, ไอคอนแท็บที่เปิดอยู่เด้งตอนเข้าหน้า
   ปิดทั้งหมดเมื่อผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" ในเครื่อง */
(function () {
  "use strict";
  if (window.__fx) return;
  window.__fx = true;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SEL = 'button, [role="button"], a[class*="btn"], a[class*="Btn"], .confirm-btn, .metric-card, .an-mid, .an-tab, .an-mi';
  const SKIP = ".nb-btn, .pw-toggle, .an-av, .swal2-container *, .fbm-opt, .modal-close-btn, [disabled]";

  const css = `
  .fx-r{position:relative;overflow:hidden}
  .fx-ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.22;transform:scale(0);pointer-events:none;animation:fxRipple .55s ease-out forwards}
  @keyframes fxRipple{to{transform:scale(1);opacity:0}}
  @keyframes fxSpin{to{transform:rotate(360deg)}}
  @keyframes fxPop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
  @media (hover:hover){
    button:not([disabled]):not(.nb-btn):not(.pw-toggle):not(.an-av):not(.modal-close-btn):not(.swal2-styled):hover,
    a[class*="btn"]:hover,.confirm-btn:not([disabled]):hover{transform:translateY(-1px)}
    .metric-card{transition:transform .18s ease,border-color .18s ease}
    .metric-card:hover{transform:translateY(-3px)}
    button:hover>.fa-arrow-right,a[class*="btn"]:hover>.fa-arrow-right{transform:translateX(4px)}
    button:hover>.fa-plus,a[class*="btn"]:hover>.fa-plus,.an-mid:hover svg{transform:rotate(90deg)}
    button:hover>.fa-xmark,a[class*="btn"]:hover>.fa-xmark{transform:rotate(90deg)}
    button:hover>.fa-qrcode,a[class*="btn"]:hover>.fa-qrcode{transform:scale(1.15)}
  }
  button>i,a[class*="btn"]>i,.an-mid svg{transition:transform .2s ease}
  button:not([disabled]):active,a[class*="btn"]:active,.an-tab:active,.metric-card:active{transform:scale(.97)!important}
  .fx-busy::before{content:"";display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-2px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:fxSpin .7s linear infinite}
  .an-tab.on svg{animation:fxPop .4s ease-out}
  @media (prefers-reduced-motion:reduce){.fx-ripple,.fx-busy::before,.an-tab.on svg{animation:none}.fx-busy::before{border-right-color:currentColor}}`;
  if (!reduce) {
    const st = document.createElement("style");
    st.id = "fx-style";
    st.textContent = css;
    document.head.appendChild(st);
  } else {
    const st = document.createElement("style");
    st.textContent = ".fx-busy::before{content:'';display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:currentColor}";
    document.head.appendChild(st);
  }

  // ---- ripple ----
  if (!reduce) {
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button > 0) return;
        const el = e.target.closest && e.target.closest(SEL);
        if (!el || el.matches(SKIP) || el.closest(".swal2-container")) return;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24 || r.width > 900) return; // ไม่ทำกับกล่องใหญ่ๆ
        if (getComputedStyle(el).position === "static") el.classList.add("fx-r");
        else el.style.overflow = el.style.overflow || "hidden";
        const d = Math.max(r.width, r.height) * 2;
        const s = document.createElement("span");
        s.className = "fx-ripple";
        s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 600);
      },
      { passive: true },
    );
  }

  // ---- loading spinner: ปุ่มที่ถูก disable พร้อมข้อความ "กำลัง..." ----
  function syncBusy(btn) {
    const busy = btn.disabled && /^\s*กำลัง/.test(btn.textContent || "");
    btn.classList.toggle("fx-busy", busy);
  }
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const btn = t && t.closest ? t.closest("button") : null;
      if (btn) syncBusy(btn);
    }
  });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["disabled"], childList: true, characterData: true });
})();
