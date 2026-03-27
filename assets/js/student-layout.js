// ==========================================
// 學生後台共用邏輯 (student-layout.js)
// ==========================================

const API_BASE_URL = 'http://localhost:8080/api';

// ── 自動帶入 JWT Token ──
const _token = localStorage.getItem('jwt_token');
if (_token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${_token}`;
}

// ── 手機版側邊欄開關 ──
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('student-sidebar');
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

    // 未登入 → 跳回登入頁
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 老師角色 → 跳到老師後台
    if (userRole === 'TUTOR') {
        window.location.href = 'teacher-dashboard.html';
        return;
    }

    // 從 localStorage 填入側邊欄姓名
    const userName = localStorage.getItem('userName');
    const nameEl = document.getElementById('sidebar-name');
    if (nameEl && userName) nameEl.textContent = userName;
});
