// PULSE Realtime Animated Chat App Core Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let authToken = localStorage.getItem('pulse_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('pulse_user')) || null;
  let ws = null;
  let selectedAvatar = '⚡';
  let soundEnabled = true;
  let typingTimeout = null;

  // DOM Elements
  const authView = document.getElementById('authView');
  const chatView = document.getElementById('chatView');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authAlert = document.getElementById('authAlert');

  const switchToRegisterBtn = document.getElementById('switchToRegister');
  const switchToLoginBtn = document.getElementById('switchToLogin');
  const avatarPicker = document.getElementById('avatarPicker');

  const myAvatarEl = document.getElementById('myAvatar');
  const myUsernameEl = document.getElementById('myUsername');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const onlineCountBadge = document.getElementById('onlineCountBadge');
  const onlineUsersList = document.getElementById('onlineUsersList');
  const filterInput = document.getElementById('filterInput');

  const messagesFeed = document.getElementById('messagesFeed');
  const typingBanner = document.getElementById('typingBanner');
  const typingText = document.getElementById('typingText');

  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  // Web Audio Synthesizer for UI SFX
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'receive') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      // Audio context policy fallback
    }
  };

  // Helper: Password Visibility Toggle
  window.togglePasswordVisibility = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🔒';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  };

  // Alert Banner Helper
  const showAlert = (message, type = 'error') => {
    authAlert.textContent = message;
    authAlert.className = `alert-banner ${type}`;
    authAlert.classList.remove('hidden');
    setTimeout(() => {
      authAlert.classList.add('hidden');
    }, 4000);
  };

  // Toggle Forms
  switchToRegisterBtn.addEventListener('click', () => {
    loginForm.classList.remove('active');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerForm.classList.add('active');
    authAlert.classList.add('hidden');
  });

  switchToLoginBtn.addEventListener('click', () => {
    registerForm.classList.remove('active');
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginForm.classList.add('active');
    authAlert.classList.add('hidden');
  });

  // Avatar Selection
  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt');
    if (!opt) return;
    avatarPicker.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
  });

  // Sound Toggle
  themeToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    themeToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
  });

  // Register Form Handler
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, avatar: selectedAvatar })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('pulse_token', authToken);
      localStorage.setItem('pulse_user', JSON.stringify(currentUser));

      showAlert('Account created successfully!', 'success');
      setTimeout(initializeChatSession, 600);
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Login Form Handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('pulse_token', authToken);
      localStorage.setItem('pulse_user', JSON.stringify(currentUser));

      initializeChatSession();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
    authToken = null;
    currentUser = null;
    if (ws) ws.close();

    chatView.classList.add('hidden');
    authView.classList.remove('hidden');
  });

  // Initialize Chat Session & WebSocket
  const initializeChatSession = async () => {
    if (!authToken || !currentUser) return;

    myAvatarEl.textContent = currentUser.avatar || '⚡';
    myUsernameEl.textContent = currentUser.username;

    authView.classList.add('hidden');
    chatView.classList.remove('hidden');

    await loadMessageHistory();
    connectWebSocket();
  };

  // Load Past Message History
  const loadMessageHistory = async () => {
    try {
      const res = await fetch('/api/messages', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) return;

      const data = await res.json();
      messagesFeed.innerHTML = `
        <div class="welcome-banner">
          <div class="spark-icon">✨</div>
          <h3>Welcome to Pulse Chat!</h3>
          <p>End-to-end real-time messaging active. All messages are persisted securely.</p>
        </div>
      `;

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(renderMessage);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // WebSocket Connection
  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(authToken)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ Connected to Pulse WebSocket Server');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth_success') {
          updateOnlineUsers(data.onlineUsers);
        } else if (data.type === 'new_message') {
          renderMessage(data);
          scrollToBottom();
          if (data.user_id !== currentUser.id) {
            playSound('receive');
          }
        } else if (data.type === 'presence') {
          updateOnlineUsers(data.onlineUsers);
        } else if (data.type === 'typing') {
          handleTypingEvent(data);
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting in 3s...');
      setTimeout(() => {
        if (authToken) connectWebSocket();
      }, 3000);
    };
  };

  // Render Single Message Bubble
  const renderMessage = (msg) => {
    const isOutgoing = msg.user_id === currentUser.id;
    const msgCard = document.createElement('div');
    msgCard.className = `message-card ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgCard.dataset.msgId = msg.id;

    const timeFormatted = new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    msgCard.innerHTML = `
      <div class="msg-avatar">${msg.avatar || '⚡'}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">${isOutgoing ? 'You' : msg.username}</span>
          <span class="msg-time">${timeFormatted}</span>
        </div>
        <div class="msg-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `;

    messagesFeed.appendChild(msgCard);
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  };

  // Scroll Chat to Bottom
  const scrollToBottom = () => {
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  };

  // Update Online Users List
  const updateOnlineUsers = (users = []) => {
    onlineCountBadge.textContent = users.length;
    onlineUsersList.innerHTML = '';

    users.forEach(u => {
      const li = document.createElement('li');
      li.className = 'online-user-item';
      li.innerHTML = `
        <span class="u-avatar">${u.avatar || '⚡'}</span>
        <span class="u-name">${escapeHtml(u.username)}</span>
      `;
      onlineUsersList.appendChild(li);
    });
  };

  // Send Message
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'chat_message',
      content: content
    }));

    messageInput.value = '';
    emojiPicker.classList.add('hidden');
    playSound('send');

    // Reset typing
    ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
  });

  // Typing Broadcast Handler
  messageInput.addEventListener('input', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'typing', isTyping: true }));

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      ws.send(JSON.stringify({ type: 'typing', isTyping: false }));
    }, 2000);
  });

  // Receive Typing Indicator
  const handleTypingEvent = (data) => {
    if (data.isTyping) {
      typingText.textContent = `${data.username} is typing...`;
      typingBanner.classList.remove('hidden');
    } else {
      typingBanner.classList.add('hidden');
    }
  };

  // Emoji Picker Toggle & Injection
  emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
  });

  emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
      messageInput.value += e.target.textContent;
      messageInput.focus();
    }
  });

  // Filter Search
  filterInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.message-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? 'flex' : 'none';
    });
  });

  // Auto-Login if token exists
  if (authToken && currentUser) {
    initializeChatSession();
  }
});
