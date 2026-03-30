// =====================================================
// booking.js — 預約頁面完整邏輯
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
const canSelectEl    = document.getElementById("canSelect");
const selectedListEl = document.getElementById("selectedList");
const totalMinutesEl = document.getElementById("totalMinutes");
const totalLessonsEl = document.getElementById("totalLessons");
const totalPointsEl  = document.getElementById("totalPoints");
const bookingBtnEl   = document.getElementById("bookingBtn");
const prevWeekBtnEl  = document.getElementById("prevWeekBtn");
const nextWeekBtnEl  = document.getElementById("nextWeekBtn");
const weekBarEl      = document.getElementById("weekBar");

// ─── 狀態 ───
let unitPrice        = 0;       // 老師課程單價
let selectedSlots    = [];      // 已選時段 [{ date, hour }]
let currentWeekIndex = 0;       // 0~3（共 4 週）
let lessonPlan       = 1;       // 購買方案：1 / 5 / 10
let walletBalance    = 0;       // 學生錢包

// 四週日期清單（Today+1 起共 28 天）
let allDates = [];

// 老師開放時段 Map：key = weekdayNumber (1~7)，value = Set<hour>
let tutorAvailableMap = {};

// 已被鎖定時段 Set：key = "YYYY-MM-DD_HH"
let lockedByOthers = new Set();

// 學生自己已約時段 Set：key = "YYYY-MM-DD_HH"
let lockedByMe = new Set();

// ─── 工具函式 ───
function padTwo(n) { return String(n).padStart(2, "0"); }

function slotKey(date, hour) { return `${date}_${padTwo(hour)}`; }

function formatDate(d) {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

// 計算折扣後單價
function discountedUnitPrice(base, count) {
  if (count === 10) return Math.floor(base * 0.9);
  if (count === 5)  return Math.floor(base * 0.95);
  return base;
}

// ─── 主函式 ───
async function booking() {
  const params   = new URLSearchParams(window.location.search);
  const tutorId  = params.get("tutorId");
  const courseId = params.get("courseId");

  if (!tutorId || !courseId) {
    showError("缺少 tutorId 或 courseId 參數，請從課程頁面進入。");
    return;
  }

  // 停用按鈕，等資料載入
  if (bookingBtnEl) bookingBtnEl.disabled = true;

  try {
    // ══════════════════════════════════════════
    // 1. 同步取得三份資料
    // ══════════════════════════════════════════
    const [coursesResp, scheduleResp, tutorBookingsResp, meBookingsResp, walletResp] =
      await Promise.allSettled([
        axios.get(`/api/view/courses`),
        axios.get(`/api/tutor/schedules/${tutorId}`),
        axios.get(`/api/shop/course/${courseId}/futurebookings`),
        axios.get(`/api/shop/me/futurebookings`),
        axios.get(`/api/users/me`),   // 可選：若無此 API 忽略
      ]);

    // ── 課程資訊 ──
    if (coursesResp.status === "fulfilled") {
      const courseList = coursesResp.value.data.content || [];
      const course = courseList.find(c => c.id === Number(courseId));
      if (course) {
        unitPrice = course.price || 0;
        if (coursePriceEl) coursePriceEl.innerText = unitPrice;
        if (courseNameEl)  courseNameEl.innerText  = course.courseName || "";
        if (tutorNameEl)   tutorNameEl.innerText   = course.teacherName || "";
      }
    }

    // ── 老師可用週期時段 ──
    // API 回傳格式：[ { weekday: 1, hour: 9, isAvailable: true }, ... ]
    if (scheduleResp.status === "fulfilled") {
      const schedules = scheduleResp.value.data || [];
      tutorAvailableMap = {};
      schedules.forEach(s => {
        if (s.isAvailable) {
          if (!tutorAvailableMap[s.weekday]) tutorAvailableMap[s.weekday] = new Set();
          tutorAvailableMap[s.weekday].add(s.hour);
        }
      });
    }

    // ── 已被他人鎖定時段 ──
    // API 回傳格式：[ { date: "2026-04-10", hour: 14 }, ... ]
    if (tutorBookingsResp.status === "fulfilled") {
      const slots = tutorBookingsResp.value.data || [];
      slots.forEach(s => lockedByOthers.add(slotKey(s.date, s.hour)));
    }

    // ── 學生自己已約時段 ──
    if (meBookingsResp.status === "fulfilled") {
      const slots = meBookingsResp.value.data || [];
      slots.forEach(s => lockedByMe.add(slotKey(s.date, s.hour)));
    }

    // ── 錢包餘額 ──
    if (walletResp.status === "fulfilled") {
      walletBalance = walletResp.value.data?.wallet ?? 0;
    }

    // ══════════════════════════════════════════
    // 2. 建立日期清單（Today+1 到 Today+28）
    // ══════════════════════════════════════════
    allDates = buildDates();

    // ══════════════════════════════════════════
    // 3. 注入購買方案選擇器
    // ══════════════════════════════════════════
    injectPlanSelector();

    // ══════════════════════════════════════════
    // 4. 渲染週列（Week Bar）
    // ══════════════════════════════════════════
    renderWeekBar();

    // ══════════════════════════════════════════
    // 5. 渲染可選時段
    // ══════════════════════════════════════════
    renderSlots();

    // ══════════════════════════════════════════
    // 6. 週切換按鈕
    // ══════════════════════════════════════════
    if (prevWeekBtnEl) {
      prevWeekBtnEl.onclick = () => {
        if (currentWeekIndex > 0) { currentWeekIndex--; renderWeekBar(); renderSlots(); }
      };
    }
    if (nextWeekBtnEl) {
      nextWeekBtnEl.onclick = () => {
        if (currentWeekIndex < 3) { currentWeekIndex++; renderWeekBar(); renderSlots(); }
      };
    }

    // ══════════════════════════════════════════
    // 7. 確定預約按鈕
    // ══════════════════════════════════════════
    if (bookingBtnEl) {
      bookingBtnEl.onclick = handlePurchase;
    }

  } catch (err) {
    console.error("booking init error:", err);
    showError("頁面初始化失敗，請重新整理後再試。");
  }
}

// ─── 建立 Today+1 起 28 天日期列表 ───
function buildDates() {
  const now = new Date();
  const list = [];

  for (let i = 1; i <= 28; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const weekdayJS = d.getDay(); // 0=Sun
    const weekday   = weekdayJS === 0 ? 7 : weekdayJS; // 1=Mon…7=Sun

    list.push({
      fullDate: formatDate(d),
      month:    d.getMonth() + 1,
      day:      d.getDate(),
      weekday,
    });
  }
  return list;
}

// ─── 注入購買方案選擇器 ───
function injectPlanSelector() {
  // 找到「✦ 已選擇的預約時間」上方插入方案區塊
  const summarySection = selectedListEl?.closest(".pb-4");
  if (!summarySection) return;

  // 移除舊方案區（避免重複插入）
  const existing = document.getElementById("planSelector");
  if (existing) existing.remove();

  const wrapper = document.createElement("div");
  wrapper.id = "planSelector";
  wrapper.className = "mb-4 border-top pt-4";
  wrapper.innerHTML = `
    <p class="ms-1 mb-3">✦ 請選擇購買方案</p>
    <div class="d-flex gap-3 flex-wrap ms-2" id="planBtns">
      ${[1, 5, 10].map(n => {
        const disc = discountedUnitPrice(unitPrice, n);
        const label = n === 1 ? '原價' : n === 5 ? '95折' : '9折';
        return `
          <button type="button"
            class="btn plan-btn ${n === lessonPlan ? 'btn-dark' : 'btn-outline-dark'} px-4 py-3 rounded-3"
            data-plan="${n}">
            <div class="fw-bold fs-5">${n} 堂</div>
            <small class="d-block">${label} · ${disc} 點/堂</small>
          </button>`;
      }).join("")}
    </div>
    <div id="walletInfo" class="ms-2 mt-3 text-muted small">
      錢包餘額：<span id="walletBalanceEl">${walletBalance}</span> 點
    </div>
  `;

  summarySection.insertAdjacentElement("beforebegin", wrapper);

  // 綁定事件
  document.querySelectorAll(".plan-btn").forEach(btn => {
    btn.onclick = () => {
      lessonPlan = Number(btn.dataset.plan);
      document.querySelectorAll(".plan-btn").forEach(b => {
        b.classList.toggle("btn-dark", b === btn);
        b.classList.toggle("btn-outline-dark", b !== btn);
      });
      // 超出方案的選擇要清除
      pruneSelection();
      updateSummary();
    };
  });
}

// ─── 渲染週列 ───
const DAY_LABEL = { 1:"一", 2:"二", 3:"三", 4:"四", 5:"五", 6:"六", 7:"日" };

function renderWeekBar() {
  if (!weekBarEl) return;
  weekBarEl.innerHTML = "";

  const start = currentWeekIndex * 7;
  const week  = allDates.slice(start, start + 7);

  week.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-dark rounded-3 flex-shrink-0";
    btn.style.width = "100px";
    btn.innerHTML = `<p class="mb-1 fw-bold">${item.month}/${item.day}</p><small>週${DAY_LABEL[item.weekday]}</small>`;
    weekBarEl.appendChild(btn);
  });

  if (prevWeekBtnEl) prevWeekBtnEl.disabled = currentWeekIndex === 0;
  if (nextWeekBtnEl) nextWeekBtnEl.disabled = currentWeekIndex === 3;
}

// ─── 渲染可選時段格子 ───
function renderSlots() {
  if (!canSelectEl) return;
  canSelectEl.innerHTML = "";

  const now        = new Date();
  const cutoff     = new Date(now.getTime() + 24 * 60 * 60 * 1000); // now + 24h

  const start      = currentWeekIndex * 7;
  const weekDates  = allDates.slice(start, start + 7);

  // 依日期列（每天一欄）
  weekDates.forEach(dateObj => {
    const availableHours = tutorAvailableMap[dateObj.weekday];
    if (!availableHours || availableHours.size === 0) return; // 老師這天沒開放

    const col = document.createElement("div");
    col.className = "col-6 col-md-3 col-lg-2 mb-4";

    const heading = document.createElement("p");
    heading.className = "fw-bold mb-2 text-center";
    heading.textContent = `${dateObj.month}/${dateObj.day} 週${DAY_LABEL[dateObj.weekday]}`;
    col.appendChild(heading);

    // 9:00 ~ 21:00
    for (let h = 9; h <= 21; h++) {
      if (!availableHours.has(h)) continue; // 老師未開放此小時

      const key = slotKey(dateObj.fullDate, h);

      // 判斷狀態
      const slotDateTime = new Date(`${dateObj.fullDate}T${padTwo(h)}:00:00`);
      const isTooSoon    = slotDateTime <= cutoff;
      const isOtherLock  = lockedByOthers.has(key);
      const isMyLock     = lockedByMe.has(key);
      const isSelected   = selectedSlots.some(s => s.date === dateObj.fullDate && s.hour === h);

      const disabled     = isTooSoon || isOtherLock || isMyLock;

      const box = document.createElement("button");
      box.type = "button";
      box.className = `btn w-100 mb-2 rounded-3 slot-btn text-start px-3 py-2 ${
        isSelected ? "btn-dark text-white" :
        disabled   ? "btn-light text-muted" :
                     "btn-outline-secondary"
      }`;
      box.disabled = disabled && !isSelected;

      let statusBadge = "";
      if (isTooSoon)   statusBadge = `<small class="d-block text-danger" style="font-size:10px">未滿24h</small>`;
      else if (isMyLock)    statusBadge = `<small class="d-block text-warning" style="font-size:10px">我已有課</small>`;
      else if (isOtherLock) statusBadge = `<small class="d-block text-secondary" style="font-size:10px">已被預約</small>`;

      box.innerHTML = `
        <span class="fw-bold">${padTwo(h)}:00</span>
        ${statusBadge}
      `;

      if (!disabled) {
        box.onclick = () => toggleSlot(dateObj.fullDate, h, box);
      }

      col.appendChild(box);
    }

    canSelectEl.appendChild(col);
  });

  // 若整週老師都沒開放
  if (canSelectEl.childElementCount === 0) {
    canSelectEl.innerHTML = `<p class="text-muted ms-2">本週老師尚未開放任何時段。</p>`;
  }
}

// ─── 切換時段選取 ───
function toggleSlot(date, hour, btn) {
  const idx = selectedSlots.findIndex(s => s.date === date && s.hour === hour);

  if (idx !== -1) {
    // 取消選取
    selectedSlots.splice(idx, 1);
    btn.className = btn.className.replace("btn-dark text-white", "btn-outline-secondary");
  } else {
    // 已達方案上限 → 不允許繼續選
    if (selectedSlots.length >= lessonPlan) {
      alert(`目前方案最多選 ${lessonPlan} 堂，請先調整購買方案或取消其他時段。`);
      return;
    }
    selectedSlots.push({ date, hour });
    btn.className = btn.className.replace("btn-outline-secondary", "btn-dark text-white");
  }

  updateSummary();
}

// ─── 超出方案上限時清除多餘選擇 ───
function pruneSelection() {
  if (selectedSlots.length > lessonPlan) {
    selectedSlots = selectedSlots.slice(0, lessonPlan);
    renderSlots(); // 重繪以清除視覺高亮
  }
}

// ─── 更新右側摘要 ───
function updateSummary() {
  const count    = selectedSlots.length;
  const uPrice   = discountedUnitPrice(unitPrice, lessonPlan);
  const total    = uPrice * count;

  if (totalLessonsEl) totalLessonsEl.innerText = count;
  if (totalMinutesEl) totalMinutesEl.innerText = count * 60;
  if (totalPointsEl)  totalPointsEl.innerText  = total;

  // 更新折扣後單價顯示
  if (coursePriceEl) coursePriceEl.innerText = uPrice;

  // 已選清單
  if (selectedListEl) {
    selectedListEl.innerHTML = "";
    if (count === 0) {
      selectedListEl.innerHTML = `<p class="text-muted">尚未選擇任何時段</p>`;
    } else {
      selectedSlots.forEach(s => {
        const tag = document.createElement("div");
        tag.className = "col-auto";
        tag.innerHTML = `
          <span class="badge bg-dark fs-6 px-3 py-2">
            ${s.date} ${padTwo(s.hour)}:00
          </span>`;
        selectedListEl.appendChild(tag);
      });
    }
  }

  // 按鈕狀態
  if (!bookingBtnEl) return;

  const isMismatch     = count !== lessonPlan;
  const isInsufficient = total > walletBalance && walletBalance > 0;

  if (isInsufficient) {
    bookingBtnEl.disabled = false;
    bookingBtnEl.className = "btn btn-warning border border-1 p-3 w-100";
    bookingBtnEl.innerHTML = `<p class="mb-0 px-5 nunito">餘額不足，請儲值</p>`;
    bookingBtnEl.onclick = () => { window.location.href = "wallet.html"; };
  } else if (count === 0 || isMismatch) {
    bookingBtnEl.disabled = true;
    bookingBtnEl.className = "btn btn-success border border-1 p-3 w-100";
    bookingBtnEl.innerHTML = `<p class="mb-0 px-5 nunito">請選擇 ${lessonPlan} 個時段（已選 ${count}）</p>`;
    bookingBtnEl.onclick = null;
  } else {
    bookingBtnEl.disabled = false;
    bookingBtnEl.className = "btn btn-success border border-1 p-3 w-100";
    bookingBtnEl.innerHTML = `<p class="mb-0 px-5 nunito">確定預約</p>`;
    bookingBtnEl.onclick = handlePurchase;
  }
}

// ─── 送出預約 ───
async function handlePurchase() {
  const params   = new URLSearchParams(window.location.search);
  const courseId = params.get("courseId");

  if (selectedSlots.length !== lessonPlan) {
    alert(`請選擇 ${lessonPlan} 個時段（目前已選 ${selectedSlots.length} 個）`);
    return;
  }

  const payload = {
    courseId:      Number(courseId),
    lessonCount:   lessonPlan,
    selectedSlots: selectedSlots.map(s => ({ date: s.date, hour: s.hour })),
  };

  bookingBtnEl.disabled = true;
  bookingBtnEl.innerHTML = `<p class="mb-0 px-5 nunito">預約中…</p>`;

  try {
    const resp = await axios.post("/api/shop/purchase", payload);
    alert("🎉 " + (resp.data.msg || "購買並預約成功！"));
    window.location.href = "my-bookings.html";
  } catch (err) {
    const msg = err.response?.data?.msg || "預約失敗，請稍後再試。";
    const action = err.response?.data?.action;

    if (action === "recharge") {
      if (confirm("餘額不足，是否前往儲值？")) {
        window.location.href = "wallet.html";
      }
    } else {
      alert("❌ " + msg);
    }

    bookingBtnEl.disabled = false;
    updateSummary();
  }
}

// ─── 錯誤提示 ───
function showError(msg) {
  if (canSelectEl) {
    canSelectEl.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
  }
}

// ─── 啟動 ───
booking();
