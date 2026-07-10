// SChat Realtime Animated Chat App Core Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let activeRecipient = null; // null = Global Channel, { id, username, avatar } = Direct Message
  let unreadCounts = {};
  let totalUnreadDM = 0;
  let isPrivacyBlurActive = false;
  let deferredPrompt = null;
  let ws = null;
  let pingInterval = null;
  let selectedAvatar = '⚡';
  let soundEnabled = true;
  let typingTimeout = null;

  document.documentElement.setAttribute('data-theme', currentTheme);

  // Register PWA Service Worker with Auto-Reload
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('⚡ PWA ServiceWorker registered successfully:', reg.scope);
      }).catch((err) => {
        console.error('ServiceWorker registration failed:', err);
      });
    });
  }

  // DOM Elements
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) {
      pwaInstallBtn.classList.remove('hidden');
    }
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User PWA Install outcome: ${outcome}`);
      deferredPrompt = null;
      pwaInstallBtn.classList.add('hidden');
    });
  }

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

  // About Owner & Options Modal Elements
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const authAboutBtn = document.getElementById('authAboutBtn');
  const sidebarAboutBtn = document.getElementById('sidebarAboutBtn');
  const headerAboutBtn = document.getElementById('headerAboutBtn');
  const optionsMenuBtn = document.getElementById('optionsMenuBtn');

  const openAboutModal = () => {
    if (aboutModal) aboutModal.classList.remove('hidden');
  };

  const closeAboutModal = () => {
    if (aboutModal) aboutModal.classList.add('hidden');
  };

  if (authAboutBtn) authAboutBtn.addEventListener('click', openAboutModal);
  if (sidebarAboutBtn) sidebarAboutBtn.addEventListener('click', openAboutModal);
  if (headerAboutBtn) headerAboutBtn.addEventListener('click', openAboutModal);
  if (optionsMenuBtn) optionsMenuBtn.addEventListener('click', openAboutModal);
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Request Desktop Notification Permission
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const showDesktopNotification = (senderName, messageText) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(`New DM from @${senderName}`, {
        body: messageText,
        icon: '/icon-192.png'
      });
    }
  };

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

  const performLogout = () => {
    localStorage.removeItem('schat_token');
    localStorage.removeItem('schat_user');
    authToken = null;
    currentUser = null;
    if (pingInterval) clearInterval(pingInterval);
    if (ws) ws.close();

    chatView.classList.add('hidden');
    authView.classList.remove('hidden');
    closeSidebar();
  };

  logoutBtn.addEventListener('click', performLogout);

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
      if (unreadCounts[activeRecipient.id]) {
        unreadCounts[activeRecipient.id] = 0;
      }
      updateUnreadBadgesUI();

      const userEl = document.querySelector(`.online-user-item[data-user-id="${activeRecipient.id}"]`);
      if (userEl) userEl.classList.add('active');

      roomAvatar.textContent = activeRecipient.avatar || '🔒';
      roomTitle.textContent = `DM with @${activeRecipient.username}`;
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Private Encrypted DM';
      welcomeTitle.textContent = `Direct Message with ${activeRecipient.username}`;
      welcomeSubtitle.textContent = `Private end-to-end communication channel.`;

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

  const updateUnreadBadgesUI = () => {
    totalUnreadDM = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

    if (totalUnreadDM > 0) {
      document.title = `(${totalUnreadDM}) New DM — SChat`;
    } else {
      document.title = 'SChat — Real-Time Messaging Platform';
    }

    for (const [userId, count] of Object.entries(unreadCounts)) {
      const userItem = document.querySelector(`.online-user-item[data-user-id="${userId}"]`);
      if (userItem) {
        let badgeEl = userItem.querySelector('.unread-badge');
        if (count > 0) {
          if (!badgeEl) {
            badgeEl = document.createElement('span');
            badgeEl.className = 'unread-badge';
            userItem.appendChild(badgeEl);
          }
          badgeEl.textContent = count;
        } else if (badgeEl) {
          badgeEl.remove();
        }
      }
    }
  };

  const initializeChatSession = async () => {
    if (!authToken || !currentUser) return;

    myAvatarEl.textContent = currentUser.avatar || '⚡';
    myUsernameEl.textContent = currentUser.username;

    authView.classList.add('hidden');
    chatView.classList.remove('hidden');

    requestNotificationPermission();
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

      if (res.status === 401 || res.status === 403) {
        // Expired token on mobile device: force fresh login
        performLogout();
        showAlert('Session expired. Please sign in again.', 'error');
        return;
      }

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

    if (ws) {
      try { ws.close(); } catch(e){}
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ Connected to SChat WebSocket Server');
      
      // Start ping heartbeat interval to keep mobile WebSocket alive
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);

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

        if (data.type === 'auth_error') {
          performLogout();
          showAlert('Authentication failed. Please sign in again.', 'error');
          return;
        }

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

            if (activeRecipient && Number(data.user_id) === Number(activeRecipient.id)) {
              ws.send(JSON.stringify({
                type: 'mark_read',
                sender_id: activeRecipient.id
              }));
            }
          } else if (data.recipient_id && Number(data.recipient_id) === Number(currentUser.id)) {
            const senderId = Number(data.user_id);
            unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
            updateUnreadBadgesUI();
            showDesktopNotification(data.username, data.content);
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
      if (pingInterval) clearInterval(pingInterval);
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

      const unreadCount = unreadCounts[u.id] || 0;
      const unreadBadgeHtml = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';

      li.innerHTML = `
        <span class="u-avatar">${u.avatar || '⚡'}</span>
        <span class="u-name">${escapeHtml(u.username)}</span>
        ${unreadBadgeHtml}
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

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showAlert('Connecting to server... Please try sending again in a moment.', 'error');
      connectWebSocket();
      return;
    }

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
