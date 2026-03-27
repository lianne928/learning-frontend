
// Sidebar toggle logic - From SCREEN_69
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

// Calendar logic
(function () {
    const scheduleGrid = document.getElementById('scheduleGrid');
    const dateRangeEl = document.getElementById('currentDateRange');

    let globalToday = new Date();
    globalToday.setHours(0, 0, 0, 0);

    let selectedDate = new Date(globalToday);

    let viewStartMonday = new Date(globalToday);
    const dayOffset = viewStartMonday.getDay() === 0 ? 6 : viewStartMonday.getDay() - 1;
    viewStartMonday.setDate(viewStartMonday.getDate() - dayOffset);

    function renderCalendar() {
        scheduleGrid.innerHTML = '';

        const daysOfWeek = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
        const viewEndSunday = new Date(viewStartMonday);
        viewEndSunday.setDate(viewStartMonday.getDate() + 6);

        const startYear = viewStartMonday.getFullYear();
        const startMonth = viewStartMonday.getMonth() + 1;
        const startDate = viewStartMonday.getDate();
        const endMonth = viewEndSunday.getMonth() + 1;
        const endDateNum = viewEndSunday.getDate();
        dateRangeEl.textContent = `${startYear}年${startMonth}月${startDate}日 - ${endMonth}月${endDateNum}日`;

        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(viewStartMonday);
            currentDay.setDate(viewStartMonday.getDate() + i);
            currentDay.setHours(0, 0, 0, 0);

            const card = document.createElement('div');
            card.className = 'day-card';

            if (currentDay.getTime() === globalToday.getTime()) {
                card.classList.add('is-today');
            }

            if (currentDay.getTime() === selectedDate.getTime()) {
                card.classList.add('selected');
            }

            card.innerHTML = `
                    <span class="day-name">${daysOfWeek[i]}</span>
                    <span class="day-number">${currentDay.getDate()}</span>
                `;

            card.addEventListener('click', () => {
                selectedDate = new Date(currentDay);
                renderCalendar();
            });

            scheduleGrid.appendChild(card);
        }
    }

    document.getElementById('prevWeek').addEventListener('click', () => {
        viewStartMonday.setDate(viewStartMonday.getDate() - 7);
        renderCalendar();
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        viewStartMonday.setDate(viewStartMonday.getDate() + 7);
        renderCalendar();
    });

    renderCalendar();
})();
