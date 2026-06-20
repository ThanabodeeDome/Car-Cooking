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
  } else {
    // ถ้าขึ้นข้อความนี้ใน Console แสดงว่า HTML หน้านั้นไม่มี ID ที่กำหนด
    console.error("Error: ไม่พบ ID #mobile-menu หรือ #nav-list ในหน้านี้");
  }
});
