window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let currentPlate = "";
let currentBookingId = null;
let startMileage = 0;
let odometerFile = null;
let conditionFile = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentPlate = params.get("plate") || "";

  const loadingEl = document.getElementById("return-loading");
  const errorEl = document.getElementById("return-error");
  const contentEl = document.getElementById("return-content");

  if (!currentPlate) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.innerText = "ไม่พบทะเบียนรถใน QR โปรดสแกนใหม่อีกครั้ง";
    return;
  }

  // 🌟 ขอ booking ที่สถานะ 'ขาไป' (กำลังใช้งานอยู่) ของทะเบียนนี้ ต่างจากหน้าเช็คอินที่ขอ 'จองแล้ว'
  fetch(
    `get_booking_by_plate.php?plate=${encodeURIComponent(currentPlate)}&status=ขาไป`,
  )
    .then((res) => res.json())
    .then((data) => {
      loadingEl.classList.add("hidden");

      if (!data.success) {
        errorEl.classList.remove("hidden");
        errorEl.innerText =
          data.message || "ไม่พบข้อมูลการใช้งานสำหรับรถคันนี้";
        return;
      }

      const b = data.booking;
      currentBookingId = b.BookingID;
      startMileage = Number(b.StartMileage || 0);

      document.getElementById("rt-plate").value = b.CarPlate || "";
      document.getElementById("rt-driver").value = b.DriverName || "";
      document.getElementById("rt-start-mile").value = startMileage;
      document.getElementById("rt-end-mile").min = startMileage + 1;

      contentEl.classList.remove("hidden");
    })
    .catch((err) => {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorEl.innerText = "ติดต่อ Server ไม่ได้ กรุณาลองใหม่";
      console.error("return lookup error:", err);
    });

  // 🩹 REDESIGN: กลับมาใช้โหมดถ่ายรูปแล้วอ่านอัตโนมัติทันที ไม่ต้องลากกรอบเองแล้ว
  // เพราะตอนนี้ใช้ OCR.space (คลาวด์) เป็นตัวหลัก ซึ่งแม่นพอจะอ่านภาพเต็มมาตรวัดได้เลย
  // ไม่ต้องพึ่งการ crop เหมือนตัวอ่านที่เขียนเอง (ตัวนั้นลดไปเป็นแค่ fallback สำรองแทน)
  const odometerInput = document.getElementById("rt-odometer-input");
  odometerInput.addEventListener("change", function () {
    odometerFile = this.files[0] || null;
    if (!odometerFile) return;

    const preview = document.getElementById("rt-odometer-preview");
    const statusEl = document.getElementById("rt-ocr-status");
    statusEl.innerText = "";
    document.getElementById("rt-end-mile").value = "";

    const reader = new FileReader();
    reader.onload = (e) => {
      // 🩹 FIX: รูปถ่ายจากมือถือมักใหญ่ 2-5MB ทั้งที่ OCR.space free tier รับได้แค่ ≤1MB/รูป
      // เกินแล้วคำขอจะถูกปฏิเสธเงียบๆ (fallback ไปตัวอ่านสำรองที่แม่นน้อยกว่าทันที)
      // ต้องย่อ/บีบอัดก่อนส่งเสมอ ไม่ส่งไฟล์ต้นฉบับตรงๆ
      compressImageDataUrl(e.target.result, 1000, 0.8).then((compressedDataUrl) => {
        preview.src = compressedDataUrl;
        preview.classList.remove("hidden");
        runOcrAuto(compressedDataUrl); // 🌟 อ่านทันทีที่เลือก/ถ่ายรูปเสร็จ ไม่ต้องกดปุ่มเพิ่ม
      });
    };
    reader.readAsDataURL(odometerFile);
  });

  // 🌟 เลือกรูปสภาพรถ -> แค่พรีวิว ไม่ต้อง OCR
  const conditionInput = document.getElementById("rt-condition-input");
  conditionInput.addEventListener("change", function () {
    conditionFile = this.files[0] || null;
    if (!conditionFile) return;

    const preview = document.getElementById("rt-condition-preview");
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(conditionFile);
  });
});

// ============================================================
// 🌟 Seven-segment digit reader — เขียนเอง ไม่พึ่ง Tesseract แล้ว
// เหตุผล: Tesseract ฝึกมาอ่านฟอนต์สิ่งพิมพ์ ไม่ใช่จอ LCD 7-segment เลยอ่านเพี้ยนหนัก
// (ทดสอบจริงหลายรอบ preprocessing ช่วยได้นิดเดียว ไม่พอ)
// วิธีนี้วิเคราะห์ pixel ตรงๆ ตามโครงสร้างจอ 7-segment ซึ่งมีรูปแบบตายตัว แม่นกว่ามาก
// ทำงาน offline ล้วนๆ ไม่ต้องพึ่ง CDN ภายนอกด้วย (ตัดปัญหา CDN ล่มไปพร้อมกัน)
//
// ขั้นตอน: หาโซนจอสว่าง (LCD backlight) ตัดพื้นหลังรถ/แดชบอร์ดทิ้ง
//        -> แยกเป็นหลักๆ ตามคอลัมน์ที่มีตัวเลข
//        -> แต่ละหลัก เช็คว่าขีด a-g (บน/ล่าง/กลาง/มุมซ้ายขวา) ติดขีดไหนบ้าง
//        -> จับคู่ตารางรูปแบบขีด -> ตัวเลข 0-9
// ============================================================

function imageToGrayscale(img, maxWidth) {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < imgData.data.length; i += 4, p++) {
    gray[p] =
      0.299 * imgData.data[i] +
      0.587 * imgData.data[i + 1] +
      0.114 * imgData.data[i + 2];
  }
  return { gray, w, h };
}

// หา threshold แยกมืด/สว่างอัตโนมัติ ปรับตามความสว่างจริงของแต่ละรูป (กันแสงจ้า/แสงน้อยต่างกัน)
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0,
    wB = 0,
    maxVar = 0,
    threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

// หากรอบจอสว่าง (backlight ของ LCD สว่างกว่าแดชบอร์ดรอบๆ ชัดเจน) ตัดพื้นหลังทิ้ง
function findBrightRegion(gray, w, h, threshold) {
  const rowSum = new Array(h).fill(0);
  const colSum = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] > threshold) {
        rowSum[y]++;
        colSum[x]++;
      }
    }
  }
  const maxRow = Math.max(...rowSum);
  const maxCol = Math.max(...colSum);
  if (maxRow === 0 || maxCol === 0) return null;

  const rowCut = maxRow * 0.3;
  const colCut = maxCol * 0.3;

  const y0 = rowSum.findIndex((v) => v >= rowCut);
  const y1 = h - 1 - [...rowSum].reverse().findIndex((v) => v >= rowCut);
  const x0 = colSum.findIndex((v) => v >= colCut);
  const x1 = w - 1 - [...colSum].reverse().findIndex((v) => v >= colCut);

  if (y0 < 0 || x0 < 0 || y1 <= y0 || x1 <= x0) return null;

  const padX = Math.max(1, Math.round((x1 - x0) * 0.03));
  const padY = Math.max(1, Math.round((y1 - y0) * 0.08));
  return {
    x0: Math.max(0, x0 - padX),
    x1: Math.min(w - 1, x1 + padX),
    y0: Math.max(0, y0 - padY),
    y1: Math.min(h - 1, y1 + padY),
  };
}

function cropGray(gray, w, box) {
  const { x0, y0, x1, y1 } = box;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      out[y * cw + x] = gray[(y + y0) * w + (x + x0)];
    }
  }
  return { gray: out, w: cw, h: ch };
}

// 🩹 FIX (บั๊กสำคัญ): เดิมโค้ดนี้ถือว่า "ตัวเลข = มืดกว่า threshold" ตายตัวเสมอ
// ใช้ได้กับจอ LCD แบบตัวเลขดำบนพื้นเทาสว่าง แต่จอ digital cluster รุ่นใหม่หลายคัน
// (โดยเฉพาะ Toyota/Chevrolet ที่ใช้ในระบบนี้) โชว์เลขไมล์เป็นตัวเลขสว่าง (ขาว/ส้ม) บนพื้นดำ
// กรณีนั้นตรรกะเดิมจะกลับตาลปัตร: พื้นหลังทั้งจอ (เสียงข้างมาก) ถูกนับเป็น ink แทนตัวเลขจริง
// ทำให้รูปทรงขีด a-g เพี้ยนหมด นี่คือสาเหตุหลักที่อ่านเลขไมล์ผิด/อ่านไม่ออกบ่อยๆ
//
// แก้ด้วยการตรวจขั้วสีอัตโนมัติ: ตัวเลขกินพื้นที่แค่ส่วนน้อยของ ROI เสมอ (เส้นขีดบางๆ)
// ดังนั้นพิกเซล "ส่วนใหญ่" ใน ROI คือพื้นหลังเสมอ ไม่ว่าจะโพลาริตีไหน
// ถ้าพื้นหลังส่วนใหญ่มืด -> ตัวเลข (ส่วนน้อย) ต้องสว่าง -> ink = สว่างกว่า threshold
// ถ้าพื้นหลังส่วนใหญ่สว่าง -> ตัวเลข (ส่วนน้อย) ต้องมืด -> ink = มืดกว่า threshold (แบบเดิม)
function detectInvertPolarity(gray, threshold) {
  let darkCount = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < threshold) darkCount++;
  }
  const darkRatio = darkCount / gray.length;
  return darkRatio > 0.5; // true = พื้นหลังมืดเป็นส่วนใหญ่ -> ต้อง invert ให้ ink = สว่าง
}

// ตัวเลข (ink) เข้มกว่าพื้นหลังที่สว่าง -> pixel มืดกว่า threshold = ติด (1)
// (invert=true กรณีจอสว่างบนพื้นมืด -> สลับตรรกะ ink = พิกเซลสว่างกว่า threshold แทน)
function binarizeInk(gray, threshold, invert) {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const isDark = gray[i] < threshold;
    out[i] = invert ? (isDark ? 0 : 1) : isDark ? 1 : 0;
  }
  return out;
}

// แยกแต่ละหลักตามคอลัมน์ที่มี ink (คั่นด้วยช่องว่างระหว่างหลัก)
function splitDigitColumns(binary, w, h) {
  const colSum = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) s += binary[y * w + x];
    colSum[x] = s;
  }
  const cols = [];
  let inDigit = false;
  let start = 0;
  const noiseFloor = 1;
  for (let x = 0; x < w; x++) {
    if (colSum[x] > noiseFloor && !inDigit) {
      inDigit = true;
      start = x;
    } else if (colSum[x] <= noiseFloor && inDigit) {
      inDigit = false;
      cols.push({ x0: start, x1: x - 1 });
    }
  }
  if (inDigit) cols.push({ x0: start, x1: w - 1 });

  const minWidth = Math.max(2, Math.round(w * 0.02));
  return cols.filter((c) => c.x1 - c.x0 + 1 >= minWidth);
}

function trimVerticalRange(binary, w, h, x0, x1) {
  let y0 = 0;
  let y1 = h - 1;
  while (y0 < h) {
    let has = false;
    for (let x = x0; x <= x1; x++)
      if (binary[y0 * w + x]) {
        has = true;
        break;
      }
    if (has) break;
    y0++;
  }
  while (y1 > y0) {
    let has = false;
    for (let x = x0; x <= x1; x++)
      if (binary[y1 * w + x]) {
        has = true;
        break;
      }
    if (has) break;
    y1--;
  }
  return { y0, y1 };
}

// เช็คแต่ละโซน a-g ว่า "ติด" ไหม จากสัดส่วนพิกเซล ink ในโซนนั้น
//   _a_
//  f   b
//   _g_
//  e   c
//   _d_
function readSegments(binary, w, x0, x1, y0, y1) {
  const dw = x1 - x0 + 1;
  const dh = y1 - y0 + 1;
  const bandH = Math.max(1, Math.round(dh * 0.18));
  const stemW = Math.max(1, Math.round(dw * 0.35));
  const midY = y0 + Math.round(dh / 2);

  function ratio(rx0, rx1, ry0, ry1) {
    let on = 0,
      total = 0;
    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0; x <= rx1; x++) {
        total++;
        if (binary[y * w + x]) on++;
      }
    }
    return total ? on / total : 0;
  }

  const a = ratio(x0, x1, y0, y0 + bandH);
  const f = ratio(x0, x0 + stemW, y0, midY);
  const b = ratio(x1 - stemW, x1, y0, midY);
  const g = ratio(
    x0,
    x1,
    Math.max(y0, midY - Math.round(bandH / 2)),
    Math.min(y1, midY + Math.round(bandH / 2)),
  );
  const e = ratio(x0, x0 + stemW, midY, y1);
  const c = ratio(x1 - stemW, x1, midY, y1);
  const d = ratio(x0, x1, y1 - bandH, y1);

  const th = 0.35;
  return [a, b, c, d, e, f, g].map((r) => (r > th ? 1 : 0));
}

// ตาราง segment (ลำดับ a,b,c,d,e,f,g) -> ตัวเลข ตามมาตรฐานจอ 7-segment
const SEGMENT_TABLE = {
  "1111110": "0",
  "0110000": "1",
  "1101101": "2",
  "1111001": "3",
  "0110011": "4",
  "1011011": "5",
  "1011111": "6",
  "1110000": "7",
  "1111111": "8",
  "1111011": "9",
};

function classifyDigit(binary, w, x0, x1, y0, y1) {
  const seg = readSegments(binary, w, x0, x1, y0, y1);
  const key = seg.join("");
  if (SEGMENT_TABLE[key]) return SEGMENT_TABLE[key];

  // ไม่ตรงเป๊ะ (เช่นแสงรบกวนนิดหน่อย) -> หารูปแบบที่ต่างกันแค่ 1 ขีด ถ้าเจอค่อยเดา
  let best = null,
    bestDist = 99;
  for (const [k, digit] of Object.entries(SEGMENT_TABLE)) {
    let dist = 0;
    for (let i = 0; i < 7; i++) if (k[i] !== key[i]) dist++;
    if (dist < bestDist) {
      bestDist = dist;
      best = digit;
    }
  }
  return bestDist <= 1 ? best : null; // ต่างเกิน 1 ขีด = ไม่มั่นใจ ไม่เดามั่ว
}

function recognizeOdometerDigits(img) {
  const { gray, w, h } = imageToGrayscale(img, 900);
  const globalThreshold = otsuThreshold(gray);

  const brightBox = findBrightRegion(gray, w, h, globalThreshold * 1.15);
  const roi = brightBox ? cropGray(gray, w, brightBox) : { gray, w, h };

  const roiThreshold = otsuThreshold(roi.gray);
  const invert = detectInvertPolarity(roi.gray, roiThreshold); // 🩹 ตรวจขั้วสีอัตโนมัติก่อน binarize
  const binary = binarizeInk(roi.gray, roiThreshold, invert);

  const digitCols = splitDigitColumns(binary, roi.w, roi.h);
  if (digitCols.length === 0) return null;

  let result = "";
  for (const col of digitCols) {
    const { y0, y1 } = trimVerticalRange(binary, roi.w, roi.h, col.x0, col.x1);
    if (y1 - y0 < 4) continue; // เล็กเกินไป ไม่ใช่ตัวเลขจริง (สัญญาณรบกวน)
    const digit = classifyDigit(binary, roi.w, col.x0, col.x1, y0, y1);
    if (digit === null) return null; // มีหลักไหนไม่มั่นใจ ยอมแพ้ทั้งชุด ดีกว่าเดาผิดทั้งเลข
    result += digit;
  }

  return result || null;
}

// ============================================================
// 🌟 Crop selector — ให้คนลากกรอบเลือกเฉพาะตัวเลขไมล์เอง ก่อนส่งเข้า OCR
// เหตุผล: หาโซนสว่างอัตโนมัติ (findBrightRegion) เดาผิดบ่อยเมื่อถ่ายภาพเต็มมาตรวัด
// เพราะมีวงแหวนโครเมียม/แสงสะท้อนอื่นสว่างแข่งกับจอ ODO เล็กๆ ตรงกลาง
// ให้คนช่วยเล็งกรอบเองแม่นกว่าเดาด้วยอัลกอริทึมมาก
// ============================================================

let cropRect = null; // {x,y,w,h} หน่วยเป็น CSS px สัมพัทธ์กับ #rt-crop-wrap
let cropDragMode = null; // 'move' | 'new' | null
let cropDragStart = null;
let cropBoxStart = null;

function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function renderCropBox() {
  const box = document.getElementById("rt-crop-box");
  if (!box || !cropRect) return;
  box.style.left = cropRect.x + "px";
  box.style.top = cropRect.y + "px";
  box.style.width = cropRect.w + "px";
  box.style.height = cropRect.h + "px";
}

// ตั้งกรอบเริ่มต้นตรงกลางภาพให้เลย (70% กว้าง x 22% สูง) ผู้ใช้ปรับต่อได้ทันที
// ไม่บังคับต้องลากเองตั้งแต่ศูนย์ ลดขั้นตอนสำหรับกรณีที่กรอบเริ่มต้นก็ครอบตัวเลขพอดีอยู่แล้ว
function initCropSelector() {
  const wrap = document.getElementById("rt-crop-wrap");
  if (!wrap) return;

  const wrapRect = wrap.getBoundingClientRect();
  const defaultW = wrapRect.width * 0.7;
  const defaultH = wrapRect.height * 0.22;
  cropRect = {
    x: (wrapRect.width - defaultW) / 2,
    y: (wrapRect.height - defaultH) / 2,
    w: defaultW,
    h: defaultH,
  };
  renderCropBox();

  // ล้าง listener เก่าก่อนผูกใหม่ กันผูกซ้ำถ้าเลือกรูปหลายรอบ
  wrap.onpointerdown = handleCropPointerDown;
  wrap.onpointermove = handleCropPointerMove;
  wrap.onpointerup = handleCropPointerUp;
  wrap.onpointercancel = handleCropPointerUp;
}

function handleCropPointerDown(e) {
  const wrap = document.getElementById("rt-crop-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const px = e.clientX - wrapRect.left;
  const py = e.clientY - wrapRect.top;

  const insideBox =
    cropRect &&
    px >= cropRect.x &&
    px <= cropRect.x + cropRect.w &&
    py >= cropRect.y &&
    py <= cropRect.y + cropRect.h;

  if (insideBox) {
    // แตะในกรอบเดิม -> ลากย้ายตำแหน่งกรอบ (ไม่เปลี่ยนขนาด)
    cropDragMode = "move";
    cropDragStart = { x: px, y: py };
    cropBoxStart = { ...cropRect };
  } else {
    // แตะนอกกรอบ -> เริ่มลากกรอบใหม่จากจุดนี้
    cropDragMode = "new";
    cropDragStart = { x: px, y: py };
    cropRect = { x: px, y: py, w: 0, h: 0 };
  }
  wrap.setPointerCapture(e.pointerId);
}

function handleCropPointerMove(e) {
  if (!cropDragMode) return;
  const wrap = document.getElementById("rt-crop-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const px = clampNum(e.clientX - wrapRect.left, 0, wrapRect.width);
  const py = clampNum(e.clientY - wrapRect.top, 0, wrapRect.height);

  if (cropDragMode === "new") {
    cropRect = {
      x: Math.min(cropDragStart.x, px),
      y: Math.min(cropDragStart.y, py),
      w: Math.abs(px - cropDragStart.x),
      h: Math.abs(py - cropDragStart.y),
    };
  } else if (cropDragMode === "move") {
    const dx = px - cropDragStart.x;
    const dy = py - cropDragStart.y;
    cropRect = {
      x: clampNum(cropBoxStart.x + dx, 0, wrapRect.width - cropBoxStart.w),
      y: clampNum(cropBoxStart.y + dy, 0, wrapRect.height - cropBoxStart.h),
      w: cropBoxStart.w,
      h: cropBoxStart.h,
    };
  }
  renderCropBox();
}

function handleCropPointerUp() {
  cropDragMode = null;
}

// แปลงกรอบที่ลาก (หน่วย CSS px ตามที่แสดงบนจอ) กลับเป็นพิกัดจริงในรูปต้นฉบับ (natural pixels)
// จำเป็นเพราะรูปที่แสดงบนจอถูกย่อ/ขยายด้วย CSS ให้พอดีความกว้างการ์ด ไม่ใช่ขนาดจริงของไฟล์รูป
function getCropRectNatural() {
  const wrap = document.getElementById("rt-crop-wrap");
  const preview = document.getElementById("rt-odometer-preview");
  const wrapRect = wrap.getBoundingClientRect();
  const scaleX = preview.naturalWidth / wrapRect.width;
  const scaleY = preview.naturalHeight / wrapRect.height;
  return {
    x: Math.round(cropRect.x * scaleX),
    y: Math.round(cropRect.y * scaleY),
    w: Math.round(cropRect.w * scaleX),
    h: Math.round(cropRect.h * scaleY),
  };
}

// 🌟 อ่านตัวเลขจากรูปที่ "ถูก crop แล้ว" โดยตรง — ข้ามขั้น findBrightRegion ไปเลย
// เพราะกรอบที่คนลากเองก็คือ ROI ที่แม่นอยู่แล้ว ไม่ต้องเดาซ้ำ
function recognizeOdometerDigitsFromCroppedImage(img) {
  const { gray, w, h } = imageToGrayscale(img, 900);
  const threshold = otsuThreshold(gray);
  const invert = detectInvertPolarity(gray, threshold);
  const binary = binarizeInk(gray, threshold, invert);

  const digitCols = splitDigitColumns(binary, w, h);
  if (digitCols.length === 0) return null;

  let result = "";
  for (const col of digitCols) {
    const { y0, y1 } = trimVerticalRange(binary, w, h, col.x0, col.x1);
    if (y1 - y0 < 4) continue;
    const digit = classifyDigit(binary, w, col.x0, col.x1, y0, y1);
    if (digit === null) return null;
    result += digit;
  }

  return result || null;
}

// 🌟 กดปุ่ม "อ่านเลขไมล์จากกรอบที่เลือก" -> crop ตามกรอบจริง แล้วรัน OCR เฉพาะส่วนนั้น
// 🌟 ย่อ + บีบอัดรูปด้วย canvas ก่อนส่งเข้า OCR เสมอ
// กัน OCR.space ปฏิเสธคำขอเงียบๆ ตอนไฟล์ต้นฉบับเกิน 1MB (limit ของ free tier)
// maxDimension = ความกว้าง/สูงสูงสุดหลังย่อ (px), quality = คุณภาพ JPEG (0-1)
function compressImageDataUrl(dataUrl, maxDimension, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const longest = Math.max(width, height);
      // 🩹 รูปแคปจอเล็กๆ (ตัวเลขไม่กี่สิบ px) ขยายให้ใหญ่ขึ้นก่อน OCR จะอ่านแม่นขึ้น (ขยายไม่เกิน 3 เท่า)
      const scale = longest > maxDimension ? maxDimension / longest : longest < 800 ? Math.min(3, 800 / longest) : 1;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // 🩹 ปูพื้นขาวก่อน: PNG พื้นโปร่งใสพอแปลงเป็น JPEG พื้นจะกลายเป็นสีดำ ตัวเลขสีดำจมหาย OCR อ่านไม่ได้เลย
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // ย่อไม่สำเร็จ ส่งต้นฉบับไปแทน (ดีกว่าไม่ส่งเลย)
    img.src = dataUrl;
  });
}

// 🌟 อ่าน OCR อัตโนมัติทันทีที่เลือก/ถ่ายรูปเสร็จ ไม่ต้องลากกรอบ/กดปุ่มเพิ่มแล้ว
// ส่งภาพเต็มไปที่ OCR.space (คลาวด์) ก่อนเสมอ เพราะแม่นพอจะอ่านภาพเต็มมาตรวัดได้เลย
// ถ้าเน็ตหลุด/เซิร์ฟเวอร์ตอบไม่สำเร็จ -> fallback ไปใช้ seven-segment reader ในเครื่อง
// (ทำงาน offline ได้เสมอ) กันผู้ใช้ติดค้างเวลาไม่มีเน็ตหรือ OCR.space ล่ม
function runOcrAuto(dataUrl) {
  const statusEl = document.getElementById("rt-ocr-status");
  const endMileInput = document.getElementById("rt-end-mile");

  statusEl.innerText = "กำลังอ่านเลขไมล์จากรูป...";
  statusEl.style.color = "#94a3b8";
  endMileInput.value = "";

  fetch("ocr_odometer.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ส่งไมล์ตอนออกไปด้วย ให้ server เลือกชุดตัวเลขที่เป็นไปได้ เมื่อในรูปมีตัวเลขหลายชุด (trip, นาฬิกา ฯลฯ)
    body: JSON.stringify({ image: dataUrl, start_mileage: startMileage || null }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success && result.digits && result.digits.length >= 3) {
        showOcrResult(statusEl, endMileInput, Number(result.digits), result.candidates || []);
      } else {
        console.warn(
          "OCR.space อ่านไม่สำเร็จ กำลัง fallback ไปตัวอ่านในเครื่อง:",
          result.message,
        );
        runLocalFallbackOcr(dataUrl, statusEl, endMileInput);
      }
    })
    .catch((err) => {
      console.warn(
        "เชื่อมต่อ OCR.space ไม่ได้ กำลัง fallback ไปตัวอ่านในเครื่อง:",
        err,
      );
      runLocalFallbackOcr(dataUrl, statusEl, endMileInput);
    });
}

// เลขไมล์ตอนคืนที่เป็นไปได้: มากกว่าไมล์ตอนออก และขับไม่เกิน 1,500 กม. (เกณฑ์เดียวกับ save_return.php)
function isPlausibleMile(v) {
  if (!Number.isFinite(v) || v <= 0) return false;
  return !startMileage || (v > startMileage && v <= startMileage + 1500);
}

// แสดงผล OCR: ใส่เลขที่ดีที่สุด + ตัวเลือกอื่นที่เจอในรูป (กดเลือกได้) + เตือนถ้าไม่อยู่ในช่วงที่เป็นไปได้
function showOcrResult(statusEl, endMileInput, value, candidates) {
  endMileInput.value = String(value); // ตัด 0 นำหน้า เช่น 0185318 -> 185318
  const ok = isPlausibleMile(value);
  statusEl.textContent =
    "อ่านได้: " + value + (ok ? " กรุณาตรวจสอบตัวเลขให้ตรงก่อนกดยืนยัน" : " ⚠️ ไม่อยู่ในช่วงที่เป็นไปได้ (ไมล์ตอนออก " + startMileage + ") กรุณาตรวจ/แก้ให้ถูกต้อง");
  statusEl.style.color = ok ? "#4ade80" : "#f59e0b";
  const others = candidates.map(Number).filter((c) => c !== value && c > 0);
  if (others.length) {
    const wrap = document.createElement("div");
    wrap.style.marginTop = "6px";
    wrap.append("ตัวเลขอื่นในรูป: ");
    others.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(c);
      b.style.cssText = "margin:2px 4px;padding:2px 10px;border-radius:999px;border:1px solid #64748b;background:transparent;color:inherit;cursor:pointer";
      b.addEventListener("click", () => showOcrResult(statusEl, endMileInput, c, [value, ...others.filter((x) => x !== c)]));
      wrap.appendChild(b);
    });
    statusEl.appendChild(wrap);
  }
}

// 🌟 ตัวอ่านสำรอง (seven-segment reader เขียนเอง, อ่านทั้งภาพผ่าน findBrightRegion เดาโซนเอง)
// ใช้เมื่อ OCR.space ตอบไม่สำเร็จหรือเน็ตหลุด — ทำงาน offline ได้เสมอ กันผู้ใช้ติดค้าง
function runLocalFallbackOcr(dataUrl, statusEl, endMileInput) {
  statusEl.innerText = "ลองอ่านด้วยตัวอ่านสำรอง (offline)...";
  const img = new Image();
  img.onload = () => {
    try {
      const digits = recognizeOdometerDigits(img);
      // 🩹 ตัวอ่านสำรองออกแบบมาสำหรับจอ LCD 7-segment เท่านั้น รูปแบบอื่นมักได้ตัวเลขมั่ว
      // -> ใส่ให้เฉพาะเมื่ออยู่ในช่วงที่เป็นไปได้ (มากกว่าไมล์ตอนออก ไม่เกิน +1,500 กม.) ไม่งั้นให้กรอกเอง
      if (digits && digits.length >= 3 && isPlausibleMile(Number(digits))) {
        endMileInput.value = String(Number(digits));
        statusEl.innerText =
          "อ่านได้ (โหมดสำรอง): " +
          Number(digits) +
          " กรุณาตรวจสอบตัวเลขให้ตรงก่อนกดยืนยัน";
        statusEl.style.color = "#f59e0b";
      } else {
        statusEl.innerText = "อ่านเลขไมล์จากรูปไม่ได้ กรุณากรอกเองด้านล่าง";
        statusEl.style.color = "#ff4d4d";
      }
    } catch (err) {
      console.error("Local OCR error:", err);
      statusEl.innerText = "OCR ทำงานผิดพลาด กรุณากรอกเลขไมล์เอง";
      statusEl.style.color = "#ff4d4d";
    }
  };
  img.onerror = () => {
    statusEl.innerText = "โหลดรูปไม่สำเร็จ กรุณากรอกเลขไมล์เอง";
    statusEl.style.color = "#ff4d4d";
  };
  img.src = dataUrl;
}



// 🌟 ฟังก์ชันเดิม runOcrOnOdometer (อ่านทั้งภาพอัตโนมัติ ไม่ครอป) เก็บไว้เผื่ออยากใช้ทางเลือก
// "ลองอ่านอัตโนมัติทั้งภาพ" ในอนาคต แต่ตอนนี้ไม่ได้ถูกเรียกใช้แล้ว (ใช้ runOcrOnSelectedCrop แทน)
function runOcrOnOdometer(file) {
  const statusEl = document.getElementById("rt-ocr-status");
  const endMileInput = document.getElementById("rt-end-mile");
  statusEl.innerText = "กำลังอ่านเลขไมล์จากรูป...";
  endMileInput.value = "";

  const img = new Image();
  const reader = new FileReader();

  reader.onload = (e) => {
    img.onload = () => {
      try {
        const digits = recognizeOdometerDigits(img);
        if (digits && digits.length >= 3) {
          endMileInput.value = digits;
          statusEl.innerText =
            "อ่านได้: " + digits + " กรุณาตรวจสอบตัวเลขให้ตรงก่อนกดยืนยัน";
          statusEl.style.color = "#4ade80";
        } else {
          statusEl.innerText = "อ่านเลขไมล์จากรูปไม่ได้ กรุณากรอกเองด้านล่าง";
          statusEl.style.color = "#ff4d4d";
        }
      } catch (err) {
        console.error("OCR error:", err);
        statusEl.innerText = "OCR ทำงานผิดพลาด กรุณากรอกเลขไมล์เอง";
        statusEl.style.color = "#ff4d4d";
      }
    };
    img.onerror = () => {
      statusEl.innerText = "โหลดรูปไม่สำเร็จ กรุณากรอกเลขไมล์เอง";
      statusEl.style.color = "#ff4d4d";
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    statusEl.innerText = "โหลดรูปไม่สำเร็จ กรุณากรอกเลขไมล์เอง";
    statusEl.style.color = "#ff4d4d";
  };
  reader.readAsDataURL(file);
}

// 🌟 ปุ่ม +/- ปรับเลขไมล์ทีละ 1 หน่วย — เผื่อ OCR อ่านเพี้ยนไปนิดหน่อย แก้ง่ายกว่าลบพิมพ์ใหม่ทั้งหมด
function bumpEndMile(delta) {
  const input = document.getElementById("rt-end-mile");
  const current = Number(input.value) || 0;
  input.value = Math.max(0, current + delta);
}

if (window.prefetchGeo) window.prefetchGeo(); // ขอสิทธิ์ตำแหน่งตั้งแต่เปิดหน้า

function confirmReturn() {
  const endMile = Number(document.getElementById("rt-end-mile").value);
  const remark = document.getElementById("rt-remark").value || "-";

  if (!odometerFile) {
    return showToast("warning", "กรุณาถ่ายรูปเลขไมล์ก่อน");
  }
  if (!conditionFile) {
    return showToast("warning", "กรุณาถ่ายรูปสภาพรถก่อนคืน");
  }
  if (!endMile || endMile <= startMileage) {
    return showToast(
      "warning",
      `เลขไมล์ตอนคืน (${endMile || 0}) ต้องมากกว่าเลขไมล์ตอนออก (${startMileage})`,
    );
  }

  const btn = document.getElementById("rt-confirm-btn");
  btn.disabled = true;
  btn.innerText = "กำลังบันทึกการคืนรถ...";

  Promise.all([
    uploadReturnPhoto(odometerFile, "odometer"),
    uploadReturnPhoto(conditionFile, "condition"),
    window.getGeo ? window.getGeo() : Promise.resolve(null),
  ])
    .then(([odometerPath, conditionPath, geo]) => {
      const now = new Date();
      // 🩹 วันที่ตามเวลาเครื่อง (toISOString เป็น UTC = ก่อน 07:00 น. ได้วันที่เมื่อวาน)
      const returnDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
      const returnTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      return fetch("save_return.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: currentBookingId,
          return_date: returnDate,
          return_time: returnTime,
          end_mile: endMile,
          return_remark: remark,
          odometer_photo_path: odometerPath,
          condition_photo_path: conditionPath,
          geo,
        }),
      });
    })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", result.message || "บันทึกการคืนรถสำเร็จ!");
        setTimeout(() => {
          askSystemFeedback(currentBookingId, () => {
            window.location.href = "booking-details.html?plate=" + encodeURIComponent(currentPlate);
          });
        }, 1200);
      } else {
        showToast("error", result.message || "เกิดข้อผิดพลาด");
        btn.disabled = false;
        btn.innerText = "ยืนยันการคืนรถ";
      }
    })
    .catch((err) => {
      showToast("error", err.message || "ติดต่อ Server ไม่ได้");
      btn.disabled = false;
      btn.innerText = "ยืนยันการคืนรถ";
      console.error("confirm return error:", err);
    });
}

// 🌟 บีบรูปให้เล็กลงก่อนส่งเสมอ (มือถือถ่ายรูปได้ 3-8MB ง่ายๆ แต่ php.ini บาง server จำกัดแค่ ~2MB)
function compressImage(file, maxDim = 1600, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx2 = canvas.getContext("2d");
        ctx2.fillStyle = "#fff"; // PNG โปร่งใส -> JPEG พื้นดำ ถ้าไม่ปูพื้นขาวก่อน
        ctx2.fillRect(0, 0, width, height);
        ctx2.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function uploadReturnPhoto(file, type) {
  return compressImage(file).then((compressed) => {
    const formData = new FormData();
    formData.append("photo", compressed);
    formData.append("type", type);

    return fetch("upload_return_photo.php", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((result) => {
        // 🩹 FIX: เดิม result.success:false -> return null เงียบๆ แล้วโค้ดข้างล่างเดินหน้าบันทึก
        // การคืนรถต่อโดยไม่มีรูปจริง (ตรงกับอาการที่แจ้ง: อัปรูปแล้วจองสำเร็จ แต่ไฟล์ไม่ถูกเก็บไว้เลย)
        if (!result.success) {
          throw new Error(result.message || `อัปโหลดรูป${type === "odometer" ? "เลขไมล์" : "สภาพรถ"}ไม่สำเร็จ`);
        }
        return result.photo_path;
      });
  });
}