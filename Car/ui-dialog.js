/* ui-dialog.js — กล่องแจ้งเตือน/ยืนยันของระบบ (แทน alert()/confirm() ดิบของเบราว์เซอร์)
   - AppDialog.confirm({ title, message, confirmText, cancelText, danger }) -> Promise<boolean>
   - AppDialog.alert(message, { title, type }) -> Promise<void>
   - window.alert ถูกแทนที่ให้ใช้กล่องนี้ (ไม่บล็อก) ; confirm() ต้องเรียก AppDialog.confirm แล้ว await
   ไม่พึ่งไลบรารีภายนอก ใส่สไตล์เอง (#appdlg) ใช้ได้ทั้งหน้า Car และ Admin */
(function () {
  "use strict";
  if (window.AppDialog) return;

  const ICONS = {
    success: { ch: "✓", bg: "rgba(74,222,128,.14)", bd: "rgba(74,222,128,.45)", fg: "#4ade80" },
    error: { ch: "!", bg: "rgba(248,113,113,.14)", bd: "rgba(248,113,113,.5)", fg: "#f87171" },
    warning: { ch: "!", bg: "rgba(251,191,36,.14)", bd: "rgba(251,191,36,.5)", fg: "#fbbf24" },
    info: { ch: "i", bg: "rgba(96,165,250,.14)", bd: "rgba(96,165,250,.5)", fg: "#60a5fa" },
    question: { ch: "?", bg: "rgba(251,191,36,.14)", bd: "rgba(251,191,36,.5)", fg: "#fbbf24" },
    danger: { ch: "!", bg: "rgba(248,113,113,.14)", bd: "rgba(248,113,113,.5)", fg: "#f87171" },
  };

  function injectStyle() {
    if (document.getElementById("appdlg-style")) return;
    const st = document.createElement("style");
    st.id = "appdlg-style";
    st.textContent = `
      #appdlg{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,6,10,.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:adFade .16s ease-out;font-family:"Prompt","Sarabun","Plus Jakarta Sans",sans-serif}
      #appdlg .ad-card{width:100%;max-width:380px;background:linear-gradient(180deg,#1e1e28,#15151b);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px 22px 20px;box-shadow:0 30px 80px -20px rgba(0,0,0,.85);color:#f5f5f7;text-align:center;animation:adPop .2s cubic-bezier(.2,.9,.3,1.2)}
      #appdlg .ad-icon{width:54px;height:54px;margin:0 auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;border:1.5px solid}
      #appdlg .ad-title{margin:0 0 6px;font-size:18px;font-weight:600;color:#fff;line-height:1.35}
      #appdlg .ad-msg{margin:0 0 20px;font-size:14px;line-height:1.55;color:#a9a9b4;white-space:pre-line;overflow-wrap:anywhere}
      #appdlg .ad-actions{display:flex;gap:10px}
      #appdlg .ad-btn{flex:1;padding:12px 10px;border-radius:12px;border:1.5px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e5e7eb;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer;transition:transform .1s,filter .12s,background .12s}
      #appdlg .ad-btn:hover{background:rgba(255,255,255,.1)}
      #appdlg .ad-btn:active{transform:scale(.97)}
      #appdlg .ad-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
      #appdlg .ad-btn.primary{border-color:transparent;background:linear-gradient(135deg,#ff4d4d,#e11d2e);color:#fff;box-shadow:0 8px 20px -8px rgba(255,77,77,.7)}
      #appdlg .ad-btn.primary:hover{filter:brightness(1.08)}
      #appdlg .ad-btn.ok{border-color:transparent;background:linear-gradient(135deg,#34d399,#10b981);color:#04241a;box-shadow:0 8px 20px -8px rgba(16,185,129,.7)}
      #appdlg.adl{background:rgba(15,23,42,.38)}
      #appdlg.adl .ad-card{background:#fff;border:1px solid #e5e7eb;color:#0f172a;box-shadow:0 24px 60px -20px rgba(15,23,42,.4)}
      #appdlg.adl .ad-title{color:#0f172a}
      #appdlg.adl .ad-msg{color:#64748b}
      #appdlg.adl .ad-btn{background:#f1f5f9;border-color:#e2e8f0;color:#334155}
      #appdlg.adl .ad-btn:hover{background:#e2e8f0}
      #appdlg.adl .ad-btn.primary{background:#dc2626;color:#fff;border-color:transparent;box-shadow:0 8px 18px -8px rgba(220,38,38,.6)}
      #appdlg.adl .ad-btn.primary:hover{background:#b91c1c}
      #appdlg.adl .ad-btn.ok{background:#16a34a;color:#fff;box-shadow:0 8px 18px -8px rgba(22,163,74,.55)}
      #appdlg.adl .ad-btn:focus-visible{outline-color:#2563eb}
      #appdlg.adl .ad-icon[data-t="success"]{background:#dcfce7!important;border-color:#86efac!important;color:#16a34a!important}
      #appdlg.adl .ad-icon[data-t="error"],#appdlg.adl .ad-icon[data-t="danger"]{background:#fee2e2!important;border-color:#fca5a5!important;color:#dc2626!important}
      #appdlg.adl .ad-icon[data-t="warning"],#appdlg.adl .ad-icon[data-t="question"]{background:#fef3c7!important;border-color:#fcd34d!important;color:#d97706!important}
      #appdlg.adl .ad-icon[data-t="info"]{background:#dbeafe!important;border-color:#93c5fd!important;color:#2563eb!important}
      @keyframes adFade{from{opacity:0}to{opacity:1}}
      @keyframes adPop{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion:reduce){#appdlg,#appdlg .ad-card{animation:none}}`;
    document.head.appendChild(st);
  }

  // คิวกล่อง: ถ้ามีหลายกล่องพร้อมกัน แสดงทีละกล่อง
  let chain = Promise.resolve();

  function open({ type, title, message, confirmText, cancelText, showCancel, danger }) {
    return new Promise((resolve) => {
      chain = chain.then(
        () =>
          new Promise((done) => {
            injectStyle();
            const ic = ICONS[danger ? "danger" : type] || ICONS.info;
            const wrap = document.createElement("div");
            wrap.id = "appdlg";
            if (/\/Admin\//i.test(location.pathname)) wrap.classList.add("adl"); // หน้าแอดมินเป็นธีมสว่าง
            wrap.innerHTML = `
              <div class="ad-card" role="alertdialog" aria-modal="true">
                <div class="ad-icon" data-t="${danger ? "danger" : type}" style="background:${ic.bg};border-color:${ic.bd};color:${ic.fg}">${ic.ch}</div>
                <h3 class="ad-title"></h3>
                <p class="ad-msg"></p>
                <div class="ad-actions"></div>
              </div>`;
            const titleEl = wrap.querySelector(".ad-title");
            const msgEl = wrap.querySelector(".ad-msg");
            if (title) titleEl.textContent = title;
            else titleEl.remove();
            if (message) msgEl.textContent = message;
            else msgEl.remove();
            if (!message && title) titleEl.style.marginBottom = "20px";

            const actions = wrap.querySelector(".ad-actions");
            const prevFocus = document.activeElement;
            const close = (val) => {
              document.removeEventListener("keydown", onKey, true);
              wrap.remove();
              if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
              resolve(val);
              done();
            };
            const mk = (label, cls, val) => {
              const b = document.createElement("button");
              b.type = "button";
              b.className = "ad-btn " + cls;
              b.textContent = label;
              b.onclick = () => close(val);
              actions.appendChild(b);
              return b;
            };
            if (showCancel) mk(cancelText || "ยกเลิก", "", false);
            const okBtn = mk(confirmText || "ตกลง", danger || type === "error" ? "primary" : type === "success" ? "ok" : "primary", true);
            const onKey = (e) => {
              if (e.key === "Escape") { e.stopPropagation(); close(showCancel ? false : true); }
              else if (e.key === "Enter" && document.activeElement === document.body) { e.preventDefault(); close(true); }
            };
            document.addEventListener("keydown", onKey, true);
            wrap.addEventListener("mousedown", (e) => {
              if (e.target === wrap && showCancel) close(false);
            });
            document.body.appendChild(wrap);
            okBtn.focus();
          }),
      );
    });
  }

  function guessType(msg) {
    const s = String(msg || "");
    if (/ไม่สำเร็จ|ผิดพลาด|ไม่ได้|ล้มเหลว|ขัดข้อง|ไม่พบ|ไม่ถูกต้อง/.test(s)) return "error";
    if (/สำเร็จ|เรียบร้อย/.test(s)) return "success";
    return "info";
  }

  window.AppDialog = {
    confirm(opts) {
      if (typeof opts === "string") opts = { message: opts };
      return open({
        type: "question",
        title: opts.title || "ยืนยันการทำรายการ",
        message: opts.message || "",
        confirmText: opts.confirmText || "ยืนยัน",
        cancelText: opts.cancelText || "ยกเลิก",
        showCancel: true,
        danger: !!opts.danger,
      });
    },
    alert(message, opts) {
      opts = opts || {};
      const type = opts.type || guessType(message);
      return open({
        type,
        title: opts.title || (type === "error" ? "ทำรายการไม่สำเร็จ" : type === "success" ? "สำเร็จ" : "แจ้งเตือน"),
        message: String(message == null ? "" : message),
        confirmText: opts.confirmText || "ตกลง",
        showCancel: false,
      }).then(() => undefined);
    },
  };

  // alert() ดิบ -> กล่องของระบบ (ไม่บล็อก; โค้ดที่ต้องรอให้ใช้ await AppDialog.alert)
  window.alert = function (msg) {
    window.AppDialog.alert(msg);
  };
})();
