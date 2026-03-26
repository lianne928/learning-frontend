// ==========================================
// 行程與排課頁面邏輯 (teacher-schedule.js)
// 包含：行程、課表管理、課程管理
// ==========================================

const tutorId = localStorage.getItem("userId");

const DAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];
const MONTH_NAMES = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

const SUBJECT_NAMES = {
  11: "低年級", 12: "中年級", 13: "高年級",
  21: "GEPT", 22: "YLE", 23: "國中先修", 31: "其他"
};

let bookings = [];
let scheduleMap = {};
let pendingMap = {};
let isEditMode = false;
let currentWeekOffset = 0;
const MAX_WEEK = 4;

// 分頁設定
const PAGE_SIZE = 10;
let currentPage = 1;
let upcomingList = [];

// 課程列表
let courses = [];

// ══════════════════════════════════════════
// 頁籤切換
// ══════════════════════════════════════════
document.querySelectorAll(".schedule-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".schedule-tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    
    // 切換到課程管理時，載入課程列表
    if (btn.dataset.tab === 'courses') {
      loadCourses();
    }
  });
});

// ══════════════════════════════════════════
// 行程相關函數
// ══════════════════════════════════════════

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateStr(b) {
  return Array.isArray(b.date)
    ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
    : b.date;
}

function renderWeekGrid() {
  const weekDates = getWeekDates(currentWeekOffset);
  const todayStr = formatDate(new Date());
  const grid = document.getElementById("week-grid");
  grid.innerHTML = "";

  weekDates.forEach((date, i) => {
    const dateStr = formatDate(date);
    const isToday = dateStr === todayStr;

    const col = document.createElement("div");
    col.className = "week-day-col";

    const header = document.createElement("div");
    header.className = "week-day-header" + (isToday ? " is-today" : "");
    header.innerHTML = `
            <span class="day-name">週${DAY_NAMES[i]}</span>
            <span class="day-date">${date.getMonth() + 1}/${date.getDate()}</span>
        `;
    col.appendChild(header);

    const dayBookings = bookings
      .filter((b) => parseDateStr(b) === dateStr && b.slotLocked === true)
      .sort((a, b) => a.hour - b.hour);

    if (dayBookings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "day-empty-slot";
      empty.textContent = "—";
      col.appendChild(empty);
    } else {
      dayBookings.forEach((b) => {
        const slot = document.createElement("div");
        const slotTime = new Date(
          `${dateStr}T${String(b.hour).padStart(2, "0")}:00:00`,
        );
        const isPast = slotTime < new Date();
        const isCompleted = b.status === 2;
        const isLeave = b.status === 3;
        
        slot.className = `booking-slot${isPast || isCompleted ? " booking-slot--done" : ""}${isLeave ? " booking-slot--leave" : ""}`;
        slot.innerHTML = `
            ${String(b.hour).padStart(2, "0")}:00 ${b.studentName || "學生 #" + b.studentId}
            ${isLeave ? '<span style="font-size:0.6rem; display:block;">請假</span>' : ""}
            ${isPast || isCompleted ? '<span style="font-size:0.6rem; display:block;">課程完成</span>' : ""}
          `;
        col.appendChild(slot);
      });
    }
    grid.appendChild(col);
  });

  const start = weekDates[0];
  const end = weekDates[6];
  const label = `${start.getMonth() + 1}/${start.getDate()} － ${end.getMonth() + 1}/${end.getDate()}`;
  document.getElementById("week-label").textContent =
    currentWeekOffset === 0 ? `本週 ${label}` : label;

  document.getElementById("prev-week").disabled = currentWeekOffset <= -MAX_WEEK;
  document.getElementById("next-week").disabled = currentWeekOffset >= MAX_WEEK;
}

function renderUpcomingList() {
  const container = document.getElementById("upcoming-list");
  const now = new Date();

  upcomingList = bookings
    .filter((b) => {
      if (!b.slotLocked) return false;
      const dateStr = parseDateStr(b);
      const slotTime = new Date(
        `${dateStr}T${String(b.hour).padStart(2, "0")}:00:00`,
      );
      return slotTime >= now;
    })
    .map((b) => ({ ...b, dateStr: parseDateStr(b) }))
    .sort((a, b) => {
      const ta = new Date(`${a.dateStr}T${String(a.hour).padStart(2, "0")}:00:00`);
      const tb = new Date(`${b.dateStr}T${String(b.hour).padStart(2, "00")}:00:00`);
      return ta - tb;
    });

  document.getElementById("upcoming-count").textContent = `${upcomingList.length} 筆`;
  renderUpcomingPage(1);
}

function renderUpcomingPage(page) {
  currentPage = page;
  const container = document.getElementById("upcoming-list");
  const totalPages = Math.ceil(upcomingList.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = upcomingList.slice(start, end);

  if (upcomingList.length === 0) {
    container.innerHTML = `
            <div class="text-center py-5" style="color:#94a3b8;">
                <span class="material-symbols-outlined d-block mb-2" style="font-size:40px; opacity:0.3;">event_available</span>
                <p class="mb-0 fw-bold">近期沒有預約課程</p>
            </div>
        `;
    return;
  }

  let html = '<div class="upcoming-grid">';

  pageData.forEach((b) => {
    const slotTime = new Date(`${b.dateStr}T${String(b.hour).padStart(2, "0")}:00:00`);
    const diffMin = (slotTime - new Date()) / 60000;
    const isSoon = diffMin > 0 && diffMin <= 60;
    const isLeave = b.status === 3;
    const month = parseInt(b.dateStr.split("-")[1]);
    const day = parseInt(b.dateStr.split("-")[2]);

    const statusBadge = isLeave
    ? `<span class="booking-status-badge" style="background:#FEF2F2; color:#DC2626; border-radius:20px; font-size:0.72rem; font-weight:700; padding:3px 10px;">✕ 請假</span>`
    : isSoon
        ? `<span class="booking-status-badge status-soon">⚡ 即將開始</span>`
        : `<span class="booking-status-badge status-scheduled">● 已排課</span>`;

    html += `
            <div class="upcoming-grid-item">
                <div class="upcoming-grid-date">
                    <span class="badge-month">${MONTH_NAMES[month - 1]}</span>
                    <span class="badge-day">${day}</span>
                </div>
                <div class="upcoming-grid-info">
                    <div class="upcoming-grid-course">${b.courseName || "課程"}</div>
                    <div class="upcoming-grid-student">
                        <span class="material-symbols-outlined" style="font-size:14px;">person</span>
                        學生：${b.studentName || "學生 #" + b.studentId}
                    </div>
                    <div class="upcoming-grid-meta">
                        <span>
                            <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
                            ${String(b.hour).padStart(2, "0")}:00 - ${String(b.hour + 1).padStart(2, "0")}:00
                        </span>
                        ${statusBadge}
                    </div>
                </div>
            </div>
        `;
  });

  html += "</div>";

  if (totalPages > 1) {
    html += '<div class="upcoming-pagination">';
    for (let i = 1; i <= totalPages; i++) {
      html += `
                <button class="page-btn${i === currentPage ? " active" : ""}" onclick="renderUpcomingPage(${i})">
                    ${i}
                </button>
            `;
    }
    html += "</div>";
  }

  container.innerHTML = html;
}

// ══════════════════════════════════════════
// 課表管理相關函數
// ══════════════════════════════════════════

function renderScheduleGrid() {
  const container = document.getElementById("schedule-grid-table");
  container.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "sg-header";
  container.appendChild(corner);

  DAY_NAMES.forEach((name) => {
    const h = document.createElement("div");
    h.className = "sg-header";
    h.textContent = `週${name}`;
    container.appendChild(h);
  });

  HOURS.forEach((hour) => {
    const timeLabel = document.createElement("div");
    timeLabel.className = "sg-time-label";
    timeLabel.textContent = `${String(hour).padStart(2, "0")}:00`;
    container.appendChild(timeLabel);

    for (let weekday = 1; weekday <= 7; weekday++) {
      const key = `${weekday}-${hour}`;
      const isAvailable = !!scheduleMap[key];
      const isPending = key in pendingMap;
      const displayState = isPending ? pendingMap[key] : isAvailable;

      const cell = document.createElement("div");
      cell.dataset.weekday = weekday;
      cell.dataset.hour = hour;
      cell.dataset.key = key;

      updateCellClass(cell, displayState, isPending);

      if (isEditMode) {
        cell.addEventListener("click", () =>
          onCellClick(cell, weekday, hour, key),
        );
      }
      container.appendChild(cell);
    }
  });
}

function updateCellClass(cell, isOn, isPending) {
  cell.className = "sg-cell";
  if (isPending) {
    cell.classList.add(isOn ? "pending-on" : "pending-off");
  } else {
    if (isOn) cell.classList.add("available");
    if (!isEditMode) cell.classList.add("readonly");
  }
}

function onCellClick(cell, weekday, hour, key) {
  const originalState = !!scheduleMap[key];
  const currentPending = key in pendingMap ? pendingMap[key] : originalState;
  const newState = !currentPending;

  if (newState === originalState) {
    delete pendingMap[key];
  } else {
    pendingMap[key] = newState;
  }

  updateCellClass(cell, newState, key in pendingMap);
}

function enterEditMode() {
  isEditMode = true;
  pendingMap = {};

  document.getElementById("schedule-hint").textContent =
    "點擊格子切換開放狀態，完成後按「儲存設定」。";
  document.getElementById("legend-pending").style.display = "";

  document.getElementById("schedule-btn-group").innerHTML = `
        <button class="btn-teacher me-2" id="btn-save-schedule">
            <span class="material-symbols-outlined" style="font-size:16px;">save</span>
            儲存設定
        </button>
        <button class="btn btn-outline-secondary btn-sm fw-bold" id="btn-cancel-schedule">
            取消
        </button>
    `;

  document.getElementById("btn-save-schedule").addEventListener("click", saveSchedule);
  document.getElementById("btn-cancel-schedule").addEventListener("click", cancelEdit);

  renderScheduleGrid();
}

function cancelEdit() {
  isEditMode = false;
  pendingMap = {};

  document.getElementById("schedule-hint").textContent =
    "點擊「編輯課表」開始設定開放時段。";
  document.getElementById("legend-pending").style.display = "none";

  document.getElementById("schedule-btn-group").innerHTML = `
        <button class="btn-teacher" id="btn-edit-schedule">
            <span class="material-symbols-outlined" style="font-size:16px;">edit_calendar</span>
            編輯課表
        </button>
    `;
  document.getElementById("btn-edit-schedule").addEventListener("click", enterEditMode);

  renderScheduleGrid();
}

async function saveSchedule() {
  const changes = Object.entries(pendingMap);
  if (changes.length === 0) {
    cancelEdit();
    return;
  }

  const saveBtn = document.getElementById("btn-save-schedule");
  saveBtn.disabled = true;
  saveBtn.textContent = "儲存中...";

  try {
    await Promise.all(
      changes.map(([key, isAvailable]) => {
        const [weekday, hour] = key.split("-").map(Number);
        return axios.post(`${API_BASE_URL}/tutor/schedules/toggle`, {
          tutorId: parseInt(tutorId),
          weekday: weekday,
          hour: hour,
          isAvailable: isAvailable,
        });
      }),
    );

    changes.forEach(([key, isAvailable]) => {
      if (isAvailable) {
        scheduleMap[key] = true;
      } else {
        delete scheduleMap[key];
      }
    });

    alert(`✅ 已成功更新 ${changes.length} 個時段！`);
    cancelEdit();
  } catch (err) {
    console.error("儲存失敗：", err);
    alert("❌ 儲存失敗，請稍後再試");
    saveBtn.disabled = false;
    saveBtn.textContent = "儲存設定";
  }
}

// ══════════════════════════════════════════
// 課程管理相關函數
// ══════════════════════════════════════════

async function loadCourses() {
  const container = document.getElementById("courses-list");
  container.innerHTML = '<div class="text-center text-muted py-4">⏳ 載入中...</div>';

  try {
    const response = await axios.get(`${API_BASE_URL}/tutor/me/courses`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
    });
    
    courses = response.data;
    renderCoursesList();
  } catch (err) {
    console.error("載入課程失敗：", err);
    container.innerHTML = '<div class="text-center text-danger py-4">❌ 載入失敗</div>';
  }
}

function renderCoursesList() {
  const container = document.getElementById("courses-list");
  
  if (courses.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5" style="color:#94a3b8;">
        <span class="material-symbols-outlined d-block mb-3" style="font-size:48px; opacity:0.3;">school</span>
        <p class="mb-0 fw-bold">尚未建立任何課程</p>
        <p class="small text-muted">點擊「新增課程」開始建立第一堂課</p>
      </div>
    `;
    return;
  }

  let html = '<div class="row g-3">';
  
  courses.forEach(course => {
    const statusBadge = course.isActive 
      ? '<span class="badge bg-success">啟用中</span>'
      : '<span class="badge bg-secondary">已停用</span>';
    
    html += `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${course.name}</h5>
              ${statusBadge}
            </div>
            <p class="text-muted small mb-2">
              <span class="badge bg-light text-dark">${SUBJECT_NAMES[course.subject] || course.subject}</span>
            </p>
            <p class="card-text small text-muted mb-3">${course.description.substring(0, 80)}${course.description.length > 80 ? '...' : ''}</p>
            <div class="d-flex justify-content-between align-items-center">
              <span class="fw-bold text-primary">NT$ ${course.price}</span>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="editCourse(${course.id})">
                  <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                </button>
                <button class="btn btn-outline-danger" onclick="deleteCourse(${course.id}, '${course.name}')">
                  <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function openCourseModal(course = null) {
  const modal = new bootstrap.Modal(document.getElementById('courseModal'));
  const form = document.getElementById('courseForm');
  form.reset();
  
  if (course) {
    // 編輯模式
    document.getElementById('courseModalTitle').textContent = '編輯課程';
    document.getElementById('courseId').value = course.id;
    document.getElementById('courseName').value = course.name;
    document.getElementById('courseSubject').value = course.subject;
    document.getElementById('coursePrice').value = course.price;
    document.getElementById('courseDescription').value = course.description;
    document.getElementById('courseIsActive').checked = course.isActive;
  } else {
    // 新增模式
    document.getElementById('courseModalTitle').textContent = '新增課程';
    document.getElementById('courseId').value = '';
    document.getElementById('courseIsActive').checked = true;
  }
  
  modal.show();
}

async function saveCourse() {
  const form = document.getElementById('courseForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const courseId = document.getElementById('courseId').value;
  const payload = {
    name: document.getElementById('courseName').value.trim(),
    subject: parseInt(document.getElementById('courseSubject').value),
    price: parseInt(document.getElementById('coursePrice').value),
    description: document.getElementById('courseDescription').value.trim(),
    isActive: document.getElementById('courseIsActive').checked
  };
  
  const saveBtn = document.getElementById('btn-save-course');
  saveBtn.disabled = true;
  saveBtn.textContent = '儲存中...';
  
  try {
    if (courseId) {
      // 更新
      await axios.put(`${API_BASE_URL}/tutor/me/courses/${courseId}`, payload, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
      });
      alert('✅ 課程已更新！');
    } else {
      // 新增
      await axios.post(`${API_BASE_URL}/tutor/me/courses`, payload, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
      });
      alert('✅ 課程已新增！');
    }
    
    bootstrap.Modal.getInstance(document.getElementById('courseModal')).hide();
    await loadCourses();
  } catch (err) {
    console.error("儲存課程失敗：", err);
    alert('❌ 儲存失敗：' + (err.response?.data?.msg || '請稍後再試'));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '儲存';
  }
}

async function editCourse(courseId) {
  const course = courses.find(c => c.id === courseId);
  if (course) {
    openCourseModal(course);
  }
}

async function deleteCourse(courseId, courseName) {
  if (!confirm(`確定要刪除課程「${courseName}」嗎？\n此操作無法復原！`)) {
    return;
  }
  
  try {
    await axios.delete(`${API_BASE_URL}/tutor/me/courses/${courseId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
    });
    alert('✅ 課程已刪除！');
    await loadCourses();
  } catch (err) {
    console.error("刪除課程失敗：", err);
    alert('❌ 刪除失敗：' + (err.response?.data?.msg || '請稍後再試'));
  }
}

// ══════════════════════════════════════════
// 週切換
// ══════════════════════════════════════════

document.getElementById("prev-week").addEventListener("click", () => {
  if (currentWeekOffset > -MAX_WEEK) {
    currentWeekOffset--;
    renderWeekGrid();
  }
});

document.getElementById("next-week").addEventListener("click", () => {
  if (currentWeekOffset < MAX_WEEK) {
    currentWeekOffset++;
    renderWeekGrid();
  }
});

// ══════════════════════════════════════════
// 頁面初始化
// ══════════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  if (!tutorId) return;

  // 綁定編輯課表按鈕
  document.getElementById("btn-edit-schedule").addEventListener("click", enterEditMode);
  
  // 綁定新增課程按鈕
  document.getElementById("btn-add-course").addEventListener("click", () => openCourseModal());
  
  // 綁定儲存課程按鈕
  document.getElementById("btn-save-course").addEventListener("click", saveCourse);

  try {
    const [bookRes, schedRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`),
      axios.get(`${API_BASE_URL}/tutor/schedules/${tutorId}`),
    ]);

    bookings = bookRes.data;

    scheduleMap = {};
    schedRes.data.forEach((s) => {
      if (s.isAvailable) scheduleMap[`${s.weekday}-${s.hour}`] = true;
    });

    renderWeekGrid();
    renderUpcomingList();
    renderScheduleGrid();
  } catch (err) {
    console.error("載入資料失敗：", err);
  }
});