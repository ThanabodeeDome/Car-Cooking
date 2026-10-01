/* geo.js — ขอตำแหน่งมือถือตอนเช็คอิน/คืนรถ
   window.getGeo() -> Promise<{lat,lng,acc} | null>  (ไม่เคย reject: ไม่ให้สิทธิ์/หมดเวลา = null)
   เรียก window.prefetchGeo() ตอนเปิดหน้า เพื่อให้เบราว์เซอร์ขอสิทธิ์ตั้งแต่แรก และมีค่าพร้อมตอนกดยืนยัน */
(function () {
  "use strict";
  let cached = null; // {pos, at}
  let inflight = null;

  function ask(timeoutMs) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      let done = false;
      const fin = (v) => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      setTimeout(() => fin(null), timeoutMs + 500);
      navigator.geolocation.getCurrentPosition(
        (p) => fin({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
        () => fin(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
      );
    });
  }

  window.getGeo = function () {
    if (cached && Date.now() - cached.at < 120000) return Promise.resolve(cached.pos);
    if (!inflight) {
      inflight = ask(8000).then((pos) => {
        inflight = null;
        if (pos) cached = { pos, at: Date.now() };
        return pos;
      });
    }
    return inflight;
  };
  window.prefetchGeo = function () {
    window.getGeo();
  };
})();
