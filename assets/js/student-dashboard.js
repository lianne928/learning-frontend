// ==========================================
// 學生控制台 - 資料載入與渲染
// ==========================================

// 問候語
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = '早安';
    if (hour >= 12 && hour < 18) greeting = '午安';
    else if (hour >= 18) greeting = '晚安';
    
    document.getElementById('greeting-prefix').textContent = greeting;
    document.getElementById('greeting-text').textContent = `${greeting}，歡迎回來`;
}

// 渲染即將開始的課程
function renderUpcomingCourses(courses) {
    const container = document.getElementById('upcoming-list');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">event_busy</span>
                <p>近期無課程安排</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = courses.map(course => {
        const date = new Date(course.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
        
        let badge = '';
        let badgeClass = '';
        
        if (diff === 0) {
            badge = '今天';
            badgeClass = 'badge-today';
        } else if (diff === 1) {
            badge = '明天';
            badgeClass = 'badge-tomorrow';
        } else {
            badge = `${diff} 天後`;
            badgeClass = 'badge-future';
        }
        
        return `
            <div class="upcoming-course-item">
                <div class="course-time">
                    <span class="course-date">${date.getMonth() + 1}/${date.getDate()}</span>
                    <span class="course-hour">${course.hour || '00'}:00</span>
                </div>
                <div class="course-info">
                    <div class="course-title">${course.courseName || '課程'}</div>
                    <div class="course-teacher">${course.tutorName || course.tutorname || '老師'}</div>
                </div>
                <span class="course-badge ${badgeClass}">${badge}</span>
            </div>
        `;
    }).join('');
}

// 載入控制台資料
async function loadDashboardData() {
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        // 並行載入資料
        const [userRes, todayRes, futureRes] = await Promise.allSettled([
            axios.get(`${API_BASE_URL}/users/me`),
            axios.get(`${API_BASE_URL}/today/me?userId=${userId}`),
            axios.get(`${API_BASE_URL}/future/me?userId=${userId}`)
        ]);
        
        // 使用者資料
        if (userRes.status === 'fulfilled') {
            const user = userRes.value.data;
            document.getElementById('welcome-name').textContent = user.name || '同學';
            document.getElementById('stat-credits').textContent = user.wallet || 0;
        }
        
        // 今日課程
        const todayCourses = todayRes.status === 'fulfilled' ? (todayRes.value.data || []) : [];
        document.getElementById('today-count').textContent = todayCourses.length;
        document.getElementById('stat-today').textContent = todayCourses.length;
        
        // 即將開始的課程
        const futureCourses = futureRes.status === 'fulfilled' ? (futureRes.value.data || []) : [];
        const allCourses = [...todayCourses, ...futureCourses].slice(0, 5);
        renderUpcomingCourses(allCourses);
        
    } catch (error) {
        console.error('載入資料失敗:', error);
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// 頁面載入
document.addEventListener('DOMContentLoaded', () => {
    setGreeting();
    loadDashboardData();
});