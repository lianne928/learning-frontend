// StudentChat.js — 學生訊息中心

const conversations = [
    {
        id: 0,
        name: 'Sarah Chen',
        subject: '英文會話',
        avatar: 'https://i.pravatar.cc/44?img=47',
        messages: [
            { role: 'teacher', text: '同學你好，今天的功課有寫完嗎？', time: '09:15' },
            { role: 'student', text: '有！我把第三章的單字都背完了 😊', time: '09:20' },
            { role: 'teacher', text: '太棒了！那我們等一下來做個小測驗確認一下吧。', time: '09:22' },
            { role: 'student', text: '沒問題！我準備好了。', time: '09:25' },
            { role: 'teacher', text: '好的！那我們下次課繼續練習發音。', time: '10:32' },
        ]
    },
    {
        id: 1,
        name: 'David Wang',
        subject: '商用英文',
        avatar: 'https://i.pravatar.cc/44?img=12',
        messages: [
            { role: 'teacher', text: '你好，上次的作業寫得不錯！', time: '14:00' },
            { role: 'student', text: '謝謝老師的鼓勵！', time: '14:05' },
            { role: 'teacher', text: '請記得預習第五課的商務郵件範例。', time: '14:10' },
        ]
    },
    {
        id: 2,
        name: 'Amy Liu',
        subject: '英文文法',
        avatar: 'https://i.pravatar.cc/44?img=32',
        messages: [
            { role: 'teacher', text: '這週的文法練習做完了嗎？', time: '10:00' },
            { role: 'student', text: '做完了，但有幾題不太確定。', time: '10:08' },
            { role: 'teacher', text: '你的進步非常大，繼續加油！', time: '10:15' },
        ]
    },
    {
        id: 3,
        name: 'Kevin Ho',
        subject: '英文口說',
        avatar: 'https://i.pravatar.cc/44?img=8',
        messages: [
            { role: 'teacher', text: '下週的課我改到週四下午三點，方便嗎？', time: '09:30' },
            { role: 'student', text: '可以的，謝謝老師通知！', time: '09:45' },
        ]
    }
];

let currentId = 0;

function renderMessages(id) {
    const conv = conversations.find(c => c.id === id);
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    conv.messages.forEach(msg => {
        const row = document.createElement('div');
        row.className = `msg-row ${msg.role}`;

        if (msg.role === 'teacher') {
            row.innerHTML = `
                <img src="${conv.avatar}" alt="${conv.name}" class="msg-row-avatar">
                <div class="msg-content">
                    <div class="msg-bubble">${escapeHtml(msg.text)}</div>
                    <span class="msg-time">${msg.time}</span>
                </div>`;
        } else {
            row.innerHTML = `
                <div class="msg-content">
                    <div class="msg-bubble">${escapeHtml(msg.text)}</div>
                    <span class="msg-time">${msg.time}</span>
                </div>`;
        }

        container.appendChild(row);
    });

    scrollToBottom();
}

function updateHeader(id) {
    const conv = conversations.find(c => c.id === id);
    document.getElementById('headerAvatar').src = conv.avatar;
    document.getElementById('headerAvatar').alt = conv.name;
    document.getElementById('headerName').textContent = conv.name;
    document.getElementById('headerTag').textContent = conv.subject;
}

function switchConversation(id) {
    currentId = id;

    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === id);
    });

    updateHeader(id);
    renderMessages(id);
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');
}

function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    const conv = conversations.find(c => c.id === currentId);
    const time = getCurrentTime();

    conv.messages.push({ role: 'student', text, time });

    const container = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'msg-row student';
    row.innerHTML = `
        <div class="msg-content">
            <div class="msg-bubble">${escapeHtml(text)}</div>
            <span class="msg-time">${time}</span>
        </div>`;
    container.appendChild(row);

    input.value = '';
    scrollToBottom();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Event Listeners ──

document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
        switchConversation(parseInt(item.dataset.id));
    });
});

document.getElementById('sendBtn').addEventListener('click', sendMessage);

document.getElementById('msgInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.getElementById('searchInput').addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.contact-name').textContent.toLowerCase();
        const tag = item.querySelector('.subject-tag').textContent.toLowerCase();
        item.style.display = (name.includes(query) || tag.includes(query)) ? '' : 'none';
    });
});

// ── Init ──
renderMessages(0);
