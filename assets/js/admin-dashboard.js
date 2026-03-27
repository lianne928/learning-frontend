// ==========================================
// admin-dashboard.js
// ==========================================

// ── JWT ───────────────────────────────────────────────────────────────
const _token = localStorage.getItem('jwt_token');
if (_token) axios.defaults.headers.common['Authorization'] = `Bearer ${_token}`;

// ── 全域狀態 ──────────────────────────────────────────────────────────
let currentTutorId = null;
let currentFilter  = 'all';
let allTutors      = [];
let reviewModal    = null;

// ── 科目代碼對照 ──────────────────────────────────────────────────────
const subjectLabel = {
    11: '低年級', 12: '中年級', 13: '高年級',
    21: 'GEPT',   22: 'YLE',   23: '國中先修',
    31: '其他'
};

// ── 即時時間 ──────────────────────────────────────────────────────────
function updateTime() {
    const el = document.getElementById('current-time');
    if (!el) return;
    const now = new Date();
    el.textContent =
        now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) +
        ' ' +
        now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

// ── Tab 切換 ──────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.teacher-nav-link').forEach(a => a.classList.remove('active'));

    document.getElementById(`panel-${tab}`)?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    // 同步側邊欄 active 狀態
    const navMap = { dashboard: 'nav-link-dashboard', tutors: 'nav-link-tutors' };
    document.getElementById(navMap[tab])?.classList.add('active');

    // 切換到審核 Tab 時，若尚未載入則觸發
    if (tab === 'tutors' && allTutors.length === 0) loadTutors();
}

// ── 載入儀表板數據 ────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await axios.get(`${API_BASE_URL}/admin/dashboard`);
        const d   = res.data;

        setText('stat-students',    d.totalStudents?.toLocaleString());
        setText('stat-tutors',      d.totalTutors?.toLocaleString());
        setText('stat-course-types', d.totalCourseTypes);
        setText('stat-new-students', d.newStudentsThisMonth);
        setText('stat-new-tutors',   d.newTutorsThisMonth);

        const todayRev = Number(d.revenueToday    ?? 0).toLocaleString();
        const monthRev = Number(d.revenueThisMonth ?? 0).toLocaleString();
        setText('stat-today-revenue',    todayRev);
        setText('stat-month-revenue',    monthRev);
        setText('welcome-revenue',       todayRev);
        setText('welcome-month-revenue', monthRev);

        renderPopular(d.popularCourses ?? []);
    } catch (err) {
        console.error('載入儀表板失敗：', err);
    }

    // 待審核數從獨立 API 取得，確保與 TutorReviewCountDTO 欄位對齊
    await loadTutorCounts();
}

// ── 渲染熱門課程 ──────────────────────────────────────────────────────
function renderPopular(list) {
    const el = document.getElementById('popular-list');
    if (!el) return;
    if (!list.length) {
        el.innerHTML = `<div class="empty-state"><span class="material-symbols-outlined">bar_chart</span><p>目前無訂單資料</p></div>`;
        return;
    }
    el.innerHTML = list.map((c, i) => {
        const rankClass = ['rank-1','rank-2','rank-3'][i] ?? 'rank-other';
        return `
        <div class="popular-item">
            <div class="popular-rank ${rankClass}">${i + 1}</div>
            <div class="popular-info">
                <div class="popular-title">${c.courseName}</div>
                <div class="popular-meta">
                    <span class="material-symbols-outlined" style="font-size:14px;">person</span> ${c.tutorName}
                    &nbsp;·&nbsp;
                    <span class="material-symbols-outlined" style="font-size:14px;">category</span> ${subjectLabel[c.subject] ?? c.subject}
                </div>
            </div>
            <div class="popular-count">
                ${Number(c.totalLessons).toLocaleString()}
                <small>堂</small>
            </div>
        </div>`;
    }).join('');
}

// ── 載入老師數量統計（對齊 TutorReviewCountDTO）─────────────────────
async function loadTutorCounts() {
    try {
        const res = await axios.get(`${API_BASE_URL}/admin/tutors/counts`);
        const c   = res.data;

        // TutorReviewCountDTO 欄位：pendingCount / qualifiedCount / bannedCount
        const pending  = c.pendingCount  ?? 0;
        const approved = c.qualifiedCount ?? 0;
        const banned   = c.bannedCount    ?? 0;

        // 審核 Tab 三張統計卡
        setText('count-pending',   pending);
        setText('count-approved',  approved);
        setText('count-suspended', banned);

        // 儀表板 Tab 待審核數格（stat-pending）
        setText('stat-pending', pending);

        // Tab Switcher badge
        const badge = document.getElementById('tab-pending-count');
        if (badge) {
            badge.textContent        = pending;
            badge.style.background   = pending > 0 ? '#fef2f2' : '';
            badge.style.color        = pending > 0 ? '#ef4444' : '';
        }

        // 側邊欄 badge
        const navBadge = document.getElementById('nav-pending-badge');
        if (navBadge) {
            navBadge.textContent   = pending;
            navBadge.style.display = pending > 0 ? 'inline-block' : 'none';
        }
    } catch (err) {
        console.error('載入老師數量失敗：', err);
    }
}

// ── 載入老師審核列表 ──────────────────────────────────────────────────
async function loadTutors() {
    try {
        const res = await axios.get(`${API_BASE_URL}/admin/tutors`);
        allTutors = res.data;
        renderTutorTable(allTutors);
    } catch (err) {
        console.error('載入老師列表失敗：', err);
        const tbody = document.getElementById('tutor-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">載入失敗，請重試</td></tr>`;
    }
}

// ── 篩選老師 ──────────────────────────────────────────────────────────
function filterTutors(filter) {
    currentFilter = filter;
    ['all','pending','qualified','suspended'].forEach(f => {
        document.getElementById(`filter-${f}`)?.classList.toggle('active', f === filter);
    });

    const filtered =
        filter === 'all'       ? allTutors :
        filter === 'pending'   ? allTutors.filter(t => t.status === 1) :
        filter === 'qualified' ? allTutors.filter(t => t.status === 2) :
                                 allTutors.filter(t => t.status === 3);
    renderTutorTable(filtered);

    // 若不在審核 Tab，切換過去
    if (!document.getElementById('panel-tutors')?.classList.contains('active')) {
        switchTab('tutors');
    }
}

// ── 渲染老師表格 ──────────────────────────────────────────────────────
function renderTutorTable(list) {
    const tbody = document.getElementById('tutor-table-body');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="material-symbols-outlined">person_search</span><p>此分類目前無資料</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(t => {
        const statusBadge =
            t.status === 1 ? `<span class="status-badge status-pending">⏳ 待審核</span>` :
            t.status === 2 ? `<span class="status-badge status-approved">✅ 已核准</span>` :
                             `<span class="status-badge status-rejected">🚫 已停權</span>`;
        const initial = (t.name || '?')[0];console.log(t);
        return `
        <tr onclick="openReviewModal(${t.tutorId})">
            <td>
                <div class="tutor-name-cell">
                    <div class="tutor-initial">${initial}</div>
                    <div>
                        <div class="tutor-name">${t.name}</div>
                        <div class="tutor-email">${t.email}</div>
                    </div>
                </div>
            </td>
            <td style="color:var(--text-light); font-size:0.85rem;">${t.title || '—'}</td>
            <td style="font-size:0.85rem; color:var(--text-light);">${t.applyDate || '—'}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm fw-bold"
                    style="border:1px solid var(--border-color); border-radius:8px; font-size:0.78rem;"
                    onclick="event.stopPropagation(); openReviewModal(${t.tutorId})">
                    <span class="material-symbols-outlined" style="font-size:15px;">open_in_new</span> 查看
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── 開啟審核 Modal ────────────────────────────────────────────────────
async function openReviewModal(tutorId) {
    currentTutorId = tutorId;
    try {
        const res = await axios.get(`${API_BASE_URL}/admin/tutors/${tutorId}`);
        const t   = res.data;

        setText('m-name',       t.name);
        setText('m-email',      t.email);
        setText('m-title',      t.title      || '（未填）');
        setText('m-intro',      t.intro      || '（未填）');
        setText('m-apply-date', t.applyDate  || '—');
        setText('m-education',  t.education ? '🎓 ' + t.education : '');

        // 經歷
        setText('m-exp1', t.experience1 || '（未填）');
        const exp2El = document.getElementById('m-exp2');
        if (exp2El) { exp2El.textContent = t.experience2 || ''; exp2El.style.display = t.experience2 ? 'block' : 'none'; }

        // 證照
        setLink('m-cert1-link', 'm-cert1-name', t.certificate1, t.certificateName1 || '證照一');
        setLink('m-cert2-link', 'm-cert2-name', t.certificate2, t.certificateName2 || '證照二');

        // 影片
        setVideoBtn('m-video1', t.videoUrl1);
        setVideoBtn('m-video2', t.videoUrl2);

        // 當前狀態
        const statusText = t.status === 1 ? '⏳ 待審核' : t.status === 2 ? '✅ 已核准' : '🚫 已停權';
        setText('m-current-status', '目前狀態：' + statusText);

        // 按鈕動態顯示
        const approveBtn = document.getElementById('btn-approve');
        const rejectBtn  = document.getElementById('btn-reject');
        if (t.status === 2) {
            approveBtn.style.display = 'none';
            rejectBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">block</span> 停權';
            rejectBtn.style.display = 'inline-flex';
        } else if (t.status === 3) {
            rejectBtn.style.display = 'none';
            approveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> 重新核准';
            approveBtn.style.display = 'inline-flex';
        } else {
            approveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> 核准';
            approveBtn.style.display = 'inline-flex';
            rejectBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">block</span> 不通過';
            rejectBtn.style.display = 'inline-flex';
        }

        reviewModal.show();
    } catch (err) {
        alert('載入老師資料失敗');
    }
}

// ── 執行審核動作 ──────────────────────────────────────────────────────
async function handleReview(status) {
    const action = status === 2 ? '核准' : '停權';
    if (!confirm(`確定要對此老師執行「${action}」操作嗎？`)) return;
    try {
        await axios.patch(`${API_BASE_URL}/admin/tutors/${currentTutorId}/status`, { status });
        reviewModal.hide();
        allTutors = [];
        await loadTutors();
        await loadTutorCounts();
        alert(`已成功${action}該老師。`);
    } catch (err) {
        alert('操作失敗：' + (err.response?.data || err.message));
    }
}

// ── 工具函式 ──────────────────────────────────────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

function setLink(linkId, nameId, url, label) {
    const link = document.getElementById(linkId);
    const name = document.getElementById(nameId);
    if (!link) return;
    link.href          = url || '#';
    link.style.display = url ? 'flex' : 'none';
    if (name) name.textContent = label;
}

function setVideoBtn(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    el.href          = url || '#';
    el.style.display = url ? 'flex' : 'none';
}

// ── 頁面初始化 ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 驗證管理員身份
    const token    = localStorage.getItem('jwt_token');
    const userRole = localStorage.getItem('userRole');
    if (!token)             { window.location.href = 'login.html';  return; }
    if (userRole !== 'ADMIN') { window.location.href = 'index.html'; return; }

    const userName = localStorage.getItem('userName');
    setText('sidebar-name', userName || '管理員');

    // 初始化 Bootstrap Modal
    reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));

    // 手機版側邊欄
    const sidebar = document.getElementById('teacher-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    });
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
    });

    // 登出
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        if (confirm('確定要登出嗎？')) { localStorage.clear(); window.location.href = 'login.html'; }
    });

    // 即時時間
    setInterval(updateTime, 1000);
    updateTime();

    // 載入資料
    loadDashboard();
});
