// ==========================================
// 課程管理頁面邏輯 (student-courses.js)
// ==========================================

const tutorId = localStorage.getItem('userId');

let bookings = [];
let courses  = [];

// 卡片背景顏色循環
const CARD_COLORS = [
    { bg: '#FFF9C4', border: '#F9E04B', accent: '#E6A817' },
    { bg: '#D4F5E9', border: '#52C99A', accent: '#1A8F5E' },
    { bg: '#D6E9FF', border: '#5BA4F5', accent: '#1A5DB0' },
    { bg: '#FFE4F0', border: '#F97BB0', accent: '#C42E72' },
    { bg: '#EDE0FF', border: '#A97EF5', accent: '#6A2DB0' },
];

// ── 分頁切換 ──
document.querySelectorAll('.schedule-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.schedule-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// ── 解析 booking date ──
function parseDateStr(b) {
    return Array.isArray(b.date)
        ? `${b.date[0]}-${String(b.date[1]).padStart(2,'0')}-${String(b.date[2]).padStart(2,'0')}`
        : b.date;
}

// ==========================================
// 分頁一：課程卡片
// ==========================================

function renderCourseCards() {
    const container = document.getElementById('course-cards-container');

    // 依「課程名稱 + 學生ID」分組
    const groups = {};
    bookings.forEach(b => {
        const key = `${b.courseName}__${b.studentId}`;
        if (!groups[key]) {
            groups[key] = {
                courseName:  b.courseName,
                studentId:   b.studentId,
                studentName: b.studentName || '學生 #' + b.studentId,
                bookings:    []
            };
        }
        groups[key].bookings.push(b);
    });

    const groupList = Object.values(groups);

    if (groupList.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5" style="color:#94a3b8; grid-column: span 2;">
                <span class="material-symbols-outlined d-block mb-2" style="font-size:40px; opacity:0.3;">menu_book</span>
                <p class="mb-0 fw-bold">目前沒有課程預約</p>
            </div>
        `;
        return;
    }

    container.innerHTML = groupList.map((g, idx) => {
        const color    = CARD_COLORS[idx % CARD_COLORS.length];
        const total    = g.bookings.length;
        const done     = g.bookings.filter(b => b.status === 2).length;
        const leave    = g.bookings.filter(b => b.status === 3).length;
        const remaining = total - done - leave;

        return `
            <div class="course-fun-card" style="background:${color.bg}; border-color:${color.border};">
                <div class="course-fun-tag" style="background:${color.border}; color:#fff;">
                    ${g.courseName}
                </div>
                <div class="course-fun-student">
                    <span class="course-fun-avatar" style="background:${color.border}; color:#fff;">
                        ${g.studentName[0]}
                    </span>
                    <span class="course-fun-name">${g.studentName}</span>
                </div>
                <div class="course-fun-stats">
                    <div class="course-fun-stat">
                        <span class="course-fun-stat-num" style="color:${color.accent};">${total}</span>
                        <span class="course-fun-stat-label">總堂數</span>
                    </div>
                    <div class="course-fun-stat-divider"></div>
                    <div class="course-fun-stat">
                        <span class="course-fun-stat-num" style="color:#10B981;">${done}</span>
                        <span class="course-fun-stat-label">已完成</span>
                    </div>
                    <div class="course-fun-stat-divider"></div>
                    <div class="course-fun-stat">
                        <span class="course-fun-stat-num" style="color:#F59E0B;">${remaining}</span>
                        <span class="course-fun-stat-label">剩餘堂數</span>
                    </div>
                    ${leave > 0 ? `
                    <div class="course-fun-stat-divider"></div>
                    <div class="course-fun-stat">
                        <span class="course-fun-stat-num" style="color:#EF4444;">${leave}</span>
                        <span class="course-fun-stat-label">請假</span>
                    </div>` : ''}
                </div>
                <button class="course-fun-btn" style="background:${color.accent};"
                    onclick="openBookingModal('${g.courseName}', ${g.studentId}, '${g.studentName}')">
                    查看預約 →
                </button>
            </div>
        `;
    }).join('');
}

// ── 開啟預約詳細 Modal ──
function openBookingModal(courseName, studentId, studentName) {
    document.getElementById('modal-course-name').textContent  = courseName;
    document.getElementById('modal-student-name').textContent = studentName;

    const studentBookings = bookings
        .filter(b => b.studentId === studentId && b.courseName === courseName)
        .map(b => ({ ...b, dateStr: parseDateStr(b) }))
        .sort((a, b) => a.dateStr > b.dateStr ? -1 : 1);

    const total     = studentBookings.length;
    const done      = studentBookings.filter(b => b.status === 2).length;
    const leave     = studentBookings.filter(b => b.status === 3).length;
    const remaining = total - done - leave;

    // 統計區
    document.getElementById('modal-stats').innerHTML = `
        <div class="modal-stat-chip" style="background:#EFF6FF; color:#1D4ED8;">
            <span class="fw-900">${total}</span> 總堂
        </div>
        <div class="modal-stat-chip" style="background:#ECFDF5; color:#059669;">
            <span class="fw-900">${done}</span> 已完成
        </div>
        <div class="modal-stat-chip" style="background:#FEF9C3; color:#92400E;">
            <span class="fw-900">${remaining}</span> 剩餘
        </div>
        ${leave > 0 ? `<div class="modal-stat-chip" style="background:#FEF2F2; color:#DC2626;"><span class="fw-900">${leave}</span> 請假</div>` : ''}
    `;

    // 預約列表
    renderModalBookings(studentBookings, courseName, studentId);

    new bootstrap.Modal(document.getElementById('bookingDetailModal')).show();
}

function renderModalBookings(studentBookings, courseName, studentId) {
    const container = document.getElementById('modal-booking-list');

    if (studentBookings.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">沒有預約紀錄</div>';
        return;
    }

    container.innerHTML = `<div class="upcoming-grid">` +
        studentBookings.map(b => {
            const month = parseInt(b.dateStr.split('-')[1]);
            const day   = parseInt(b.dateStr.split('-')[2]);

            let statusBadge, actionBtn = '';

            if (b.status === 2) {
                statusBadge = `<span class="booking-status-badge status-scheduled" style="background:#ECFDF5; color:#059669;">✓ 已完成</span>`;
            } else if (b.status === 3) {
                statusBadge = `<span class="booking-status-badge" style="background:#FEF2F2; color:#DC2626; border-radius:20px; font-size:0.72rem; font-weight:700; padding:3px 10px;">✕ 請假</span>`;
            } else {
                statusBadge = `<span class="booking-status-badge status-scheduled">● 排課中</span>`;
                const slotTime = new Date(`${b.dateStr}T${String(b.hour).padStart(2,'0')}:00:00`);
                if (slotTime > new Date()) {
                    actionBtn = `
                        <button class="btn btn-outline-danger btn-sm fw-bold ms-2"
                            onclick="markAsLeave(${b.id}, '${courseName}', ${studentId})"
                            style="font-size:0.72rem; border-radius:8px; padding:3px 10px;">
                            請假
                        </button>
                    `;
                }
            }

            return `
                <div class="upcoming-grid-item">
                    <div class="upcoming-grid-date">
                        <span class="badge-month">${String(month).padStart(2,'0')}月</span>
                        <span class="badge-day">${day}</span>
                    </div>
                    <div class="upcoming-grid-info">
                        <div class="upcoming-grid-course">${b.dateStr}</div>
                        <div class="upcoming-grid-student">
                            <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
                            ${String(b.hour).padStart(2,'0')}:00 - ${String(b.hour+1).padStart(2,'0')}:00
                        </div>
                    </div>
                    <div style="margin-left:auto; display:flex; align-items:center; gap:4px; flex-shrink:0;">
                        ${statusBadge}${actionBtn}
                    </div>
                </div>
            `;
        }).join('') +
    `</div>`;
}

// ── 標記請假 ──
async function markAsLeave(bookingId, courseName, studentId) {
    if (!confirm('確定要將這堂課標記為請假嗎？')) return;

    try {
        await axios.patch(`${API_BASE_URL}/bookings/${bookingId}/status`, { status: 3 });

        // 更新本地資料
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) booking.status = 3;

        // 重新渲染卡片和 Modal
        renderCourseCards();

        const studentBookings = bookings
            .filter(b => b.studentId === studentId && b.courseName === courseName)
            .map(b => ({ ...b, dateStr: parseDateStr(b) }))
            .sort((a, b) => a.dateStr > b.dateStr ? -1 : 1);

        renderModalBookings(studentBookings, courseName, studentId);

        // 更新 Modal 統計
        const total     = studentBookings.length;
        const done      = studentBookings.filter(b => b.status === 2).length;
        const leave     = studentBookings.filter(b => b.status === 3).length;
        const remaining = total - done - leave;

        document.getElementById('modal-stats').innerHTML = `
            <div class="modal-stat-chip" style="background:#EFF6FF; color:#1D4ED8;"><span class="fw-900">${total}</span> 總堂</div>
            <div class="modal-stat-chip" style="background:#ECFDF5; color:#059669;"><span class="fw-900">${done}</span> 已完成</div>
            <div class="modal-stat-chip" style="background:#FEF9C3; color:#92400E;"><span class="fw-900">${remaining}</span> 剩餘</div>
            ${leave > 0 ? `<div class="modal-stat-chip" style="background:#FEF2F2; color:#DC2626;"><span class="fw-900">${leave}</span> 請假</div>` : ''}
        `;

    } catch (err) {
        console.error('標記請假失敗：', err);
        alert('❌ 操作失敗，請稍後再試');
    }
}

// ==========================================
// 分頁二：歷史訂單
// ==========================================

function renderHistoryList() {
    const container = document.getElementById('history-list');

    const sorted = [...bookings]
        .map(b => ({ ...b, dateStr: parseDateStr(b) }))
        .sort((a, b) => {
            const ta = new Date(`${a.dateStr}T${String(a.hour).padStart(2,'0')}:00:00`);
            const tb = new Date(`${b.dateStr}T${String(b.hour).padStart(2,'0')}:00:00`);
            return tb - ta; // 最新在前
        });

    document.getElementById('history-count').textContent = `${sorted.length} 筆`;

    if (sorted.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">沒有歷史訂單</div>';
        return;
    }

    container.innerHTML = `<div class="upcoming-grid">` +
        sorted.map(b => {
            const month = parseInt(b.dateStr.split('-')[1]);
            const day   = parseInt(b.dateStr.split('-')[2]);

            let statusBadge;
            if (b.status === 2) {
                statusBadge = `<span class="booking-status-badge status-scheduled" style="background:#ECFDF5; color:#059669;">✓ 已完成</span>`;
            } else if (b.status === 3) {
                statusBadge = `<span class="booking-status-badge" style="background:#FEF2F2; color:#DC2626; border-radius:20px; font-size:0.72rem; font-weight:700; padding:3px 10px;">✕ 請假</span>`;
            } else {
                statusBadge = `<span class="booking-status-badge status-scheduled">● 排課中</span>`;
            }

            return `
                <div class="upcoming-grid-item">
                    <div class="upcoming-grid-date">
                        <span class="badge-month">${String(month).padStart(2,'0')}月</span>
                        <span class="badge-day">${day}</span>
                    </div>
                    <div class="upcoming-grid-info">
                        <div class="upcoming-grid-course">${b.courseName || '課程'}</div>
                        <div class="upcoming-grid-student">
                            <span class="material-symbols-outlined" style="font-size:13px;">person</span>
                            ${b.studentName || '學生 #' + b.studentId}
                            &nbsp;·&nbsp;
                            <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
                            ${String(b.hour).padStart(2,'0')}:00 - ${String(b.hour+1).padStart(2,'0')}:00
                        </div>
                    </div>
                    <div style="margin-left:auto; flex-shrink:0;">
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('') +
    `</div>`;
}

// ==========================================
// 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!tutorId) return;

    try {
        const [coursesRes, bookingsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/view/courses`),
            axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`)
        ]);

        const allCourses = coursesRes.data.content;
        courses  = allCourses.filter(c => String(c.tutorId) === String(tutorId));
        bookings = bookingsRes.data;

        renderCourseCards();
        renderHistoryList();

    } catch (err) {
        console.error('載入失敗：', err);
    }
});