// main.js
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("mobile-menu");
  const navLinks = document.getElementById("nav-list");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      // สลับคลาสเพื่อเปลี่ยนเป็นกากบาท
      menuToggle.classList.toggle("is-active");
      // สลับคลาสเพื่อเปิดเมนูสไลด์
      navLinks.classList.toggle("active");
      console.log("Menu Toggled!"); // เช็คใน Console (F12) ว่ากดติดไหม
    });
  }
  // 🩹 ไม่มีเมนูเดิมก็ไม่ใช่ error: app-nav.js ลบ <nav class="nav-bar"> เก่าทิ้งแล้วใช้เมนูใหม่แทน
  // (เดิมขึ้น console.error ทุกหน้าของผู้ใช้ ทำให้ดู error จริงใน F12 ยาก)
});
