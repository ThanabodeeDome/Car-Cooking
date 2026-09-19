// Minimal service worker: makes the site installable ("Add to Home screen"). No offline caching —
// booking data must always be live, so every request goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
