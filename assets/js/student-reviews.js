// ==========================================
// 報告與評價頁面邏輯 (student-reviews.js)
// ==========================================

const tutorId = localStorage.getItem("userId");

let allReviews = [];
let courses = [];
let bookings = [];
let currentFeedbackBookingId = null;
let currentFeedbackId = null; // 如果已有回饋則存 id，用來判斷是 POST 還是 PUT

// 各項評分的暫存值
const scores = { focus: 0, comprehension: 0, confidence: 0 };

// ── 分頁切換 ──
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
  });
});

// ── 產生星星 HTML ──
function renderStars(rating) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating;
    html += `<span class="material-symbols-outlined" style="font-size:18px; color:${filled ? "#F59E0B" : "#E2E8F0"}; font-variation-settings:'FILL' ${filled ? 1 : 0},'wght' 400;">star</span>`;
  }
  return html;
}

// ── 格式化時間 ──
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

// ── 解析 booking date ──
function parseDateStr(b) {
  return Array.isArray(b.date)
    ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
    : b.date;
}

// ==========================================
// 學生評價相關
// ==========================================

function updateOverallStats() {
  if (allReviews.length === 0) {
    document.getElementById("stat-avg").textContent = "—";
    document.getElementById("stat-total").textContent = "0";
    document.getElementById("stat-good").textContent = "—";
    return;
  }
  const total = allReviews.length;
  const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1);
  const goodPct = Math.round(
    (allReviews.filter((r) => r.rating >= 4).length / total) * 100,
  );

  document.getElementById("stat-avg").textContent = avg;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-good").textContent = goodPct;
}

function renderCourseTabs(selectedCourseId) {
  const container = document.getElementById("course-tabs");
  container.innerHTML = courses
    .map(
      (c) => `
        <button class="course-tab-chip${c.id === selectedCourseId ? " active" : ""}"
            onclick="selectCourse(${c.id}, '${c.courseName}')">
            ${c.courseName}
        </button>
    `,
    )
    .join("");
}

async function selectCourse(courseId, courseName) {
  renderCourseTabs(courseId);
  document.getElementById("current-course-name").textContent = courseName;

  const reviewsList = document.getElementById("reviews-list");
  const avgBar = document.getElementById("course-avg-bar");
  reviewsList.innerHTML =
    '<div class="text-center text-muted py-4">⏳ 載入評價中...</div>';
  avgBar.style.display = "none";

  try {
    const [reviewsRes, avgRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/reviews/course/${courseId}`),
      axios.get(`${API_BASE_URL}/reviews/course/${courseId}/average-rating`),
    ]);

    const reviews = reviewsRes.data;
    const avgRating = avgRes.data.averageRating || 0;

    avgBar.style.display = "";
    document.getElementById("course-avg-score").textContent =
      avgRating.toFixed(1);
    document.getElementById("course-stars").innerHTML = renderStars(
      Math.round(avgRating),
    );
    document.getElementById("course-review-count").textContent =
      `${reviews.length} 則評價`;

    if (reviews.length === 0) {
      reviewsList.innerHTML = `
                <div class="text-center py-4" style="color:#94a3b8;">
                    <span class="material-symbols-outlined d-block mb-2" style="font-size:36px; opacity:0.3;">rate_review</span>
                    <p class="mb-0 fw-bold">這堂課還沒有評價</p>
                </div>
            `;
      return;
    }

    reviewsList.innerHTML = reviews
      .map(
        (r) => `
            <div class="review-item">
                <div class="review-header">
                    <div class="review-student">
                        <div class="review-avatar">${(r.student?.name || "學")[0]}</div>
                        <div>
                            <div class="review-name">${r.student?.name || "匿名學生"}</div>
                            <div class="review-date">${formatDate(r.updatedAt)}</div>
                        </div>
                    </div>
                    <div class="review-stars">
                        ${renderStars(r.rating)}
                        <span class="review-rating-num">${r.rating}.0</span>
                    </div>
                </div>
                ${r.comment ? `<p class="review-comment">${r.comment}</p>` : ""}
            </div>
        `,
      )
      .join("");
  } catch (err) {
    console.error("載入評價失敗：", err);
    reviewsList.innerHTML =
      '<div class="text-center text-danger py-4">❌ 無法載入評價資料</div>';
  }
}

// ==========================================
// 課後回饋相關
// ==========================================

function renderFeedbackCourseTabs(selectedCourseId) {
  const container = document.getElementById("feedback-course-tabs");
  container.innerHTML = courses
    .map(
      (c) => `
        <button class="course-tab-chip${c.id === selectedCourseId ? " active" : ""}"
            onclick="selectFeedbackCourse(${c.id}, '${c.courseName}')">
            ${c.courseName}
        </button>
    `,
    )
    .join("");
}

async function selectFeedbackCourse(courseId, courseName) {
  renderFeedbackCourseTabs(courseId);

  const container = document.getElementById("completed-bookings-list");
  container.innerHTML =
    '<div class="text-center text-muted py-4">⏳ 載入中...</div>';

  // 過濾出此課程已完成的預約（status=2）
  const completed = bookings.filter((b) => {
    // 從 orderId 找課程，這裡用 courseName 比對（簡化）
    return (
      b.slotLocked === true && b.status === 2 && b.courseName === courseName
    );
  });

  if (completed.length === 0) {
    container.innerHTML = `
            <div class="text-center py-4" style="color:#94a3b8;">
                <span class="material-symbols-outlined d-block mb-2" style="font-size:36px; opacity:0.3;">event_available</span>
                <p class="mb-0 fw-bold">這堂課還沒有已完成的課程</p>
            </div>
        `;
    return;
  }

  // 查詢每筆 booking 有沒有已填的回饋
  const feedbackChecks = await Promise.all(
    completed.map((b) =>
      axios
        .get(`${API_BASE_URL}/feedbacks/lesson/${b.id}`)
        .then((res) => ({ bookingId: b.id, feedbacks: res.data }))
        .catch(() => ({ bookingId: b.id, feedbacks: [] })),
    ),
  );

  const feedbackMap = {};
  feedbackChecks.forEach((f) => {
    feedbackMap[f.bookingId] = f.feedbacks;
  });

  container.innerHTML =
    `<div class="upcoming-grid">` +
    completed
      .sort((a, b) => {
        const da = parseDateStr(a),
          db = parseDateStr(b);
        return da > db ? -1 : 1; // 最新的在前
      })
      .map((b) => {
        const dateStr = parseDateStr(b);
        const hasFeedback = feedbackMap[b.id]?.length > 0;
        const feedback = hasFeedback ? feedbackMap[b.id][0] : null;

        return `
            <div class="upcoming-grid-item">
                <div class="upcoming-grid-date">
                    <span class="badge-month">${dateStr.split("-")[1]}月</span>
                    <span class="badge-day">${parseInt(dateStr.split("-")[2])}</span>
                </div>
                <div class="upcoming-grid-info">
                    <div class="upcoming-grid-course">${b.studentName || "學生 #" + b.studentId}</div>
                    <div class="upcoming-grid-student">
                        <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
                        ${String(b.hour).padStart(2, "0")}:00 - ${String(b.hour + 1).padStart(2, "0")}:00・${dateStr}
                    </div>
                </div>
                <div style="margin-left:auto;">
                    ${
                      hasFeedback
                        ? `<span class="feedback-done-badge">✅ 已填寫</span>
                           <button class="btn-student ms-2" style="font-size:0.78rem; padding:6px 12px;"
                               onclick="openFeedbackModal(${b.id}, '${b.studentName || "學生"}', '${dateStr}', ${b.hour}, ${feedback.id}, ${feedback.focusScore}, ${feedback.comprehensionScore}, ${feedback.confidenceScore}, \`${(feedback.comment || "").replace(/\`/g, "'")}\`)">
                               修改
                           </button>`
                        : `<button class="btn-student" style="font-size:0.78rem; padding:6px 12px;"
                               onclick="openFeedbackModal(${b.id}, '${b.studentName || "學生"}', '${dateStr}', ${b.hour})">
                               <span class="material-symbols-outlined" style="font-size:14px;">edit</span>
                               填寫回饋
                           </button>`
                    }
                </div>
            </div>
        `;
      })
      .join("") +
    `</div>`;
}

// ── 開啟回饋 Modal ──
function openFeedbackModal(
  bookingId,
  studentName,
  dateStr,
  hour,
  feedbackId = null,
  focus = 0,
  comprehension = 0,
  confidence = 0,
  comment = "",
) {
  currentFeedbackBookingId = bookingId;
  currentFeedbackId = feedbackId;

  document.getElementById("modal-booking-info").textContent =
    `${studentName}・${dateStr} ${String(hour).padStart(2, "0")}:00`;

  // 設定評分
  scores.focus = focus;
  scores.comprehension = comprehension;
  scores.confidence = confidence;

  renderScoreGroup("score-focus", "focus", focus);
  renderScoreGroup("score-comprehension", "comprehension", comprehension);
  renderScoreGroup("score-confidence", "confidence", confidence);

  document.getElementById("feedback-comment").value = comment;

  new bootstrap.Modal(document.getElementById("feedbackModal")).show();
}

// ── 渲染評分按鈕組 ──
function renderScoreGroup(containerId, scoreKey, currentVal) {
  const container = document.getElementById(containerId);
  container.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (n) => `
        <button class="score-btn${n <= currentVal ? " active" : ""}"
            onclick="setScore('${scoreKey}', ${n}, '${containerId}')">
            ${n}
        </button>
    `,
    )
    .join("");
}

// ── 設定評分 ──
function setScore(key, val, containerId) {
  scores[key] = val;
  renderScoreGroup(containerId, key, val);
}

// ── 送出回饋 ──
document
  .getElementById("btn-submit-feedback")
  .addEventListener("click", async () => {
    if (!scores.focus || !scores.comprehension || !scores.confidence) {
      alert("請填寫所有評分項目！");
      return;
    }

    const payload = {
      bookingId: currentFeedbackBookingId,
      focusScore: scores.focus,
      comprehensionScore: scores.comprehension,
      confidenceScore: scores.confidence,
      comment: document.getElementById("feedback-comment").value,
    };

    const btn = document.getElementById("btn-submit-feedback");
    btn.disabled = true;
    btn.textContent = "送出中...";

    try {
      if (currentFeedbackId) {
        // 已有回饋 → PUT 修改
        await axios.put(
          `${API_BASE_URL}/feedbacks/${currentFeedbackId}`,
          payload,
        );
      } else {
        // 新增 → POST
        await axios.post(`${API_BASE_URL}/feedbacks`, payload);
      }

      alert("✅ 課後回饋已儲存！");
      bootstrap.Modal.getInstance(
        document.getElementById("feedbackModal"),
      ).hide();

      // 重新載入目前選取的課程
      const activeTab = document.querySelector(
        "#feedback-course-tabs .course-tab-chip.active",
      );
      if (activeTab) activeTab.click();
    } catch (err) {
      console.error("送出失敗：", err);
      alert("❌ 送出失敗，請稍後再試");
    } finally {
      btn.disabled = false;
      btn.textContent = "送出回饋";
      btn.innerHTML =
        '<span class="material-symbols-outlined" style="font-size:16px;">send</span> 送出回饋';
    }
  });

// ==========================================
// 頁面初始化
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!tutorId) return;

  try {
    // 同時取得課程和預約資料
    const [coursesRes, bookingsRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/view/courses`),
      axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`),
    ]);

    const allCourses = coursesRes.data.content;
    courses = allCourses.filter((c) => String(c.tutorId) === String(tutorId));
    bookings = bookingsRes.data;

    if (courses.length === 0) {
      document.getElementById("course-tabs").innerHTML =
        '<p class="text-muted small">目前沒有課程</p>';
      document.getElementById("feedback-course-tabs").innerHTML =
        '<p class="text-muted small">目前沒有課程</p>';
      return;
    }

    // 取得所有評價（整體統計用）
    const reviewPromises = courses.map((c) =>
      axios
        .get(`${API_BASE_URL}/reviews/course/${c.id}`)
        .then((res) => res.data)
        .catch(() => []),
    );
    const allReviewsArr = await Promise.all(reviewPromises);
    allReviews = allReviewsArr.flat();

    updateOverallStats();

    // 渲染課程按鈕，預設選第一個
    renderCourseTabs(courses[0].id);
    selectCourse(courses[0].id, courses[0].courseName);

    renderFeedbackCourseTabs(courses[0].id);
    selectFeedbackCourse(courses[0].id, courses[0].courseName);
  } catch (err) {
    console.error("初始化失敗：", err);
  }
});
