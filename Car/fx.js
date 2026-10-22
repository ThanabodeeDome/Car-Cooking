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

/* ---- ลูกเล่นเพิ่ม (v2) ----
   - การ์ด/รายการค่อยๆ เลื่อนขึ้นตอนเลื่อนถึง (รวมรายการที่โหลดมาทีหลังด้วย)
   - window.fxCount(el, n): ตัวเลขวิ่งนับขึ้น
   - สถานะ "กำลังใช้งาน" เรืองแสงเบาๆ, กล่องค้างคืนรถสั่นเตือนเป็นระยะ
   - window.fxCelebrate(): confetti ตอนเช็คอิน/คืนรถ/จองสำเร็จ
   ปิดทั้งหมดเมื่อผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" */
(function () {
  "use strict";
  if (window.__fx2) return;
  window.__fx2 = true;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // เลขวิ่งนับ (ใช้ได้แม้ปิดลดการเคลื่อนไหว — แค่ไม่วิ่ง)
  window.fxCount = function (el, to) {
    if (!el) return;
    to = Number(to) || 0;
    const show = (v) => (el.textContent = Math.round(v).toLocaleString("th-TH"));
    if (reduce || to === 0) return show(to);
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      show(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => show(to), dur + 150); // แท็บอยู่เบื้องหลัง rAF หยุด — ให้ค่าสุดท้ายถูกเสมอ
  };

  if (reduce) {
    window.fxCelebrate = function () {};
    return;
  }

  const st = document.createElement("style");
  st.textContent = `
  .fx-rv{opacity:0;transform:translateY(18px)}
  .fx-rv.fx-in{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1)}
  @keyframes fxGlow{0%,100%{box-shadow:0 0 0 0 rgba(96,165,250,0)}50%{box-shadow:0 0 0 6px rgba(96,165,250,.2)}}
  .status-badge.status-inuse{animation:fxGlow 2.2s ease-in-out infinite}
  @keyframes fxNudge{0%,86%,100%{transform:none}88%{transform:translateX(-5px)}90%{transform:translateX(5px)}92%{transform:translateX(-4px)}94%{transform:translateX(4px)}96%{transform:translateX(-2px)}98%{transform:translateX(2px)}}
  @keyframes fxEdge{0%,100%{border-color:rgba(255,77,77,.4)}50%{border-color:rgba(255,77,77,.9)}}
  .overdue-card:not(.fx-rv){animation:fxNudge 7s ease-in-out infinite,fxEdge 2.4s ease-in-out infinite}`;
  document.head.appendChild(st);

  // --- เลื่อนขึ้นตอนเลื่อนถึง ---
  const RV = ".booking-row-container,.metric-card,.overdue-card,.overdue-list li,.history-section .table-container";
  const pending = new Set();
  const reveal = (el) => {
    if (!pending.delete(el)) return;
    el.classList.add("fx-in");
    const done = () => {
      el.classList.remove("fx-rv", "fx-in");
      el.style.transitionDelay = "";
    };
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 900);
  };
  let batch = 0;
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            e.target.style.transitionDelay = Math.min(batch++ % 6, 5) * 60 + "ms";
            reveal(e.target);
          }
        });
        setTimeout(() => (batch = 0), 400);
      }, { threshold: 0.1 })
    : null;
  const watch = (el) => {
    if (el.__fxRv || el.classList.contains("fx-rv")) return;
    el.__fxRv = true;
    el.classList.add("fx-rv");
    pending.add(el);
    if (io) io.observe(el);
    else reveal(el);
  };
  const scan = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(RV)) watch(root);
    root.querySelectorAll(RV).forEach(watch);
  };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", () => scan(document.body));
  // กันกรณีแท็บอยู่เบื้องหลัง/IO ไม่ทำงาน: ไม่ปล่อยให้เนื้อหาโปร่งใสค้าง
  setTimeout(() => [...pending].forEach(reveal), 2500);

  // --- confetti ---
  window.fxCelebrate = function () {
    const c = document.createElement("canvas");
    c.width = innerWidth;
    c.height = innerHeight;
    Object.assign(c.style, { position: "fixed", inset: 0, zIndex: 100000, pointerEvents: "none" });
    document.body.appendChild(c);
    const g = c.getContext("2d");
    const colors = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ff6b6b", "#fff"];
    const ps = Array.from({ length: 70 }, () => ({
      x: c.width / 2, y: c.height * 0.6,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      col: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    const end = () => c.remove();
    const frame = (t) => {
      const age = t - t0;
      if (age > 1600) return end();
      g.clearRect(0, 0, c.width, c.height);
      g.globalAlpha = Math.max(0, 1 - age / 1600);
      ps.forEach((p) => {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); g.restore();
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(end, 2000);
  };
})();
