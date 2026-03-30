// ═══════════════════════════════════════════════════
//  Config & Globals
// ═══════════════════════════════════════════════════
const API_BASE_URL = '/api';
const WS_URL       = window.location.origin + '/ws';

const urlParams = new URLSearchParams(window.location.search);
const bookingId = urlParams.get('bookingId');

const token    = localStorage.getItem('jwt_token');
const userId   = localStorage.getItem('userId');
// userRole stored as 'TUTOR' or 'STUDENT' from login.js — normalizeRole 統一為 'tutor' | 'student'
const userRole = normalizeRole(localStorage.getItem('userRole'));
const userName = localStorage.getItem('userName') || '我';

/**
 * 透過後端 API 驗證 JWT 是否仍有效。
 * 呼叫已知的 room participants 端點，若回傳 401/403 即視為失效。
 */
async function isTokenExpired(jwt) {
    if (!jwt) return true;

    try {
        const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));

        // 過期驗證
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            console.warn('[JWT] token 已過期', new Date(payload.exp * 1000).toISOString());
            return true;
        }

        // 角色驗證：token 工作角色須與頁面當前 userRole 一致
        // authorities 可能是字串陣列或物件陣列（Spring Security 格式）
        let rawAuth = '';
        if (Array.isArray(payload.authorities) && payload.authorities.length > 0) {
            const first = payload.authorities[0];
            rawAuth = typeof first === 'string' ? first : (first?.authority || '');
        }
        const tokenRole = normalizeRole(payload.role || payload.userRole || rawAuth);
        if (tokenRole && tokenRole !== userRole) {
            console.warn('[JWT] 角色不符，token:', tokenRole, '當前:', userRole);
            return true;
        }

        return false;
    } catch (err) {
        console.warn('[JWT] 解析失敗，視為無效', err);
        return true;
    }
}

let stompClient       = null;
let peerConnection    = null;
let localStream       = null;
let screenStream      = null;
let isMicMuted        = false;
let isCamOff          = false;
let isSharingScreen   = false;
let isConnected       = false;
let iceCandidateQueue = [];
let offerRetryTimer   = null;   // 重試 offer 的計時器
let peerReady         = false;  // 對方是否已在房間

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // TURN 伺服器：NAT 穿透失敗時透過 relay 轉發，解決雙方看不到對方視訊的問題
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 2
};

function normalizeRole(role) {
    const raw = String(role || '').trim().toLowerCase();
    if (raw === '1' || raw === 'student' || raw === 'role_student') return 'student';
    if (raw === '2' || raw === 'tutor' || raw === 'teacher' || raw === 'role_tutor' || raw === 'role_teacher') return 'tutor';
    return raw;
}

function roleToNumber(role) {
    if (role === 'student') return 1;
    if (role === 'tutor')   return 2;
    return role;
}

// ═══════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    // Guard: require token + bookingId
    if (!bookingId) {
        alert('缺少有效的預約連結，請重新進入教室');
        window.location.href = 'student-courses.html';
        return;
    }
    if (!token) {
        // 儲存目標頁面，登入後自動返回
        localStorage.setItem('redirect_after_login', window.location.href);
        alert('請先登入以進入教室');
        window.location.href = 'login.html';
        return;
    }

    // Token 過期預檢（透過後端驗證）
    if (await isTokenExpired(token)) {
        localStorage.setItem('redirect_after_login', window.location.href);
        alert('登入已過期，請重新登入');
        window.location.href = 'login.html';
        return;
    }

    // 頁面角色驗證：若角色不符則自動導向正確的視訊頁面
    const isTeacherPage = /teacher-VideoRoom/i.test(window.location.pathname);
    const isStudentPage = /Student-VideoRoom/i.test(window.location.pathname);
    if (isTeacherPage && userRole !== 'tutor') {
        alert('您的帳號為學生，正在為您導向學生教室');
        window.location.href = `Student-VideoRoom.html?bookingId=${bookingId}`;
        return;
    }
    if (isStudentPage && userRole !== 'student') {
        alert('您的帳號為老師，正在為您導向老師教室');
        window.location.href = `teacher-VideoRoom.html?bookingId=${bookingId}`;
        return;
    }

    // 非安全上下文（HTTP 且非 localhost）提醒
    if (!window.isSecureContext) {
        console.warn('[Security] 未使用 HTTPS，攝影機/麥克風將無法使用。請透過 HTTPS 或 localhost 存取。');
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

    // iOS Safari 要求 getUserMedia 必須在使用者手勢內呼叫；
    // 頁面載入時呼叫可能被拒絕，此處先嘗試，失敗則顯示「點擊預覽」提示。
    const tryPreview = async () => {
        try {
            previewStream = await getUserMediaSafe(true, true);
            const vid = document.getElementById('prejoin-video');
            vid.srcObject = previewStream;
            vid.play().catch(() => {});
            const icon = document.getElementById('prejoin-cam-off-icon');
            const hasVideoTrack = previewStream.getVideoTracks().length > 0;
            if (icon) icon.style.display = hasVideoTrack ? 'none' : 'flex';
            if (vid) vid.style.visibility = hasVideoTrack ? 'visible' : 'hidden';
        } catch (err) {
            const noDevice = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';
            if (noDevice) {
                console.info('預覽裝置不存在，將以無影音模式顯示前置畫面。');
            } else {
                console.warn('無法取得預覽媒體：', err);
            }
            const icon = document.getElementById('prejoin-cam-off-icon');
            if (icon) {
                icon.style.display = 'flex';
                // 無裝置時顯示可理解提示；其餘錯誤才提供點擊重試。
                if (!icon.dataset.tapHint) {
                    icon.dataset.tapHint = '1';
                    const hint = document.createElement('p');
                    hint.textContent = noDevice
                        ? '未偵測到攝影機或麥克風，可直接進入教室'
                        : '點擊以開啟預覽';
                    hint.style.cssText = 'margin:8px 0 0;font-size:0.85rem;color:#aaa;cursor:pointer;';
                    if (!noDevice) {
                        hint.addEventListener('click', tryPreview);
                    } else {
                        hint.style.cursor = 'default';
                    }
                    icon.appendChild(hint);
                }
            }
        }
    };
    await tryPreview();

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
        const streamToReuse = previewStream || null;
        document.getElementById('prejoin-video').srcObject = null;
        document.getElementById('prejoin-overlay').style.display = 'none';
        document.getElementById('room-layout').style.display = '';
        enterRoom(streamToReuse);
    });
}

// ═══════════════════════════════════════════════════
//  Enter Room (actual session start)
// ═══════════════════════════════════════════════════
async function enterRoom(existingStream) {
    await startLocalMedia(existingStream);
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

/**
 * 取得媒體串流，依序嘗試多種約束以相容行動裝置。
 * 行動裝置（iOS/Android）需要 HTTPS 才能存取 mediaDevices。
 */
async function getUserMediaSafe(wantVideo = true, wantAudio = true) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(
            new Error('此瀏覽器不支援媒體裝置，請確認使用 HTTPS 連線並更新瀏覽器'),
            { name: 'NotSupportedError' }
        );
    }

    const attempts = [];
    if (wantVideo && wantAudio) {
        attempts.push(
            { video: { facingMode: 'user' }, audio: true },
            { video: true, audio: true },
            { video: true,  audio: false },
            { video: false, audio: true  }
        );
    } else if (wantVideo) {
        attempts.push({ video: { facingMode: 'user' } }, { video: true });
    } else {
        attempts.push({ audio: true });
    }

    let lastErr;
    for (const constraints of attempts) {
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            lastErr = err;
            // 使用者拒絕權限時不再重試；其餘錯誤允許繼續嘗試降級約束。
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                throw err;
            }
        }
    }
    throw lastErr;
}

async function startLocalMedia(existingStream) {
    try {
        if (existingStream) {
            localStream = existingStream;
        } else {
            localStream = await getUserMediaSafe(true, true);
        }
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        localVideo.play().catch(() => {}); // iOS 需要明確呼叫 play()
        const hasVideoTrack = localStream.getVideoTracks().length > 0;
        document.getElementById('local-placeholder-icon').style.display = hasVideoTrack ? 'none' : 'flex';
    } catch (err) {
        const noDevice = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';
        if (noDevice) {
            console.info('未偵測到本地影音裝置，將以無影音模式進入。');
        } else {
            console.warn('無法取得本地媒體：', err);
        }
        document.getElementById('local-placeholder-icon').style.display = 'flex';
        if (err.name === 'NotSupportedError') {
            alert(err.message);
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            alert('找不到攝影機或麥克風裝置，請確認設備已連接。');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert('請允許瀏覽器存取攝影機和麥克風。\n在 iOS 請至「設定 > Safari > 攝影機/麥克風」開啟權限。');
        }
    }
}

// ═══════════════════════════════════════════════════
//  STOMP / WebSocket
// ═══════════════════════════════════════════════════
function connectStomp() {
    // SockJS 不支援自訂 HTTP header；Spring Security WebSocket 攔截在 HTTP 握手階段，
    // 因此必須將 token 放在 URL query parameter，讓 Spring 的 HandshakeInterceptor 讀取。
    const wsUrlWithToken = WS_URL + '?token=' + encodeURIComponent(token);

    stompClient = new StompJs.Client({
        webSocketFactory: () => new SockJS(wsUrlWithToken),
        connectHeaders: {
            'Authorization': `Bearer ${token}`
        },
        reconnectDelay: 5000,
        onConnect:    onStompConnected,
        onDisconnect: () => {
            isConnected = false;
            console.warn('[STOMP] Disconnected');
        },
        onStompError: frame => {
            const errMsg = frame.headers?.message || '(no message)';
            console.error('[STOMP] Broker Error:', errMsg, '\nHeaders:', JSON.stringify(frame.headers));
            // 若錯誤為認證失敗，提示重新登入
            if (errMsg.includes('401') || errMsg.includes('403') || errMsg.toLowerCase().includes('auth')) {
                alert('WebSocket 連線驗證失敗，請重新登入。');
                localStorage.setItem('redirect_after_login', window.location.href);
                window.location.href = 'login.html';
            }
        },
        onWebSocketError: evt => {
            console.error('[STOMP] WebSocket Error:', evt);
        }
    });
    stompClient.activate();
}

function onStompConnected() {
    isConnected = true;
    console.log('[STOMP] Connected. userId:', userId, 'role:', userRole, 'bookingId:', bookingId);

    stompClient.subscribe(`/topic/room/${bookingId}/signal`, frame => {
        console.log('[STOMP RAW signal]', frame.body.substring(0, 200));
        onSignalMessage(frame);
    });
    stompClient.subscribe(`/topic/room/${bookingId}/chat`,   onChatMessage);
    stompClient.subscribe(`/topic/room/${bookingId}/events`, frame => {
        console.log('[STOMP RAW event]', frame.body.substring(0, 200));
        onRoomEvent(frame);
    });
    stompClient.subscribe(`/topic/room/${bookingId}/errors`, onRoomError);

    publishEvent('joined');
    console.log('[STOMP] Published joined event');

    // 備援：透過 REST 檢查對方是否已在房間，避免漏接 STOMP 事件
    setTimeout(() => checkPeerViaRest(), 2000);
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
        console.log('[Room] participants response:', JSON.stringify(res.data));
        updateRoomStatusBadge(res.data.state);
        if (res.data.state === 'ENDED') showEndedOverlay();
    } catch (err) {
        console.warn('無法取得房間狀態', err);
    }
}

/**
 * 備援機制：透過 REST API 檢查對方是否已在房間，
 * 若 STOMP 事件遺漏，仍可正常建立 WebRTC 連線。
 */
async function checkPeerViaRest() {
    try {
        const res = await axios.get(`${API_BASE_URL}/room/${bookingId}/participants`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = res.data;
        console.log('[REST Peer Check] state:', data.state, 'participants:', JSON.stringify(data.participants || data));

        // 檢查對方是否已在房間（依回傳格式彈性處理）
        const participants = data.participants || data.users || [];
        const peerIsHere = data.state === 'ACTIVE' || participants.some(p => {
            const pId = String(p.userId || p.id || '');
            const pRole = normalizeRole(p.role);
            return (pId && pId !== String(userId)) || (pRole && pRole !== userRole);
        });

        if (peerIsHere && !peerReady) {
            console.log('[REST Peer Check] Peer detected via REST, triggering WebRTC...');
            peerReady = true;
            document.getElementById('peer-status-dot').className = 'peer-dot online';
            initiateCallIfCaller();
            // 老師端：重新通知學生以觸發 offer
            if (userRole === 'tutor') {
                publishEvent('joined');
            }
        }
    } catch (err) {
        console.warn('[REST Peer Check] 無法查詢房間參與者:', err.message || err);
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
    const evtRole = normalizeRole(evt.role || evt.senderRole);
    const evtUserId = String(evt.userId || evt.senderId || '');

    // 過濾自己的事件 — userId 為主要判斷，role 為備援
    const isOwnById   = evtUserId && userId && evtUserId === String(userId);
    const isOwnByRole = !evtUserId && evtRole && evtRole === userRole;
    if (isOwnById || isOwnByRole) return;

    console.log('[Event] Received:', evt.type, 'from role:', evtRole, 'userId:', evtUserId);

    if (evt.type === 'joined') {
        console.log('[Event] Peer joined! role:', evtRole, 'userId:', evtUserId);
        peerReady = true;
        document.getElementById('peer-status-dot').className = 'peer-dot online';
        initiateCallIfCaller();
        // If teacher is already in the room when student arrives, the student won't have
        // received the teacher's original 'joined' event (published before student subscribed).
        // Re-announce so the student can initiate the WebRTC offer.
        if (userRole === 'tutor' && evtRole === 'student') {
            console.log('[Event] Tutor re-announcing joined for late-arriving student');
            publishEvent('joined');
        }
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

    // Add local tracks；若沒有本地媒體，加入 recvonly transceiver 確保能收到對方的影音
    if (localStream && localStream.getTracks().length > 0) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        console.log('[WebRTC] Added', localStream.getTracks().length, 'local tracks');
    } else {
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        console.log('[WebRTC] No local tracks — added recvonly transceivers');
    }

    // Receive remote stream
    peerConnection.ontrack = event => {
        console.log('[WebRTC] ontrack fired, kind:', event.track.kind, 'streams:', event.streams.length);
        const remoteVideo = document.getElementById('remote-video');
        // 有些瀏覽器 event.streams 可能為空，需自行建立 MediaStream
        let stream;
        if (event.streams && event.streams[0]) {
            stream = event.streams[0];
        } else {
            stream = remoteVideo.srcObject || new MediaStream();
            stream.addTrack(event.track);
        }
        if (remoteVideo.srcObject !== stream) {
            remoteVideo.srcObject = stream;
        }
        document.getElementById('remote-placeholder').classList.add('hidden');
        // iOS Safari 需要明確呼叫 play()；若被阻擋（未靜音自動播放政策）則忽略
        remoteVideo.play().catch(err => {
            console.warn('遠端視訊自動播放受限，等待使用者互動後恢復：', err.name);
        });
    };

    // Send ICE candidates via STOMP
    peerConnection.onicecandidate = event => {
        if (event.candidate && isConnected) {
            console.log('[WebRTC] Sending ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
            stompClient.publish({
                destination: `/app/signal/${bookingId}`,
                body: JSON.stringify({
                    type:          'candidate',
                    senderRole:    userRole,
                    senderId:      userId,
                    candidate:     event.candidate.candidate,
                    sdpMid:        event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                })
            });
        } else if (!event.candidate) {
            console.log('[WebRTC] ICE gathering complete');
        }
    };

    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('[WebRTC] connectionState:', state);
        if (state === 'connected')                          updateRoomStatusBadge('ACTIVE');
        if (state === 'disconnected' || state === 'failed') updateRoomStatusBadge('WAITING');
    };

    // ICE 連線狀態監控：失敗時自動嘗試 ICE restart
    peerConnection.oniceconnectionstatechange = () => {
        if (!peerConnection) return;
        const state = peerConnection.iceConnectionState;
        console.log('[WebRTC] iceConnectionState:', state);
        if (state === 'failed' && userRole === 'student') {
            console.log('[WebRTC] ICE failed — attempting ICE restart');
            peerConnection.createOffer({ iceRestart: true })
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    stompClient.publish({
                        destination: `/app/signal/${bookingId}`,
                        body: JSON.stringify({
                            type:       'offer',
                            senderRole: userRole,
                            senderId:   userId,
                            sdp:        peerConnection.localDescription.sdp
                        })
                    });
                })
                .catch(err => console.error('[WebRTC] ICE restart failed:', err));
        }
    };

    peerConnection.onicegatheringstatechange = () => {
        if (!peerConnection) return;
        console.log('[WebRTC] iceGatheringState:', peerConnection.iceGatheringState);
    };
}

// Student always initiates the offer
async function initiateCallIfCaller() {
    if (userRole !== 'student') return;
    // Guard: skip if a connection is already being established or is active
    if (peerConnection && ['new', 'connecting', 'connected'].includes(peerConnection.connectionState)) return;
    console.log('[Signal] Student initiating offer...');
    createPeerConnection();
    await sendOffer();
}

async function sendOffer() {
    // 清除先前的重試計時器
    if (offerRetryTimer) { clearTimeout(offerRetryTimer); offerRetryTimer = null; }
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('[Signal] Sending offer, SDP type:', offer.type,
                    'media lines:', (offer.sdp.match(/^m=/gm) || []).length);
        stompClient.publish({
            destination: `/app/signal/${bookingId}`,
            body: JSON.stringify({
                type:       'offer',
                senderRole: userRole,
                senderId:   userId,
                sdp:        peerConnection.localDescription.sdp
            })
        });
        // 若 5 秒內未收到 answer，自動重試（最多 3 次）
        scheduleOfferRetry();
    } catch (err) {
        console.error('建立 offer 失敗:', err);
    }
}

let offerRetryCount = 0;
const MAX_OFFER_RETRIES = 3;

function scheduleOfferRetry() {
    if (offerRetryTimer) clearTimeout(offerRetryTimer);
    offerRetryTimer = setTimeout(() => {
        if (!peerConnection) return;
        // 若已建立連線或正在連線中就不重試
        if (['connected', 'connecting'].includes(peerConnection.connectionState)) return;
        if (peerConnection.remoteDescription) return;  // 已收到 answer
        offerRetryCount++;
        if (offerRetryCount > MAX_OFFER_RETRIES) {
            console.warn('[Signal] Offer retry exhausted after', MAX_OFFER_RETRIES, 'attempts');
            return;
        }
        console.log('[Signal] No answer received, retrying offer... (attempt', offerRetryCount + '/' + MAX_OFFER_RETRIES + ')');
        sendOffer();
    }, 5000);
}

async function onSignalMessage(frame) {
    const msg = JSON.parse(frame.body);
    const senderRole = normalizeRole(msg.senderRole || msg.role);
    const senderId = String(msg.senderId || msg.userId || '');

    // Ignore own signals — userId 為主要判斷，role 為 senderId 不存在時的備援
    const isOwnById   = senderId && userId && senderId === String(userId);
    const isOwnByRole = !senderId && senderRole && senderRole === userRole;
    if (isOwnById || isOwnByRole) {
        console.log('[Signal] Ignored own signal:', msg.type, '(senderId:', senderId, 'role:', senderRole, ')');
        return;
    }

    console.log('[Signal] Received:', msg.type, 'from role:', senderRole, 'senderId:', senderId);

    if (msg.type === 'offer') {
        console.log('[Signal] Processing offer, creating answer...');
        createPeerConnection();
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
            await flushIceCandidates();
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('[Signal] Sending answer, media lines:', (answer.sdp.match(/^m=/gm) || []).length);
            stompClient.publish({
                destination: `/app/signal/${bookingId}`,
                body: JSON.stringify({
                    type:       'answer',
                    senderRole: userRole,
                    senderId:   userId,
                    sdp:        answer.sdp
                })
            });
        } catch (err) {
            console.error('處理 offer 失敗:', err);
        }
    }

    else if (msg.type === 'answer') {
        if (!peerConnection) return;
        console.log('[Signal] Processing answer — cancelling retry timer');
        // 收到 answer，停止重試
        if (offerRetryTimer) { clearTimeout(offerRetryTimer); offerRetryTimer = null; }
        offerRetryCount = 0;
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
            await flushIceCandidates();
        } catch (err) {
            console.error('處理 answer 失敗:', err);
        }
    }

    else if (msg.type === 'candidate') {
        console.log('[Signal] Processing ICE candidate');
        const candidate = new RTCIceCandidate({
            candidate:     msg.candidate,
            sdpMid:        msg.sdpMid,
            sdpMLineIndex: msg.sdpMLineIndex
        });
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidate).catch(err =>
                console.warn('[WebRTC] addIceCandidate failed:', err)
            );
        } else {
            iceCandidateQueue.push(candidate);
            console.log('[Signal] Queued ICE candidate (remoteDescription not set yet), queue size:', iceCandidateQueue.length);
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
    initPipResize();
}

function initPipResize() {
    const wrapper = document.getElementById('local-video-wrapper');
    if (!wrapper) return;

    const handle = document.createElement('div');
    handle.className = 'pip-resize-handle';
    wrapper.appendChild(handle);

    const MIN_W = 90;
    const MAX_W = 320;
    let startX, startW, dragging = false;

    function onStart(e) {
        e.preventDefault();
        dragging = true;
        startX = (e.touches ? e.touches[0].clientX : e.clientX);
        startW = wrapper.offsetWidth;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend',  onEnd);
    }

    function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const dx = startX - clientX;
        const newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
        wrapper.style.width = newW + 'px';
    }

    function onEnd() {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend',  onEnd);
    }

    handle.addEventListener('mousedown',  onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
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
    if (offerRetryTimer) { clearTimeout(offerRetryTimer); offerRetryTimer = null; }
    offerRetryCount = 0;
    peerReady = false;
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
    formData.append('role',      roleToNumber(userRole));

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
        // FILE — 透過帶 Auth 的 blob 下載，避免瀏覽器直接請求被 401
        const a = document.createElement('a');
        a.className = 'msg-file-link';
        a.href = '#';
        const downloadName = msg.message || '附件';
        a.addEventListener('click', (e) => {
            e.preventDefault();
            downloadWithAuth(msg.mediaUrl, downloadName);
        });
        const icon = document.createElement('i');
        icon.className = 'bi bi-file-earmark-arrow-down';
        a.appendChild(icon);
        a.appendChild(document.createTextNode(' ' + downloadName));
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

/**
 * 將後端回傳的 mediaUrl 轉換為可經由 Vite proxy 存取的相對路徑。
 * 若後端回傳完整 URL（如 http://localhost:8080/uploads/...），
 * 取其 pathname 走 proxy，避免跨域問題。
 */
function toProxyPath(mediaUrl) {
    if (!mediaUrl) return '';
    if (mediaUrl.startsWith('blob:')) return mediaUrl;
    if (mediaUrl.startsWith('http')) {
        try { return new URL(mediaUrl).pathname; } catch { /* fall through */ }
    }
    return (mediaUrl.startsWith('/') ? '' : '/') + mediaUrl;
}

async function loadMediaWithAuth(element, mediaUrl) {
    if (!mediaUrl) return;
    const url = toProxyPath(mediaUrl);
    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob'
        });
        element.src = URL.createObjectURL(res.data);
    } catch (err) {
        console.warn('[Chat] 媒體載入失敗', url, err);
    }
}

async function downloadWithAuth(mediaUrl, filename) {
    const url = toProxyPath(mediaUrl);
    if (!url) return;
    try {
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob'
        });
        const blobUrl = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error('[Chat] 檔案下載失敗', url, err);
        alert('檔案下載失敗');
    }
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
