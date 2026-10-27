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
  // สถานะที่คำนวณจากเวลา (ไม่เก็บใน DB): รถเช็คอินแล้วแต่เลยเวลาคืน
  //   เลยเวลาคืน = เลยกำหนดคืนแล้ว (ยังเป็นวันเดียวกับกำหนดคืน)   ข้ามคืน = ยังไม่คืนจนข้ามวันแล้ว
  const LATE = { k: "late", icon: "fa-triangle-exclamation", label: "เลยเวลาคืน" };
  const NIGHT = { k: "night", icon: "fa-moon", label: "ข้ามคืน" };
  // คืนแล้วแต่คืนช้ากว่ากำหนดเกิน 60 นาที (เกณฑ์เดียวกับรายงานแอดมิน)
  const LATE_RET = { k: "lateret", icon: "fa-clock-rotate-left", label: "คืนช้า" };
  const LATE_RET_MIN = 60;
  const CAR = {
    "ว่าง": { k: "done", icon: "fa-circle-check", label: "ว่าง" },
    "ใช้งานได้": { k: "done", icon: "fa-circle-check", label: "ใช้งานได้" },
    "ไม่ว่าง": { k: "use", icon: "fa-car-side", label: "ไม่ว่าง" },
    "กำลังใช้งาน": { k: "use", icon: "fa-car-side", label: "กำลังใช้งาน" },
    "ติดจอง": { k: "wait", icon: "fa-calendar-check", label: "ติดจอง" },
    "งดให้บริการ": { k: "bad", icon: "fa-screwdriver-wrench", label: "เช็คระยะ/ซ่อม" },
    "เช็คระยะ": { k: "bad", icon: "fa-screwdriver-wrench", label: "เช็คระยะ/ซ่อม" },
    "ซ่อมบำรุง": { k: "bad", icon: "fa-screwdriver-wrench", label: "เช็คระยะ/ซ่อม" },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /**
   * @param {string} status สถานะดิบจาก DB
   * @param {{type?: "booking"|"car", overdue?: boolean}} [opt] overdue = รถยังไม่คืนเลยกำหนด (ขึ้นม่วง "ข้ามคืน")
   */
  // เวลาที่ต้องคืน จากวันที่จอง + เวลาออก + เวลากลับ (กลับ <= ออก = ข้ามคืน +1 วัน) คืน Date หรือ null
  window.bookingDue = function (date, out, ret) {
    date = String(date || "").slice(0, 10);
    out = String(out || "").slice(0, 5);
    ret = String(ret || "").slice(0, 5);
    if (!date || !out || !ret) return null;
    const d = new Date(date + "T" + ret + ":00");
    if (isNaN(d)) return null;
    if (ret <= out) d.setDate(d.getDate() + 1);
    return d;
  };

  // เวลาที่คืนจริง จากวันที่คืน + เวลาคืน คืน Date หรือ null
  window.bookingReturned = function (date, time) {
    date = String(date || "").slice(0, 10);
    time = String(time || "").slice(0, 8);
    if (!date || !time) return null;
    const d = new Date(date + "T" + (time.length === 5 ? time + ":00" : time));
    return isNaN(d) ? null : d;
  };

  window.statusBadge = function (status, opt) {
    opt = opt || {};
    const map = opt.type === "car" ? CAR : BOOKING;
    let s = map[status];
    if (opt.type !== "car" && status === "คืนแล้ว" && opt.due instanceof Date && opt.returned instanceof Date) {
      if (opt.returned.getTime() - opt.due.getTime() > LATE_RET_MIN * 60000) s = LATE_RET;
    }
    if (opt.type !== "car" && status === "ขาไป") {
      const due = opt.due instanceof Date ? opt.due : null;
      const late = due ? Date.now() > due.getTime() : !!opt.overdue;
      if (late) s = due && new Date().toDateString() !== due.toDateString() ? NIGHT : LATE;
    }
    if (!s) s = { k: "cancel", icon: "fa-circle-question", label: status || "-" };
    return `<span class="st st-${s.k}" title="${esc(status || "-")}"><i class="fa-solid ${s.icon}"></i>${esc(s.label)}</span>`;
  };

  // ตัวอย่างความหมายสี (ใช้ทำคำอธิบายใต้หัวตาราง)
  window.statusLegendHtml = function () {
    return [
      ["wait", "fa-hourglass-half", "รอเช็คอิน"],
      ["use", "fa-car-side", "กำลังใช้งาน"],
      ["done", "fa-circle-check", "คืนแล้ว"],
      ["lateret", "fa-clock-rotate-left", "คืนช้า (คืนแล้วแต่เกิน 60 นาที)"],
      ["cancel", "fa-ban", "ยกเลิก / ไม่ได้ใช้รถ"],
      ["late", "fa-triangle-exclamation", "เลยเวลาคืน"],
      ["night", "fa-moon", "ข้ามคืน (ยังไม่คืนจนข้ามวัน)"],
      ["bad", "fa-user-xmark", "ไม่มาใช้งาน"],
    ]
      .map(([k, icon, label]) => `<span class="st st-${k}"><i class="fa-solid ${icon}"></i>${label}</span>`)
      .join("");
  };
})();
