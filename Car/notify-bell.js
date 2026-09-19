/* Notification bell — self-contained (injects its own CSS + markup into .nav-bar). Free: no external service.
   Polls get_notifications.php every 60s. Dismissed items are remembered in localStorage.
   Optional: browser (desktop/phone) notifications via the free Notification API while a tab is open. */
(function () {
  "use strict";

  const POLL_MS = 60000;
  const DISMISS_KEY = "nb_dismissed_v1";
  const NOTIFIED_KEY = "nb_notified_v1";

  const nav = document.querySelector(".nav-bar") || document.getElementById("an-top");
  if (!nav || document.getElementById("nb-wrap")) return;

  const css = `
  .nb-wrap{position:relative;margin:0;display:flex;align-items:center}
  .nb-wrap[hidden]{display:none}
  .nb-btn{position:relative;width:44px;height:44px;border-radius:14px;border:none;background:transparent;color:#e5e7eb;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s,color .15s}
  .nb-btn:hover,.nb-btn[aria-expanded="true"]{background:rgba(255,255,255,.08);color:#fff}
  .nb-btn:focus-visible{outline:2px solid #ff6b6b;outline-offset:2px}
  .nb-btn svg{width:23px;height:23px}
  .nb-btn.has-new svg{animation:nbRing 2.4s ease-in-out infinite;transform-origin:50% 10%}
  @keyframes nbRing{0%,88%,100%{transform:rotate(0)}91%{transform:rotate(14deg)}94%{transform:rotate(-12deg)}97%{transform:rotate(8deg)}}
  @media (prefers-reduced-motion:reduce){.nb-btn.has-new svg{animation:none}}
  .nb-badge{position:absolute;top:3px;right:2px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;box-shadow:0 0 0 2px #171a24;background:#f59e0b;color:#111;font-size:11px;font-weight:700;line-height:17px;text-align:center}
  .nb-badge.is-danger{background:#ef4444;color:#fff}
  .nb-badge[hidden]{display:none}
  .nb-panel{position:fixed;top:64px;right:8px;width:min(380px,calc(100vw - 16px));max-height:70vh;overflow-y:auto;background:#15151b;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 20px 50px -12px rgba(0,0,0,.7);z-index:1200;font-family:"Prompt",sans-serif}
  .nb-panel[hidden]{display:none}
  .nb-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);color:#fff;font-weight:600;font-size:15px;position:sticky;top:0;background:#15151b}
  .nb-clear{background:none;border:none;color:#9a9aa5;font-size:12px;cursor:pointer}
  .nb-clear:hover{color:#ff4d4d}
  .nb-item{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);border-left:3px solid #3b82f6;cursor:pointer;text-decoration:none}
  .nb-item.warn{border-left-color:#f59e0b}
  .nb-item.danger{border-left-color:#ef4444;background:rgba(239,68,68,.07)}
  .nb-item:hover{background:rgba(255,255,255,.04)}
  .nb-body{flex:1;min-width:0}
  .nb-title{color:#f5f5f7;font-size:13.5px;font-weight:600;line-height:1.35}
  .nb-text{color:#9a9aa5;font-size:12.5px;margin-top:2px;line-height:1.4;overflow-wrap:anywhere}
  .nb-x{background:none;border:none;color:#6b7280;font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
  .nb-x:hover{color:#ff4d4d}
  .nb-empty{padding:26px 14px;text-align:center;color:#9a9aa5;font-size:13px}
  .nb-foot{padding:10px 14px;text-align:center}
  .nb-foot button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e5e7eb;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer}
  .nb-foot button:hover{border-color:#ff4d4d}`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.id = "nb-wrap";
  wrap.className = "nb-wrap";
  wrap.innerHTML = `
    <button type="button" class="nb-btn" id="nb-btn" aria-label="แจ้งเตือน">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      <span class="nb-badge" id="nb-badge" hidden>0</span>
    </button>
    <div class="nb-panel" id="nb-panel" hidden>
      <div class="nb-head"><span>แจ้งเตือน</span><button type="button" class="nb-clear" id="nb-clear">ซ่อนทั้งหมด</button></div>
      <div id="nb-list"></div>
      <div class="nb-foot" id="nb-foot" hidden><button type="button" id="nb-perm">เปิดแจ้งเตือนบนเครื่องนี้</button></div>
    </div>`;
  const slot = document.getElementById("an-bell-slot");
  if (slot) {
    slot.appendChild(wrap);
  } else {
    const anchor = nav.querySelector(".menu-toggle") || nav.querySelector(".nav-links");
    nav.insertBefore(wrap, anchor);
  }

  const btn = wrap.querySelector("#nb-btn");
  const panel = wrap.querySelector("#nb-panel");
  document.body.appendChild(panel);
  const badge = wrap.querySelector("#nb-badge");
  const list = panel.querySelector("#nb-list");
  const foot = panel.querySelector("#nb-foot");
  let items = [];

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function readJson(store, key) {
    try {
      return JSON.parse(store.getItem(key) || "{}") || {};
    } catch (e) {
      return {};
    }
  }
  function writeJson(store, key, val) {
    try {
      store.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* private mode / storage blocked: dismissal just won't persist */
    }
  }
  function dismissed() {
    const d = readJson(localStorage, DISMISS_KEY);
    const cutoff = Date.now() - 3 * 86400000;
    let changed = false;
    Object.keys(d).forEach((k) => {
      if (d[k] < cutoff) {
        delete d[k];
        changed = true;
      }
    });
    if (changed) writeJson(localStorage, DISMISS_KEY, d);
    return d;
  }

  function visibleItems() {
    const d = dismissed();
    return items.filter((i) => !d[i.id]);
  }

  function dismiss(ids) {
    const d = dismissed();
    ids.forEach((id) => (d[id] = Date.now()));
    writeJson(localStorage, DISMISS_KEY, d);
    render();
  }

  function render() {
    const vis = visibleItems();
    badge.hidden = vis.length === 0;
    badge.textContent = vis.length > 9 ? "9+" : String(vis.length);
    badge.classList.toggle("is-danger", vis.some((i) => i.level === "danger"));
    btn.classList.toggle("has-new", vis.length > 0);

    if (!vis.length) {
      list.innerHTML = '<div class="nb-empty">ไม่มีแจ้งเตือนใหม่</div>';
    } else {
      list.innerHTML = vis
        .map(
          (i) => `<div class="nb-item ${esc(i.level)}" data-link="${esc(i.link)}">
            <div class="nb-body"><div class="nb-title">${esc(i.title)}</div><div class="nb-text">${esc(i.body)}</div></div>
            <button type="button" class="nb-x" data-id="${esc(i.id)}" aria-label="ซ่อน">&times;</button>
          </div>`
        )
        .join("");
    }
    foot.hidden = !("Notification" in window) || Notification.permission !== "default";
  }

  function maybeSystemNotify() {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    const seen = readJson(sessionStorage, NOTIFIED_KEY);
    visibleItems()
      .filter((i) => i.level !== "info" && !seen[i.id])
      .forEach((i) => {
        try {
          new Notification(i.title, { body: i.body });
        } catch (e) {
          /* some mobile browsers only allow notifications via service worker */
        }
        seen[i.id] = 1;
      });
    writeJson(sessionStorage, NOTIFIED_KEY, seen);
  }

  function load() {
    fetch("get_notifications.php", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.success) {
          wrap.hidden = true; // not logged in / endpoint unavailable -> no bell
          return;
        }
        wrap.hidden = false;
        items = data.items || [];
        render();
        maybeSystemNotify();
      })
      .catch(() => {});
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) placePanel();
  });
  // วางแผงให้อยู่ใต้กระดิ่ง (กึ่งกลางกระดิ่ง) แต่ไม่ให้ล้นขอบจอ
  function placePanel() {
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = Math.min(380, vw - 16);
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vw - w - 8));
    panel.style.left = left + "px";
    panel.style.right = "auto";
    panel.style.width = w + "px";
  }
  window.addEventListener("resize", () => { if (!panel.hidden) placePanel(); });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !wrap.contains(e.target) && !panel.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });
  list.addEventListener("click", (e) => {
    const x = e.target.closest(".nb-x");
    if (x) {
      e.stopPropagation();
      dismiss([x.dataset.id]);
      return;
    }
    const row = e.target.closest(".nb-item");
    if (row && row.dataset.link) window.location.href = row.dataset.link;
  });
  panel.querySelector("#nb-clear").addEventListener("click", () => dismiss(visibleItems().map((i) => i.id)));
  panel.querySelector("#nb-perm").addEventListener("click", () => {
    Notification.requestPermission().then(render);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) load();
  });
  wrap.hidden = true;
  load();
  setInterval(load, POLL_MS);
})();
