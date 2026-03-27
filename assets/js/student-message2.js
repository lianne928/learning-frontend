
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

// Chat Data
const chatData = {
    sarah: {
        name: "Teacher Sarah",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuC7-0ktyy4gZ7JY_5Ng4DtfkO-GcyMl0AfRDdBPdN62-VV1l4EC65oMmqawhjn5Rq8fleX-AhVCclzLgvcxp_r81Q2FkSnTSpQZaXfWqe62Q8uVcHHV4DADhndw7FJKzPAN3P3XpCuuNkp3xUqCl_uI0nbw3MMN15dkWXI0FHP3-oVCJw5rpxMd_mwfvqjcSNeLFTRvJr2Vi0CACLKSvW7fUH9xiCuVJSZC5_xWoR26XI34oXHgYiAGLE4JGEcyLuZZAP9oA6c1yLsD",
        messages: [
            { type: 'divider', text: '三月 26, 2026' },
            { type: 'sent', text: '老師好！請問這週的作業是什麼？', time: '10:00 AM' },
            { type: 'received', text: 'Leo 你好！這週請練習錄製一段自我介紹的影片。', time: '10:15 AM' },
            { type: 'received', text: '發音部分可以多注意 "th" 的發音。', time: '10:16 AM' },
            { type: 'sent', text: '好的，謝謝老師！我會練習的。', time: '10:25 AM' },
            { type: 'received', text: 'Leo 今天的表現很棒喔！', time: '10:30 AM' }
        ]
    },
    mike: {
        name: "Teacher Mike",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBhjRi6kj4DgSmvufmBI5Y1gFygEnyEf9k-SL0f9d1htgDYB84HWfK9QdrRAEuy5ZNTzYHYVJqvzYQEdzUXmwgn56NtawacXHKwuX9QlyEaNxH35HMiP1KQfIGpYWZbPriiYfyxw6xPuEbVjZmGNJLESt5ZgdV_NnFLMiIiM0WYNcXQbr1ynDR2rfo5SicowRUYfOeYocEZf84_w3HallO4afcstHA8E1tJhFfT5COFlTt1o-QKeHi5AzpaZEPpXGtQ_oLlHU0chf1t",
        messages: [
            { type: 'divider', text: '三月 25, 2026' },
            { type: 'received', text: 'Hi Leo, 關於下週三的商務英語課程，你有想討論的主題嗎？', time: '2:15 PM' },
            { type: 'sent', text: '我想加強簡報時的開場白。', time: '3:05 PM' },
            { type: 'received', text: '沒問題，下週的課程時間確認了嗎？', time: '5:40 PM' }
        ]
    },
    emily: {
        name: "Teacher Emily",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4vSNT2iIEjUsHY7MTN_o2vtbwhnZtiTitqJ0WNth8OqjtQwNMjuixKOA4Gdn-oOxX2YRN0CEkDZC5kRhLvvb-5W5PPGxECJEidZrDR7MDKCNpvb6fFQIpeKqYvBCyhWxnJy3SrBXqJJT1IigWOXzto-un_nSV7P7cd-DO-6Xqfv36XzBd3jHayDX1qucVB7UfxVX8AX16KSajlvhGFzWpgIgdqarYo7WtnNLZHPAvYAViDkSrXWx5KnLLkANbVeXKoY7Nd6YzmaIa",
        messages: [
            { type: 'divider', text: '三月 20, 2026' },
            { type: 'sent', text: 'Emily老師，我已經把上次的繪畫習作寄到你的信箱了。', time: '10:00 AM' },
            { type: 'received', text: '收到了，我看完會給你反饋。', time: '11:20 AM' },
            { type: 'received', text: '好的，我會準備相關教材。', time: '4:15 PM' }
        ]
    }
};

// Draft Message Store
const draftMessages = {
    sarah: '',
    mike: '',
    emily: ''
};

const chatListItems = document.querySelectorAll('.chat-item');
const messagesContainer = document.getElementById('messagesContainer');
const headerName = document.getElementById('headerName');
const headerAvatar = document.getElementById('headerAvatar');
const chatWindow = document.getElementById('chatWindow');
const chatSidebar = document.getElementById('chatSidebar');
const closeChat = document.getElementById('closeChat');
const chatSearch = document.getElementById('chatSearch');
const msgInput = document.getElementById('messageInput');

function renderMessages(chatId) {
    const chat = chatData[chatId];
    headerName.textContent = chat.name;
    headerAvatar.src = chat.avatar;

    messagesContainer.innerHTML = '';
    chat.messages.forEach(msg => {
        if (msg.type === 'divider') {
            messagesContainer.innerHTML += `<div class="date-divider"><span>${msg.text}</span></div>`;
        } else {
            const messageHtml = `
                    <div class="message ${msg.type}">
                        ${msg.type === 'received' ? `<img class="msg-avatar" src="${chat.avatar}"/>` : ''}
                        <div class="msg-bubble">${msg.text}</div>
<div class="msg-info">
                            ${msg.time} 
                        </div>
</div>
                `;
            messagesContainer.innerHTML += messageHtml;
        }
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Restore draft message for this contact
    msgInput.value = draftMessages[chatId] || '';
}

chatListItems.forEach(item => {
    item.addEventListener('click', () => {
        // Save current input to draft store for the OLD active chat
        const currentActive = document.querySelector('.chat-item.active');
        if (currentActive) {
            const prevChatId = currentActive.getAttribute('data-chat-id');
            draftMessages[prevChatId] = msgInput.value;
        }

        chatListItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const chatId = item.getAttribute('data-chat-id');

        renderMessages(chatId);

        if (window.innerWidth <= 768) {
            chatWindow.classList.add('active');
            chatSidebar.classList.add('hidden');
        }
    });
});

closeChat.addEventListener('click', () => {
    chatWindow.classList.remove('active');
    chatSidebar.classList.remove('hidden');
});

chatSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    chatListItems.forEach(item => {
        const name = item.querySelector('h4').textContent.toLowerCase();
        const preview = item.querySelector('.item-preview p').textContent.toLowerCase();
        if (name.includes(term) || preview.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Initial load
renderMessages('sarah');

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageHtml = `
            <div class="message sent">
<div class="msg-bubble">${text}</div>
<div class="msg-info">
                    ${timeStr}
                </div>
</div>
        `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);

    // Clear input and draft
    const activeItem = document.querySelector('.chat-item.active');
    if (activeItem) {
        const chatId = activeItem.getAttribute('data-chat-id');
        draftMessages[chatId] = '';

        // Optional: Update the chat list preview
        activeItem.querySelector('.item-preview p').textContent = text;
        activeItem.querySelector('.time').textContent = timeStr;
    }

    messageInput.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
