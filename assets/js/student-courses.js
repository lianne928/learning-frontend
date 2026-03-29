// ==========================================
// 學習與課程 - 資料載入與篩選
// ==========================================

let allCourses = [];
let currentFilter = 'all';

// 渲染課程卡片
function renderCourses(courses) {
    const container = document.getElementById('courses-list');
    
    if (!courses || courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">school_off</span>
                <p>目前沒有課程</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = courses.map(course => {
        const statusInfo = getCourseStatus(course);
        
        return `
            <div class="course-card">
                <div class="course-card-header">
                    <span class="course-status ${statusInfo.class}">${statusInfo.text}</span>
                    <span class="course-lessons">${course.lessonUsed || 0}/${course.lessonCount || 0} 堂</span>
                </div>
                <div class="course-card-body">
                    <h3 class="course-name">${course.courseName || '課程名稱'}</h3>
                    <div class="course-teacher">
                        <span class="material-symbols-outlined">person</span>
                        ${course.tutorName || '老師'}
                    </div>
                    <div class="course-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${getProgress(course)}%"></div>
                        </div>
                        <span class="progress-text">${getProgress(course)}%</span>
                    </div>
                </div>
                <div class="course-card-footer">
                    <a href="StudentChat.html" class="course-btn course-btn-secondary">
                        <span class="material-symbols-outlined">chat</span>
                        聊天
                    </a>
                    <a href="Student-VideoRoom.html?orderId=${course.id}" class="course-btn course-btn-primary">
                        <span class="material-symbols-outlined">video_call</span>
                        進入教室
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// 取得課程狀態
function getCourseStatus(course) {
    if (course.status === 2) {
        return { text: '已完成', class: 'status-completed' };
    } else if (course.lessonUsed > 0) {
        return { text: '進行中', class: 'status-ongoing' };
    } else {
        return { text: '即將開始', class: 'status-upcoming' };
    }
}

// 計算進度
function getProgress(course) {
    if (!course.lessonCount || course.lessonCount === 0) return 0;
    return Math.round((course.lessonUsed || 0) / course.lessonCount * 100);
}

// 篩選課程
function filterCourses(filter) {
    currentFilter = filter;
    
    // 更新標籤狀態
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    // 篩選課程
    let filtered = allCourses;
    
    if (filter === 'ongoing') {
        filtered = allCourses.filter(c => c.status !== 2 && (c.lessonUsed > 0));
    } else if (filter === 'completed') {
        filtered = allCourses.filter(c => c.status === 2);
    } else if (filter === 'upcoming') {
        filtered = allCourses.filter(c => c.status !== 2 && (c.lessonUsed === 0));
    }
    
    renderCourses(filtered);
}

// 載入課程資料
async function loadCourses() {
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const res = await axios.get(`${API_BASE_URL}/courses/me?userId=${userId}`);
        allCourses = res.data || [];
        filterCourses(currentFilter);
        
    } catch (error) {
        console.error('載入課程失敗:', error);
        document.getElementById('courses-list').innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">error</span>
                <p>載入失敗，請重新整理</p>
            </div>
        `;
        
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// 頁面載入
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    
    // 篩選標籤點擊
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            filterCourses(tab.dataset.filter);
        });
    });
});