
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

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
            toggleSidebar();
        }
    });
});

// Tab switching logic
const tabs = document.querySelectorAll('.tab-item');
const tabContents = document.querySelectorAll('.tab-content');
const statusText = document.getElementById('status-text');

const statusMessages = {
    'purchased': '查看您擁有的所有課程與剩餘點數',
    'upcoming': '查看即將開始的預約與上課連結',
    'completed': '回顧過去完成的學習內容與導師評價',
    'cancelled': '查看已取消或變更的課程紀錄'
};

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        // Toggle active tab style
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Toggle active content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === target) {
                content.classList.add('active');
            }
        });

        // Update header text
        if (statusMessages[target]) {
            statusText.innerText = statusMessages[target];
        }
    });
});
