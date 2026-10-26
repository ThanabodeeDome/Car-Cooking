/* Add-to-home-screen support: injects the manifest + registers the (no-cache) service worker. */
(function () {
  "use strict";
  // 📱 iOS: กัน Safari ซูมเข้าเองตอนแตะช่องกรอก — ตั้ง maximum-scale=1 เฉพาะ iPhone/iPad
  //    (iOS ไม่นำค่านี้ไปห้ามผู้ใช้บีบนิ้วซูมเอง จึงยังซูมขยายเองได้ตามต้องการ; Android/คอม ไม่ถูกแตะ)
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const vp = document.querySelector('meta[name="viewport"]');
    if (ios && vp && !/maximum-scale/.test(vp.content)) vp.content += ", maximum-scale=1";
  } catch (e) {}
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "manifest.json";
    document.head.appendChild(l);
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = "#111118";
    document.head.appendChild(m);
    const a = document.createElement("link");
    a.rel = "apple-touch-icon";
    a.href = "assets/image/apple-touch-icon.png?v=2";
    document.head.appendChild(a);
  }
  // ไอคอนแท็บ/ทางลัดบนคอม (favicon) — ใช้โลโก้แอปตัวเดียวกัน
  if (!document.querySelector('link[rel="icon"]')) {
    [["48x48", "favicon-48.png"], ["32x32", "favicon-32.png"], ["192x192", "pwa-192.png"]].forEach(([sz, f]) => {
      const i = document.createElement("link");
      i.rel = "icon";
      i.type = "image/png";
      i.sizes = sz;
      i.href = "assets/image/" + f + "?v=2";
      document.head.appendChild(i);
    });
  }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
