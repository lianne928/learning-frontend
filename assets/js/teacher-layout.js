// ==========================================
// 教師後台共用邏輯 (teacher-layout.js)
// ==========================================

// ── 自動帶入 JWT Token（所有老師後台 API 都需要）──
const _token = localStorage.getItem('jwt_token');
if (_token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${_token}`;
}

// ── 手機版側邊欄開關 ──
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('teacher-sidebar');
const overlay = document.getElementById('sidebar-overlay');

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        overlay.classList.toggle('show');
    });
}

if (overlay) {
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
    });
}

// ── 登出功能 ──
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('確定要登出嗎？')) {
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('userId');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userName');
            window.location.href = 'login.html';
        }
    });
}

// ── 頁面載入：驗證登入狀態、填入側邊欄資訊 ──
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwt_token');
    const userRole = localStorage.getItem('userRole');
    const tutorId = localStorage.getItem('userId');

    // 未登入 → 跳回登入頁
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 不是老師 → 跳回首頁
    if (userRole !== 'TUTOR') {
        window.location.href = 'index.html';
        return;
    }

    // 從 localStorage 填入側邊欄姓名
    const userName = localStorage.getItem('userName');
    const nameEl = document.getElementById('sidebar-name');
    if (nameEl && userName) nameEl.textContent = userName;

    // 載入頭貼
    if (tutorId) loadSidebarAvatar(tutorId);
});

// ── 載入側邊欄頭貼 ──
async function loadSidebarAvatar(tutorId) {
    try {
        const res = await axios.get(`${API_BASE_URL}/tutor/${tutorId}`);
        const avatarUrl = res.data.avatar;
        const avatarEl = document.getElementById('sidebar-avatar');

        if (avatarEl && avatarUrl) {
            const match = avatarUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            avatarEl.src = match
                ? `https://lh3.googleusercontent.com/d/${match[1]}`
                : avatarUrl;
        }
    } catch (e) {
        console.error('載入頭貼失敗：', e);
    }

    // ── 動態插入返回首頁按鈕 ──
    const nav = document.querySelector('.teacher-sidebar nav');
    if (nav) {
        const homeLink = document.createElement('a');
        homeLink.href = 'index.html';
        homeLink.className = 'teacher-nav-link';
        homeLink.innerHTML = '<span class="material-symbols-outlined">home</span> 返回首頁';
        homeLink.style.marginTop = 'auto';
        nav.appendChild(homeLink);
    }
}