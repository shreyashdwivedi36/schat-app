// SChat Realtime Animated Chat App Core Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let activeRecipient = null; // null = Global Channel, { id, username, avatar } = Direct Message
  let isPrivacyBlurActive = false;
  let ws = null;
  let selectedAvatar = '⚡';
  let soundEnabled = true;
  let typingTimeout = null;

  document.documentElement.setAttribute('data-theme', currentTheme);

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
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const themeModeBtn = document.getElementById('themeModeBtn');
  const headerThemeBtn = document.getElementById('headerThemeBtn');

  const chatSidebar = document.getElementById('chatSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');

  const globalChannelBtn = document.getElementById('globalChannelBtn');
  const onlineCountBadge = document.getElementById('onlineCountBadge');
  const onlineUsersList = document.getElementById('onlineUsersList');
  const filterInput = document.getElementById('filterInput');

  const roomAvatar = document.getElementById('roomAvatar');
  const roomTitle = document.getElementById('roomTitle');
  const roomSubtitle = document.getElementById('roomSubtitle');
  const welcomeTitle = document.getElementById('welcomeTitle');
  const welcomeSubtitle = document.getElementById('welcomeSubtitle');

  const messagesFeed = document.getElementById('messagesFeed');
  const typingBanner = document.getElementById('typingBanner');
  const typingText = document.getElementById('typingText');

  const privacyBlurBtn = document.getElementById('privacyBlurBtn');
  const timerSelect = document.getElementById('timerSelect');

  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  // Privacy Blur Toggle
  if (privacyBlurBtn) {
    privacyBlurBtn.addEventListener('click', () => {
      isPrivacyBlurActive = !isPrivacyBlurActive;
      if (isPrivacyBlurActive) {
        privacyBlurBtn.classList.add('active');
        privacyBlurBtn.querySelector('.control-text').textContent = 'Blur On';
      } else {
        privacyBlurBtn.classList.remove('active');
        privacyBlurBtn.querySelector('.control-text').textContent = 'Blur Off';
      }
    });
  }

  // Theme Switcher
  const updateThemeUI = () => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('schat_theme', currentTheme);
    const icon = currentTheme === 'dark' ? '🌙' : '☀️';
    if (themeModeBtn) themeModeBtn.textContent = icon;
    if (headerThemeBtn) headerThemeBtn.textContent = icon;
  };

  const toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateThemeUI();
  };

  updateThemeUI();
  if (themeModeBtn) themeModeBtn.addEventListener('click', toggleTheme);
  if (headerThemeBtn) headerThemeBtn.addEventListener('click', toggleTheme);

  // Mobile Sidebar Drawer
  const openSidebar = () => {
    chatSidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  };

  const closeSidebar = () => {
    chatSidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  };

  if (mobileSidebarToggle) mobileSidebarToggle.addEventListener('click', openSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Web Audio Synthesizer
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
      } else if (type === 'delete') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {}
  };

  window.togglePasswordVisibility = (inputId, btn) => {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁️' : '🔒';
  };

  const showAlert = (message, type = 'error') => {
    authAlert.textContent = message;
    authAlert.className = `alert-banner ${type}`;
    authAlert.classList.remove('hidden');
    setTimeout(() => authAlert.classList.add('hidden'), 4000);
  };

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

  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt');
    if (!opt) return;
    avatarPicker.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
  });

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });
  }

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
      localStorage.setItem('schat_token', authToken);
      localStorage.setItem('schat_user', JSON.stringify(currentUser));

      showAlert('Account created successfully!', 'success');
      setTimeout(initializeChatSession, 600);
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

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
      localStorage.setItem('schat_token', authToken);
      localStorage.setItem('schat_user', JSON.stringify(currentUser));

      initializeChatSession();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('schat_token');
    localStorage.removeItem('schat_user');
    authToken = null;
    currentUser = null;
    if (ws) ws.close();

    chatView.classList.add('hidden');
    authView.classList.remove('hidden');
    closeSidebar();
  });

  // Channel & DM Tab Switching
  globalChannelBtn.addEventListener('click', () => {
    switchChatTab(null);
  });

  const switchChatTab = (recipient) => {
    activeRecipient = recipient;

    document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
    globalChannelBtn.classList.remove('active');

    if (!activeRecipient) {
      globalChannelBtn.classList.add('active');
      roomAvatar.textContent = '💬';
      roomTitle.textContent = 'Global Channel';
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Realtime Active';
      welcomeTitle.textContent = 'Welcome to SChat!';
      welcomeSubtitle.textContent = 'End-to-end real-time messaging active across mobile & desktop.';
    } else {
      const userEl = document.querySelector(`.online-user-item[data-user-id="${activeRecipient.id}"]`);
      if (userEl) userEl.classList.add('active');

      roomAvatar.textContent = activeRecipient.avatar || '🔒';
      roomTitle.textContent = `DM with @${activeRecipient.username}`;
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Private Encrypted DM';
      welcomeTitle.textContent = `Direct Message with ${activeRecipient.username}`;
      welcomeSubtitle.textContent = `Private end-to-end communication channel.`;

      // Emit Mark Read event for this user's DMs
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'mark_read',
          sender_id: activeRecipient.id
        }));
      }
    }

    closeSidebar();
    loadMessageHistory();
  };

  const initializeChatSession = async () => {
    if (!authToken || !currentUser) return;

    myAvatarEl.textContent = currentUser.avatar || '⚡';
    myUsernameEl.textContent = currentUser.username;

    authView.classList.add('hidden');
    chatView.classList.remove('hidden');

    await loadMessageHistory();
    connectWebSocket();
  };

  const loadMessageHistory = async () => {
    try {
      const url = activeRecipient 
        ? `/api/messages?recipient_id=${activeRecipient.id}` 
        : '/api/messages';

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) return;

      const data = await res.json();
      messagesFeed.innerHTML = `
        <div class="welcome-banner">
          <div class="spark-icon">✨</div>
          <h3 id="welcomeTitle">${activeRecipient ? 'Direct Message with ' + activeRecipient.username : 'Welcome to SChat!'}</h3>
          <p id="welcomeSubtitle">${activeRecipient ? 'Private communication channel.' : 'End-to-end real-time messaging active across mobile & desktop.'}</p>
        </div>
      `;

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(renderMessage);
        scrollToBottom();

        // Mark read if active DM tab
        if (activeRecipient && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'mark_read',
            sender_id: activeRecipient.id
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(authToken)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ Connected to SChat WebSocket Server');
      if (activeRecipient) {
        ws.send(JSON.stringify({
          type: 'mark_read',
          sender_id: activeRecipient.id
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'auth_success') {
          updateOnlineUsers(data.onlineUsers);
        } else if (data.type === 'new_message') {
          let isCurrentTab = false;

          if (!activeRecipient) {
            isCurrentTab = !data.recipient_id || data.recipient_id === 'null' || Number(data.recipient_id) === 0;
          } else {
            const msgSender = Number(data.user_id);
            const msgTarget = Number(data.recipient_id);
            const activeId = Number(activeRecipient.id);
            const myId = Number(currentUser.id);

            isCurrentTab = (msgSender === myId && msgTarget === activeId) || (msgSender === activeId && msgTarget === myId);
          }

          if (isCurrentTab) {
            renderMessage(data);
            scrollToBottom();

            // Mark read immediately if we are currently viewing this DM
            if (activeRecipient && Number(data.user_id) === Number(activeRecipient.id)) {
              ws.send(JSON.stringify({
                type: 'mark_read',
                sender_id: activeRecipient.id
              }));
            }
          }

          if (Number(data.user_id) !== Number(currentUser.id)) {
            playSound('receive');
          }
        } else if (data.type === 'msg_status_update') {
          if (data.status === 'read') {
            document.querySelectorAll('.msg-status-icon').forEach(icon => {
              icon.textContent = '✓✓';
              icon.classList.add('read');
            });
          }
        } else if (data.type === 'delete_message') {
          removeMessageFromDOM(data.messageId);
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
      setTimeout(() => { if (authToken) connectWebSocket(); }, 3000);
    };
  };

  const deleteMessage = async (messageId) => {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'delete_message',
          messageId: messageId
        }));
      } else {
        await fetch(`/api/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
      removeMessageFromDOM(messageId);
      playSound('delete');
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const removeMessageFromDOM = (messageId) => {
    const card = document.querySelector(`.message-card[data-msg-id="${messageId}"]`);
    if (card) {
      card.classList.add('removing');
      setTimeout(() => card.remove(), 300);
    }
  };

  const renderMessage = (msg) => {
    const msgUniqueId = msg.id || `temp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    if (msg.id && document.querySelector(`.message-card[data-msg-id="${msg.id}"]`)) {
      return;
    }

    const isOutgoing = Number(msg.user_id) === Number(currentUser.id);
    const msgCard = document.createElement('div');
    msgCard.className = `message-card ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgCard.dataset.msgId = msgUniqueId;

    const timeFormatted = new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const deleteBtnHtml = isOutgoing 
      ? `<button class="msg-delete-btn" title="Delete Message" data-id="${msgUniqueId}">🗑️</button>` 
      : '';

    // Checkmark status html for outgoing messages
    let statusIconHtml = '';
    if (isOutgoing) {
      const status = msg.status || 'sent';
      const checkSymbol = status === 'sent' ? '✓' : '✓✓';
      const isReadClass = status === 'read' ? 'read' : (status === 'delivered' ? 'delivered' : 'sent');
      statusIconHtml = `<span class="msg-status-icon ${isReadClass}">${checkSymbol}</span>`;
    }

    let timerBadgeHtml = '';
    if (msg.expires_at) {
      const remainingMs = new Date(msg.expires_at).getTime() - Date.now();
      if (remainingMs > 0) {
        const secondsLeft = Math.ceil(remainingMs / 1000);
        timerBadgeHtml = `<span class="timer-badge" id="timerBadge_${msgUniqueId}">⏱️ ${secondsLeft}s</span>`;
        
        const timerInterval = setInterval(() => {
          const updatedRemaining = new Date(msg.expires_at).getTime() - Date.now();
          const badgeEl = document.getElementById(`timerBadge_${msgUniqueId}`);
          if (updatedRemaining <= 0) {
            clearInterval(timerInterval);
            removeMessageFromDOM(msgUniqueId);
          } else if (badgeEl) {
            badgeEl.textContent = `⏱️ ${Math.ceil(updatedRemaining / 1000)}s`;
          }
        }, 1000);
      }
    }

    const isBlurredClass = msg.is_blurred ? 'blurred' : '';

    msgCard.innerHTML = `
      <div class="msg-avatar">${msg.avatar || '⚡'}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">${isOutgoing ? 'You' : (msg.username || 'User')}</span>
          <span class="msg-time">${timeFormatted}</span>
          ${statusIconHtml}
          ${timerBadgeHtml}
          ${deleteBtnHtml}
        </div>
        <div class="msg-bubble ${isBlurredClass}">${escapeHtml(msg.content || '')}</div>
      </div>
    `;

    const bubbleEl = msgCard.querySelector('.msg-bubble');
    if (msg.is_blurred && bubbleEl) {
      bubbleEl.addEventListener('click', () => {
        bubbleEl.classList.toggle('unmasked');
      });
    }

    const deleteBtn = msgCard.querySelector('.msg-delete-btn');
    if (deleteBtn && msg.id) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMessage(msg.id);
      });
    }

    messagesFeed.appendChild(msgCard);
  };

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

  const scrollToBottom = () => {
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  };

  const updateOnlineUsers = (users = []) => {
    const otherUsers = users.filter(u => Number(u.id) !== Number(currentUser.id));
    onlineCountBadge.textContent = otherUsers.length;
    onlineUsersList.innerHTML = '';

    if (otherUsers.length === 0) {
      onlineUsersList.innerHTML = `<li class="online-user-item disabled"><span class="u-name">No other users online</span></li>`;
      return;
    }

    otherUsers.forEach(u => {
      const li = document.createElement('li');
      li.className = `online-user-item ${activeRecipient && Number(activeRecipient.id) === Number(u.id) ? 'active' : ''}`;
      li.dataset.userId = u.id;
      li.innerHTML = `
        <span class="u-avatar">${u.avatar || '⚡'}</span>
        <span class="u-name">${escapeHtml(u.username)}</span>
      `;

      li.addEventListener('click', () => {
        switchChatTab(u);
      });

      onlineUsersList.appendChild(li);
    });
  };

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !ws || ws.readyState !== WebSocket.OPEN) return;

    const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

    ws.send(JSON.stringify({
      type: 'chat_message',
      recipient_id: activeRecipient ? activeRecipient.id : null,
      content: content,
      is_blurred: isPrivacyBlurActive ? 1 : 0,
      timer_seconds: timerSeconds
    }));

    messageInput.value = '';
    emojiPicker.classList.add('hidden');
    playSound('send');

    ws.send(JSON.stringify({
      type: 'typing',
      recipient_id: activeRecipient ? activeRecipient.id : null,
      isTyping: false
    }));
  });

  messageInput.addEventListener('input', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'typing',
      recipient_id: activeRecipient ? activeRecipient.id : null,
      isTyping: true
    }));

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'typing',
        recipient_id: activeRecipient ? activeRecipient.id : null,
        isTyping: false
      }));
    }, 2000);
  });

  const handleTypingEvent = (data) => {
    const isRelevantTyping = activeRecipient 
      ? (Number(data.user_id) === Number(activeRecipient.id) && Number(data.recipient_id) === Number(currentUser.id))
      : (!data.recipient_id && Number(data.user_id) !== Number(currentUser.id));

    if (isRelevantTyping && data.isTyping) {
      typingText.textContent = `${data.username} is typing...`;
      typingBanner.classList.remove('hidden');
    } else {
      typingBanner.classList.add('hidden');
    }
  };

  emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
  });

  emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
      messageInput.value += e.target.textContent;
      messageInput.focus();
    }
  });

  filterInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.online-user-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(term) ? 'flex' : 'none';
    });
    document.querySelectorAll('.message-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? 'flex' : 'none';
    });
  });

  if (authToken && currentUser) {
    initializeChatSession();
  }
});
