// SChat Realtime Animated Chat App Core Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let activeRecipient = null; // null = Global Channel, { id, username, avatar } = Direct Message
  let activeReply = null; // null or { id, username, text }
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

  // Initialize Three.js 3D Interactive WebGL Motion Engine
  init3DMotionBackground();

  // Register PWA Service Worker
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

  // Keyboard Shortcuts (Accessibility & Speed)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (filterInput) filterInput.focus();
    }
    if (e.key === 'Escape') {
      closeAboutModal();
      closeProfileModal();
      closeOptionsDropdown();
      if (emojiPicker) emojiPicker.classList.add('hidden');
    }
  });

  // DOM Elements
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  const dropdownPwaBtn = document.getElementById('dropdownPwaBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.classList.remove('hidden');
    if (dropdownPwaBtn) dropdownPwaBtn.classList.remove('hidden');
  });

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User PWA Install outcome: ${outcome}`);
    deferredPrompt = null;
    if (pwaInstallBtn) pwaInstallBtn.classList.add('hidden');
    if (dropdownPwaBtn) dropdownPwaBtn.classList.add('hidden');
  };

  if (pwaInstallBtn) pwaInstallBtn.addEventListener('click', triggerPwaInstall);
  if (dropdownPwaBtn) dropdownPwaBtn.addEventListener('click', () => {
    triggerPwaInstall();
    closeOptionsDropdown();
  });

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
  const myBioEl = document.getElementById('myBio');
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

  const pinnedBanner = document.getElementById('pinnedBanner');
  const pinnedTextSnippet = document.getElementById('pinnedTextSnippet');
  const unpinBtn = document.getElementById('unpinBtn');
  const exportChatBtn = document.getElementById('exportChatBtn');

  const privacyBlurBtn = document.getElementById('privacyBlurBtn');
  const timerSelect = document.getElementById('timerSelect');

  const replyPreviewBar = document.getElementById('replyPreviewBar');
  const replyUserLabel = document.getElementById('replyUserLabel');
  const replyTextSnippet = document.getElementById('replyTextSnippet');
  const cancelReplyBtn = document.getElementById('cancelReplyBtn');

  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');

  // Modals & Liquid Glass Options Dropdown
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const authAboutBtn = document.getElementById('authAboutBtn');
  const sidebarAboutBtn = document.getElementById('sidebarAboutBtn');
  const headerAboutBtn = document.getElementById('headerAboutBtn');
  
  const optionsMenuBtn = document.getElementById('optionsMenuBtn');
  const optionsDropdown = document.getElementById('optionsDropdown');
  const dropdownThemeBtn = document.getElementById('dropdownThemeBtn');
  const dropdownThemeIcon = document.getElementById('dropdownThemeIcon');
  const dropdownThemeValue = document.getElementById('dropdownThemeValue');
  const dropdownExportBtn = document.getElementById('dropdownExportBtn');
  const dropdownAboutBtn = document.getElementById('dropdownAboutBtn');

  const profileModal = document.getElementById('profileModal');
  const myProfileCard = document.getElementById('myProfileCard');
  const closeProfileBtn = document.getElementById('closeProfileBtn');
  const profileForm = document.getElementById('profileForm');
  const profileBioInput = document.getElementById('profileBioInput');

  const toggleOptionsDropdown = () => {
    if (optionsDropdown) optionsDropdown.classList.toggle('hidden');
  };

  const closeOptionsDropdown = () => {
    if (optionsDropdown) optionsDropdown.classList.add('hidden');
  };

  if (optionsMenuBtn) optionsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOptionsDropdown();
  });

  document.addEventListener('click', (e) => {
    if (optionsDropdown && !optionsDropdown.contains(e.target) && e.target !== optionsMenuBtn) {
      closeOptionsDropdown();
    }
  });

  const openAboutModal = () => { if (aboutModal) aboutModal.classList.remove('hidden'); };
  const closeAboutModal = () => { if (aboutModal) aboutModal.classList.add('hidden'); };

  const openProfileModal = () => {
    if (profileModal) {
      if (profileBioInput && currentUser) profileBioInput.value = currentUser.bio || '';
      profileModal.classList.remove('hidden');
    }
  };
  const closeProfileModal = () => { if (profileModal) profileModal.classList.add('hidden'); };

  if (myProfileCard) myProfileCard.addEventListener('click', (e) => {
    if (e.target.closest('#logoutBtn')) return;
    openProfileModal();
  });
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newBio = profileBioInput.value.trim();
      try {
        const res = await fetch('/api/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ bio: newBio, avatar: currentUser.avatar })
        });
        if (res.ok) {
          currentUser.bio = newBio;
          localStorage.setItem('schat_user', JSON.stringify(currentUser));
          if (myBioEl) myBioEl.textContent = newBio || 'Online';
          closeProfileModal();
        }
      } catch (err) {}
    });
  }

  if (authAboutBtn) authAboutBtn.addEventListener('click', openAboutModal);
  if (sidebarAboutBtn) sidebarAboutBtn.addEventListener('click', openAboutModal);
  if (headerAboutBtn) headerAboutBtn.addEventListener('click', openAboutModal);
  if (dropdownAboutBtn) dropdownAboutBtn.addEventListener('click', () => {
    openAboutModal();
    closeOptionsDropdown();
  });
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Export Chat Functionality
  const executeExportChat = () => {
    const cards = document.querySelectorAll('.message-card');
    if (cards.length === 0) return alert('No messages to export.');

    let exportText = `========================================\n`;
    exportText += `SChat Export: ${activeRecipient ? 'DM with ' + activeRecipient.username : 'Global Channel'}\n`;
    exportText += `Exported At: ${new Date().toLocaleString()}\n`;
    exportText += `========================================\n\n`;

    cards.forEach(card => {
      const author = card.querySelector('.msg-author')?.textContent || 'User';
      const time = card.querySelector('.msg-time')?.textContent || '';
      const content = card.querySelector('.msg-bubble')?.textContent || '';
      exportText += `[${time}] ${author}: ${content.trim()}\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SChat_Export_${activeRecipient ? activeRecipient.username : 'Global'}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (exportChatBtn) exportChatBtn.addEventListener('click', executeExportChat);
  if (dropdownExportBtn) dropdownExportBtn.addEventListener('click', () => {
    executeExportChat();
    closeOptionsDropdown();
  });

  // Reply Mode UI Controls
  const setReplyState = (msg) => {
    if (!msg) {
      activeReply = null;
      if (replyPreviewBar) replyPreviewBar.classList.add('hidden');
      return;
    }
    activeReply = {
      id: msg.id,
      username: msg.username || 'User',
      text: msg.content || ''
    };
    if (replyUserLabel) replyUserLabel.textContent = `Replying to @${activeReply.username}`;
    if (replyTextSnippet) replyTextSnippet.textContent = activeReply.text;
    if (replyPreviewBar) replyPreviewBar.classList.remove('hidden');
    messageInput.focus();
  };

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener('click', () => setReplyState(null));
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
    const label = currentTheme === 'dark' ? 'Dark' : 'Light';
    if (themeModeBtn) themeModeBtn.textContent = icon;
    if (headerThemeBtn) headerThemeBtn.textContent = icon;
    if (dropdownThemeIcon) dropdownThemeIcon.textContent = icon;
    if (dropdownThemeValue) dropdownThemeValue.textContent = label;
  };

  const toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    updateThemeUI();
  };

  updateThemeUI();
  if (themeModeBtn) themeModeBtn.addEventListener('click', toggleTheme);
  if (headerThemeBtn) headerThemeBtn.addEventListener('click', toggleTheme);
  if (dropdownThemeBtn) dropdownThemeBtn.addEventListener('click', () => {
    toggleTheme();
    closeOptionsDropdown();
  });

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

  if (switchToRegisterBtn) switchToRegisterBtn.addEventListener('click', () => {
    loginForm.classList.remove('active');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerForm.classList.add('active');
    authAlert.classList.add('hidden');
  });

  if (switchToLoginBtn) switchToLoginBtn.addEventListener('click', () => {
    registerForm.classList.remove('active');
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginForm.classList.add('active');
    authAlert.classList.add('hidden');
  });

  if (avatarPicker) avatarPicker.addEventListener('click', (e) => {
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

  if (registerForm) registerForm.addEventListener('submit', async (e) => {
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

  if (loginForm) loginForm.addEventListener('submit', async (e) => {
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

  if (logoutBtn) logoutBtn.addEventListener('click', performLogout);

  // Channel & DM Tab Switching
  if (globalChannelBtn) globalChannelBtn.addEventListener('click', () => {
    switchChatTab(null);
  });

  const switchChatTab = (recipient) => {
    activeRecipient = recipient;
    setReplyState(null);

    document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
    globalChannelBtn.classList.remove('active');

    if (!activeRecipient) {
      globalChannelBtn.classList.add('active');
      roomAvatar.textContent = '💬';
      roomTitle.textContent = 'Global Channel';
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Realtime Active';
      welcomeTitle.textContent = 'Welcome to SChat!';
      welcomeSubtitle.textContent = 'Real-time messaging active across mobile & desktop.';
    } else {
      if (unreadCounts[activeRecipient.id]) {
        unreadCounts[activeRecipient.id] = 0;
      }
      updateUnreadBadgesUI();

      const userEl = document.querySelector(`.online-user-item[data-user-id="${activeRecipient.id}"]`);
      if (userEl) userEl.classList.add('active');

      roomAvatar.textContent = activeRecipient.avatar || '🔒';
      roomTitle.textContent = `DM with @${activeRecipient.username}`;
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Private Direct Message';
      welcomeTitle.textContent = `Direct Message with ${activeRecipient.username}`;
      welcomeSubtitle.textContent = `Private communication channel.`;

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

    if (myAvatarEl) myAvatarEl.textContent = currentUser.avatar || '⚡';
    if (myUsernameEl) myUsernameEl.textContent = currentUser.username;
    if (myBioEl) myBioEl.textContent = currentUser.bio || 'Online';

    if (authView) authView.classList.add('hidden');
    if (chatView) chatView.classList.remove('hidden');

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
          <p id="welcomeSubtitle">${activeRecipient ? 'Private communication channel.' : 'Real-time messaging active across mobile & desktop.'}</p>
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
        } else if (data.type === 'edit_message') {
          const card = document.querySelector(`.message-card[data-msg-id="${data.messageId}"]`);
          if (card) {
            const bubble = card.querySelector('.msg-bubble');
            if (bubble) {
              bubble.textContent = data.newContent;
              let editedTag = card.querySelector('.edited-badge');
              if (!editedTag) {
                editedTag = document.createElement('span');
                editedTag.className = 'edited-badge';
                editedTag.textContent = '(edited)';
                card.querySelector('.msg-header').appendChild(editedTag);
              }
            }
          }
        } else if (data.type === 'update_reactions') {
          updateMessageReactionsDOM(data.messageId, data.reactions);
        } else if (data.type === 'update_pinned') {
          if (data.is_pinned) {
            const card = document.querySelector(`.message-card[data-msg-id="${data.messageId}"]`);
            if (card && pinnedBanner) {
              pinnedTextSnippet.textContent = card.querySelector('.msg-bubble')?.textContent || 'Pinned message';
              pinnedBanner.classList.remove('hidden');
            }
          } else if (pinnedBanner) {
            pinnedBanner.classList.add('hidden');
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

  const editMessage = (messageId, currentContent) => {
    const newContent = prompt('Edit your message:', currentContent);
    if (!newContent || newContent.trim() === currentContent) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'edit_message',
        messageId: messageId,
        newContent: newContent.trim()
      }));
    }
  };

  const toggleReaction = (messageId, emoji) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_reaction',
        messageId: messageId,
        emoji: emoji
      }));
    }
  };

  const togglePinMessage = (messageId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_pin',
        messageId: messageId
      }));
    }
  };

  const updateMessageReactionsDOM = (messageId, reactionsObj) => {
    const card = document.querySelector(`.message-card[data-msg-id="${messageId}"]`);
    if (!card) return;

    let rxContainer = card.querySelector('.reactions-container');
    if (!rxContainer) {
      rxContainer = document.createElement('div');
      rxContainer.className = 'reactions-container';
      card.querySelector('.msg-body').appendChild(rxContainer);
    }

    rxContainer.innerHTML = '';
    for (const [emoji, users] of Object.entries(reactionsObj || {})) {
      if (users && users.length > 0) {
        const badge = document.createElement('div');
        badge.className = `reaction-badge ${users.includes(currentUser.username) ? 'active' : ''}`;
        badge.title = `Reacted by ${users.join(', ')}`;
        badge.innerHTML = `<span>${emoji}</span> <span class="reaction-count">${users.length}</span>`;
        badge.addEventListener('click', () => toggleReaction(messageId, emoji));
        rxContainer.appendChild(badge);
      }
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

    const editBtnHtml = isOutgoing 
      ? `<button class="msg-action-btn msg-edit-btn" title="Edit Message">✏️</button>` 
      : '';

    const pinBtnHtml = `<button class="msg-action-btn msg-pin-btn" title="Pin Message">📌</button>`;
    const replyBtnHtml = `<button class="msg-reply-btn" title="Reply to Message">↩️</button>`;

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
    const editedBadgeHtml = msg.is_edited ? `<span class="edited-badge">(edited)</span>` : '';

    let replyBoxHtml = '';
    if (msg.reply_to_text) {
      replyBoxHtml = `
        <div class="msg-reply-box">
          <div class="msg-reply-user">↩️ Quoting @${escapeHtml(msg.reply_to_user || 'User')}</div>
          <div class="msg-reply-content">${escapeHtml(msg.reply_to_text)}</div>
        </div>
      `;
    }

    msgCard.innerHTML = `
      <div class="msg-avatar">${msg.avatar || '⚡'}</div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">${isOutgoing ? 'You' : (msg.username || 'User')}</span>
          <span class="msg-time">${timeFormatted}</span>
          ${statusIconHtml}
          ${timerBadgeHtml}
          ${editedBadgeHtml}
          ${replyBtnHtml}
          ${pinBtnHtml}
          ${editBtnHtml}
          ${deleteBtnHtml}
        </div>
        <div class="msg-bubble ${isBlurredClass}">
          ${replyBoxHtml}
          ${escapeHtml(msg.content || '')}
        </div>
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

    const editBtn = msgCard.querySelector('.msg-edit-btn');
    if (editBtn && msg.id) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editMessage(msg.id, msg.content);
      });
    }

    const pinBtn = msgCard.querySelector('.msg-pin-btn');
    if (pinBtn && msg.id) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinMessage(msg.id);
      });
    }

    const replyBtn = msgCard.querySelector('.msg-reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReplyState(msg);
      });
    }

    messagesFeed.appendChild(msgCard);

    if (msg.reactions) {
      let rx = {};
      try { rx = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions; } catch(e){}
      updateMessageReactionsDOM(msg.id, rx);
    }

    if (msg.is_pinned && pinnedBanner) {
      pinnedTextSnippet.textContent = msg.content;
      pinnedBanner.classList.remove('hidden');
    }
  };

  if (unpinBtn) {
    unpinBtn.addEventListener('click', () => {
      if (pinnedBanner) pinnedBanner.classList.add('hidden');
    });
  }

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

  if (messageForm) messageForm.addEventListener('submit', (e) => {
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
      timer_seconds: timerSeconds,
      reply_to_id: activeReply ? activeReply.id : null,
      reply_to_user: activeReply ? activeReply.username : null,
      reply_to_text: activeReply ? activeReply.text : null
    }));

    messageInput.value = '';
    setReplyState(null);
    emojiPicker.classList.add('hidden');
    playSound('send');

    ws.send(JSON.stringify({
      type: 'typing',
      recipient_id: activeRecipient ? activeRecipient.id : null,
      isTyping: false
    }));
  });

  if (messageInput) messageInput.addEventListener('input', () => {
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

  if (emojiBtn) emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
  });

  if (emojiPicker) emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
      messageInput.value += e.target.textContent;
      messageInput.focus();
    }
  });

  if (filterInput) filterInput.addEventListener('input', (e) => {
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

// ================= THREE.JS 3D WEBGL MOTION ENGINE =================
// ================= FLUID WEBGL MOTION DESIGN ENGINE =================
function init3DMotionBackground() {
  const canvas = document.getElementById('bg3dCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 120;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // 1. Organic Fluid Wave Plane Mesh
  const planeGeo = new THREE.PlaneGeometry(320, 220, 64, 64);
  
  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uColor1: { value: new THREE.Color(0x8b5cf6) }, // Vibrant Accent Purple
    uColor2: { value: new THREE.Color(0x06b6d4) }, // Vibrant Accent Cyan
    uColor3: { value: new THREE.Color(0xec4899) }, // Neon Pink Ripple
    uRipple: { value: 0 },
    uRipplePos: { value: new THREE.Vector2(0.5, 0.5) }
  };

  const vertexShader = `
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uRipple;
    uniform vec2 uRipplePos;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Complex fluid wave displacement using trigonometric combinations
      float wave1 = sin(pos.x * 0.05 + uTime * 0.8) * cos(pos.y * 0.05 + uTime * 0.6) * 4.5;
      float wave2 = cos(pos.x * 0.08 - uTime * 0.5) * sin(pos.y * 0.08 + uTime * 0.7) * 3.5;
      
      // Cursor fluid distortion
      float distMouse = distance(uv, uMouse);
      float mouseDistortion = smoothstep(0.4, 0.0, distMouse) * 7.0 * sin(uTime * 2.5);

      // Radial fluid shockwave ripple
      float distRipple = distance(uv, uRipplePos);
      float rippleWave = sin(distRipple * 30.0 - uTime * 8.0) * exp(-distRipple * 3.0) * uRipple * 10.0;

      pos.z += wave1 + wave2 + mouseDistortion + rippleWave;
      vElevation = pos.z;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixFactor = smoothstep(-6.0, 8.0, vElevation);
      vec3 color = mix(uColor1, uColor2, mixFactor + sin(uTime * 0.4) * 0.25);
      
      // Dynamic specular glass highlight
      float specular = pow(smoothstep(-2.0, 6.0, vElevation), 3.0) * 0.35;
      color += uColor3 * specular;

      float alpha = smoothstep(0.0, 0.8, 1.0 - length(vUv - vec2(0.5)) * 1.2) * 0.65;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const waveMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    wireframe: false,
    side: THREE.DoubleSide
  });

  const waveMesh = new THREE.Mesh(planeGeo, waveMaterial);
  waveMesh.rotation.x = -Math.PI / 4;
  waveMesh.position.y = -20;
  scene.add(waveMesh);

  // 2. Floating Interactive Particle Constellation
  const particleCount = 450;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    particlePos[i * 3] = (Math.random() - 0.5) * 260;
    particlePos[i * 3 + 1] = (Math.random() - 0.5) * 180;
    particlePos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 2.5,
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // Smooth Motion Interpolation Controls
  let mouseX = 0.5, mouseY = 0.5;
  let targetMouseX = 0, targetMouseY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth);
    mouseY = 1.0 - (e.clientY / window.innerHeight);
    
    targetMouseX = (e.clientX - window.innerWidth / 2) * 0.0005;
    targetMouseY = (e.clientY - window.innerHeight / 2) * 0.0005;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  });

  // Global Shockwave Ripple Trigger for Messaging Events
  window.triggerFluidRipple = (normalizedX = 0.5, normalizedY = 0.5) => {
    uniforms.uRipplePos.value.set(normalizedX, normalizedY);
    uniforms.uRipple.value = 1.0;
  };

  const clock = new THREE.Clock();

  function animateFluid() {
    requestAnimationFrame(animateFluid);

    const elapsedTime = clock.getElapsedTime();
    uniforms.uTime.value = elapsedTime;

    uniforms.uMouse.value.x += (mouseX - uniforms.uMouse.value.x) * 0.08;
    uniforms.uMouse.value.y += (mouseY - uniforms.uMouse.value.y) * 0.08;

    if (uniforms.uRipple.value > 0.001) {
      uniforms.uRipple.value *= 0.94;
    } else {
      uniforms.uRipple.value = 0;
    }

    camera.position.x += (targetMouseX * 50 - camera.position.x) * 0.05;
    camera.position.y += (-targetMouseY * 50 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    particleSystem.rotation.y = elapsedTime * 0.03;
    particleSystem.rotation.x = elapsedTime * 0.02;

    renderer.render(scene, camera);
  }

  animateFluid();
}


  // ================= 3D TILT MOTION & CONTEXT MENU ENGINE =================
  const msgContextMenu = document.getElementById('msgContextMenu');
  const ctxReplyBtn = document.getElementById('ctxReplyBtn');
  const ctxReactBtn = document.getElementById('ctxReactBtn');
  const ctxCopyBtn = document.getElementById('ctxCopyBtn');
  const ctxPinBtn = document.getElementById('ctxPinBtn');
  const ctxPinText = document.getElementById('ctxPinText');
  const ctxEditBtn = document.getElementById('ctxEditBtn');
  const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');

  let activeContextMsg = null;
  let touchTimer = null;
  let touchStartPos = { x: 0, y: 0 };

  // 3D Card Perspective Motion Effect on MouseMove
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.message-card, .btn, .icon-btn, .avatar-opt, .online-user-item, .auth-card-container');
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    const rotateX = (-y / rect.height) * 12;
    const rotateY = (x / rect.width) * 12;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  document.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.message-card, .btn, .icon-btn, .avatar-opt, .online-user-item, .auth-card-container');
    if (card) {
      card.style.transform = '';
    }
  });

  // Open Context Menu Function
  const openMsgContextMenu = (msgCard, clientX, clientY) => {
    if (!msgCard || !msgContextMenu) return;
    activeContextMsg = msgCard;

    const msgId = msgCard.dataset.msgId;
    const isOutgoing = msgCard.classList.contains('outgoing');
    const isPinned = msgCard.classList.contains('pinned');

    // Show or hide outgoing-only options
    msgContextMenu.querySelectorAll('.outgoing-only').forEach(el => {
      el.style.display = isOutgoing ? 'flex' : 'none';
    });

    if (ctxPinText) {
      ctxPinText.textContent = isPinned ? 'Unpin Message' : 'Pin Message';
    }

    // Position Context Menu Responsively
    msgContextMenu.classList.remove('hidden');
    const menuWidth = msgContextMenu.offsetWidth || 220;
    const menuHeight = msgContextMenu.offsetHeight || 240;

    let left = clientX;
    let top = clientY;

    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 15;
    }
    if (top + menuHeight > window.innerHeight - 10) {
      top = window.innerHeight - menuHeight - 15;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    msgContextMenu.style.left = `${left}px`;
    msgContextMenu.style.top = `${top}px`;

    // Trigger haptic vibration feedback on mobile
    if ('vibrate' in navigator) {
      try { navigator.vibrate(50); } catch(e){}
    }
  };

  const closeMsgContextMenu = () => {
    if (msgContextMenu) msgContextMenu.classList.add('hidden');
    if (activeContextMsg) {
      activeContextMsg.classList.remove('long-pressed');
      activeContextMsg = null;
    }
  };

  // Close context menu on outside click or scroll
  document.addEventListener('click', (e) => {
    if (msgContextMenu && !msgContextMenu.contains(e.target)) {
      closeMsgContextMenu();
    }
  });

  document.addEventListener('scroll', closeMsgContextMenu, true);

  // Desktop Right Click (contextmenu) Event Delegation
  if (messagesFeed) {
    messagesFeed.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.message-card');
      if (card) {
        e.preventDefault();
        openMsgContextMenu(card, e.clientX, e.clientY);
      }
    });

    // Mobile Long Press (touchstart / touchend / touchmove) Handling
    messagesFeed.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.message-card');
      if (!card) return;

      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };

      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        card.classList.add('long-pressed');
        openMsgContextMenu(card, touchStartPos.x, touchStartPos.y);
      }, 500); // 500ms long press threshold
    }, { passive: true });

    messagesFeed.addEventListener('touchmove', (e) => {
      if (!touchTimer) return;
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
      if (dist > 10) { // Cancel long press if scrolled
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    }, { passive: true });

    messagesFeed.addEventListener('touchend', () => {
      clearTimeout(touchTimer);
      touchTimer = null;
    });

    messagesFeed.addEventListener('touchcancel', () => {
      clearTimeout(touchTimer);
      touchTimer = null;
    });
  }

  // Context Menu Action Listeners
  if (ctxReplyBtn) {
    ctxReplyBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const author = activeContextMsg.querySelector('.msg-author')?.textContent || 'User';
      const content = activeContextMsg.querySelector('.msg-text')?.textContent || '';
      const msgId = activeContextMsg.dataset.msgId;

      // Trigger reply UI in message form
      if (typeof setQuotedReply === 'function') {
        setQuotedReply(msgId, author, content);
      } else if (messageInput) {
        messageInput.placeholder = `Replying to ${author}...`;
        messageInput.focus();
      }
      closeMsgContextMenu();
    });
  }

  if (ctxReactBtn) {
    ctxReactBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      if (emojiPicker) emojiPicker.classList.remove('hidden');
      closeMsgContextMenu();
    });
  }

  if (ctxCopyBtn) {
    ctxCopyBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const content = activeContextMsg.querySelector('.msg-text')?.textContent || '';
      if (content && navigator.clipboard) {
        navigator.clipboard.writeText(content);
        if (typeof showAlert === 'function') showAlert('Message copied to clipboard!', 'success');
      }
      closeMsgContextMenu();
    });
  }

  if (ctxPinBtn) {
    ctxPinBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const msgId = activeContextMsg.dataset.msgId;
      if (ws && ws.readyState === WebSocket.OPEN && msgId) {
        ws.send(JSON.stringify({ type: 'toggle_pin', messageId: parseInt(msgId, 10) }));
      }
      closeMsgContextMenu();
    });
  }

  if (ctxEditBtn) {
    ctxEditBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const msgId = activeContextMsg.dataset.msgId;
      const content = activeContextMsg.querySelector('.msg-text')?.textContent || '';
      if (messageInput && content) {
        messageInput.value = content;
        messageInput.focus();
      }
      closeMsgContextMenu();
    });
  }

  if (ctxDeleteBtn) {
    ctxDeleteBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const msgId = activeContextMsg.dataset.msgId;
      if (msgId && typeof deleteMessage === 'function') {
        deleteMessage(msgId);
      }
      closeMsgContextMenu();
    });
  }
