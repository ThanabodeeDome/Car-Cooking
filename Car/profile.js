/**
 * Profile Page Controller
 * Handles user profile fetching, updating, avatar upload.
 */

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

// Cache for reverting changes if the user cancels editing
let cachedProfile = {
  email: "",
  phone: "",
  division: "",
  department: "",
  unit: "",
};

const editableInputIds = ["emp-email", "emp-phone"];
const editableSelectIds = ["emp-division", "emp-dept", "emp-unit"];
let isEditing = false;

// Unified notification helper (Uses toast.js if loaded, fallback to alert)
function notify(type, message) {
  if (typeof showToast === "function") {
    showToast(type, message);
  } else {
    alert(message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadUserProfile();
  setupAvatarUpload();
});

/**
 * Fetch and populate current user's profile details
 */
function loadUserProfile() {
  fetch("get_profile.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        notify("error", data.message || "กรุณาเข้าสู่ระบบก่อนใช้งาน");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1200);
        return;
      }

      const u = data.user;
      document.getElementById("display-name").innerText = `${u.first_name} ${u.last_name}`;
      
      const roleText = [u.Division, u.department, u.Unit]
        .filter((part) => part && part.trim() !== "")
        .join(" / ");
      document.getElementById("display-role").innerText = roleText || "พนักงานองค์กร";

      document.getElementById("emp-id").value = u.employee_id || "-";
      document.getElementById("emp-email").value = u.email || "";
      document.getElementById("emp-phone").value = u.phone || "";

      // Cache data for cancel functionality
      cachedProfile = {
        email: u.email || "",
        phone: u.phone || "",
        division: u.Division || "",
        department: u.department || "",
        unit: u.Unit || "",
      };

      // Cascade select values
      setDeptSelectsValue(
        "emp-division",
        "emp-dept",
        "emp-unit",
        u.Division,
        u.department,
        u.Unit
      );

      // Populate booking statistics
      document.getElementById("stat-total").innerText = u.total_bookings ?? "0";
      document.getElementById("stat-complete").innerText = u.completed_bookings ?? "0";

      // Load avatar
      if (u.AvatarPath) {
        document.getElementById("user-avatar").src = u.AvatarPath;
      }
    })
    .catch((err) => {
      console.error("Error loading profile:", err);
      notify("error", "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    });
}

/**
 * Handle avatar image selection and upload
 */
function setupAvatarUpload() {
  const uploadInput = document.getElementById("upload-photo");
  if (!uploadInput) return;

  uploadInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    // Check size limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      notify("warning", "ไฟล์ภาพต้องมีขนาดไม่เกิน 2MB");
      this.value = "";
      return;
    }

    // Instant local preview
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("user-avatar").src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append("avatar", file);

    fetch("upload_avatar.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          notify("success", "เปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว");
          if (window.setNavAvatar && result.path) window.setNavAvatar(result.path); // ซิงค์รูปบนแถบเมนูทันที
        } else {
          notify("error", "อัปโหลดรูปไม่สำเร็จ: " + (result.message || ""));
        }
      })
      .catch((err) => {
        console.error("Upload error:", err);
        notify("error", "ติดต่อ Server ไม่ได้เพื่ออัปโหลดรูป");
      });
  });
}

/**
 * Cascade dropdown handlers
 */
function onEditDivisionChange() {
  cascadeSubDept("emp-division", "emp-dept");
  onEditDeptChange();
}

function onEditDeptChange() {
  cascadeSection("emp-division", "emp-dept", "emp-unit");
}

/**
 * Toggle Edit Mode
 */
function toggleEditMode() {
  if (!isEditing) {
    enterEditMode();
  } else {
    saveProfile();
  }
}

function enterEditMode() {
  isEditing = true;

  // Enable inputs & selects
  editableInputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = false;
  });

  editableSelectIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  // UI state indicators
  const editBanner = document.getElementById("edit-banner");
  if (editBanner) editBanner.style.display = "flex";

  const editActions = document.getElementById("edit-actions-footer");
  if (editActions) editActions.style.display = "flex";

  const toggleBtn = document.getElementById("edit-toggle-btn");
  if (toggleBtn) {
    toggleBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>บันทึกข้อมูล</span>';
  }

  const emailField = document.getElementById("emp-email");
  if (emailField) emailField.focus();
}

function cancelEditMode() {
  // Revert values to cached originals
  document.getElementById("emp-email").value = cachedProfile.email;
  document.getElementById("emp-phone").value = cachedProfile.phone;

  setDeptSelectsValue(
    "emp-division",
    "emp-dept",
    "emp-unit",
    cachedProfile.division,
    cachedProfile.department,
    cachedProfile.unit
  );

  exitEditMode();
  notify("info", "ยกเลิกการแก้ไขข้อมูลแล้ว");
}

function exitEditMode() {
  isEditing = false;

  // Lock inputs & selects
  editableInputIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = true;
  });

  editableSelectIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  // UI state indicators
  const editBanner = document.getElementById("edit-banner");
  if (editBanner) editBanner.style.display = "none";

  const editActions = document.getElementById("edit-actions-footer");
  if (editActions) editActions.style.display = "none";

  const toggleBtn = document.getElementById("edit-toggle-btn");
  if (toggleBtn) {
    toggleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> <span>แก้ไขข้อมูล</span>';
  }
}

/**
 * Save updated profile details to server
 */
function saveProfile() {
  const emailVal = document.getElementById("emp-email").value.trim();
  const phoneVal = document.getElementById("emp-phone").value.trim();
  const divisionVal = document.getElementById("emp-division").value;
  const deptVal = document.getElementById("emp-dept").value;
  const unitVal = document.getElementById("emp-unit").value;

  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    notify("warning", "รูปแบบอีเมลไม่ถูกต้อง");
    document.getElementById("emp-email").focus();
    return;
  }

  const data = {
    employee_id: document.getElementById("emp-id").value,
    email: emailVal,
    phone: phoneVal,
    division: divisionVal,
    department: deptVal,
    unit: unitVal,
  };

  const saveBtn = document.getElementById("save-profile-btn");
  const toggleBtn = document.getElementById("edit-toggle-btn");
  if (saveBtn) saveBtn.disabled = true;
  if (toggleBtn) toggleBtn.disabled = true;

  fetch("update_profile.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        notify("success", "บันทึกข้อมูลส่วนตัวสำเร็จเรียบร้อย");

        // Update cached values
        cachedProfile = {
          email: emailVal,
          phone: phoneVal,
          division: divisionVal,
          department: deptVal,
          unit: unitVal,
        };

        // Update role badge in identity card
        const roleText = [divisionVal, deptVal, unitVal]
          .filter((p) => p && p.trim() !== "")
          .join(" / ");
        document.getElementById("display-role").innerText = roleText || "พนักงานองค์กร";

        exitEditMode();
      } else {
        notify("error", "เกิดข้อผิดพลาด: " + (result.message || ""));
      }
    })
    .catch((err) => {
      console.error("Save profile error:", err);
      notify("error", "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    })
    .finally(() => {
      if (saveBtn) saveBtn.disabled = false;
      if (toggleBtn) toggleBtn.disabled = false;
    });
}

/**
 * User Logout
 */
async function logout() {
  if (await AppDialog.confirm({ title: "ออกจากระบบ", message: "คุณต้องการออกจากระบบใช่หรือไม่?", confirmText: "ออกจากระบบ", cancelText: "อยู่ต่อ" })) {
    fetch("../logout.php").then(() => {
      window.location.href = "index.html";
    });
  }
}