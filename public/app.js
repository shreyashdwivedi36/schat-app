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
      const pwdAlertEl = document.getElementById('pwdAlert');
      const changeCurrPwdEl = document.getElementById('changeCurrentPwd');
      const changeNewPwdEl = document.getElementById('changeNewPwd');
      if (pwdAlertEl) pwdAlertEl.classList.add('hidden');
      if (changeCurrPwdEl) changeCurrPwdEl.value = '';
      if (changeNewPwdEl) changeNewPwdEl.value = '';
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
          if (myBioEl) myBioEl.textContent = newBio;
          closeProfileModal();
        }
      } catch (e) {}
    });
  }

  // Change Password Form Submission
  const changePasswordForm = document.getElementById('changePasswordForm');
  const changeCurrentPwd = document.getElementById('changeCurrentPwd');
  const changeNewPwd = document.getElementById('changeNewPwd');
  const pwdAlert = document.getElementById('pwdAlert');

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = changeCurrentPwd.value;
      const newPassword = changeNewPwd.value;

      if (!currentPassword || !newPassword) return;

      if (newPassword.length < 6) {
        if (pwdAlert) {
          pwdAlert.className = 'alert-banner error';
          pwdAlert.textContent = 'New password must be at least 6 characters long.';
          pwdAlert.classList.remove('hidden');
        }
        return;
      }

      try {
        const res = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (pwdAlert) {
          if (!res.ok) {
            pwdAlert.className = 'alert-banner error';
            pwdAlert.textContent = data.error || 'Failed to change password.';
            pwdAlert.classList.remove('hidden');
          } else {
            pwdAlert.className = 'alert-banner success';
            pwdAlert.textContent = data.message || 'Password changed successfully!';
            pwdAlert.classList.remove('hidden');
            changeCurrentPwd.value = '';
            changeNewPwd.value = '';
          }
        }
      } catch (err) {
        if (pwdAlert) {
          pwdAlert.className = 'alert-banner error';
          pwdAlert.textContent = 'Network error. Please try again.';
          pwdAlert.classList.remove('hidden');
        }
      }
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

    myAvatarEl.textContent = currentUser.avatar || '⚡';
    myUsernameEl.textContent = currentUser.username;
    if (myBioEl) myBioEl.textContent = currentUser.bio || 'Online';

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
        performLogout();
        showAlert('Session expired. Please sign in again.', 'error');
        return;
      }

      if (!res.ok) return;

      const renewedToken = res.headers.get('X-Renewed-Token');
      if (renewedToken) {
        authToken = renewedToken;
        localStorage.setItem('schat_token', authToken);
      }

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
          if (data.token) {
            authToken = data.token;
            localStorage.setItem('schat_token', authToken);
          }
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

  
  // Liquid Glass Context Menu Management
  const msgContextMenu = document.getElementById('msgContextMenu');
  const msgContextMenuOverlay = document.getElementById('msgContextMenuOverlay');
  const msgContextMenuCard = document.getElementById('msgContextMenuCard');
  let activeContextMsg = null;

  const closeMessageContextMenu = () => {
    if (msgContextMenu) msgContextMenu.classList.add('hidden');
    activeContextMsg = null;
  };

  if (msgContextMenuOverlay) {
    msgContextMenuOverlay.addEventListener('click', closeMessageContextMenu);
  }

  const openMessageContextMenu = (e, msg, msgCard, isOutgoing) => {
    if (e && e.preventDefault) e.preventDefault();
    activeContextMsg = { msg, msgCard, isOutgoing };

    const ownerElements = msgContextMenuCard ? msgContextMenuCard.querySelectorAll('.owner-only') : [];
    ownerElements.forEach(el => {
      el.style.display = isOutgoing ? 'flex' : 'none';
    });

    const ctxPinLabel = document.getElementById('ctxPinLabel');
    if (ctxPinLabel) {
      ctxPinLabel.textContent = msg.is_pinned ? 'Unpin Message' : 'Pin Message';
    }

    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;

    if (e) {
      if (e.clientX !== undefined && e.clientX !== 0) clientX = e.clientX;
      else if (e.touches && e.touches[0]) clientX = e.touches[0].clientX;

      if (e.clientY !== undefined && e.clientY !== 0) clientY = e.clientY;
      else if (e.touches && e.touches[0]) clientY = e.touches[0].clientY;
    }

    const cardWidth = 260;
    const cardHeight = 280;

    let posX = clientX - cardWidth / 2;
    let posY = clientY - 40;

    if (posX < 12) posX = 12;
    if (posX + cardWidth > window.innerWidth - 12) posX = window.innerWidth - cardWidth - 12;

    if (posY < 12) posY = 12;
    if (posY + cardHeight > window.innerHeight - 12) posY = window.innerHeight - cardHeight - 12;

    if (msgContextMenuCard) {
      msgContextMenuCard.style.left = `${posX}px`;
      msgContextMenuCard.style.top = `${posY}px`;
    }

    if (msgContextMenu) msgContextMenu.classList.remove('hidden');
  };

  // Quick Reactions in Context Menu
  const quickRxBtns = document.querySelectorAll('.quick-rx-btn');
  quickRxBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeContextMsg) return;
      const emoji = btn.dataset.emoji;
      toggleReaction(activeContextMsg.msg.id, emoji);
      closeMessageContextMenu();
    });
  });

  // Action Items in Context Menu
  const ctxReplyBtn = document.getElementById('ctxReplyBtn');
  const ctxCopyBtn = document.getElementById('ctxCopyBtn');
  const ctxPinBtn = document.getElementById('ctxPinBtn');
  const ctxEditBtn = document.getElementById('ctxEditBtn');
  const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');

  if (ctxReplyBtn) {
    ctxReplyBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msg } = activeContextMsg;
      setReplyState(msg);
      closeMessageContextMenu();
    });
  }

  if (ctxCopyBtn) {
    ctxCopyBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msg } = activeContextMsg;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg.content);
        showAlert('Message text copied to clipboard!', 'success');
      }
      closeMessageContextMenu();
    });
  }

  if (ctxPinBtn) {
    ctxPinBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msg } = activeContextMsg;
      togglePinMessage(msg.id);
      closeMessageContextMenu();
    });
  }

  if (ctxEditBtn) {
    ctxEditBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msgCard } = activeContextMsg;
      closeMessageContextMenu();
      const editBtn = msgCard.querySelector('.msg-edit-btn');
      if (editBtn) editBtn.click();
    });
  }

  if (ctxDeleteBtn) {
    ctxDeleteBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msg } = activeContextMsg;
      closeMessageContextMenu();
      deleteMessage(msg.id);
    });
  }


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

        // Right-Click Desktop & Long-Press Mobile Listeners
    let longPressTimer = null;
    msgCard.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openMessageContextMenu(e, msg, msgCard, isOutgoing);
    });

    msgCard.addEventListener('touchstart', (e) => {
      longPressTimer = setTimeout(() => {
        openMessageContextMenu(e, msg, msgCard, isOutgoing);
      }, 400);
    }, { passive: true });

    msgCard.addEventListener('touchend', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    });

    msgCard.addEventListener('touchmove', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    });

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

// ================= THREE.JS 3D WEBGL MOTION ENGINE =================
function init3DMotionBackground() {
  const canvas = document.getElementById('bg3dCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 400;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Create 3D Particle Mesh Constellation
  const particleCount = 700;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const color1 = new THREE.Color(0x8b5cf6); // Purple
  const color2 = new THREE.Color(0x06b6d4); // Cyan

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;

    const mixedColor = color1.clone().lerp(color2, Math.random());
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 4,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Mouse Interactive Motion Tracking
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0008;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0008;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animate3D() {
    requestAnimationFrame(animate3D);

    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;

    particleSystem.rotation.y += 0.0012 + targetX * 0.2;
    particleSystem.rotation.x += 0.0008 + targetY * 0.2;

    camera.position.x += (targetX * 200 - camera.position.x) * 0.05;
    camera.position.y += (-targetY * 200 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate3D();
}
