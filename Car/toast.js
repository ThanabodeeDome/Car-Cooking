function showToast(type, message, duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const icons = {
    success: "✅",
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
  };

  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 🌟 ถาม feedback หลังคืนรถเสร็จ — เลือก 👍/👎 และ/หรือพิมพ์ความคิดเห็น (ไม่บังคับ กดข้ามได้)
// เรียก onDone() เสมอไม่ว่าจะตอบหรือข้าม (ไม่ขวาง flow หลัก) — ใช้ร่วมกันทั้ง return_scan.js และ booking.js
function askSystemFeedback(bookingId, onDone) {
  if (!document.getElementById("fbm-style")) {
    const st = document.createElement("style");
    st.id = "fbm-style";
    // ใช้ #fbm นำหน้า + !important เพราะ booking.css บังคับสไตล์ textarea/button ทั้งเว็บด้วย !important
    st.textContent = `
      #fbm{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,6,10,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:fbmFade .18s ease-out}
      #fbm .fbm-card{width:100%;max-width:360px;background:linear-gradient(180deg,#1d1d26,#15151b);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:26px 22px 20px;box-shadow:0 30px 80px -20px rgba(0,0,0,.85);color:#f5f5f7;font-family:"Prompt","Sarabun",sans-serif;text-align:center;animation:fbmPop .22s cubic-bezier(.2,.9,.3,1.2)}
      #fbm .fbm-badge{width:54px;height:54px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;background:rgba(74,222,128,.14);border:1px solid rgba(74,222,128,.4)}
      #fbm h3{margin:0 0 4px;font-size:18px;font-weight:600;color:#fff}
      #fbm .fbm-sub{margin:0 0 18px;font-size:13px;color:#9a9aa5}
      #fbm .fbm-rate{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      #fbm .fbm-opt{display:flex!important;flex-direction:column;align-items:center;gap:4px;padding:12px 8px!important;border-radius:14px!important;border:1.5px solid rgba(255,255,255,.14)!important;background:rgba(255,255,255,.04)!important;color:#c9c9d1!important;font:inherit;font-size:13px;cursor:pointer;transition:all .15s;width:auto!important}
      #fbm .fbm-opt .em{font-size:30px;line-height:1;filter:grayscale(.85);opacity:.7;transition:all .15s}
      #fbm .fbm-opt:hover{border-color:rgba(255,255,255,.3)!important}
      #fbm .fbm-opt.on{color:#fff!important;transform:translateY(-1px)}
      #fbm .fbm-opt.on .em{filter:none;opacity:1;transform:scale(1.08)}
      #fbm .fbm-opt.good.on{border-color:#4ade80!important;background:rgba(74,222,128,.14)!important}
      #fbm .fbm-opt.bad.on{border-color:#f87171!important;background:rgba(248,113,113,.14)!important}
      #fbm textarea{display:block;width:100%;box-sizing:border-box;min-height:84px;padding:12px 14px!important;border-radius:14px!important;border:1.5px solid rgba(255,255,255,.14)!important;background:rgba(0,0,0,.3)!important;color:#f5f5f7!important;font:inherit;font-size:14px;line-height:1.5;resize:none;outline:none;transition:border-color .15s,box-shadow .15s}
      #fbm textarea::placeholder{color:#6e6e79!important}
      #fbm textarea:focus{border-color:#ff6b6b!important;box-shadow:0 0 0 3px rgba(255,77,77,.18)!important}
      #fbm .fbm-count{text-align:right;font-size:11px;color:#6e6e79;margin:4px 4px 14px}
      #fbm .fbm-send{width:100%!important;padding:13px!important;border:none!important;border-radius:14px!important;background:linear-gradient(135deg,#ff4d4d,#e11d2e)!important;color:#fff!important;font:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:transform .12s,filter .12s;box-shadow:0 8px 20px -8px rgba(255,77,77,.7)}
      #fbm .fbm-send:hover{filter:brightness(1.08)}
      #fbm .fbm-send:active{transform:scale(.98)}
      #fbm .fbm-skip{display:inline-block;margin-top:12px;padding:6px 12px;color:#9a9aa5;font-size:13px;text-decoration:none}
      #fbm .fbm-skip:hover{color:#fff}
      @keyframes fbmFade{from{opacity:0}to{opacity:1}}
      @keyframes fbmPop{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion:reduce){#fbm,#fbm .fbm-card{animation:none}}`;
    document.head.appendChild(st);
  }

  const overlay = document.createElement("div");
  overlay.id = "fbm";
  overlay.innerHTML = `
    <div class="fbm-card" role="dialog" aria-modal="true" aria-label="ความคิดเห็นการใช้งานระบบ">
      <div class="fbm-badge">✅</div>
      <h3>คืนรถเรียบร้อย</h3>
      <p class="fbm-sub">ระบบใช้งานวันนี้เป็นอย่างไรบ้าง?</p>
      <div class="fbm-rate">
        <button type="button" class="fbm-opt good" id="fb-good-btn"><span class="em">👍</span>ใช้งานง่าย</button>
        <button type="button" class="fbm-opt bad" id="fb-bad-btn"><span class="em">👎</span>ควรปรับปรุง</button>
      </div>
      <textarea id="fb-comment" maxlength="300" placeholder="เล่าให้เราฟังหน่อย (ไม่บังคับ)"></textarea>
      <div class="fbm-count"><span id="fb-count">0</span>/300</div>
      <button type="button" class="fbm-send" id="fb-send-btn">ส่งความคิดเห็น</button>
      <a href="#" class="fbm-skip" id="fb-skip-link">ข้ามไปก่อน</a>
    </div>`;
  document.body.appendChild(overlay);

  let finished = false;
  let choice = "";
  const finish = () => {
    if (finished) return;
    finished = true;
    overlay.remove();
    onDone();
  };
  const good = overlay.querySelector("#fb-good-btn");
  const bad = overlay.querySelector("#fb-bad-btn");
  const commentEl = overlay.querySelector("#fb-comment");
  const countEl = overlay.querySelector("#fb-count");
  const pick = (val) => {
    choice = choice === val ? "" : val;
    good.classList.toggle("on", choice === "good");
    bad.classList.toggle("on", choice === "bad");
  };
  good.onclick = () => pick("good");
  bad.onclick = () => pick("bad");
  commentEl.addEventListener("input", () => (countEl.textContent = String(commentEl.value.length)));

  overlay.querySelector("#fb-send-btn").onclick = () => {
    const comment = commentEl.value.trim();
    if (!choice && !comment) return finish(); // ไม่ได้กรอกอะไร = ข้าม
    fetch("save_feedback.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, feedback: choice, comment }),
    })
      .catch(() => {})
      .finally(finish);
  };
  overlay.querySelector("#fb-skip-link").onclick = (e) => {
    e.preventDefault();
    finish();
  };
}
