/**
 * 🏢 0. ข้อมูลฝ่าย/แผนก/หน่วยงาน (เอามาจาก booking.js ตัวเดียวกับหน้าจองรถ)
 */
const companyData = {
  บริหาร: {
    ทรัพยากรและการเงิน: ["บุคคลและความปลอดภัย", "บัญชีการเงินและต้นทุน"],
    การตลาดและจัดซื้อ: ["การตลาด", "จัดซื้อและพัสดุ"],
  },
  วิศวกรรมและเทคโนโลยี: {
    วิศวกรรมผลิตภัณฑ์และแม่พิมพ์: [
      "วิศวกรรมโครงการ",
      "ออกแบบผลิตภัณฑ์และแม่พิมพ์",
      "ผลิตและประกอบแม่พิมพ์",
      "ทดลองแม่พิมพ์",
    ],
    วิศวกรรมระบบอัตโนมัติ: [
      "ระบบดิจิทอลและไอที",
      "วิศวกรรมหุ่นยนต์และ IoT",
      "บำรุงรักษา",
    ],
  },
  ผลิตและบริหารคุณภาพ: {
    บริหารการผลิตและโลจิสติกส์: ["วางแผนการผลิตและ TPS", "จัดส่งและคลังสินค้า"],
    บริหารคุณภาพ: ["ประกันคุณภาพและมาตรฐาน", "ควบคุมคุณภาพ"],
    "ผลิต 1": ["ปั๊ม 1", "ปั๊ม 2", "ประกอบ", "บำรุงรักษาแม่พิมพ์"],
    "ผลิต 2": ["ชิ้นส่วนท่อ", "ประกอบท่อ", "ชิ้นส่วนสี"],
  },
};

function initRegDeptDropdown() {
  const mainSelect = document.getElementById("reg-main-dept");
  if (!mainSelect) return;
  for (let main in companyData) {
    mainSelect.options.add(new Option(main, main));
  }
}

function updateRegSubDept() {
  const main = document.getElementById("reg-main-dept").value;
  const subSelect = document.getElementById("reg-sub-dept");
  subSelect.innerHTML =
    '<option value="" disabled selected>-- เลือกแผนก --</option>';
  if (companyData[main]) {
    for (let sub in companyData[main]) {
      subSelect.options.add(new Option(sub, sub));
    }
  }
  updateRegSection();
}

function updateRegSection() {
  const main = document.getElementById("reg-main-dept").value;
  const sub = document.getElementById("reg-sub-dept").value;
  const secSelect = document.getElementById("reg-section");
  secSelect.innerHTML =
    '<option value="" disabled selected>-- เลือกหน่วยงาน --</option>';
  if (companyData[main] && companyData[main][sub]) {
    companyData[main][sub].forEach((sec) => {
      secSelect.options.add(new Option(sec, sec));
    });
  }
}

document.addEventListener("DOMContentLoaded", initRegDeptDropdown);

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
 * 🎛️ 2. คอนฟิกพื้นฐานสำหรับ Modal กลางจอ (success / error / warning)
 * เข้าธีมกระจกม่วงเดียวกันทั้งหมด
 */
const AppModal = Swal.mixin({
  customClass: { popup: "swal-night" },
  confirmButtonColor: "#a563c9",
  background: "#1b1140",
  color: "#f5f2ff",
});

/**
 * 🚀 3. ระบบดักจับการสมัครสมาชิก (Register Form)
 */
document
  .querySelector("#register-form form")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บรีโหลด

    const formData = new FormData(this);

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
          // เปลี่ยนรหัสผ่านสำเร็จ modal กลางจอ แล้วพากลับหน้าเข้าสู่ระบบ
          AppModal.fire({
            icon: "success",
            title: "เปลี่ยนรหัสผ่านสำเร็จ",
            text: data.message || "ใช้รหัสผ่านใหม่เข้าสู่ระบบได้เลย",
            confirmButtonText: "ไปเข้าสู่ระบบ",
            iconColor: "#ff9ecb",
          }).then(() => {
            this.reset(); // เคลียร์ฟอร์ม
            switchForm("login-form");
          });
        } else {
          AppModal.fire({
            icon: "warning",
            title: "ไม่สามารถดำเนินการได้",
            text: data.message || "ข้อมูลยืนยันไม่ถูกต้อง",
          });
        }
      })
      .catch((error) => {
        console.error("Reset Password Error:", error);
        AppModal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถทำรายการได้ในขณะนี้ โปรดตรวจสอบการเชื่อมต่อของคุณ",
        });
      });
  });
