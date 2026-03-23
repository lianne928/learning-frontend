// 自動帶入 JWT Token
const _bookingToken = localStorage.getItem("jwt_token");
if (_bookingToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${_bookingToken}`;
}

// 🔗 【API 串接處 1】
const API_BASE_URL = "http://localhost:8080/api";

const urlParams = new URLSearchParams(window.location.search);
const tutorId = urlParams.get("tutorId") || 1;
const courseId = urlParams.get("courseId") || 101;
const UNIT_PRICE = parseInt(urlParams.get("price")) || 500;

document.getElementById("display-course-name").textContent =
  urlParams.get("courseName") || "課程名稱";
document.getElementById("teacher-name").textContent =
  urlParams.get("tutorName") || "老師名稱";
document.getElementById("display-unit-price").textContent = UNIT_PRICE;
document.getElementById("display-unit-price-2").textContent = UNIT_PRICE;

let scheduleData = [];
let selectedSlots = [];
let currentWeek = 0;
const TOTAL_WEEKS = 4;
const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

const checkoutBtn = document.getElementById("checkout-btn");
const cartList = document.getElementById("cart-list");

// 取得指定週的週一到週日日期
function getWeekDates(weekOffset) {
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - currentDay + 1 + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔗 【API 串接處 2】
    const [schedRes, bookRes, tutorRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/teacher/schedules/${tutorId}`),
      axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`),
      axios.get(`${API_BASE_URL}/tutor/${tutorId}`),
    ]);

    const schedules = schedRes.data;
    const bookings = bookRes.data;
    const now = new Date();

    // 填入頭貼
    const avatarUrl = tutorRes.data.avatar;
    const avatarEl = document.getElementById("tutor-avatar");
    if (avatarEl && avatarUrl) {
      const match = avatarUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      avatarEl.src = match
        ? `https://lh3.googleusercontent.com/d/${match[1]}`
        : avatarUrl;
    }

    scheduleData = [];

    schedules.forEach((s) => {
      // isAvailable = false 直接跳過，不顯示
      if (!s.isAvailable) return;

      for (let weekOffset = 0; weekOffset < TOTAL_WEEKS; weekOffset++) {
        // 每次迴圈重新建立日期，避免疊加
        const targetDate = new Date();
        const currentDay = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
        const daysToAdd = (s.weekday + 7 - currentDay) % 7;

        targetDate.setDate(targetDate.getDate() + daysToAdd + weekOffset * 7);
        targetDate.setHours(s.hour, 0, 0, 0);

        if (targetDate <= now) continue;

        const dateString = formatDate(targetDate);

        const isBooked = bookings.some((b) => {
          let bDateStr = Array.isArray(b.date)
            ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
            : b.date;
          return (
            bDateStr === dateString &&
            b.hour === s.hour &&
            b.slotLocked === true
          );
        });

        scheduleData.push({
          date: dateString,
          weekday: s.weekday,
          hour: s.hour,
          time: `${String(s.hour).padStart(2, "0")}:00`,
          isBooked: isBooked,
        });
      }
    });

    renderAllWeeks();
    updateWeekLabel();
    updateNavButtons();
  } catch (error) {
    console.error("❌ 撈取資料失敗：", error);
    document.getElementById("calendar-track").innerHTML =
      '<div style="padding: 30px; color: red; text-align:center;">❌ 無法取得班表，請確認 Spring Boot 是否啟動。</div>';
  }
});

// 渲染所有四週面板
function renderAllWeeks() {
  const track = document.getElementById("calendar-track");
  track.innerHTML = "";

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const weekDates = getWeekDates(w);
    const weekPanel = document.createElement("div");
    weekPanel.className = "calendar-week";

    const header = document.createElement("div");
    header.className = "calendar-header";

    const slotsGrid = document.createElement("div");
    slotsGrid.className = "calendar-slots";

    weekDates.forEach((date, i) => {
      const dateStr = formatDate(date);
      const daySlots = scheduleData.filter((s) => s.date === dateStr);

      // 標題
      const dayHeader = document.createElement("div");
      dayHeader.className =
        "calendar-day-header" + (daySlots.length > 0 ? " has-slots" : "");
      dayHeader.innerHTML = `
                <span class="day-name">週${DAY_NAMES[i]}</span>
                <span class="day-date">${date.getMonth() + 1}/${date.getDate()}</span>
            `;
      header.appendChild(dayHeader);

      // 格子欄
      const col = document.createElement("div");
      col.className = "calendar-day-col";

      if (daySlots.length === 0) {
        const empty = document.createElement("div");
        empty.className = "day-empty";
        empty.textContent = "—";
        col.appendChild(empty);
      } else {
        daySlots
          .sort((a, b) => a.hour - b.hour)
          .forEach((slot) => {
            const slotString = `${slot.date} ${slot.time}`;
            const isSelected = selectedSlots.includes(slotString);

            const btn = document.createElement("button");
            btn.className = `slot-btn${slot.isBooked ? " booked" : ""}${isSelected ? " selected" : ""}`;
            btn.textContent = slot.time;
            btn.dataset.slot = slotString;

            if (!slot.isBooked) {
              btn.addEventListener("click", () => toggleSlot(slotString));
            }
            col.appendChild(btn);
          });
      }
      slotsGrid.appendChild(col);
    });

    // 滾動式 wrapper 包住 slotsGrid
    const slotsWrapper = document.createElement("div");
    slotsWrapper.className = "calendar-slots-wrapper";
    slotsWrapper.appendChild(slotsGrid);

    weekPanel.appendChild(header);
    weekPanel.appendChild(slotsWrapper);
    track.appendChild(weekPanel);
  }

  updateTrackPosition();
}

// 切換選取
function toggleSlot(slotString) {
  if (selectedSlots.includes(slotString)) {
    selectedSlots = selectedSlots.filter((s) => s !== slotString);
  } else {
    selectedSlots.push(slotString);
  }
  document.querySelectorAll(".slot-btn").forEach((btn) => {
    if (btn.dataset.slot === slotString) {
      btn.classList.toggle("selected", selectedSlots.includes(slotString));
    }
  });
  updateCartUI();
}

// 更新購物車
function updateCartUI() {
  cartList.innerHTML = "";

  if (selectedSlots.length === 0) {
    const empty = document.createElement("p");
    empty.className = "booking-cart-empty";
    empty.textContent = "尚未選擇任何時段";
    cartList.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    [...selectedSlots].sort().forEach((slot) => {
      const div = document.createElement("div");
      div.className = "booking-cart-item";

      const span = document.createElement("span");
      span.textContent = slot;

      const delBtn = document.createElement("button");
      delBtn.className = "booking-cart-del";
      delBtn.textContent = "✕";
      delBtn.onclick = () => toggleSlot(slot);

      div.appendChild(span);
      div.appendChild(delBtn);
      fragment.appendChild(div);
    });
    cartList.appendChild(fragment);
  }

  const totalCount = selectedSlots.length;
  let originalTotal = totalCount * UNIT_PRICE;
  let finalTotal = originalTotal;
  let discountTip = "";

  if (totalCount >= 10) {
    finalTotal = Math.floor(originalTotal * 0.9);
    discountTip = "🎉 已享 9 折優惠！";
  } else if (totalCount >= 5) {
    finalTotal = Math.floor(originalTotal * 0.95);
    discountTip = "🎉 已享 95 折優惠！";
  }

  document.getElementById("summary-count").textContent = totalCount;
  const summaryPriceElem = document.getElementById("summary-price");

  if (finalTotal < originalTotal) {
    summaryPriceElem.innerHTML = `
            <span style="text-decoration:line-through;color:#999;font-size:0.6em;margin-right:6px;">${originalTotal.toLocaleString()}</span>
            ${finalTotal.toLocaleString()}
            <div style="font-size:0.5em;color:#e11d48;margin-top:4px;">${discountTip}</div>
        `;
  } else {
    summaryPriceElem.textContent = finalTotal.toLocaleString();
  }

  if (totalCount > 0) {
    checkoutBtn.disabled = false;
    checkoutBtn.className = "booking-checkout-btn";
    checkoutBtn.textContent = "前往結帳 👉";
  } else {
    checkoutBtn.disabled = true;
    checkoutBtn.className =
      "booking-checkout-btn booking-checkout-btn--disabled";
    checkoutBtn.textContent = "請先選擇時段";
  }
}

function updateTrackPosition() {
  document.getElementById("calendar-track").style.transform =
    `translateX(-${currentWeek * 100}%)`;
}

function updateWeekLabel() {
  const dates = getWeekDates(currentWeek);
  const start = dates[0];
  const end = dates[6];
  const label = `${start.getMonth() + 1}/${start.getDate()} － ${end.getMonth() + 1}/${end.getDate()}`;
  document.getElementById("week-label").textContent =
    currentWeek === 0 ? `本週 ${label}` : `第 ${currentWeek + 1} 週 ${label}`;
}

function updateNavButtons() {
  document.getElementById("prev-week").disabled = currentWeek === 0;
  document.getElementById("next-week").disabled =
    currentWeek === TOTAL_WEEKS - 1;
  document.querySelectorAll(".calendar-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === currentWeek);
  });
}

document.getElementById("prev-week").addEventListener("click", () => {
  if (currentWeek > 0) {
    currentWeek--;
    updateTrackPosition();
    updateWeekLabel();
    updateNavButtons();
  }
});

document.getElementById("next-week").addEventListener("click", () => {
  if (currentWeek < TOTAL_WEEKS - 1) {
    currentWeek++;
    updateTrackPosition();
    updateWeekLabel();
    updateNavButtons();
  }
});

document.getElementById("calendar-dots").addEventListener("click", (e) => {
  if (e.target.classList.contains("calendar-dot")) {
    currentWeek = parseInt(e.target.dataset.week);
    updateTrackPosition();
    updateWeekLabel();
    updateNavButtons();
  }
});

// 🔗 【API 串接處 3】結帳
checkoutBtn.addEventListener("click", async () => {
  if (selectedSlots.length === 0) return;

  const formattedSlots = selectedSlots.map((slotStr) => {
    const [datePart, timePart] = slotStr.split(" ");
    return { date: datePart, hour: parseInt(timePart.split(":")[0], 10) };
  });

  const simulatedUserId = localStorage.getItem("userId") || 9527;
  const orderPayload = {
    courseId: parseInt(courseId),
    lessonCount: selectedSlots.length, // ← 加這行
    selectedSlots: formattedSlots,
  };

  checkoutBtn.textContent = "資料傳送中... ⏳";
  checkoutBtn.disabled = true;
  checkoutBtn.className = "booking-checkout-btn booking-checkout-btn--disabled";

  try {
    const response = await axios.post(
      `${API_BASE_URL}/shop/purchase`,
      orderPayload,
    );
    alert("🎉 " + response.data.msg);
    selectedSlots = [];
    window.location.href = "index.html"; // ← 改這行
  } catch (error) {
    if (error.response && error.response.status === 402) {
      alert("💸 結帳失敗：" + error.response.data.msg + " (請先去儲值！)");
    } else if (error.response && error.response.data) {
      alert("🚨 發生錯誤：" + error.response.data.msg);
    } else {
      alert("🚨 伺服器連線異常！");
    }
  } finally {
    updateCartUI();
  }
});
