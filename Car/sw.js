// Service worker: (1) ทำให้เว็บติดตั้งเป็นแอปได้ ("Add to Home screen") ไม่แคชออฟไลน์ — ข้อมูลจองต้องสดเสมอ
// (2) รับ Web Push แล้วแสดงแจ้งเตือนในเครื่อง (Car/push_lib.php ส่งมาจาก notify_cron.php / หลังกด "รถยังไม่มา")
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (_) {
    d = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "ระบบจองรถ", {
      body: d.body || "",
      icon: "assets/image/pwa-192.png",
      badge: "assets/image/pwa-192.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || "homepage.html" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "homepage.html", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === target && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
