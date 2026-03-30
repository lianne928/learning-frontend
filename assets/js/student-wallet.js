// ==========================================
// 收益與績效頁面邏輯 (student-wallet.js)
// ==========================================

const tutorId = localStorage.getItem('userId');

// 圓餅圖顏色
const PIE_COLORS = [
    '#1A2238', '#FFD000', '#10B981', '#3B82F6',
    '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
];

// ── 格式化金額 ──
function formatMoney(num) {
    return Number(num).toLocaleString();
}

// ── 格式化日期 ──
function formatDate(instantStr) {
    if (!instantStr) return '';
    const d = new Date(instantStr);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

// ── 取得近6個月標籤 ──
function getLast6Months() {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            label: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`,
            year:  d.getFullYear(),
            month: d.getMonth() + 1
        });
    }
    return months;
}

// ── 渲染柱狀圖 ──
function renderBarChart(walletLogs) {
    const months  = getLast6Months();
    const wallets = months.map(m =>
        walletLogs
            .filter(log => {
                if (log.transactionType !== 3) return false;
                const d = new Date(log.createdAt);
                return d.getFullYear() === m.year && (d.getMonth() + 1) === m.month;
            })
            .reduce((sum, log) => sum + Number(log.amount), 0)
    );

    new Chart(document.getElementById('wallet-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: '授課收入 (NT$)',
                data: wallets,
                backgroundColor: '#1A2238',
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => `NT$ ${formatMoney(ctx.raw)}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: val => `NT$ ${formatMoney(val)}` },
                    grid: { color: '#f1f5f9' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ── 渲染圓餅圖 ──
function renderPieChart(walletLogs, bookings) {
    // 只取授課收入（transactionType=3）
    const walletItems = walletLogs.filter(log => log.transactionType === 3);

    if (walletItems.length === 0) {
        document.getElementById('pie-legend').innerHTML =
            '<p class="text-muted small text-center">尚無收入資料</p>';
        return;
    }

    // 建立 bookingId → courseName 的 Map
    const bookingMap = {};
    bookings.forEach(b => { bookingMap[b.id] = b.courseName || '未知課程'; });

    // 依課程分組加總
    const coursewallet = {};
    walletItems.forEach(log => {
        const courseName = bookingMap[log.relatedId] || '其他';
        coursewallet[courseName] = (coursewallet[courseName] || 0) + Number(log.amount);
    });

    const labels = Object.keys(coursewallet);
    const data   = Object.values(coursewallet);
    const total  = data.reduce((s, v) => s + v, 0);

    new Chart(document.getElementById('pie-chart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: PIE_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `NT$ ${formatMoney(ctx.raw)} (${Math.round(ctx.raw / total * 100)}%)`
                    }
                }
            }
        }
    });

    // 自訂圖例
    document.getElementById('pie-legend').innerHTML = labels.map((label, i) => `
        <div class="d-flex align-items-center gap-2 mb-1">
            <span style="width:10px; height:10px; border-radius:50%; background:${PIE_COLORS[i]}; flex-shrink:0;"></span>
            <span style="font-size:0.75rem; font-weight:600; color:#64748b; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</span>
            <span style="font-size:0.75rem; font-weight:700; color:#1A2238;">
                ${Math.round(data[i] / total * 100)}%
            </span>
        </div>
    `).join('');
}

// ── 渲染收入明細 ──
function renderwalletList(walletLogs, bookings) {
    const container = document.getElementById('wallet-list');
    const bookingMap = {};
    bookings.forEach(b => { bookingMap[b.id] = b; });

    const wallets = walletLogs
        .filter(log => log.transactionType === 3)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('wallet-count').textContent = `${wallets.length} 筆`;

    if (wallets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5" style="color:#94a3b8;">
                <span class="material-symbols-outlined d-block mb-2" style="font-size:40px; opacity:0.3;">payments</span>
                <p class="mb-0 fw-bold">目前還沒有收入記錄</p>
                <p class="small">課程完成後會自動撥款</p>
            </div>
        `;
        return;
    }

    const booking = (log) => bookingMap[log.relatedId];

    container.innerHTML = `<div class="upcoming-grid">` +
        wallets.map(log => {
            const d     = new Date(log.createdAt);
            const month = d.getMonth() + 1;
            const day   = d.getDate();
            const b     = booking(log);

            return `
                <div class="upcoming-grid-item">
                    <div class="upcoming-grid-date">
                        <span class="badge-month">${String(month).padStart(2,'0')}月</span>
                        <span class="badge-day">${day}</span>
                    </div>
                    <div class="upcoming-grid-info">
                        <div class="upcoming-grid-course" style="color:#10B981; font-weight:900;">
                            + NT$ ${formatMoney(log.amount)}
                        </div>
                        <div class="upcoming-grid-student">
                            <span class="material-symbols-outlined" style="font-size:13px;">menu_book</span>
                            ${b ? b.courseName : '課程'}
                            &nbsp;·&nbsp;
                            <span class="material-symbols-outlined" style="font-size:13px;">person</span>
                            ${b ? (b.studentName || '學生') : '學生'}
                        </div>
                    </div>
                    <div style="margin-left:auto; flex-shrink:0;">
                        <span style="font-size:0.7rem; font-weight:700; color:#94a3b8;">
                            ${formatDate(log.createdAt)}
                        </span>
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
        const [meRes, statsRes, logsRes, bookingsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/users/me`),
            axios.get(`${API_BASE_URL}/tutor/${tutorId}/stats`),
            axios.get(`${API_BASE_URL}/users/wallet-logs`),
            axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`)
        ]);

        const wallet      = meRes.data.wallet || 0;
        const monthwallet = statsRes.data.monthwallet || 0;
        const walletLogs  = logsRes.data;
        const bookings    = bookingsRes.data;

        // 計算累計總收入
        const totalwallet = walletLogs
            .filter(log => log.transactionType === 3)
            .reduce((sum, log) => sum + Number(log.amount), 0);

        // 更新統計卡片
        document.getElementById('stat-wallet').textContent       = formatMoney(wallet);
        document.getElementById('stat-month-wallet').textContent = formatMoney(monthwallet);
        document.getElementById('stat-total-wallet').textContent = formatMoney(totalwallet);

        // 渲染圖表和明細
        renderBarChart(walletLogs);
        renderPieChart(walletLogs, bookings);
        renderwalletList(walletLogs, bookings);

    } catch (err) {
        console.error('載入失敗：', err);
    }
});