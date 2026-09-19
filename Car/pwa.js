/* Add-to-home-screen support: injects the manifest + registers the (no-cache) service worker. */
(function () {
  "use strict";
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
    a.href = "assets/image/apple-touch-icon.png";
    document.head.appendChild(a);
  }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
