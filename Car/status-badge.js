/**
 * 🏷️ ป้ายสถานะฝั่งผู้ใช้ (ชุดเดียวกับ Admin/status-badge.js) — สีบอกความหมายเดียวกันทุกหน้า
 *   เขียว  = ดี/เสร็จสมบูรณ์   (คืนแล้ว, ว่าง, ใช้งานได้)
 *   ฟ้า    = กำลังดำเนินอยู่   (กำลังใช้งาน)
 *   เหลือง = รอ/ต้องเตรียมตัว  (รอเช็คอิน, ติดจอง)
 *   แดง    = มีปัญหา          (ไม่มาใช้งาน, งดให้บริการ)
 *   ม่วง   = ข้ามคืน           (ยังไม่คืนรถเลยกำหนด)
 *   เทา    = ยกเลิก/ไม่มีผล    (ยกเลิก, ไม่ได้ใช้รถ)
 * ข้อความยาวย่อให้สั้น (เช่น "ยกเลิก (ไม่มาใช้งาน)" -> "ไม่มาใช้งาน") ข้อความเต็มดูได้จาก tooltip
 */
(function () {
  "use strict";

  const BOOKING = {
    "จองแล้ว": { k: "wait", icon: "fa-hourglass-half", label: "รอเช็คอิน" },
    "ขาไป": { k: "use", icon: "fa-car-side", label: "กำลังใช้งาน" },
    "ขากลับ": { k: "done", icon: "fa-circle-check", label: "คืนแล้ว" },
    "คืนแล้ว": { k: "done", icon: "fa-circle-check", label: "คืนแล้ว" },
    "ยกเลิก": { k: "cancel", icon: "fa-ban", label: "ยกเลิก" },
    "ยกเลิก (ไม่ได้ใช้รถ)": { k: "cancel", icon: "fa-key", label: "ไม่ได้ใช้รถ" },
    "ยกเลิก (ไม่มาใช้งาน)": { k: "bad", icon: "fa-user-xmark", label: "ไม่มาใช้งาน" },
  };
  const CAR = {
    "ว่าง": { k: "done", icon: "fa-circle-check", label: "ว่าง" },
    "ใช้งานได้": { k: "done", icon: "fa-circle-check", label: "ใช้งานได้" },
    "ไม่ว่าง": { k: "use", icon: "fa-car-side", label: "ไม่ว่าง" },
    "กำลังใช้งาน": { k: "use", icon: "fa-car-side", label: "กำลังใช้งาน" },
    "ติดจอง": { k: "wait", icon: "fa-calendar-check", label: "ติดจอง" },
    "งดให้บริการ": { k: "bad", icon: "fa-screwdriver-wrench", label: "งดให้บริการ" },
    "เช็คระยะ": { k: "bad", icon: "fa-screwdriver-wrench", label: "งดให้บริการ" },
    "ซ่อมบำรุง": { k: "bad", icon: "fa-screwdriver-wrench", label: "งดให้บริการ" },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /**
   * @param {string} status สถานะดิบจาก DB
   * @param {{type?: "booking"|"car", overdue?: boolean}} [opt] overdue = รถยังไม่คืนเลยกำหนด (ขึ้นม่วง "ข้ามคืน")
   */
  window.statusBadge = function (status, opt) {
    opt = opt || {};
    const map = opt.type === "car" ? CAR : BOOKING;
    let s = map[status];
    if (opt.type !== "car" && opt.overdue && status === "ขาไป") s = { k: "night", icon: "fa-moon", label: "ข้ามคืน" };
    if (!s) s = { k: "cancel", icon: "fa-circle-question", label: status || "-" };
    return `<span class="st st-${s.k}" title="${esc(status || "-")}"><i class="fa-solid ${s.icon}"></i>${esc(s.label)}</span>`;
  };

  // ตัวอย่างความหมายสี (ใช้ทำคำอธิบายใต้หัวตาราง)
  window.statusLegendHtml = function () {
    return [
      ["wait", "fa-hourglass-half", "รอเช็คอิน"],
      ["use", "fa-car-side", "กำลังใช้งาน"],
      ["done", "fa-circle-check", "คืนแล้ว"],
      ["cancel", "fa-ban", "ยกเลิก / ไม่ได้ใช้รถ"],
      ["night", "fa-moon", "ข้ามคืน (ยังไม่คืนรถ)"],
      ["bad", "fa-triangle-exclamation", "มีปัญหา (ไม่มาใช้งาน)"],
    ]
      .map(([k, icon, label]) => `<span class="st st-${k}"><i class="fa-solid ${icon}"></i>${label}</span>`)
      .join("");
  };
})();
