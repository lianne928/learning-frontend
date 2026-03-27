
const courses = {
    "1": {
        title: "Space Exploration",
        meta: "Sunny 老師 • 今天 14:00",
        rating: 5,
        tags: ["自然發音", "認識動物", "句型問答"],
        comment: "Leo 今天上課非常專心！對於太空的單字掌握度很高，尤其是發音進步很多，下次可以試著用完整的句子回答問題喔！繼續保持！"
    },
    "2": {
        title: "Animal Kingdom",
        meta: "Sunny 老師 • 2026/05/08 10:00",
        rating: 4,
        tags: ["動物單字", "情境模擬", "創意表達"],
        comment: "今天我們認識了很多非洲草原的動物！Leo 對獅子跟大象非常有興趣. 發音的部分可以再加強一些連音，整體表現很棒喔！"
    }
};

function updateReport(courseId) {
    const data = courses[courseId];
    if (!data) return;
    document.getElementById('reportTitle').textContent = `${data.title} 的專屬報告`;
    document.getElementById('reportMeta').textContent = data.meta;
    document.getElementById('reportComment').textContent = `"${data.comment}"`;
    const ratingEl = document.getElementById('reportRating');
    ratingEl.innerHTML = Array(5).fill(0).map((_, i) =>
        `<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${i < data.rating ? 1 : 0};">star</span>`
    ).join('');
    const tagsEl = document.getElementById('reportTags');
    tagsEl.innerHTML = data.tags.map(tag => `<span class="report-tag">${tag}</span>`).join('');
}

updateReport("1");

// Tab Switching
const tabs = document.querySelectorAll('.tab-item');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('reportSection').classList.toggle('active', target === 'report');
        document.getElementById('evaluationSection').classList.toggle('active', target === 'evaluation');
    });
});

// Course Selection
const courseCards = document.querySelectorAll('.course-card');
courseCards.forEach(card => {
    card.addEventListener('click', () => {
        courseCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        updateReport(card.dataset.courseId);
        if (window.innerWidth <= 1024) {
            document.getElementById('reportContentArea').scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Sidebar Toggle logic
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

menuToggle.addEventListener('click', toggleSidebar);
overlay.addEventListener('click', toggleSidebar);
