/**
 * 🏢 ข้อมูลฝ่าย/แผนก/หน่วยงาน — ใช้ร่วมกันทั้งหน้าสมัครสมาชิก (index.js) และหน้าโปรไฟล์ (profile.js)
 * แยกออกมาไฟล์นี้ไฟล์เดียว กันข้อมูลชุดเดียวกันพิมพ์ซ้ำหลายที่แล้วเผลอแก้ไม่ตรงกัน
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

/**
 * ฟังก์ชัน cascade แบบ generic ใช้ได้กับ dropdown ชุดฝ่าย/แผนก/หน่วยงานที่ไหนก็ได้
 * แค่ส่ง id ของ select ทั้ง 3 ช่องเข้ามา
 */
function populateMainDept(mainSelectId) {
  const mainSelect = document.getElementById(mainSelectId);
  if (!mainSelect) return;
  mainSelect.innerHTML = '<option value="" disabled selected>-- เลือกฝ่าย --</option>';
  for (let main in companyData) {
    mainSelect.options.add(new Option(main, main));
  }
}

function cascadeSubDept(mainSelectId, subSelectId) {
  const main = document.getElementById(mainSelectId).value;
  const subSelect = document.getElementById(subSelectId);
  subSelect.innerHTML = '<option value="" disabled selected>-- เลือกแผนก --</option>';
  if (companyData[main]) {
    for (let sub in companyData[main]) {
      subSelect.options.add(new Option(sub, sub));
    }
  }
}

function cascadeSection(mainSelectId, subSelectId, sectionSelectId) {
  const main = document.getElementById(mainSelectId).value;
  const sub = document.getElementById(subSelectId).value;
  const secSelect = document.getElementById(sectionSelectId);
  secSelect.innerHTML = '<option value="" disabled selected>-- เลือกหน่วยงาน --</option>';
  if (companyData[main] && companyData[main][sub]) {
    companyData[main][sub].forEach((sec) => {
      secSelect.options.add(new Option(sec, sec));
    });
  }
}

/**
 * ตั้งค่า dropdown 3 ชั้นให้ตรงกับค่าที่มีอยู่แล้ว (เช่นตอนโหลดโปรไฟล์เดิมของพนักงาน)
 * ทำ cascade ให้ครบทุกชั้นแล้วค่อย set value เพื่อให้ option ที่ต้องการ "มีอยู่จริง" ในตัวเลือกก่อน
 */
function setDeptSelectsValue(mainSelectId, subSelectId, sectionSelectId, division, department, unit) {
  const mainSelect = document.getElementById(mainSelectId);
  if (mainSelect.options.length <= 1) populateMainDept(mainSelectId);
  mainSelect.value = division || "";

  cascadeSubDept(mainSelectId, subSelectId);
  document.getElementById(subSelectId).value = department || "";

  cascadeSection(mainSelectId, subSelectId, sectionSelectId);
  document.getElementById(sectionSelectId).value = unit || "";
}