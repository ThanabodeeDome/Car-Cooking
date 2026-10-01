window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});
/**
 * 🏢 0. ข้อมูลฝ่าย/แผนก/หน่วยงาน (เอามาจาก booking.js ตัวเดียวกับหน้าจองรถ)
 */
/**
 * 🏢 0. ข้อมูลฝ่าย/แผนก/หน่วยงาน — ย้ายไปไฟล์กลาง dept-data.js แล้ว (ใช้ร่วมกับหน้าโปรไฟล์)
 * เหลือแค่ wire เข้ากับ id ของหน้านี้
 */
function initRegDeptDropdown() {
  populateMainDept("reg-main-dept");
}

function updateRegSubDept() {
  cascadeSubDept("reg-main-dept", "reg-sub-dept");
  updateRegSection();
}

function updateRegSection() {
  cascadeSection("reg-main-dept", "reg-sub-dept", "reg-section");
}

document.addEventListener("DOMContentLoaded", initRegDeptDropdown);

/**
 * 🔢 0.5 รหัสพนักงาน: เติม 0 นำหน้าให้ครบ 5 หลักเสมอ (91 -> 00091, 2126 -> 02126)
 * เรียกตอน blur ช่องกรอกรหัสพนักงาน (สมัครสมาชิก / ลืมรหัสผ่าน)
 * ถ้าไม่ใช่ตัวเลขล้วน หรือยาวเกิน 5 หลักอยู่แล้ว ปล่อยผ่านไม่ยุ่ง (กันพังกรณี format อื่นในอนาคต)
 */
function padEmployeeId(input) {
  if (!input) return;
  const v = input.value.trim();
  if (/^\d+$/.test(v) && v.length > 0 && v.length <= 5) {
    input.value = v.padStart(5, "0");
  }
}

/**
 * 🧭 1. ฟังก์ชันเดิมสำหรับสลับหน้ากากฟอร์ม
 */
function switchForm(formId) {
  const forms = document.querySelectorAll(".auth-box");
  forms.forEach((form) => (form.style.display = "none"));
  const targetForm = document.getElementById(formId);
  if (targetForm) targetForm.style.display = "block";
}

/**
 * 🛟 1.5 Fallback กัน error ทั้งไฟล์เวลา SweetAlert2 CDN โหลดไม่ทัน/ล่ม
 * ถ้า Swal ไม่มีจริงๆ ใช้ alert() ธรรมดาแทน โครงสร้าง .then() ยังทำงานได้เหมือนเดิม
 * (จุดนี้คือสาเหตุหลักที่มือถือบางทีเจอ raw JSON เต็มจอ:
 *  ถ้า Swal เป็น undefined ตอนไฟล์นี้รัน จะเกิด ReferenceError ตั้งแต่บรรทัดสร้าง AppModal
 *  ทำให้โค้ดทั้งไฟล์หยุดทำงาน รวมถึง addEventListener ของฟอร์ม login ก็ไม่ถูกติดตั้ง
 *  ผลคือฟอร์ม submit ตรงไป PHP แบบ default แทน)
 */
const AppModal =
  typeof Swal !== "undefined"
    ? Swal.mixin({
        customClass: { popup: "swal-night" },
        confirmButtonColor: "#a563c9",
        background: "#1b1140",
        color: "#f5f2ff",
      })
    : {
        fire: function (opts) {
          alert((opts && (opts.title ? opts.title + "\n" : "")) + ((opts && opts.text) || ""));
          return Promise.resolve();
        },
      };

/**
 * 🚀 3. ระบบดักจับการสมัครสมาชิก (Register Form)
 */
const registerFormEl = document.querySelector("#register-form form");
if (registerFormEl) {
  registerFormEl.addEventListener("submit", function (e) {
    e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บรีโหลด

    const formData = new FormData(this);

    // 🌟 กันเผื่อ blur ไม่ทัน (เช่น กด submit ด้วย Enter จากช่องอื่น) เติม 0 นำหน้ารหัสพนักงานอีกรอบก่อนส่ง
    padEmployeeId(document.getElementById("reg-employee-id"));
    formData.set("employee_id", document.getElementById("reg-employee-id").value);

    const password = document.getElementById("reg-password").value;
    if (password.length < 6) {
      AppModal.fire({
        icon: "warning",
        title: "คำแนะนำระบบ",
        text: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
      return;
    }

    // 🌟 แยกส่ง 3 field ตรงๆ ตาม register_process.php ใหม่ ($_POST['division'], ['department'], ['unit'])
    const mainDept = document.getElementById("reg-main-dept").value;
    const subDept = document.getElementById("reg-sub-dept").value;
    const section = document.getElementById("reg-section").value;
    if (!mainDept || !subDept || !section) {
      AppModal.fire({
        icon: "warning",
        title: "คำแนะนำระบบ",
        text: "กรุณาเลือกฝ่าย/แผนก/หน่วยงานให้ครบ",
      });
      return;
    }
    formData.set("division", mainDept);
    formData.set("department", subDept);
    formData.set("unit", section);

    fetch("../register_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // สมัครสมาชิกสำเร็จ modal กลางจอ แล้วดีดกลับหน้า Login
          AppModal.fire({
            icon: "success",
            title: "สมัครสมาชิกสำเร็จ",
            text: data.message || "สร้างบัญชีพนักงานเรียบร้อยแล้ว",
            confirmButtonText: "ไปเข้าสู่ระบบ",
            iconColor: "#ff9ecb",
          }).then(() => {
            this.reset(); // เคลียร์ฟอร์ม
            switchForm("login-form"); // สลับไปหน้าล็อกอิน
          });
        } else {
          // แจ้งเตือนกรณีเกิดข้อผิดพลาดจากฝั่งเซิร์ฟเวอร์ (เช่น ชื่อผู้ใช้ซ้ำ)
          AppModal.fire({
            icon: "warning",
            title: "คำแนะนำระบบ",
            text: data.message || "กรุณาตรวจสอบข้อมูลอีกครั้ง",
          });
        }
      })
      .catch((err) => {
        console.error("Register Error:", err);
        AppModal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        });
      });
  });
}

/**
 * 🔑 4. ระบบดักจับการเข้าสู่ระบบ (Login Form)
 */
const loginFormEl = document.querySelector("#login-form form");
if (loginFormEl) {
  loginFormEl.addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(this);

    // 🌟 ใหม่: ถ้ามี ?redirect=... ติดมากับ URL ปัจจุบัน (มาจาก guard_user.php ตอนโดนเด้งจากการสแกน QR)
    // แนบไปเป็นส่วนหนึ่งของ POST ด้วย ให้ login_process.php ส่งกลับไปหน้าที่ตั้งใจเข้าแทนหน้า homepage เดิม
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get("redirect");
    if (redirectParam) {
      formData.set("redirect", redirectParam);
    }

    fetch("../login_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // เข้าสู่ระบบสำเร็จ modal กลางจอ แล้วย้ายหน้าเมื่อกด OK
          AppModal.fire({
            icon: "success",
            title: "เข้าสู่ระบบสำเร็จ",
            text: data.message || "ยินดีต้อนรับกลับมา",
            confirmButtonText: "เข้าใช้งาน",
            iconColor: "#ff9ecb",
          }).then(() => {
            window.location.href = data.redirect;
          });
        } else {
          // กรณีรหัสผ่านผิด หรือไม่พบผู้ใช้งาน
          AppModal.fire({
            icon: "error",
            title: "เข้าสู่ระบบไม่สำเร็จ",
            text: data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          });
        }
      })
      .catch((err) => {
        console.error("Login Error:", err);
        AppModal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ระบบเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาติดต่อผู้ดูแลระบบ",
        });
      });
  });
}

/**
 * 👁️ 5. UI ช่วยกรอกรหัสผ่าน: ปุ่มแสดง/ซ่อน + แถบความแข็งแรง + เช็คยืนยันรหัสตรงกัน
 */
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const icon = btn.querySelector("i");
    if (icon) icon.className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
  });
});

function pwScore(pw) {
  if (pw.length < 6) return 1;
  let s = 1;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) s++;
  return Math.min(4, s);
}
const PW_LABELS = ["", "อ่อนมาก", "พอใช้", "ดี", "แข็งแรง"];
const PW_DEFAULT_HINT = "ยิ่งยาวและผสมตัวอักษร/ตัวเลข ยิ่งปลอดภัย";

function bindPwMeter(inputId, meterId, hintId) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  if (!input || !meter) return;
  const hint = hintId ? document.getElementById(hintId) : null;
  input.addEventListener("input", () => {
    const sc = input.value ? pwScore(input.value) : 0;
    meter.dataset.level = String(sc);
    if (hint) hint.textContent = input.value ? "ความแข็งแรง: " + PW_LABELS[sc] : PW_DEFAULT_HINT;
  });
}
function bindPwMatch(aId, bId, hintId) {
  const a = document.getElementById(aId);
  const b = document.getElementById(bId);
  const hint = document.getElementById(hintId);
  if (!a || !b || !hint) return;
  const check = () => {
    if (!b.value) {
      hint.textContent = "";
      hint.className = "pw-hint";
      return;
    }
    const ok = a.value === b.value;
    hint.textContent = ok ? "รหัสผ่านตรงกัน ✓" : "รหัสผ่านไม่ตรงกัน";
    hint.className = "pw-hint " + (ok ? "ok" : "bad");
  };
  a.addEventListener("input", check);
  b.addEventListener("input", check);
}
bindPwMeter("reg-password", "reg-pw-meter", "reg-pw-hint");
bindPwMatch("reg-password", "reg-password2", "reg-pw2-hint");
bindPwMeter("reset-new-password", "reset-pw-meter");
bindPwMatch("reset-new-password", "reset-new-password2", "reset-pw2-hint");

/**
 * 🔒 6. ลืมรหัสผ่าน 3 ขั้น: ยืนยันตัวตน → (รหัส OTP ทางอีเมล ถ้าระบบส่งอีเมลได้) → ตั้งรหัสใหม่
 */
const resetFormEl = document.getElementById("reset-password-form");
let resetMode = "direct"; // "otp" | "direct" (server บอกใน action=start)

function resetGoStep(n) {
  document.querySelectorAll("#reset-password-form .reset-pane").forEach((p) => {
    p.style.display = p.dataset.pane === String(n) ? "" : "none";
  });
  document.querySelectorAll("#reset-stepper li").forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  const dot2 = document.getElementById("reset-step2-dot");
  if (dot2) dot2.style.display = resetMode === "otp" || n === 2 ? "" : "none";
  const focusId = { 1: "reset-username", 2: "reset-otp", 3: "reset-new-password" }[n];
  const el = document.getElementById(focusId);
  if (el) setTimeout(() => el.focus(), 50);
}

function resetForgotFlow() {
  if (resetFormEl) resetFormEl.reset();
  resetMode = "direct";
  document.getElementById("reset-subtitle").textContent = "ยืนยันตัวตนก่อน แล้วตั้งรหัสผ่านใหม่ได้เลย";
  resetGoStep(1);
}
window.resetForgotFlow = resetForgotFlow;

function resetPost(fields) {
  const fd = new FormData();
  padEmployeeId(document.getElementById("reset-employee-id"));
  fd.set("username", document.getElementById("reset-username").value.trim());
  fd.set("employee_id", document.getElementById("reset-employee-id").value.trim());
  Object.keys(fields).forEach((k) => fd.set(k, fields[k]));
  return fetch("../reset_password_process.php", { method: "POST", body: fd }).then((r) => r.json());
}

function resetNetErr(err) {
  console.error("Reset Password Error:", err);
  AppModal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: "ไม่สามารถทำรายการได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่อของคุณ" });
}

function resetStart(isResend) {
  const u = document.getElementById("reset-username").value.trim();
  const e = document.getElementById("reset-employee-id").value.trim();
  if (!u || !e) {
    AppModal.fire({ icon: "warning", title: "คำแนะนำระบบ", text: "กรอกชื่อผู้ใช้งานและรหัสพนักงานก่อน" });
    return;
  }
  resetPost({ action: "start" })
    .then((data) => {
      if (!data.success) {
        AppModal.fire({ icon: "warning", title: "ไม่สามารถดำเนินการได้", text: data.message || "ข้อมูลยืนยันไม่ถูกต้อง" });
        return;
      }
      resetMode = data.mode === "otp" ? "otp" : "direct";
      if (resetMode === "otp") {
        document.getElementById("reset-otp-note").textContent = data.message || "";
        document.getElementById("reset-subtitle").textContent = "กรอกรหัสที่ส่งไปทางอีเมลของคุณ";
        resetGoStep(2);
        if (isResend) AppModal.fire({ icon: "success", title: "ส่งรหัสใหม่แล้ว", text: data.message || "" });
      } else {
        document.getElementById("reset-subtitle").textContent = "ตั้งรหัสผ่านใหม่ได้เลย";
        resetGoStep(3);
      }
    })
    .catch(resetNetErr);
}

document.getElementById("reset-start-btn")?.addEventListener("click", () => resetStart(false));
document.getElementById("reset-resend")?.addEventListener("click", (e) => {
  e.preventDefault();
  resetStart(true);
});
document.getElementById("reset-otp-next")?.addEventListener("click", () => {
  if (!/^\d{6}$/.test(document.getElementById("reset-otp").value.trim())) {
    AppModal.fire({ icon: "warning", title: "คำแนะนำระบบ", text: "กรอกรหัสยืนยัน 6 หลักให้ครบ" });
    return;
  }
  // ตรวจรหัสกับ server ทันที (ผิดจะรู้ตั้งแต่ตรงนี้ ไม่ต้องกรอกรหัสใหม่เสร็จก่อนค่อยรู้)
  resetPost({ action: "verify", otp: document.getElementById("reset-otp").value.trim() })
    .then((data) => {
      if (!data.success) {
        AppModal.fire({ icon: "warning", title: "รหัสไม่ถูกต้อง", text: data.message || "รหัสยืนยัน (OTP) ไม่ถูกต้องหรือหมดอายุ" });
        return;
      }
      document.getElementById("reset-subtitle").textContent = "ตั้งรหัสผ่านใหม่ได้เลย";
      resetGoStep(3);
    })
    .catch(resetNetErr);
});
// กด Enter ในขั้น 1/2 = ปุ่ม "ถัดไป" (ไม่ให้ฟอร์ม submit ข้ามขั้น)
resetFormEl?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const pane = e.target.closest(".reset-pane");
  if (!pane || pane.dataset.pane === "3") return;
  e.preventDefault();
  pane.querySelector("button.btn")?.click();
});

resetFormEl?.addEventListener("submit", function (e) {
  e.preventDefault();
  const pw = document.getElementById("reset-new-password").value;
  if (pw.length < 6) {
    AppModal.fire({ icon: "warning", title: "คำแนะนำระบบ", text: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
    return;
  }
  if (pw !== document.getElementById("reset-new-password2").value) {
    AppModal.fire({ icon: "warning", title: "คำแนะนำระบบ", text: "รหัสผ่านและช่องยืนยันไม่ตรงกัน" });
    return;
  }
  const fields = { action: "finish", new_password: pw };
  if (resetMode === "otp") fields.otp = document.getElementById("reset-otp").value.trim();

  resetPost(fields)
    .then((data) => {
      if (data.success) {
        AppModal.fire({
          icon: "success",
          title: "เปลี่ยนรหัสผ่านสำเร็จ",
          text: data.message || "ใช้รหัสผ่านใหม่เข้าสู่ระบบได้เลย",
          confirmButtonText: "ไปเข้าสู่ระบบ",
          iconColor: "#ff9ecb",
        }).then(() => {
          const u = document.getElementById("reset-username").value;
          resetForgotFlow();
          switchForm("login-form");
          const lu = document.getElementById("login-username");
          if (lu) lu.value = u;
          document.getElementById("login-password")?.focus();
        });
      } else {
        // OTP ผิด/หมดอายุ → กลับไปขั้นกรอกรหัส
        if (resetMode === "otp" && /OTP/.test(data.message || "")) resetGoStep(2);
        AppModal.fire({ icon: "warning", title: "ไม่สามารถดำเนินการได้", text: data.message || "ข้อมูลยืนยันไม่ถูกต้อง" });
      }
    })
    .catch(resetNetErr);
});

// สมัครสมาชิก: ต้องยืนยันรหัสผ่านตรงกันก่อนส่ง (capture = ทำงานก่อน handler หลักด้านบน)
if (registerFormEl) {
  registerFormEl.addEventListener(
    "submit",
    function (e) {
      if (document.getElementById("reg-password").value !== document.getElementById("reg-password2").value) {
        e.preventDefault();
        e.stopImmediatePropagation();
        AppModal.fire({ icon: "warning", title: "คำแนะนำระบบ", text: "รหัสผ่านและช่องยืนยันไม่ตรงกัน" });
      }
    },
    true,
  );
}

// 🌟 สมัครสมาชิก: เช็คทันทีตอนกรอกเสร็จแต่ละช่องว่า username / รหัสพนักงาน / ชื่อ-นามสกุล มีบัญชีในระบบแล้วหรือยัง
// (กันคนเดียวสมัครซ้ำหลายบัญชี) — register_process.php ตรวจซ้ำอีกรอบตอนบันทึกจริงเสมอ
if (registerFormEl) {
  const regTaken = { username: false, employee_id: false, name: false };
  const regVal = (id) => (document.getElementById(id)?.value || "").trim();
  const setRegHint = (hintId, msg) => {
    const el = document.getElementById(hintId);
    if (!el) return;
    el.textContent = msg || "";
    el.className = "pw-hint" + (msg ? " bad" : "");
  };

  const checkRegField = (field) => {
    const params = new URLSearchParams();
    if (field === "username") {
      if (!regVal("reg-username")) return setRegHint("reg-username-hint", "");
      params.set("username", regVal("reg-username"));
    } else if (field === "employee_id") {
      if (!regVal("reg-employee-id")) return setRegHint("reg-employee-id-hint", "");
      params.set("employee_id", regVal("reg-employee-id"));
    } else {
      if (!regVal("reg-first-name") || !regVal("reg-last-name")) return setRegHint("reg-name-hint", "");
      params.set("first_name", regVal("reg-first-name"));
      params.set("last_name", regVal("reg-last-name"));
    }
    fetch("../check_availability.php?" + params.toString())
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !d.taken) return; // ตรวจไม่ได้ (เช่นเน็ตหลุด) ปล่อยให้ server ตรวจตอนกดสมัครแทน
        regTaken[field] = !!d.taken[field];
        const msgs = {
          username: ["reg-username-hint", "Username นี้ถูกใช้งานแล้ว"],
          employee_id: ["reg-employee-id-hint", 'รหัสพนักงานนี้มีบัญชีแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน"'],
          name: ["reg-name-hint", 'ชื่อ-นามสกุลนี้มีบัญชีแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน"'],
        };
        setRegHint(msgs[field][0], regTaken[field] ? msgs[field][1] : "");
      })
      .catch(() => {});
  };

  const bind = (id, field) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => checkRegField(field));
    el.addEventListener("input", () => {
      regTaken[field] = false; // แก้ค่าแล้วล้างสถานะเดิม รอเช็คใหม่ตอนออกจากช่อง
    });
  };
  bind("reg-username", "username");
  bind("reg-employee-id", "employee_id");
  bind("reg-first-name", "name");
  bind("reg-last-name", "name");
  // padEmployeeId() เติม 0 ตอน blur โดยไม่ยิง change -> เช็คอีกรอบหลังเติมแล้ว
  document.getElementById("reg-employee-id")?.addEventListener("blur", () => checkRegField("employee_id"));

  registerFormEl.addEventListener(
    "submit",
    function (e) {
      if (regTaken.username || regTaken.employee_id || regTaken.name) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const text = regTaken.employee_id
          ? 'รหัสพนักงานนี้มีบัญชีในระบบแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน"'
          : regTaken.username
            ? "Username นี้ถูกใช้งานแล้ว กรุณาเปลี่ยนใหม่"
            : 'ชื่อ-นามสกุลนี้มีบัญชีในระบบแล้ว หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน"';
        AppModal.fire({ icon: "warning", title: "มีบัญชีอยู่แล้ว", text });
      }
    },
    true,
  );
}
