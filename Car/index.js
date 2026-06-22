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
 * 🎛️ 2. คอนฟิกพื้นฐานสำหรับแจ้งเตือนด่วน (SweetAlert2 Toast)
 * เด้งมุมขวาบน สวย นุ่มนวล และไม่ต้องค้างรอให้ผู้ใช้งานกดปุ่ม OK
 */
const AppToast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1500,
  timerProgressBar: true,
});

/**
 * 🚀 3. ระบบดักจับการสมัครสมาชิก (Register Form)
 */
document
  .querySelector("#register-form form")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บรีโหลด

    const formData = new FormData(this);

    fetch("../register_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // แจ้งเตือนสำเร็จ แล้วดีดกลับไปหน้า Login อัตโนมัติ
          AppToast.fire({
            icon: "success",
            title: data.message || "สมัครสมาชิกสำเร็จเรียบร้อย",
          }).then(() => {
            this.reset(); // เคลียร์ฟอร์ม
            switchForm("login-form"); // สลับไปหน้าล็อกอิน
          });
        } else {
          // แจ้งเตือนกรณีเกิดข้อผิดพลาดจากฝั่งเซิร์ฟเวอร์ (เช่น ชื่อผู้ใช้ซ้ำ)
          Swal.fire({
            icon: "warning",
            title: "คำแนะนำระบบ",
            text: data.message || "กรุณาตรวจสอบข้อมูลอีกครั้ง",
          });
        }
      })
      .catch((err) => {
        console.error("Register Error:", err);
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        });
      });
  });

/**
 * 🔑 4. ระบบดักจับการเข้าสู่ระบบ (Login Form)
 */
document
  .querySelector("#login-form form")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(this);

    fetch("../login_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // เข้าสู่ระบบสำเร็จ สไลด์แจ้งเตือนแล้วย้ายหน้าอัตโนมัติเมื่อแถบโหลดเต็ม
          AppToast.fire({
            icon: "success",
            title: data.message || "เข้าสู่ระบบสำเร็จ",
          }).then(() => {
            window.location.href = data.redirect;
          });
        } else {
          // กรณีรหัสผ่านผิด หรือไม่พบผู้ใช้งาน
          Swal.fire({
            icon: "error",
            title: "เข้าสู่ระบบไม่สำเร็จ",
            text: data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          });
        }
      })
      .catch((err) => {
        console.error("Login Error:", err);
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ระบบเชื่อมต่อฐานข้อมูลล้มเหลว กรุณาติดต่อผู้ดูแลระบบ",
        });
      });
  });

/**
 * 🔒 5. ระบบดักจับฟอร์มตั้งรหัสผ่านใหม่ (Reset Password Form)
 */
document
  .getElementById("reset-password-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(this);

    fetch("../reset_password_process.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // เปลี่ยนรหัสผ่านสำเร็จ สไลด์เตือนแล้วพากลับหน้าเข้าสู่ระบบทันที
          AppToast.fire({
            icon: "success",
            title: data.message || "เปลี่ยนรหัสผ่านใหม่เรียบร้อย",
          }).then(() => {
            this.reset(); // เคลียร์ฟอร์ม
            switchForm("login-form");
          });
        } else {
          Swal.fire({
            icon: "warning",
            title: "ไม่สามารถดำเนินการได้",
            text: data.message || "ข้อมูลยืนยันไม่ถูกต้อง",
          });
        }
      })
      .catch((error) => {
        console.error("Reset Password Error:", error);
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถทำรายการได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่อของคุณ",
        });
      });
  });
