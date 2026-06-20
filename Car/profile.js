function saveProfile() {
  alert("บันทึกข้อมูลสำเร็จ!");
  // ตรงนี้พี่สามารถเพิ่มโค้ด Fetch เพื่อส่งข้อมูลไปที่ไฟล์ PHP ได้ครับ
}

function logout() {
  if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
    window.location.href = "login.html";
  }
}
function logout() {
  // ใช้ confirm เพื่อถามความแน่ใจก่อนออกจากระบบ
  if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
    // เปลี่ยนเส้นทางไปยังหน้า index.html
    window.location.href = "index.html";
  }
}
