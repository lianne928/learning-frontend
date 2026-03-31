// ==========================================
// 儲值與明細 - 點數管理（JWT 版本）
// ==========================================

// 載入點數餘額
async function loadBalance() {
    try {
        const token = localStorage.getItem('jwt_token'); // ✅ 改成 jwt_token
        const res = await axios.get(`${API_BASE_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const user = res.data;

        document.getElementById('current-balance').textContent = user.wallet || 0;

    } catch (error) {
        console.error('載入餘額失敗:', error);
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// 載入交易明細
async function loadTransactions() {
    const token = localStorage.getItem('jwt_token'); // ✅ 改成 jwt_token

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await axios.get(`${API_BASE_URL}/users/wallet-logs`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const logs = res.data || [];

        renderTransactions(logs);

    } catch (error) {
        console.error('載入交易明細失敗:', error);
        document.getElementById('transactions-list').innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">error</span>
                <p>載入失敗，請重新整理</p>
            </div>
        `;
    }
}

// 渲染交易明細
function renderTransactions(logs) {
    const container = document.getElementById('transactions-list');

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">receipt</span>
                <p>尚無交易紀錄</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="transaction-list">
            ${logs.map(log => `
                <div class="transaction-item">
                    <div class="transaction-icon ${getTransactionClass(log.transactionType)}">
                        ${getTransactionIcon(log.transactionType)}
                    </div>
                    <div class="transaction-info">
                        <div class="transaction-title">${getTransactionTitle(log.transactionType)}</div>
                        <div class="transaction-date">${formatDate(log.createdAt)}</div>
                        ${log.merchantTradeNo ? `<div class="transaction-no">交易編號：${log.merchantTradeNo}</div>` : ''}
                    </div>
                    <div class="transaction-amount ${log.amount > 0 ? 'positive' : 'negative'}">
                        ${log.amount > 0 ? '+' : ''}${log.amount} 點
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 取得交易類型標題
function getTransactionTitle(type) {
    const titles = {
        1: '儲值',
        2: '購買課程',
        3: '授課收入',
        4: '退款',
        5: '提現',
        6: '平台贈點'
    };
    return titles[type] || '其他';
}

// 取得交易圖示
function getTransactionIcon(type) {
    const icons = {
        1: '<span class="material-symbols-outlined">add_circle</span>',
        2: '<span class="material-symbols-outlined">school</span>',
        3: '<span class="material-symbols-outlined">payments</span>',
        4: '<span class="material-symbols-outlined">refresh</span>',
        5: '<span class="material-symbols-outlined">account_balance</span>',
        6: '<span class="material-symbols-outlined">card_giftcard</span>'
    };
    return icons[type] || '<span class="material-symbols-outlined">receipt</span>';
}

// 取得交易類型 class
function getTransactionClass(type) {
    const classes = {
        1: 'icon-deposit',
        2: 'icon-purchase',
        3: 'icon-income',
        4: 'icon-refund',
        5: 'icon-withdraw',
        6: 'icon-gift'
    };
    return classes[type] || 'icon-default';
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const offset = 8 * 60; // 台北時區 UTC+8，單位分鐘
    const localTime = new Date(date.getTime() + (offset + date.getTimezoneOffset() + date.getTimezoneOffset()) * 60000);
    const year = localTime.getFullYear();
    const month = String(localTime.getMonth() + 1).padStart(2, '0');
    const day = String(localTime.getDate()).padStart(2, '0');
    const hours = String(localTime.getHours()).padStart(2, '0');
    const minutes = String(localTime.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// 處理購買（儲值功能）
// function handlePurchase(amount, points) {
//     alert(`選擇方案：NT$ ${amount}\n獲得點數：${points} 點\n\n儲值功能開發中...`);
// }

// 頁面載入
document.addEventListener('DOMContentLoaded', () => {
    loadBalance();
    loadTransactions();
});



function handlePurchase(amount, points) {

    Swal.fire({
        title: '確認購買？',
        html: `
            <p>方案：NT$ ${amount}</p>
            <p>獲得點數：${points} 點</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '確定購買',
        cancelButtonText: '取消'
    }).then((result) => {

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('jwt_token');

        if (!token) {
            Swal.fire('錯誤', '請先登入', 'error');
            return;
        }

        $.ajax({
            url: "https://subjugable-uncreditably-ignacia.ngrok-free.dev/api/ecpay/pay",
            type: "POST",
            data: {
                ecpayprice: String(amount)
            },
            headers: {
                "Authorization": "Bearer " + token
            },
            success: function(htmlResponse) {
                $("body").append(htmlResponse);
            },
            error: function(xhr) {
                Swal.fire('失敗', '跳轉失敗，請重新登入', 'error');
            }
        });

    });
}

const urlParams = new URLSearchParams(window.location.search);




