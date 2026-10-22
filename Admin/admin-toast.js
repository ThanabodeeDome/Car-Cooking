/**
 * 🔔 ข้อความแจ้งเบาๆ ที่หายเอง (toast) สำหรับหน้าแอดมิน
 * เดิม alert("...สำเร็จ") ทุกครั้งเด้งกล่อง "ตกลง" ที่ต้องกดปิด ทำรายการต่อเนื่องแล้วกล่องซ้อนกันเป็นตั้ง
 * ตอนนี้: ข้อความที่เป็น "สำเร็จ/เรียบร้อย" -> toast สีเขียวมุมล่าง หายเองใน ~3 วินาที (กดเพื่อปิดได้)
 *         ข้อความ error/แจ้งเตือนอื่น -> ยังเป็นกล่องเดิม (ต้องอ่านและกดรับทราบ)
 * ต้องโหลดหลัง Car/ui-dialog.js
 */
(function () {
  "use strict";

  const css = `
  .adm-toasts{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:3500;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;width:min(420px,calc(100vw - 24px))}
  .adm-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:13px 16px;border-radius:14px;background:#151926;color:#f1f3fb;font:500 14.5px/1.5 "Prompt","Sarabun",sans-serif;box-shadow:0 14px 34px -10px rgba(15,18,31,.55);border:1px solid rgba(255,255,255,.08);cursor:pointer;animation:admToastIn .28s cubic-bezier(.2,.9,.3,1.2)}
  .adm-toast i{flex:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#22c55e;color:#fff;font-size:13px}
  .adm-toast.out{animation:admToastOut .22s ease-in forwards}
  .adm-toast-bar{position:absolute;left:0;bottom:0;height:3px;background:#22c55e;border-radius:0 0 14px 14px;animation:admToastBar linear forwards}
  .adm-toast{position:relative;overflow:hidden}
  @keyframes admToastIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
  @keyframes admToastOut{to{opacity:0;transform:translateY(8px) scale(.97)}}
  @keyframes admToastBar{from{width:100%}to{width:0}}
  @media (max-width:900px){.adm-toasts{bottom:16px}}
  @media (prefers-reduced-motion:reduce){.adm-toast,.adm-toast.out,.adm-toast-bar{animation:none}}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  let host = null;
  function toast(message, ms) {
    ms = ms || 3000;
    if (!host) {
      host = document.createElement("div");
      host.className = "adm-toasts";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "adm-toast";
    el.innerHTML = '<i class="fa-solid fa-check"></i><span></span><div class="adm-toast-bar"></div>';
    el.querySelector("span").textContent = String(message || "");
    el.querySelector(".adm-toast-bar").style.animationDuration = ms + "ms";
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove(); // ไม่ให้ซ้อนยาว
    let gone = false;
    const close = () => {
      if (gone) return;
      gone = true;
      el.classList.add("out");
      setTimeout(() => el.remove(), 240);
    };
    el.addEventListener("click", close);
    setTimeout(close, ms);
  }
  window.adminToast = toast;

  // ครอบ AppDialog.alert: เฉพาะ "สำเร็จ" เปลี่ยนเป็น toast
  function wrap() {
    const D = window.AppDialog;
    if (!D || D.__toastWrapped) return !!D;
    const orig = D.alert.bind(D);
    D.alert = function (message, opts) {
      opts = opts || {};
      const s = String(message == null ? "" : message);
      const isError = /ไม่สำเร็จ|ผิดพลาด|ไม่ได้|ล้มเหลว|ขัดข้อง|ไม่พบ|ไม่ถูกต้อง/.test(s);
      const type = opts.type || (isError ? "error" : /สำเร็จ|เรียบร้อย/.test(s) ? "success" : "info");
      if (type === "success") {
        toast(s);
        return Promise.resolve();
      }
      return orig(message, opts);
    };
    D.__toastWrapped = true;
    return true;
  }
  if (!wrap()) window.addEventListener("load", wrap);
})();
