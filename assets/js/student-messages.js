// ==========================================
// 學生訊息中心邏輯 (student-messages.js)
// ==========================================

const mockConversations = [
    {
        id: 1,
        teacherName: 'Sarah Chen',
        subject: '英文會話',
        avatar: 'https://i.pravatar.cc/48?img=47',
        lastMessage: '好的！那我們下次課繼續練習發音。',
        time: '10:32',
        unread: 2,
        messages: [
            { from: 'teacher', text: '同學你好，今天的功課有寫完嗎？', time: '09:15' },
            { from: 'me', text: '有！我把第三章的單字都背完了 😊', time: '09:20' },
            { from: 'teacher', text: '太棒了！那我們等一下來做個小測驗確認一下吧。', time: '09:22' },
            { from: 'me', text: '沒問題！我準備好了。', time: '09:25' },
            { from: 'teacher', text: '好的！那我們下次課繼續練習發音。', time: '10:32' },
        ]
    },
    {
        id: 2,
        teacherName: 'David Wang',
        subject: '商用英文',
        avatar: 'https://i.pravatar.cc/48?img=12',
        lastMessage: '請記得預習第五課的商務郵件範例。',
        time: '昨天',
        unread: 0,
        messages: [
            { from: 'teacher', text: '本週課程進度到商務郵件的寫法，你覺得有什麼困難嗎？', time: '14:00' },
            { from: 'me', text: '開頭語和結尾語我還不太確定怎麼選擇。', time: '14:05' },
            { from: 'teacher', text: '這很正常！我下次課會整理一個範本給你。', time: '14:07' },
            { from: 'teacher', text: '請記得預習第五課的商務郵件範例。', time: '17:30' },
        ]
    },
    {
        id: 3,
        teacherName: 'Amy Liu',
        subject: '英文文法',
        avatar: 'https://i.pravatar.cc/48?img=32',
        lastMessage: '你的進步非常大，繼續加油！',
        time: '週一',
        unread: 0,
        messages: [
            { from: 'teacher', text: '這週的時態作業做得很好！', time: '11:00' },
            { from: 'me', text: '謝謝老師，我花了很多時間複習 😅', time: '11:10' },
            { from: 'teacher', text: '你的進步非常大，繼續加油！', time: '11:12' },
        ]
    },
    {
        id: 4,
        teacherName: 'Kevin Ho',
        subject: '英文口說',
        avatar: 'https://i.pravatar.cc/48?img=60',
        lastMessage: '下週的課我改到週四下午三點，可以嗎？',
        time: '3/18',
        unread: 1,
        messages: [
            { from: 'me', text: '老師你好，我想預約下週的口說練習課。', time: '15:00' },
            { from: 'teacher', text: '好的，請問你方便哪個時段？', time: '15:30' },
            { from: 'me', text: '週四或週五下午都可以。', time: '15:35' },
            { from: 'teacher', text: '下週的課我改到週四下午三點，可以嗎？', time: '16:00' },
        ]
    }
];

let currentConvId = 1;

function renderContactList(filter = '') {
    const list = document.getElementById('contact-list');
    const filtered = mockConversations.filter(c =>
        c.teacherName.toLowerCase().includes(filter.toLowerCase()) ||
        c.subject.includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <div class="contact-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}" onclick="selectConversation(${c.id})">
            <div class="contact-avatar-wrap">
                <img src="${c.avatar}" alt="${c.teacherName}" class="contact-avatar">
                <span class="contact-status-dot"></span>
            </div>
            <div class="contact-info">
                <div class="contact-top">
                    <span class="contact-name">${c.teacherName}</span>
                    <span class="contact-time">${c.time}</span>
                </div>
                <div class="contact-bottom">
                    <span class="contact-last">${c.lastMessage}</span>
                    ${c.unread > 0 ? `<span class="contact-badge">${c.unread}</span>` : ''}
                </div>
                <div class="contact-subject">${c.subject}</div>
            </div>
        </div>
    `).join('');
}

function renderChatWindow(convId) {
    const conv = mockConversations.find(c => c.id === convId);
    if (!conv) return;

    // Header
    document.getElementById('chat-teacher-avatar').src = conv.avatar;
    document.getElementById('chat-teacher-name').textContent = conv.teacherName;
    document.getElementById('chat-subject-tag').textContent = conv.subject;

    // Messages
    const msgArea = document.getElementById('chat-messages');
    msgArea.innerHTML = conv.messages.map(m => `
        <div class="msg-row ${m.from === 'me' ? 'msg-row--me' : 'msg-row--teacher'}">
            ${m.from === 'teacher' ? `<img src="${conv.avatar}" class="msg-avatar" alt="">` : ''}
            <div class="msg-bubble ${m.from === 'me' ? 'msg-bubble--me' : 'msg-bubble--teacher'}">
                ${m.text}
                <div class="msg-time">${m.time}</div>
            </div>
        </div>
    `).join('');

    // Clear unread
    conv.unread = 0;

    // Scroll to bottom
    msgArea.scrollTop = msgArea.scrollHeight;
}

function selectConversation(id) {
    currentConvId = id;
    renderContactList(document.getElementById('search-input').value);
    renderChatWindow(id);

    // On mobile, show chat panel
    document.getElementById('chat-panel').classList.add('chat-panel--visible');
    document.getElementById('contacts-panel').classList.add('contacts-panel--hidden');
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const conv = mockConversations.find(c => c.id === currentConvId);
    if (!conv) return;

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    conv.messages.push({ from: 'me', text, time });
    conv.lastMessage = text;
    conv.time = time;

    input.value = '';
    renderContactList(document.getElementById('search-input').value);
    renderChatWindow(currentConvId);
}

document.addEventListener('DOMContentLoaded', () => {
    renderContactList();
    renderChatWindow(currentConvId);

    // Search
    document.getElementById('search-input').addEventListener('input', e => {
        renderContactList(e.target.value);
    });

    // Send on Enter (Shift+Enter = newline)
    document.getElementById('msg-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Back button (mobile)
    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('chat-panel').classList.remove('chat-panel--visible');
            document.getElementById('contacts-panel').classList.remove('contacts-panel--hidden');
        });
    }
});
