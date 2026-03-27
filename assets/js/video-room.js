// ═══════════════════════════════════════════════════
//  Config & Globals
// ═══════════════════════════════════════════════════
const API_BASE_URL = 'http://localhost:8080/api';
const WS_URL       = 'http://localhost:8080/ws';

const urlParams = new URLSearchParams(window.location.search);
const bookingId = urlParams.get('bookingId');

const token    = localStorage.getItem('jwt_token');
const userId   = localStorage.getItem('userId');
// userRole stored as 'TUTOR' or 'STUDENT' from login.js
const userRole = (localStorage.getItem('userRole') || '').toLowerCase(); // 'tutor' | 'student'
const userName = localStorage.getItem('userName') || '我';

let stompClient       = null;
let peerConnection    = null;
let localStream       = null;
let screenStream      = null;
let isMicMuted        = false;
let isCamOff          = false;
let isSharingScreen   = false;
let isConnected       = false;
let iceCandidateQueue = [];

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ═══════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    // Guard: require token + bookingId
    if (!bookingId) {
        alert('缺少有效的預約連結，請重新進入教室');
        window.location.href = 'index.html';
        return;
    }
    if (!token) {
        // 儲存目標頁面，登入後自動返回
        localStorage.setItem('redirect_after_login', window.location.href);
        alert('請先登入以進入教室');
        window.location.href = 'login.html';
        return;
    }

    initNavbar();
    document.getElementById('chat-booking-id').textContent = bookingId;

    if (document.getElementById('prejoin-overlay')) {
        initPreJoin();   // 顯示前置畫面，等待使用者點擊「進入教室」
    } else {
        enterRoom();     // 無前置畫面時直接進入（相容舊行為）
    }
});

// ═══════════════════════════════════════════════════
//  Pre-join
// ═══════════════════════════════════════════════════
async function initPreJoin() {
    const courseNameEl = document.getElementById('prejoin-course-name');
    if (courseNameEl) {
        try {
            const endpoint = userRole === 'tutor'
                ? `${API_BASE_URL}/tutor/bookings`
                : `${API_BASE_URL}/student/bookings`;
            const res = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const booking = (res.data || []).find(b =>
                String(b.id) === String(bookingId) || String(b.orderId) === String(bookingId)
            );
            courseNameEl.textContent = booking?.courseName || `#${bookingId}`;
        } catch (err) {
            console.warn('無法取得課程名稱', err);
            courseNameEl.textContent = `#${bookingId}`;
        }
    }

    let previewStream = null;
    try {
        previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('prejoin-video').srcObject = previewStream;
    } catch (err) {
        console.warn('無法取得預覽媒體：', err);
        const icon = document.getElementById('prejoin-cam-off-icon');
        if (icon) icon.style.display = 'flex';
    }

    // 麥克風切換
    document.getElementById('btn-pre-mic').addEventListener('click', () => {
        if (!previewStream) return;
        const tracks = previewStream.getAudioTracks();
        tracks.forEach(t => { t.enabled = !t.enabled; });
        const btn = document.getElementById('btn-pre-mic');
        const muted = tracks[0] ? !tracks[0].enabled : true;
        btn.classList.toggle('muted', muted);
        btn.querySelector('i').className = muted ? 'bi bi-mic-mute-fill' : 'bi bi-mic-fill';
        btn.title = muted ? '取消靜音' : '靜音';
    });

    // 攝影機切換
    document.getElementById('btn-pre-cam').addEventListener('click', () => {
        if (!previewStream) return;
        const tracks = previewStream.getVideoTracks();
        tracks.forEach(t => { t.enabled = !t.enabled; });
        const btn = document.getElementById('btn-pre-cam');
        const off = tracks[0] ? !tracks[0].enabled : true;
        btn.classList.toggle('cam-off', off);
        btn.querySelector('i').className = off ? 'bi bi-camera-video-off-fill' : 'bi bi-camera-video-fill';
        btn.title = off ? '開啟鏡頭' : '關閉鏡頭';
        const icon = document.getElementById('prejoin-cam-off-icon');
        const vid  = document.getElementById('prejoin-video');
        if (icon) icon.style.display = off ? 'flex' : 'none';
        if (vid)  vid.style.visibility = off ? 'hidden' : 'visible';
    });

    // 進入教室按鈕
    document.getElementById('btn-enter-room').addEventListener('click', () => {
        if (previewStream) previewStream.getTracks().forEach(t => t.stop());
        document.getElementById('prejoin-overlay').style.display = 'none';
        document.getElementById('room-layout').style.display = '';
        enterRoom();
    });
}

// ═══════════════════════════════════════════════════
//  Enter Room (actual session start)
// ═══════════════════════════════════════════════════
function enterRoom() {
    startLocalMedia();
    connectStomp();
    loadChatHistory();
    fetchRoomStatus();
    bindControls();
    bindChat();
}

// ═══════════════════════════════════════════════════
//  Navbar (same pattern as explore.html)
// ═══════════════════════════════════════════════════
function initNavbar() {
    const authNavItem = document.getElementById('auth-nav-item');
    if (!token || !authNavItem) return;
    try {
        let base64Url = token.split('.')[1];
        let base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        const payload = JSON.parse(decodeURIComponent(
            atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        ));
        const realName = payload.name || userName || '會員';
        authNavItem.innerHTML = `
            <span style="color:#2563EB;font-weight:bold;padding:0 15px;">👋 ${realName}</span>
            <a href="#" onclick="logout()" style="text-decoration:none;color:#d9534f;font-weight:bold;border-left:2px solid #d9534f;padding-left:15px;">登出</a>
        `;
    } catch (e) {
        console.error('Token 解析失敗:', e);
    }
}

function logout() {
    if (confirm('確定要登出嗎？')) {
        cleanup();
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
    }
}

// ═══════════════════════════════════════════════════
//  Local Media
// ═══════════════════════════════════════════════════
async function startLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
    } catch (err) {
        console.warn('無法取得本地媒體：', err);
        document.getElementById('local-placeholder-icon').style.display = 'flex';
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            alert('找不到攝影機或麥克風裝置，請確認設備已連接。');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert('請允許瀏覽器存取攝影機和麥克風。');
        }
    }
}

// ═══════════════════════════════════════════════════
//  STOMP / WebSocket
// ═══════════════════════════════════════════════════
function connectStomp() {
    stompClient = new StompJs.Client({
        webSocketFactory: () => new SockJS(WS_URL),
        connectHeaders: {
            'Authorization': `Bearer ${token}`
        },
        reconnectDelay: 5000,
        onConnect:    onStompConnected,
        onDisconnect: () => { isConnected = false; },
        onStompError: frame => console.error('STOMP error', frame)
    });
    stompClient.activate();
}

function onStompConnected() {
    isConnected = true;

    stompClient.subscribe(`/topic/room/${bookingId}/signal`, onSignalMessage);
    stompClient.subscribe(`/topic/room/${bookingId}/chat`,   onChatMessage);
    stompClient.subscribe(`/topic/room/${bookingId}/events`, onRoomEvent);
    stompClient.subscribe(`/topic/room/${bookingId}/errors`, onRoomError);

    publishEvent('joined');
}

function publishEvent(type) {
    if (!isConnected || !stompClient) return;
    stompClient.publish({
        destination: `/app/event/${bookingId}`,
        body: JSON.stringify({
            type:      type,
            role:      userRole,
            userId:    userId,
            timestamp: new Date().toISOString()
        })
    });
}

// ═══════════════════════════════════════════════════
//  Room Status
// ═══════════════════════════════════════════════════
async function fetchRoomStatus() {
    try {
        const res = await axios.get(`${API_BASE_URL}/room/${bookingId}/participants`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        updateRoomStatusBadge(res.data.state);
        if (res.data.state === 'ENDED') showEndedOverlay();
    } catch (err) {
        console.warn('無法取得房間狀態', err);
    }
}

function updateRoomStatusBadge(state) {
    const badge  = document.getElementById('room-status-badge');
    const icons  = { WAITING: '⏳', ACTIVE: '🟢', ENDED: '🔴' };
    const labels = { WAITING: '等待對方加入...', ACTIVE: '課程進行中', ENDED: '課程已結束' };
    badge.className = 'room-status-badge ' + (state || 'waiting').toLowerCase();
    document.getElementById('status-icon').textContent = icons[state]  || '⏳';
    document.getElementById('status-text').textContent = labels[state] || state;
}

function showEndedOverlay() {
    document.getElementById('ended-overlay').classList.add('show');
    // Disable controls
    ['btn-mic', 'btn-cam', 'btn-screen', 'btn-hangup'].forEach(id => {
        document.getElementById(id).disabled = true;
        document.getElementById(id).style.opacity = '0.4';
    });
    document.getElementById('btn-send').disabled = true;
    document.getElementById('chat-text-input').disabled = true;
    document.getElementById('btn-attach').style.pointerEvents = 'none';
    document.getElementById('btn-attach').style.opacity = '0.4';
}

// ═══════════════════════════════════════════════════
//  Room Events
// ═══════════════════════════════════════════════════
function onRoomEvent(frame) {
    const evt = JSON.parse(frame.body);

    if (evt.role === userRole) return; // ignore own events

    if (evt.type === 'joined') {
        document.getElementById('peer-status-dot').className = 'peer-dot online';
        initiateCallIfCaller();
    }

    if (evt.type === 'left') {
        document.getElementById('peer-status-dot').className = 'peer-dot offline';
        if (peerConnection) { peerConnection.close(); peerConnection = null; }
        const remoteVideo = document.getElementById('remote-video');
        remoteVideo.srcObject = null;
        document.getElementById('remote-placeholder').classList.remove('hidden');
        updateRoomStatusBadge('WAITING');
    }
}

function onRoomError(frame) {
    const err = JSON.parse(frame.body);
    console.error('Room error:', err.code, err.message);
}

// ═══════════════════════════════════════════════════
//  WebRTC
// ═══════════════════════════════════════════════════
function createPeerConnection() {
    if (peerConnection) { peerConnection.close(); }
    peerConnection    = new RTCPeerConnection(ICE_CONFIG);
    iceCandidateQueue = [];

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Receive remote stream
    peerConnection.ontrack = event => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            document.getElementById('remote-placeholder').classList.add('hidden');
        }
    };

    // Send ICE candidates via STOMP
    peerConnection.onicecandidate = event => {
        if (event.candidate && isConnected) {
            stompClient.publish({
                destination: `/app/signal/${bookingId}`,
                body: JSON.stringify({
                    type:          'candidate',
                    senderRole:    userRole,
                    candidate:     event.candidate.candidate,
                    sdpMid:        event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                })
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'connected')                        updateRoomStatusBadge('ACTIVE');
        if (state === 'disconnected' || state === 'failed') updateRoomStatusBadge('WAITING');
    };
}

// Student always initiates the offer
async function initiateCallIfCaller() {
    if (userRole !== 'student') return;
    createPeerConnection();
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        stompClient.publish({
            destination: `/app/signal/${bookingId}`,
            body: JSON.stringify({
                type:       'offer',
                senderRole: userRole,
                sdp:        peerConnection.localDescription.sdp
            })
        });
    } catch (err) {
        console.error('建立 offer 失敗:', err);
    }
}

async function onSignalMessage(frame) {
    const msg = JSON.parse(frame.body);

    // Ignore own signals
    if (msg.senderRole === userRole) return;

    if (msg.type === 'offer') {
        createPeerConnection();
        try {
            await peerConnection.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            await flushIceCandidates();
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            stompClient.publish({
                destination: `/app/signal/${bookingId}`,
                body: JSON.stringify({
                    type:       'answer',
                    senderRole: userRole,
                    sdp:        answer.sdp
                })
            });
        } catch (err) {
            console.error('處理 offer 失敗:', err);
        }
    }

    else if (msg.type === 'answer') {
        if (!peerConnection) return;
        try {
            await peerConnection.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            await flushIceCandidates();
        } catch (err) {
            console.error('處理 answer 失敗:', err);
        }
    }

    else if (msg.type === 'candidate') {
        const candidate = new RTCIceCandidate({
            candidate:     msg.candidate,
            sdpMid:        msg.sdpMid,
            sdpMLineIndex: msg.sdpMLineIndex
        });
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidate).catch(console.warn);
        } else {
            iceCandidateQueue.push(candidate);
        }
    }
}

async function flushIceCandidates() {
    while (iceCandidateQueue.length) {
        await peerConnection.addIceCandidate(iceCandidateQueue.shift()).catch(console.warn);
    }
}

// ═══════════════════════════════════════════════════
//  Control Bar
// ═══════════════════════════════════════════════════
function bindControls() {
    document.getElementById('btn-mic').addEventListener('click', toggleMic);
    document.getElementById('btn-cam').addEventListener('click', toggleCam);
    document.getElementById('btn-screen').addEventListener('click', toggleScreen);
    document.getElementById('btn-hangup').addEventListener('click', hangUp);
}

function toggleMic() {
    isMicMuted = !isMicMuted;
    if (localStream) {
        localStream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
    }
    const btn = document.getElementById('btn-mic');
    btn.classList.toggle('muted', isMicMuted);
    btn.querySelector('i').className = isMicMuted ? 'bi bi-mic-mute-fill' : 'bi bi-mic-fill';
    btn.title = isMicMuted ? '取消靜音' : '靜音';
}

function toggleCam() {
    isCamOff = !isCamOff;
    if (localStream) {
        localStream.getVideoTracks().forEach(t => { t.enabled = !isCamOff; });
    }
    const btn = document.getElementById('btn-cam');
    btn.classList.toggle('cam-off', isCamOff);
    btn.querySelector('i').className = isCamOff ? 'bi bi-camera-video-off-fill' : 'bi bi-camera-video-fill';
    btn.title = isCamOff ? '開啟鏡頭' : '關閉鏡頭';
    document.getElementById('local-placeholder-icon').style.display = isCamOff ? 'flex' : 'none';
}

async function toggleScreen() {
    if (!isSharingScreen) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Replace video track in peer connection
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack).catch(console.warn);
            }

            document.getElementById('local-video').srcObject = screenStream;
            isSharingScreen = true;
            document.getElementById('btn-screen').classList.add('sharing');
            document.getElementById('btn-screen').title = '停止分享';

            screenTrack.onended = stopScreenShare;
        } catch (err) {
            console.warn('螢幕分享取消或失敗:', err);
        }
    } else {
        stopScreenShare();
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    // Restore camera track
    if (localStream && peerConnection) {
        const camTrack = localStream.getVideoTracks()[0];
        const sender   = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && camTrack) sender.replaceTrack(camTrack).catch(console.warn);
    }
    if (localStream) document.getElementById('local-video').srcObject = localStream;
    isSharingScreen = false;
    document.getElementById('btn-screen').classList.remove('sharing');
    document.getElementById('btn-screen').title = '分享螢幕';
}

function hangUp() {
    if (!confirm('確定要離開教室嗎？')) return;
    publishEvent('left');
    cleanup();
    /* 離開教室回歸html */
    window.location.href = 'index.html';
}

function cleanup() {
    if (localStream)    { localStream.getTracks().forEach(t => t.stop());    localStream    = null; }
    if (screenStream)   { screenStream.getTracks().forEach(t => t.stop());   screenStream   = null; }
    if (peerConnection) { peerConnection.close();                             peerConnection = null; }
    if (stompClient)    { stompClient.deactivate();                           stompClient    = null; }
    isConnected = false;
}

// ═══════════════════════════════════════════════════
//  Chat — History
// ═══════════════════════════════════════════════════
async function loadChatHistory() {
    try {
        const res = await axios.get(`${API_BASE_URL}/chatMessage/booking/${bookingId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        (res.data || []).forEach(msg => appendMessage(msg, msg.role === userRole));
        scrollChatToBottom();
    } catch (err) {
        console.error('無法載入聊天記錄', err);
    }
}

// ═══════════════════════════════════════════════════
//  Chat — Incoming
// ═══════════════════════════════════════════════════
function onChatMessage(frame) {
    const msg = JSON.parse(frame.body);
    appendMessage(msg, msg.role === userRole);
    scrollChatToBottom();
}

// ═══════════════════════════════════════════════════
//  Chat — Send & Upload
// ═══════════════════════════════════════════════════
function bindChat() {
    const input    = document.getElementById('chat-text-input');
    const btnSend  = document.getElementById('btn-send');
    const fileInput = document.getElementById('file-input');

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextMessage(); }
    });
    btnSend.addEventListener('click', sendTextMessage);
    fileInput.addEventListener('change', handleFileUpload);
}

function sendTextMessage() {
    if (!isConnected) { alert('尚未連線，請稍候再試'); return; }
    const input = document.getElementById('chat-text-input');
    const text  = input.value.trim();
    if (!text) return;

    stompClient.publish({
        destination: `/app/chat/${bookingId}`,
        body: JSON.stringify({
            bookingId:   parseInt(bookingId),
            role:        userRole,
            messageType: 1,
            message:     text
        })
    });
    input.value = '';
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const btnAttach = document.getElementById('btn-attach');
    btnAttach.classList.add('uploading');

    const formData = new FormData();
    formData.append('file',      file);
    formData.append('bookingId', bookingId);
    formData.append('role',      userRole);

    try {
        const res = await axios.post(`${API_BASE_URL}/chatMessage/upload`, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'multipart/form-data'
            }
        });
        // Send message via STOMP so both parties receive it
        const mediaUrl = res.data.mediaUrl || '';
        const msgType  = detectMessageType(file.type);
        if (isConnected) {
            stompClient.publish({
                destination: `/app/chat/${bookingId}`,
                body: JSON.stringify({
                    bookingId:   parseInt(bookingId),
                    role:        userRole,
                    messageType: msgType,
                    message:     file.name,
                    mediaUrl:    mediaUrl
                })
            });
        }
    } catch (err) {
        alert('檔案上傳失敗：' + (err.response?.data?.message || err.message));
    } finally {
        btnAttach.classList.remove('uploading');
    }
}

// ═══════════════════════════════════════════════════
//  Chat — Render
// ═══════════════════════════════════════════════════
function appendMessage(msg, isMine) {
    const container = document.getElementById('chat-messages');
    const type = msg.messageType || 1;

    const row = document.createElement('div');
    row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    const roleName = msg.role === 'tutor' ? '老師' : '學生';
    meta.textContent = `${isMine ? '我' : roleName} · ${formatTime(msg.createdAt)}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (type === 1) {
        // TEXT
        bubble.textContent = msg.message;
        const url = extractUrl(msg.message);
        if (url) fetchAndAppendLinkPreview(url, row);

    } else if (type === 4) {
        // IMAGE
        const img = document.createElement('img');
        img.className = 'msg-image';
        img.alt = '圖片';
        img.onclick = () => window.open(img.src, '_blank');
        loadMediaWithAuth(img, msg.mediaUrl);
        bubble.classList.add('msg-bubble--image');
        bubble.appendChild(img);

    } else if (type === 3) {
        // VOICE
        const audio = document.createElement('audio');
        audio.className = 'msg-audio';
        audio.controls = true;
        loadMediaWithAuth(audio, msg.mediaUrl);
        bubble.appendChild(audio);

    } else if (type === 5) {
        // VIDEO
        const video = document.createElement('video');
        video.className = 'msg-video';
        video.controls = true;
        loadMediaWithAuth(video, msg.mediaUrl);
        bubble.appendChild(video);

    } else if (type === 6) {
        // FILE
        const a = document.createElement('a');
        a.className = 'msg-file-link';
        a.href = buildDownloadUrl(msg.mediaUrl);
        a.download = msg.message || '下載檔案';
        a.target = '_blank';
        const icon = document.createElement('i');
        icon.className = 'bi bi-file-earmark-arrow-down';
        a.appendChild(icon);
        a.appendChild(document.createTextNode(' ' + (msg.message || '附件')));
        bubble.appendChild(a);

    } else if (type === 2) {
        // STICKER
        bubble.style.cssText += 'font-size:2.5rem;border:none;background:transparent;box-shadow:none;padding:4px;';
        bubble.textContent = msg.message;
    }

    row.appendChild(meta);
    row.appendChild(bubble);
    container.appendChild(row);
}

// ═══════════════════════════════════════════════════
//  Link Preview
// ═══════════════════════════════════════════════════
async function fetchAndAppendLinkPreview(url, rowEl) {
    try {
        const res = await axios.get(`${API_BASE_URL}/linkPreview`, {
            params:  { url },
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = res.data;
        if (!data || !data.title) return;

        const card = document.createElement('div');
        card.className = 'link-preview-card';
        card.onclick = () => window.open(url, '_blank');

        if (data.imageUrl) {
            const img = document.createElement('img');
            img.src  = data.imageUrl;
            img.alt  = data.title;
            img.onerror = () => img.remove();
            card.appendChild(img);
        }
        const body = document.createElement('div');
        body.className = 'lp-body';
        body.innerHTML =
            `<div class="lp-title">${escapeHtml(data.title)}</div>` +
            (data.description ? `<div class="lp-desc">${escapeHtml(data.description)}</div>` : '') +
            `<div class="lp-url">${escapeHtml(safeHostname(data.url || url))}</div>`;
        card.appendChild(body);
        rowEl.appendChild(card);
        scrollChatToBottom();
    } catch { /* silent */ }
}

// ═══════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════
function scrollChatToBottom() {
    const el = document.getElementById('chat-messages');
    el.scrollTop = el.scrollHeight;
}

function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
        return new Date(isoStr).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}

function extractUrl(text) {
    const m = (text || '').match(/https?:\/\/[^\s]+/);
    return m ? m[0] : null;
}

function resolveMediaUrl(mediaUrl) {
    if (!mediaUrl) return '';
    if (mediaUrl.startsWith('http')) return mediaUrl;
    return API_BASE_URL + (mediaUrl.startsWith('/') ? '' : '/') + mediaUrl;
}

async function loadMediaWithAuth(element, mediaUrl) {
    if (!mediaUrl) return;
    // Use a relative URL so the Vite proxy forwards to the backend correctly.
    // resolveMediaUrl() prepends API_BASE_URL which produces /api/uploads/...
    // — the wrong path. Static uploads are served at /uploads/... (proxied).
    let url;
    if (mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:')) {
        url = mediaUrl;
    } else {
        url = (mediaUrl.startsWith('/') ? '' : '/') + mediaUrl;
    }
    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob'
        });
        element.src = URL.createObjectURL(res.data);
    } catch { /* leave src empty; element shows broken state */ }
}

function buildDownloadUrl(mediaUrl) {
    const filename = (mediaUrl || '').split('/').pop();
    return `${API_BASE_URL}/chatMessage/download/${filename}?name=${encodeURIComponent(filename)}`;
}

function detectMessageType(mimeType) {
    if (mimeType.startsWith('image/')) return 4;
    if (mimeType.startsWith('audio/')) return 3;
    if (mimeType.startsWith('video/')) return 5;
    return 6;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeHostname(url) {
    try { return new URL(url).hostname; } catch { return url; }
}

// ═══════════════════════════════════════════════════
//  Cleanup on page unload
// ═══════════════════════════════════════════════════
window.addEventListener('beforeunload', () => {
    publishEvent('left');
    cleanup();
});
