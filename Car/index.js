// ฟังก์ชันเดิมของเราที่เอาไว้สลับหน้ากากฟอร์ม
function switchForm(formId) {
  const forms = document.querySelectorAll(".auth-box");
  forms.forEach((form) => (form.style.display = "none"));
  document.getElementById(formId).style.display = "block";
}

// 🚀 ส่วนที่เพิ่มใหม่: ดักจับตอนกดสมัครสมาชิก (Register)
document
  .querySelector("#register-form form")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // เบรกไม่ให้หน้าเว็บรีโหลดหมุนติ้วๆ

    const formData = new FormData(this); // ดึงข้อมูลทั้งหมดในฟอร์มสมัครสมาชิก

    // ยิง Fetch API ไปหลังบ้าน
    fetch("../register_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message); // โชว์ข้อความสำเร็จ
          this.reset(); // เคลียร์ตัวหนังสือในช่องกรอกข้อมูล
          switchForm("login-form"); // ดีดผู้ใช้กลับไปหน้าเข้าสู่ระบบทันทีแบบเนียนๆ
        } else {
          alert(data.message); // โชว์ข้อความเตือน (เช่น ชื่อซ้ำ หรือกรอกไม่ครบ)
        }
      })
      .catch((err) => {
        console.error("Error:", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบครับเพื่อน");
      });
  });

// ตัวอย่างโค้ดดักจับตอน Submit ฟอร์มล็อกอินฝั่งหน้าบ้าน
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
          alert(data.message);
          // 🚀 เปลี่ยนเส้นทางหน้าเว็บแบบอัตโนมัติตามสิทธิ์ที่หลังบ้านส่งมาให้
          window.location.href = data.redirect;
        } else {
          alert(data.message);
        }
      })
      .catch((err) => {
        console.error("Error:", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบล็อกอิน");
      });
  });

// ดักจับฟอร์มตั้งรหัสผ่านใหม่
// ตัวอย่างการใช้ Fetch เพื่อดักข้อมูลไม่ให้กระโดดไปหน้า PHP
document
  .getElementById("reset-password-form")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // 1. สั่งให้ฟอร์มไม่ต้องเปลี่ยนหน้า

    const formData = new FormData(this); // 2. เก็บข้อมูลในฟอร์ม

    // 3. ส่งข้อมูลไปที่ไฟล์ PHP ด้วย Fetch
    fetch("../reset_password_process.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json()) // 4. รับค่าที่ PHP ส่งกลับมาเป็น JSON
      .then((data) => {
        // 5. แจ้งเตือนเพื่อนด้วย alert
        alert(data.message);

        // 6. ถ้าสำเร็จ ให้สลับหน้ากลับไปหน้า Login หรือทำตามที่ต้องการ
        if (data.success) {
          switchForm("login-form"); // สมมติว่าฟังก์ชัน switchForm มีอยู่แล้ว
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบครับเพื่อน");
      });
  });

// ดักจับฟอร์มล็อกอิน
document
  .querySelector("#login-form form")
  .addEventListener("submit", function (e) {
    e.preventDefault(); // ป้องกันหน้าเว็บรีโหลด

    const formData = new FormData(this);

    fetch("../login_process.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          // 🚀 นี่คือคำสั่งย้ายหน้าตามที่ PHP ส่งค่ามาครับ
          window.location.href = data.redirect;
        } else {
          alert(data.message);
        }
      })
      .catch((err) => {
        console.error("Error:", err);
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อระบบล็อกอิน");
      });
  });
