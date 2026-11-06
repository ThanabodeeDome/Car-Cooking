/* push.js — เปิด/ปิดแจ้งเตือนในเครื่อง (Web Push) ใช้ร่วมกับ notify-bell.js
   window.CBPush = { supported, state(): Promise<'unsupported'|'ios-install'|'denied'|'off'|'on'>, enable(): Promise<{ok,message}>, disable(), sync() }
   - 'ios-install': iPhone/iPad ต้อง "เพิ่มไปยังหน้าจอโฮม" ก่อนถึงจะเปิดแจ้งเตือนได้
   - sync(): ถ้าเคยอนุญาตไว้แล้ว ส่ง subscription ปัจจุบันให้เซิร์ฟเวอร์ใหม่ (กันคีย์/อุปกรณ์เปลี่ยน) เรียกตอนโหลดหน้า */
(function () {
  "use strict";
  const me = document.currentScript || document.querySelector('script[src*="push.js"]');
  const BASE = new URL(".", (me && me.src) || location.href);
  const api = (p) => new URL(p, BASE).href;

  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function b64uToBytes(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  const sameKey = (a, b) => {
    if (!a || !b || a.byteLength !== b.byteLength) return false;
    const x = new Uint8Array(a), y = new Uint8Array(b);
    return x.every((v, i) => v === y[i]);
  };

  async function registration() {
    return navigator.serviceWorker.register(api("sw.js")).then(() => navigator.serviceWorker.ready);
  }
  async function serverKey() {
    const r = await fetch(api("push_api.php?action=key"), { cache: "no-store" }).then((x) => x.json());
    if (!r || !r.success) throw new Error((r && r.message) || "key");
    return r;
  }
  async function post(body) {
    return fetch(api("push_api.php"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
  }

  async function subscribe(askPermission) {
    if (Notification.permission === "default" && askPermission) await Notification.requestPermission();
    if (Notification.permission !== "granted") return null;
    const key = (await serverKey()).key;
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    const want = b64uToBytes(key);
    if (sub && !sameKey(sub.options && sub.options.applicationServerKey, want.buffer)) {
      await sub.unsubscribe(); // คีย์ฝั่งเซิร์ฟเวอร์เปลี่ยน -> สมัครใหม่
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
    const r = await post({ action: "subscribe", subscription: sub.toJSON() });
    if (!r.success) throw new Error(r.message || "subscribe");
    return sub;
  }

  const CBPush = {
    supported,
    async state() {
      if (isIOS && !standalone) return "ios-install";
      if (!supported) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      if (Notification.permission !== "granted") return "off";
      try {
        const reg = await registration();
        return (await reg.pushManager.getSubscription()) ? "on" : "off";
      } catch (_) {
        return "off";
      }
    },
    async enable() {
      const st = await this.state();
      if (st === "ios-install") return { ok: false, message: 'iPhone/iPad: กดปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอนบนหน้าจอ จากนั้นกดเปิดแจ้งเตือนอีกครั้ง' };
      if (st === "unsupported") return { ok: false, message: "เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนในเครื่อง" };
      if (st === "denied") return { ok: false, message: "แจ้งเตือนถูกบล็อกไว้ ไปที่การตั้งค่าเบราว์เซอร์/ไอคอนแม่กุญแจ แล้วเปลี่ยนเป็น อนุญาต" };
      try {
        const sub = await subscribe(true);
        return sub ? { ok: true, message: "เปิดแจ้งเตือนในเครื่องนี้แล้ว" } : { ok: false, message: "ยังไม่ได้อนุญาตให้แสดงแจ้งเตือน" };
      } catch (e) {
        return { ok: false, message: "เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง" };
      }
    },
    async disable() {
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await post({ action: "unsubscribe", endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        return { ok: true, message: "ปิดแจ้งเตือนในเครื่องนี้แล้ว" };
      } catch (_) {
        return { ok: false, message: "ปิดแจ้งเตือนไม่สำเร็จ" };
      }
    },
    async sync() {
      if (!supported || (isIOS && !standalone) || Notification.permission !== "granted") return;
      try {
        await subscribe(false);
      } catch (_) {}
    },
  };
  window.CBPush = CBPush;
  CBPush.sync();
})();
