/**
 * 🧾 หน้า "บันทึกระบบ" — ดึงจาก get_system_log.php
 * ตัวกรอง: ช่วงวันที่ / หมวด / ค้นหาข้อความ แบ่งหน้า 50 รายการ + Export CSV
 * กดที่แถวเพื่อดูรายละเอียด (เช่น ค่าก่อน/หลังที่แอดมินแก้ไข)
 */
let slPage = 1;
let slState = { category: "" };

const SL_CAT_COLOR = { auth: "slate", booking: "blue", usage: "green", admin: "red", user: "violet" };

function slEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function slIso(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function slInit() {
  const s = document.getElementById("sl-start");
  const e = document.getElementById("sl-end");
  if (s && !s.value) {
    const now = new Date();
    e.value = slIso(now);
    s.value = slIso(new Date(now.getTime() - 6 * 86400000));
  }
}

function slParams(page) {
  const p = new URLSearchParams();
  p.set("start", document.getElementById("sl-start").value);
  p.set("end", document.getElementById("sl-end").value);
  if (slState.category) p.set("category", slState.category);
  const q = document.getElementById("sl-q").value.trim();
  if (q) p.set("q", q);
  if (page) p.set("page", page);
  return p;
}

function slPreset(days) {
  const now = new Date();
  document.getElementById("sl-end").value = slIso(now);
  document.getElementById("sl-start").value = slIso(new Date(now.getTime() - (days - 1) * 86400000));
  document.querySelectorAll(".sl-pill").forEach((b) => b.classList.toggle("on", Number(b.dataset.d) === days));
  fetchSystemLog(1);
}

function slSetCategory(cat) {
  slState.category = slState.category === cat ? "" : cat;
  fetchSystemLog(1);
}

function slExport() {
  window.location.href = "get_system_log.php?format=csv&" + slParams().toString();
}

function fetchSystemLog(page) {
  slInit();
  slPage = page || 1;
  const body = document.getElementById("sl-tbody");
  if (!body) return;
  body.innerHTML = `<tr><td colspan="5" class="sl-empty">กำลังโหลด...</td></tr>`;

  fetch("get_system_log.php?" + slParams(slPage).toString(), { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      const note = document.getElementById("sl-note");
      if (!d.success) {
        body.innerHTML = `<tr><td colspan="5" class="sl-empty" style="color:#dc2626">${slEsc(d.message || "โหลดไม่สำเร็จ")}</td></tr>`;
        return;
      }
      if (d.ready === false) {
        note.hidden = false;
        note.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${slEsc(d.message)}`;
        body.innerHTML = `<tr><td colspan="5" class="sl-empty">ยังไม่มีข้อมูล</td></tr>`;
        document.getElementById("sl-chips").innerHTML = "";
        document.getElementById("sl-pager").innerHTML = "";
        return;
      }
      note.hidden = true;
      renderSlChips(d);
      renderSlRows(d);
      renderSlPager(d);
    })
    .catch(() => {
      body.innerHTML = `<tr><td colspan="5" class="sl-empty" style="color:#dc2626">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</td></tr>`;
    });
}

function renderSlChips(d) {
  const total = Object.values(d.counts || {}).reduce((a, b) => a + b, 0);
  const chips = [`<button type="button" class="sl-chip${slState.category === "" ? " on" : ""}" onclick="slSetCategory('')">ทั้งหมด <b>${total.toLocaleString("th-TH")}</b></button>`];
  Object.entries(d.categories || {}).forEach(([k, label]) => {
    chips.push(`<button type="button" class="sl-chip c-${SL_CAT_COLOR[k] || "slate"}${slState.category === k ? " on" : ""}" onclick="slSetCategory('${k}')">${slEsc(label)} <b>${(d.counts[k] || 0).toLocaleString("th-TH")}</b></button>`);
  });
  document.getElementById("sl-chips").innerHTML = chips.join("");
}

function slTime(t) {
  // "2026-10-22 09:04:36" -> "22/10/2569 09:04:36"
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543} ${m[4]}` : t;
}

function slDetailHtml(r) {
  const parts = [];
  if (r.detail && typeof r.detail === "object") {
    Object.entries(r.detail).forEach(([k, v]) => {
      const val = v && typeof v === "object" ? Object.entries(v).map(([a, b]) => `${slEsc(a)}: ${slEsc(b === "" ? "-" : b)}`).join(" • ") : slEsc(v === "" || v === null ? "-" : v);
      parts.push(`<div><span>${slEsc(k)}</span>${val}</div>`);
    });
  } else if (r.detail) parts.push(`<div>${slEsc(r.detail)}</div>`);
  if (r.ip) parts.push(`<div><span>IP</span>${slEsc(r.ip)}</div>`);
  if (r.actor_id) parts.push(`<div><span>รหัสผู้ใช้ในระบบ</span>${slEsc(r.actor_id)}</div>`);
  return parts.length ? parts.join("") : '<div class="sl-none">ไม่มีรายละเอียดเพิ่มเติม</div>';
}

function renderSlRows(d) {
  const body = document.getElementById("sl-tbody");
  if (!d.rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="sl-empty">ไม่พบบันทึกในช่วงที่เลือก</td></tr>`;
    return;
  }
  body.innerHTML = d.rows
    .map(
      (r) => `
      <tr class="sl-row" onclick="this.nextElementSibling.hidden = !this.nextElementSibling.hidden; this.classList.toggle('open')">
        <td class="sl-time">${slEsc(slTime(r.time))}</td>
        <td><span class="sl-type c-${SL_CAT_COLOR[r.category] || "slate"}${r.type === "login_fail" ? " bad" : ""}">${slEsc(r.label)}</span></td>
        <td class="sl-actor">${r.actor ? `<b>${slEsc(r.actor)}</b>${r.emp ? `<small>#${slEsc(r.emp)}</small>` : ""}` : '<span class="sl-none">-</span>'}</td>
        <td class="sl-sum">${slEsc(r.summary)}${r.target ? `<small>${slEsc(r.target)}</small>` : ""}</td>
        <td class="sl-ip">${slEsc(r.ip) || "-"}</td>
      </tr>
      <tr class="sl-detail" hidden><td colspan="5"><div class="sl-detail-box">${slDetailHtml(r)}</div></td></tr>`,
    )
    .join("");
}

function renderSlPager(d) {
  const el = document.getElementById("sl-pager");
  const from = d.total ? (d.page - 1) * d.per + 1 : 0;
  const to = Math.min(d.total, d.page * d.per);
  el.innerHTML = `
    <span>แสดง ${from.toLocaleString("th-TH")}–${to.toLocaleString("th-TH")} จาก ${d.total.toLocaleString("th-TH")} รายการ <em>(เก็บย้อนหลัง ${d.retention_days} วัน)</em></span>
    <div>
      <button type="button" class="sl-pg" ${d.page <= 1 ? "disabled" : ""} onclick="fetchSystemLog(${d.page - 1})"><i class="fa-solid fa-chevron-left"></i></button>
      <b>${d.page} / ${d.pages}</b>
      <button type="button" class="sl-pg" ${d.page >= d.pages ? "disabled" : ""} onclick="fetchSystemLog(${d.page + 1})"><i class="fa-solid fa-chevron-right"></i></button>
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const q = document.getElementById("sl-q");
  if (q) q.addEventListener("keydown", (e) => e.key === "Enter" && fetchSystemLog(1));
});
