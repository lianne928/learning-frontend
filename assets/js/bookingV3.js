// =====================================================
// bookingV2.js — 完整重構版 (每周課表 + 四色判定)
// =====================================================

// 自動帶入 JWT Token
const _bookingToken = localStorage.getItem("jwt_token");
if (_bookingToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${_bookingToken}`;
}

// ─── DOM 元素 ───
const tutorNameEl    = document.getElementById("tutorName");
const courseNameEl   = document.getElementById("courseName");
const coursePriceEl  = document.getElementById("coursePrice");
const selectedListEl = document.getElementById("selectedList");
const totalLessonsEl = document.getElementById("totalLessons");
const totalPointsEl  = document.getElementById("totalPoints");
const bookingBtnEl   = document.getElementById("bookingBtn");
const weekBarEl      = document.getElementById("weekBar");
const timeSlotsContainer = document.getElementById("timeSlotsContainer");

// ─── 狀態管理 ───
let unitPrice           = 0;       // 課程單價
let lessonPlan          = 1;       // 1, 5, 10 堂方案
let walletBalance       = 0;       // 學生餘額
let selectedSlots       = [];      // 格式: [{ date: '2026-04-01', hour: 14 }]

let currentWeekIndex    = 0;       // 0~3 (共 4 週)
let allDates            = [];      // 存放未來 28 天的日期資訊
let weekSchedule        = [];      // 老師原始週課表 (星期幾/小時)
let tutorBookedSlots    = [];      // 他人已預約 (紅色)
let studentBookedSlots  = [];      // 自己已預約 (黃色)

// ─── 初始化 ───
document.addEventListener("DOMContentLoaded", () => {
  initDates();
  fetchData();
  setupEventListeners();
});

// 1. 產生未來 28 天日期 (從明天開始，符合 24h 預約規則)
function initDates() {
  const today = new Date();
  for (let i = 1; i <= 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    // 轉換為星期幾 (JS 0=日, 1=一... 改為後端慣用 1=一, 7=日)
    let day = d.getDay();
    if (day === 0) day = 7;

    allDates.push({
      dateStr,
      day,
      label: `${mm}/${dd}`
    });
  }
}

// 2. 並行抓取所有必要資料
async function fetchData() {
  const params   = new URLSearchParams(window.location.search);
  const tutorId  = params.get("tutorId");
  const courseId = params.get("courseId");

  try {
    const [tutorRes, courseRes, scheduleRes, tutorBookedRes, studentBookedRes, userRes] = await Promise.all([
      axios.get(`/api/tutor/${tutorId}`),
      axios.get(`/api/view/courses/${courseId}`),
      axios.get(`/api/tutor/schedules/${tutorId}`),            // 老師週課表模板
      axios.get(`/api/shop/course/${courseId}/futurebookings`), // 他人已約
      axios.get(`/api/shop/me/futurebookings`),                 // 自己已約
      axios.get(`/api/users/me`)                                      // 查餘額
    ]);

    // 填充基本資訊
    tutorNameEl.innerText  = tutorRes.data.name;
    courseNameEl.innerText = courseRes.data.name;
    unitPrice              = courseRes.data.price;
    coursePriceEl.innerText = unitPrice;
    walletBalance          = userRes.data.wallet;

    // 存儲比對資料
    weekSchedule       = scheduleRes.data;
    tutorBookedSlots   = tutorBookedRes.data;
    studentBookedSlots = studentBookedRes.data;

    renderWeekBar();
    renderTimeSlots(); // 初始渲染
  } catch (err) {
    console.error("資料載入失敗", err);
  }
}

// 3. 渲染上方日期橫條 (一週 7 天)
function renderWeekBar() {
  weekBarEl.innerHTML = "";
  const start = currentWeekIndex * 7;
  const currentWeek = allDates.slice(start, start + 7);
  const dayNames = ["", "一", "二", "三", "四", "五", "六", "日"];

  currentWeek.forEach((item, idx) => {
    const btn = document.createElement("button");
    // 預設選中該週的第一天
    btn.className = (idx === 0) ? "btn btn-primary px-3 mx-1" : "btn btn-outline-dark px-3 mx-1";
    btn.style.minWidth = "80px";
    btn.dataset.date = item.dateStr;
    btn.dataset.weekday = item.day;
    
    btn.innerHTML = `<small>${dayNames[item.day]}</small><br><b>${item.label}</b>`;
    
    btn.onclick = () => {
      // 切換選中樣式
      document.querySelectorAll("#weekBar .btn").forEach(b => {
        b.classList.replace("btn-primary", "btn-outline-dark");
      });
      btn.classList.replace("btn-outline-dark", "btn-primary");
      renderTimeSlots(); // 切換日期時，重新刷下方時段
    };
    weekBarEl.appendChild(btn);
  });
}

// 4. 核心功能：渲染時段格子 (四色判定)
function renderTimeSlots() {
  timeSlotsContainer.innerHTML = "";
  const activeBtn = weekBarEl.querySelector(".btn-primary");
  if (!activeBtn) return;

  const dateStr = activeBtn.dataset.date;
  const weekdayNum = parseInt(activeBtn.dataset.weekday);

  for (let h = 9; h <= 21; h++) {
    // A. 老師是否有排班
    const isAvailable = weekSchedule.some(s => s.weekday === weekdayNum && s.hour === h);
    // B. 他人已預約 (紅色)
    const isTutorBooked = tutorBookedSlots.some(b => b.date === dateStr && b.hour === h);
    // C. 自己已預約 (黃色)
    const isStudentBooked = studentBookedSlots.some(b => b.date === dateStr && b.hour === h);
    // D. 目前選取中 (綠色)
    const isSelected = selectedSlots.some(s => s.date === dateStr && s.hour === h);

    let btnClass = "";
    let btnText = `${h}:00`;
    let isDisabled = false;

    if (!isAvailable) {
      btnClass = "btn-outline-secondary opacity-25"; // 不可預約
      btnText = "未開放";
      isDisabled = true;
    } else if (isTutorBooked) {
      btnClass = "btn-danger text-white";           // 他人預約 (紅色)
      btnText = "已被預約";
      isDisabled = true;
    } else if (isStudentBooked) {
      btnClass = "btn-warning text-dark";           // 自己有課 (黃色)
      btnText = "自己有課";
      isDisabled = true;
    } else if (isSelected) {
      btnClass = "btn-success text-white";          // 已選取 (綠色)
    } else {
      btnClass = "btn-outline-dark";                // 可預約 (黑色)
    }

    const col = document.createElement("div");
    col.className = "col-4 col-md-3 mb-2";
    col.innerHTML = `
      <button class="btn w-100 py-2 fw-bold ${btnClass}" ${isDisabled ? 'disabled' : ''}>
        ${btnText}
      </button>
    `;
    
    const btn = col.querySelector("button");
    if (!isDisabled) {
      btn.onclick = () => toggleSlot(dateStr, h);
    }
    timeSlotsContainer.appendChild(col);
  }
}

// 5. 切換選取時段
function toggleSlot(date, hour) {
  const idx = selectedSlots.findIndex(s => s.date === date && s.hour === hour);
  if (idx > -1) {
    selectedSlots.splice(idx, 1);
  } else {
    if (selectedSlots.length >= lessonPlan) {
      alert(`您選擇的方案為 ${lessonPlan} 堂課，請先移除其他時段。`);
      return;
    }
    selectedSlots.push({ date, hour });
  }
  renderTimeSlots();
  updateSelectedUI();
}

// 6. 更新右側選取清單 (顯示日期+時間)
function updateSelectedUI() {
  selectedListEl.innerHTML = "";
  selectedSlots.forEach((slot, index) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center border-0 px-0 py-2";
    li.innerHTML = `
      <div class="d-flex align-items-center">
        <span class="badge bg-primary me-2">${index + 1}</span>
        <div>
          <div class="small text-muted" style="font-size: 0.7rem;">${slot.date}</div>
          <div class="fw-bold">${slot.hour}:00</div>
        </div>
      </div>
      <button class="btn btn-sm text-danger p-0" onclick="removeSlot(${index})">
        <i class="bi bi-x-circle-fill"></i>
      </button>
    `;
    selectedListEl.appendChild(li);
  });

  totalLessonsEl.innerText = selectedSlots.length;
  const total = calculateTotal();
  totalPointsEl.innerText = total;

  // 餘額檢查與按鈕啟用
  bookingBtnEl.disabled = (selectedSlots.length !== lessonPlan || total > walletBalance);
  if (total > walletBalance) {
    bookingBtnEl.classList.replace("btn-success", "btn-secondary");
    bookingBtnEl.innerText = "餘額不足";
  } else {
    bookingBtnEl.classList.replace("btn-secondary", "btn-success");
    bookingBtnEl.innerText = "確定預約";
  }
}

// 移除單一選取
window.removeSlot = (index) => {
  selectedSlots.splice(index, 1);
  renderTimeSlots();
  updateSelectedUI();
};

// 計算總價 (含 95折/9折 邏輯)
function calculateTotal() {
  let discount = 1.0;
  if (lessonPlan === 5) discount = 0.95;
  if (lessonPlan === 10) discount = 0.9;
  return Math.round(unitPrice * lessonPlan * discount);
}

// 7. 設定切換週別與方案點擊事件
function setupEventListeners() {
  // 週別切換
  document.getElementById("prevWeekBtn").onclick = () => {
    if (currentWeekIndex > 0) { currentWeekIndex--; renderWeekBar(); renderTimeSlots(); }
  };
  document.getElementById("nextWeekBtn").onclick = () => {
    if (currentWeekIndex < 3) { currentWeekIndex++; renderWeekBar(); renderTimeSlots(); }
  };

  // 方案切換 (1, 5, 10 堂)
  document.querySelectorAll(".btn-check").forEach(radio => {
    radio.addEventListener("change", (e) => {
      lessonPlan = parseInt(e.target.value);
      // 切換方案時通常清空已選，避免數量衝突
      selectedSlots = [];
      renderTimeSlots();
      updateSelectedUI();
    });
  });

  // 確定購買
  bookingBtnEl.onclick = handlePurchase;
}

// 8. 送出購買與預約
async function handlePurchase() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("courseId");

  const payload = {
    courseId: Number(courseId),
    lessonCount: lessonPlan,
    selectedSlots: selectedSlots
  };

  try {
    const resp = await axios.post("/api/shop/purchase", payload);
    alert("預約成功！");
    window.location.href = "my-bookings.html";
  } catch (err) {
    alert("失敗: " + (err.response?.data?.msg || "系統錯誤"));
  }
}