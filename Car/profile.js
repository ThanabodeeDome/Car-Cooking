document.addEventListener("DOMContentLoaded", () => {
  fetch("get_profile.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        alert(data.message || "กรุณาเข้าสู่ระบบก่อนใช้งาน");
        window.location.href = "index.html";
        return;
      }
      const u = data.user;
      document.getElementById("display-name").innerText =
        `${u.first_name} ${u.last_name}`;
      document.getElementById("display-role").innerText =
        `พนักงานขับรถ / ${u.Division} / ${u.department} / ${u.Unit}`;
      document.getElementById("emp-id").value = u.employee_id;
      document.getElementById("emp-email").value = u.email;
      document.getElementById("emp-phone").value = u.phone;
      document.getElementById("emp-division").value = u.Division;
      document.getElementById("emp-dept").value = u.department;
      document.getElementById("emp-unit").value = u.Unit;
      document.getElementById("stat-total").innerText = u.total_bookings;
      document.getElementById("stat-complete").innerText = u.completed_bookings;

      // 🌟 โหลดรูปโปรไฟล์ถ้ามีอยู่แล้ว
      if (u.AvatarPath) {
        document.getElementById("user-avatar").src = u.AvatarPath;
      }
    })
    .catch((err) => console.error("Error loading profile:", err));

  // 🌟 ดักฟังเมื่อเลือกไฟล์รูปใหม่
  const uploadInput = document.getElementById("upload-photo");
  if (uploadInput) {
    uploadInput.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;

      // พรีวิวรูปทันทีก่อนอัปโหลดเสร็จ
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById("user-avatar").src = e.target.result;
      };
      reader.readAsDataURL(file);

      // อัปโหลดขึ้นเซิร์ฟเวอร์จริง
      const formData = new FormData();
      formData.append("avatar", file);

      fetch("upload_avatar.php", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((result) => {
          if (!result.success) {
            alert("อัปโหลดรูปไม่สำเร็จ: " + (result.message || ""));
          }
        })
        .catch((err) => {
          console.error("Upload error:", err);
          alert("ติดต่อ Server ไม่ได้");
        });
    });
  }
});

const editableFieldIds = [
  "emp-id",
  "emp-email",
  "emp-phone",
  "emp-division",
  "emp-dept",
  "emp-unit",
];
let isEditing = false;

function toggleEditMode() {
  const btn = document.getElementById("edit-toggle-btn");

  if (!isEditing) {
    // เข้าสู่โหมดแก้ไข: ปลด readonly ทุกช่อง
    editableFieldIds.forEach((id) => {
      document.getElementById(id).readOnly = false;
    });
    document.getElementById("emp-email").focus();
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล';
    isEditing = true;
  } else {
    // กดซ้ำ = บันทึก แล้วกลับเป็นโหมดดูอย่างเดียว
    saveProfile();
  }
}

function saveProfile() {
  const data = {
    employee_id: document.getElementById("emp-id").value,
    email: document.getElementById("emp-email").value,
    phone: document.getElementById("emp-phone").value,
    division: document.getElementById("emp-division").value,
    department: document.getElementById("emp-dept").value,
    unit: document.getElementById("emp-unit").value,
  };
  fetch("update_profile.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((result) => {
      alert(
        result.success
          ? "บันทึกข้อมูลสำเร็จ!"
          : "เกิดข้อผิดพลาด: " + (result.message || ""),
      );
      if (result.success) {
        editableFieldIds.forEach((id) => {
          document.getElementById(id).readOnly = true;
        });
        document.getElementById("edit-toggle-btn").innerHTML =
          '<i class="fa-solid fa-pen"></i> แก้ไขข้อมูล';
        isEditing = false;
      }
    })
    .catch(() => alert("ติดต่อ Server ไม่ได้"));
}

function logout() {
  if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
    fetch("logout.php").then(() => {
      window.location.href = "index.html";
    });
  }
}
