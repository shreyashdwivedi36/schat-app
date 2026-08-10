// SChat Realtime Animated Chat App Core Frontend Logic
import { MotionFX } from './motion-fx.js';

const startSChat = () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let activeRecipient = 'empty'; // 'empty' = Welcome Screen, null = Global Channel, { id, username, avatar } = Direct Message
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

  init3DMotionBackground();
  MotionFX.boot();

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
      if (emojiPicker) hideElement(emojiPicker);
    }
  });

  
  // Helper functions for showing/hiding elements with both style.display and classList
  const showElement = (el) => {
    if (!el) return;
    el.style.display = '';
    el.classList.remove('hidden');
  };

  const hideElement = (el) => {
    if (!el) return;
    el.style.display = 'none';
    el.classList.add('hidden');
  };

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
    if (optionsDropdown) {
      if (optionsDropdown.classList.contains('hidden')) {
        optionsDropdown.style.display = '';
        optionsDropdown.classList.remove('hidden');
        MotionFX.popIn(optionsDropdown);
      } else {
        optionsDropdown.style.display = 'none';
        optionsDropdown.classList.add('hidden');
      }
    }
  };

  const closeOptionsDropdown = () => {
    if (optionsDropdown) {
      optionsDropdown.style.display = 'none';
      optionsDropdown.classList.add('hidden');
    }
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

  const openAboutModal = () => {
    if (!aboutModal) return;
    aboutModal.style.display = '';
    aboutModal.classList.remove('hidden');
    const card = aboutModal.querySelector('.modal-card');
    if (card) MotionFX.popIn(card);
  };
  const closeAboutModal = () => { if (aboutModal) { aboutModal.style.display = 'none'; aboutModal.classList.add('hidden'); } };

  const openProfileModal = () => {
    if (profileModal) {
      if (profileBioInput && currentUser) profileBioInput.value = currentUser.bio || '';
      const pwdAlertEl = document.getElementById('pwdAlert');
      const changeCurrPwdEl = document.getElementById('changeCurrentPwd');
      const changeNewPwdEl = document.getElementById('changeNewPwd');
      if (pwdAlertEl) pwdAlertEl.classList.add('hidden');
      if (changeCurrPwdEl) changeCurrPwdEl.value = '';
      if (changeNewPwdEl) changeNewPwdEl.value = '';
      profileModal.style.display = '';
      profileModal.classList.remove('hidden');
      const card = profileModal.querySelector('.modal-card');
      if (card) MotionFX.popIn(card);
    }
  };
  const closeProfileModal = () => { if (profileModal) { profileModal.style.display = 'none'; profileModal.classList.add('hidden'); } };

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
          showElement(pwdAlert);
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
            showElement(pwdAlert);
          } else {
            pwdAlert.className = 'alert-banner success';
            pwdAlert.textContent = data.message || 'Password changed successfully!';
            showElement(pwdAlert);
            changeCurrentPwd.value = '';
            changeNewPwd.value = '';
          }
        }
      } catch (err) {
        if (pwdAlert) {
          pwdAlert.className = 'alert-banner error';
          pwdAlert.textContent = 'Network error. Please try again.';
          showElement(pwdAlert);
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
      if (replyPreviewBar) hideElement(replyPreviewBar);
      return;
    }
    activeReply = {
      id: msg.id,
      username: msg.username || 'User',
      text: msg.content || ''
    };
    if (replyUserLabel) replyUserLabel.textContent = `Replying to @${activeReply.username}`;
    if (replyTextSnippet) replyTextSnippet.textContent = activeReply.text;
    if (replyPreviewBar) showElement(replyPreviewBar);
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
    showElement(authAlert);
    setTimeout(() => authAlert.classList.add('hidden'), 4000);
  };

  const swapAuthForms = async (fromForm, toForm) => {
    hideElement(authAlert);
    if (!MotionFX.reduced) {
      await MotionFX.exit(fromForm, { y: -10 });
    }
    fromForm.classList.remove('active');
    fromForm.classList.add('hidden');
    fromForm.style.opacity = '';
    fromForm.style.filter = '';
    fromForm.style.transform = '';
    toForm.classList.remove('hidden');
    toForm.classList.add('active');
    await MotionFX.enter(toForm, { y: 16, bounce: 0.10 });
    MotionFX.staggerIn(toForm.querySelectorAll('.input-group, .avatar-selector, .btn-primary, .auth-switch'), { y: 10, step: 0.04 });
  };

  switchToRegisterBtn.addEventListener('click', () => {
    swapAuthForms(loginForm, registerForm);
  });

  switchToLoginBtn.addEventListener('click', () => {
    swapAuthForms(registerForm, loginForm);
  });

  avatarPicker.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt');
    if (!opt) return;
    avatarPicker.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.avatar;
    MotionFX.press(opt);
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

    const leaveChat = async () => {
      await MotionFX.exit(chatView, { y: 16 });
      chatView.classList.add('hidden');
      chatView.style.opacity = '';
      chatView.style.filter = '';
      chatView.style.transform = '';
      authView.classList.remove('hidden');
      await MotionFX.enter(authView, { y: 18 });
    };
    leaveChat();
    closeSidebar();
  };

  logoutBtn.addEventListener('click', performLogout);

  // Channel & DM Tab Switching
  globalChannelBtn.addEventListener('click', () => {
    switchChatTab(null);
  });

  // Channel Context Menu Management
  const channelContextMenu = document.getElementById('channelContextMenu');
  const channelContextMenuOverlay = document.getElementById('channelContextMenuOverlay');
  const channelContextMenuCard = document.getElementById('channelContextMenuCard');
  const ctxCloseChatBtn = document.getElementById('ctxCloseChatBtn');

  const closeChannelContextMenu = () => {
    if (channelContextMenu) {
      channelContextMenu.style.display = 'none';
      channelContextMenu.classList.add('hidden');
    }
  };

  if (channelContextMenuOverlay) {
    channelContextMenuOverlay.addEventListener('click', closeChannelContextMenu);
  }

  if (ctxCloseChatBtn) {
    ctxCloseChatBtn.addEventListener('click', () => {
      closeChannelContextMenu();
      switchChatTab('empty');
    });
  }

  const handleChannelContextMenu = (e) => {
    e.preventDefault();
    if (activeRecipient === 'empty') return; // Do not show menu if already empty
    
    if (channelContextMenu && channelContextMenuCard) {
      // Show menu
      channelContextMenu.style.display = '';
      channelContextMenu.classList.remove('hidden');

      const actualWidth = channelContextMenuCard.offsetWidth || 200;
      const actualHeight = channelContextMenuCard.offsetHeight || 100;
      
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      let posX = clientX - 20;
      let posY = clientY - 20;

      if (posX + actualWidth > window.innerWidth - 12) posX = window.innerWidth - actualWidth - 12;
      if (posY + actualHeight > window.innerHeight - 12) posY = window.innerHeight - actualHeight - 12;
      if (posX < 12) posX = 12;
      if (posY < 12) posY = 12;

      channelContextMenuCard.style.left = `${posX}px`;
      channelContextMenuCard.style.top = `${posY}px`;

      MotionFX.popIn(channelContextMenuCard);
    }
  };

  globalChannelBtn.addEventListener('contextmenu', handleChannelContextMenu);
  let channelLongPressTimer = null;
  globalChannelBtn.addEventListener('touchstart', (e) => {
    channelLongPressTimer = setTimeout(() => handleChannelContextMenu(e), 500);
  }, { passive: true });
  globalChannelBtn.addEventListener('touchend', () => clearTimeout(channelLongPressTimer));
  globalChannelBtn.addEventListener('touchmove', () => clearTimeout(channelLongPressTimer));

  const switchChatTab = (recipient) => {
    activeRecipient = recipient;
    setReplyState(null);

    document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
    globalChannelBtn.classList.remove('active');

    const chatWrapper = document.querySelector('.chat-wrapper');

    if (activeRecipient === 'empty') {
      chatWrapper.classList.add('empty-state');
      document.querySelector('.chat-footer').style.display = '';
      return;
    }

    chatWrapper.classList.remove('empty-state');
    document.querySelector('.chat-footer').style.display = '';

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

    const enterChat = async () => {
      await MotionFX.exit(authView, { y: -14 });
      authView.classList.add('hidden');
      authView.style.opacity = '';
      authView.style.filter = '';
      authView.style.transform = '';
      chatView.classList.remove('hidden');

      if (activeRecipient === 'empty') {
        document.querySelector('.chat-wrapper').classList.add('empty-state');
      }

      await MotionFX.enter(chatView, { y: 22, bounce: 0.08 });
      MotionFX.staggerIn(chatView.querySelectorAll('.chat-sidebar > *, .chat-header, .welcome-banner, .chat-footer'), { y: 12, step: 0.04 });
    };
    await enterChat();

    requestNotificationPermission();
    await loadMessageHistory();
    connectWebSocket();
  };

  const loadMessageHistory = async () => {
    if (activeRecipient === 'empty') return;
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
        data.messages.forEach((msg) => renderMessage(msg, { animateEnter: false }));
        scrollToBottom();

        if (activeRecipient && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'mark_read',
            sender_id: activeRecipient.id
          }));
        }

        // Verify if any message in loaded history is actively pinned
        const activePinned = data.messages.find(m => m.is_pinned === 1);
        if (activePinned && pinnedBanner) {
          if (pinnedTextSnippet) pinnedTextSnippet.textContent = activePinned.content;
          showElement(pinnedBanner);
        } else if (pinnedBanner) {
          if (pinnedTextSnippet) pinnedTextSnippet.textContent = '';
          hideElement(pinnedBanner);
        }
      } else if (pinnedBanner) {
        if (pinnedTextSnippet) pinnedTextSnippet.textContent = '';
        hideElement(pinnedBanner);
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
            if (autoTranslateEnabled && Number(data.user_id) !== Number(currentUser.id)) {
              setTimeout(() => {
                const newCard = document.querySelector(`.message-card[data-msg-id="${data.id || data.messageId}"]`);
                if (newCard) translateMessageCard(newCard, data.content, targetLanguage);
              }, 150);
            }

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
          const card = document.querySelector(`.message-card[data-msg-id="${data.messageId}"]`);
          const isPinned = data.is_pinned ? 1 : 0;
          if (card) {
            card.dataset.isPinned = isPinned;
            if (card._msgData) card._msgData.is_pinned = isPinned;
            const pinBtn = card.querySelector('.msg-pin-btn');
            if (pinBtn) pinBtn.title = isPinned ? 'Unpin Message' : 'Pin Message';
          }
          if (isPinned && pinnedBanner) {
            if (pinnedTextSnippet) {
              pinnedTextSnippet.textContent = data.content
                || (card && card._msgData && card._msgData.content) 
                || (card && card.querySelector('.msg-bubble')?.textContent) 
                || 'Pinned message';
            }
            showElement(pinnedBanner);
          } else if (!isPinned && pinnedBanner) {
            const otherPinned = document.querySelector('.message-card[data-is-pinned="1"]');
            if (otherPinned && pinnedTextSnippet) {
              pinnedTextSnippet.textContent = otherPinned._msgData?.content || 'Pinned message';
              showElement(pinnedBanner);
            } else {
              hideElement(pinnedBanner);
            }
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

  
  // Reaction Micro-Particle Physics Burst
  const triggerReactionBurst = (targetEl, emoji) => {
    if (!targetEl || !emoji) return;
    const rect = targetEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = 'reaction-burst-particle';
      p.textContent = emoji;

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const dist1 = Math.random() * 35 + 25;
      const dist2 = dist1 + Math.random() * 30 + 15;

      p.style.left = `${originX}px`;
      p.style.top = `${originY}px`;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist1}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist1 - 15}px`);
      p.style.setProperty('--dx2', `${Math.cos(angle) * dist2}px`);
      p.style.setProperty('--dy2', `${Math.sin(angle) * dist2 - 35}px`);
      p.style.setProperty('--rot', `${(Math.random() - 0.5) * 45}deg`);
      p.style.setProperty('--rot2', `${(Math.random() - 0.5) * 90}deg`);

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }

    if (window.triggerCanvasShockwave) {
      window.triggerCanvasShockwave(originX, originY, '#6366f1');
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
      const wasPinned = card.dataset.isPinned === '1';
      card.classList.add('removing');
      setTimeout(() => card.remove(), 300);

      if (wasPinned) {
        const nextPinned = document.querySelector(`.message-card[data-is-pinned="1"]:not([data-msg-id="${messageId}"])`);
        if (nextPinned) {
          if (pinnedTextSnippet) {
            pinnedTextSnippet.textContent = nextPinned._msgData?.content || nextPinned.querySelector('.msg-bubble')?.textContent || 'Pinned message';
          }
          showElement(pinnedBanner);
        } else {
          hideElement(pinnedBanner);
        }
      }
    }
  };

  
  // Liquid Glass Context Menu Management
  const msgContextMenu = document.getElementById('msgContextMenu');
  const msgContextMenuOverlay = document.getElementById('msgContextMenuOverlay');
  const msgContextMenuCard = document.getElementById('msgContextMenuCard');
  let activeContextMsg = null;

  const closeMessageContextMenu = () => {
    if (msgContextMenu) {
      msgContextMenu.style.display = 'none';
      msgContextMenu.classList.add('hidden');
    }
    activeContextMsg = null;
  };

  if (msgContextMenuOverlay) {
    msgContextMenuOverlay.addEventListener('click', closeMessageContextMenu);
  }

  
  // Language & Translation State
  const langNames = {
    en: 'English', hi: 'Hindi (हिन्दी)', bn: 'Bengali (বাংলা)', mr: 'Marathi (मराठी)',
    te: 'Telugu (తెలుగు)', ta: 'Tamil (தமிழ்)', gu: 'Gujarati (ગુજરાતી)', pa: 'Punjabi (ਪੰਜਾਬੀ)',
    ur: 'Urdu (اردو)', es: 'Spanish (Español)', fr: 'French (Français)', de: 'German (Deutsch)',
    ja: 'Japanese (日本語)', zh: 'Chinese (中文)', ru: 'Russian (Русский)', ar: 'Arabic (العربية)',
    pt: 'Portuguese (Português)'
  };
  let targetLanguage = localStorage.getItem('schat_target_lang') || 'en';
  let autoTranslateEnabled = localStorage.getItem('schat_auto_translate') === 'true';

  const langModal = document.getElementById('langModal');
  const closeLangBtn = document.getElementById('closeLangBtn');
  const dropdownLangBtn = document.getElementById('dropdownLangBtn');
  const dropdownLangValue = document.getElementById('dropdownLangValue');
  const dropdownAutoTranslateBtn = document.getElementById('dropdownAutoTranslateBtn');
  const dropdownAutoTranslateValue = document.getElementById('dropdownAutoTranslateValue');
  const ctxTranslateBtn = document.getElementById('ctxTranslateBtn');

  const updateLangUI = () => {
    if (dropdownLangValue) dropdownLangValue.textContent = (langNames[targetLanguage] || 'English').split(' ')[0];
    if (dropdownAutoTranslateValue) dropdownAutoTranslateValue.textContent = autoTranslateEnabled ? 'On' : 'Off';
    document.querySelectorAll('.lang-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === targetLanguage);
    });
  };
  updateLangUI();

  const openLangModal = () => {
    if (langModal) {
      showElement(langModal);
      const langCard = langModal.querySelector('.modal-card');
      if (langCard) MotionFX.popIn(langCard);
      closeOptionsDropdown();
    }
  };
  const closeLangModal = () => {
    if (langModal) hideElement(langModal);
  };

  if (dropdownLangBtn) dropdownLangBtn.addEventListener('click', openLangModal);
  if (closeLangBtn) closeLangBtn.addEventListener('click', closeLangModal);

  if (dropdownAutoTranslateBtn) {
    dropdownAutoTranslateBtn.addEventListener('click', () => {
      autoTranslateEnabled = !autoTranslateEnabled;
      localStorage.setItem('schat_auto_translate', autoTranslateEnabled ? 'true' : 'false');
      updateLangUI();
      showAlert(`Auto-Translate ${autoTranslateEnabled ? 'Enabled' : 'Disabled'}`, 'success');
      closeOptionsDropdown();
    });
  }

  document.querySelectorAll('.lang-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      targetLanguage = btn.dataset.lang || 'en';
      localStorage.setItem('schat_target_lang', targetLanguage);
      updateLangUI();
      closeLangModal();
      showAlert(`Translation language set to ${btn.dataset.name || targetLanguage}`, 'success');
    });
  });

  // Message Translation Handler
  const translateMessageCard = async (card, text, targetLang = targetLanguage) => {
    if (!card || !text) return;
    const bubble = card.querySelector('.msg-bubble');
    if (!bubble) return;

    let existingBox = bubble.querySelector('.msg-translation-box');
    if (existingBox) existingBox.remove();

    const loadingBox = document.createElement('div');
    loadingBox.className = 'msg-translation-box';
    loadingBox.innerHTML = `
      <div class="translation-header">
        <span class="translation-tag">🌐 Translating to ${(langNames[targetLang] || targetLang).split(' ')[0]}...</span>
      </div>
    `;
    bubble.appendChild(loadingBox);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ text, targetLang })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');

      loadingBox.innerHTML = `
        <div class="translation-header">
          <span class="translation-tag">🌐 ${(langNames[targetLang] || targetLang).split(' ')[0]}</span>
          <button class="close-translation-btn" title="Hide translation">✕</button>
        </div>
        <div class="translation-content">${escapeHtml(data.translatedText || text)}</div>
      `;

      const closeBtn = loadingBox.querySelector('.close-translation-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          loadingBox.remove();
        });
      }
    } catch (err) {
      loadingBox.innerHTML = `
        <div class="translation-header">
          <span class="translation-tag" style="color: var(--danger-color);">⚠️ Translation Error</span>
          <button class="close-translation-btn">✕</button>
        </div>
        <div class="translation-content" style="font-size:0.8rem; color: var(--text-dim);">Unable to translate message at this time.</div>
      `;
      const closeBtn = loadingBox.querySelector('.close-translation-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => loadingBox.remove());
    }
  };

  const openMessageContextMenu = (e, msg, msgCard, isOutgoing) => {
    if (e && e.preventDefault) e.preventDefault();
    activeContextMsg = { msg, msgCard, isOutgoing };

    const ownerElements = msgContextMenuCard ? msgContextMenuCard.querySelectorAll('.owner-only') : [];
    ownerElements.forEach(el => {
      el.style.display = isOutgoing ? 'flex' : 'none';
    });

    const isPinned = Number(msgCard ? (msgCard.dataset.isPinned || msg.is_pinned) : msg.is_pinned) === 1;
    const ctxPinLabel = document.getElementById('ctxPinLabel');
    if (ctxPinLabel) {
      ctxPinLabel.textContent = isPinned ? 'Unpin Message' : 'Pin Message';
    }

    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;

    if (e) {
      if (e.clientX !== undefined && e.clientX !== 0) clientX = e.clientX;
      else if (e.touches && e.touches[0]) clientX = e.touches[0].clientX;

      if (e.clientY !== undefined && e.clientY !== 0) clientY = e.clientY;
      else if (e.touches && e.touches[0]) clientY = e.touches[0].clientY;
    }

    if (msgContextMenu) {
      // 1. Make visible first to measure actual dimensions
      msgContextMenu.style.display = '';
      msgContextMenu.classList.remove('hidden');

      if (msgContextMenuCard) {
        const actualWidth = msgContextMenuCard.offsetWidth || 260;
        const actualHeight = msgContextMenuCard.offsetHeight || 320;

        // 2. Calculate initial position
        let posX = clientX - actualWidth / 2;
        let posY = clientY - 40;

        // 3. Clamp to screen bounds dynamically
        if (posX < 12) posX = 12;
        if (posX + actualWidth > window.innerWidth - 12) posX = window.innerWidth - actualWidth - 12;

        if (posY < 12) posY = 12;
        if (posY + actualHeight > window.innerHeight - 12) {
          posY = window.innerHeight - actualHeight - 12;
          if (posY < 12) posY = 12; // Prevent overlapping top edge on very small screens
        }

        // 4. Apply precise coordinates
        msgContextMenuCard.style.left = `${posX}px`;
        msgContextMenuCard.style.top = `${posY}px`;

        MotionFX.popIn(msgContextMenuCard);
      }
    }
  };

  // Quick Reactions in Context Menu
  const quickRxBtns = document.querySelectorAll('.quick-rx-btn');
  quickRxBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeContextMsg) return;
      const emoji = btn.dataset.emoji;
      triggerReactionBurst(btn, emoji);
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

    if (ctxTranslateBtn) {
    ctxTranslateBtn.addEventListener('click', () => {
      if (!activeContextMsg) return;
      const { msg, msgCard } = activeContextMsg;
      closeMessageContextMenu();
      translateMessageCard(msgCard, msg.content, targetLanguage);
    });
  }

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


  const renderMessage = (msg, { animateEnter = true } = {}) => {
    const msgUniqueId = msg.id || `temp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    if (msg.id && document.querySelector(`.message-card[data-msg-id="${msg.id}"]`)) {
      return;
    }

    const isOutgoing = Number(msg.user_id) === Number(currentUser.id);
    const msgCard = document.createElement('div');
    msgCard.className = `message-card ${isOutgoing ? 'outgoing' : 'incoming'}`;
    msgCard.dataset.msgId = msgUniqueId;
    msgCard.dataset.isPinned = msg.is_pinned ? '1' : '0';
    msgCard._msgData = msg;

    const timeFormatted = new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    const optionsTriggerHtml = `<button class="msg-options-trigger-btn" title="Message Options" aria-label="Message options">⋮</button>`;

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

    let contentHtml = '';
    if (msg.content && msg.content.startsWith('data:audio/')) {
      contentHtml = `
        <div class="audio-player-ui">
          <button class="play-pause-btn" aria-label="Play">▶</button>
          <div class="audio-progress-bar"><div class="audio-progress-fill"></div></div>
          <span class="audio-time">0:00</span>
          <audio src="${msg.content}" style="display: none;" preload="metadata"></audio>
        </div>
      `;
    } else {
      contentHtml = escapeHtml(msg.content || '');
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
          ${optionsTriggerHtml}
        </div>
        <div class="msg-bubble ${isBlurredClass}">
          ${replyBoxHtml}
          ${contentHtml}
        </div>
      </div>
    `;

    const bubbleEl = msgCard.querySelector('.msg-bubble');
    if (msg.is_blurred && bubbleEl) {
      bubbleEl.addEventListener('click', () => {
        bubbleEl.classList.toggle('unmasked');
      });
    }

    // Audio Player Logic
    const audioUI = msgCard.querySelector('.audio-player-ui');
    if (audioUI) {
      const audioEl = audioUI.querySelector('audio');
      const playBtn = audioUI.querySelector('.play-pause-btn');
      const progressFill = audioUI.querySelector('.audio-progress-fill');
      const timeSpan = audioUI.querySelector('.audio-time');
      const progressBar = audioUI.querySelector('.audio-progress-bar');
      
      let isPlaying = false;
      
      const formatTime = (seconds) => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      };

      audioEl.addEventListener('loadedmetadata', () => {
        if (audioEl.duration && audioEl.duration !== Infinity) {
          timeSpan.textContent = formatTime(audioEl.duration);
        } else {
          // Chrome webm duration bug fallback
          audioEl.currentTime = 1e101; 
          audioEl.addEventListener('timeupdate', function getDuration() {
            audioEl.removeEventListener('timeupdate', getDuration);
            audioEl.currentTime = 0;
            timeSpan.textContent = formatTime(audioEl.duration);
          });
        }
      });

      audioEl.addEventListener('timeupdate', () => {
        if (audioEl.duration) {
          const percent = (audioEl.currentTime / audioEl.duration) * 100;
          progressFill.style.width = `${percent}%`;
          timeSpan.textContent = formatTime(audioEl.currentTime);
        }
      });

      audioEl.addEventListener('ended', () => {
        isPlaying = false;
        playBtn.textContent = '▶';
        progressFill.style.width = '0%';
        timeSpan.textContent = formatTime(audioEl.duration);
      });

      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPlaying) {
          audioEl.pause();
          playBtn.textContent = '▶';
        } else {
          audioEl.play();
          playBtn.textContent = '⏸';
        }
        isPlaying = !isPlaying;
      });

      progressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!audioEl.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioEl.currentTime = percent * audioEl.duration;
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

    const optTriggerBtn = msgCard.querySelector('.msg-options-trigger-btn');
    if (optTriggerBtn) {
      optTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMessageContextMenu(e, msg, msgCard, isOutgoing);
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
    if (animateEnter) {
      MotionFX.enterMessage(msgCard, isOutgoing);
      if (!MotionFX.reduced && typeof window.triggerCanvasShockwave === 'function') {
        const rect = msgCard.getBoundingClientRect();
        window.triggerCanvasShockwave(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          isOutgoing ? '#6366f1' : '#0ea5e9'
        );
      }
    }

    if (msg.reactions) {
      let rx = {};
      try { rx = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions; } catch(e){}
      updateMessageReactionsDOM(msg.id, rx);
    }

    if (msg.is_pinned && pinnedBanner) {
      pinnedTextSnippet.textContent = msg.content;
      showElement(pinnedBanner);
    }
  };

  if (unpinBtn) {
    unpinBtn.addEventListener('click', () => {
      const pinnedCard = document.querySelector('.message-card[data-is-pinned="1"]');
      if (pinnedCard) {
        togglePinMessage(pinnedCard.dataset.msgId);
      }
      if (pinnedTextSnippet) pinnedTextSnippet.textContent = '';
      if (pinnedBanner) hideElement(pinnedBanner);
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
    MotionFX.tickNumber(onlineCountBadge, otherUsers.length);
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

      li.addEventListener('contextmenu', handleChannelContextMenu);
      let userLongPressTimer = null;
      li.addEventListener('touchstart', (e) => {
        userLongPressTimer = setTimeout(() => handleChannelContextMenu(e), 500);
      }, { passive: true });
      li.addEventListener('touchend', () => clearTimeout(userLongPressTimer));
      li.addEventListener('touchmove', () => clearTimeout(userLongPressTimer));

      onlineUsersList.appendChild(li);
    });
  };

  // ================= VOICE MESSAGES =================
  const micBtn = document.getElementById('micBtn');
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64AudioMessage = reader.result;
          
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            showAlert('Connecting to server... Please try sending again in a moment.', 'error');
            return;
          }

          const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

          ws.send(JSON.stringify({
            type: 'chat_message',
            recipient_id: activeRecipient ? activeRecipient.id : null,
            content: base64AudioMessage,
            is_blurred: isPrivacyBlurActive ? 1 : 0,
            timer_seconds: timerSeconds,
            reply_to_id: activeReply ? activeReply.id : null,
            reply_to_user: activeReply ? activeReply.username : null,
            reply_to_text: activeReply ? activeReply.text : null
          }));

          setReplyState(null);
          playSound('send');
        };
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      isRecording = true;
      if (micBtn) micBtn.classList.add('recording');
      
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
      
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      showAlert('Microphone access denied. Please allow microphone permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    isRecording = false;
    if (micBtn) micBtn.classList.remove('recording');
  };

  if (micBtn) {
    // Desktop
    micBtn.addEventListener('mousedown', startRecording);
    window.addEventListener('mouseup', () => { if (isRecording) stopRecording(); });
    // Mobile
    micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); }, { passive: false });
    window.addEventListener('touchend', () => { if (isRecording) stopRecording(); });
  }

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
    hideElement(emojiPicker);
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
      showElement(typingBanner);
    } else {
      hideElement(typingBanner);
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
  } else {
    authView.classList.remove('hidden');
    MotionFX.enter(authView, { y: 18 });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSChat);
} else {
  startSChat();
}

// ================= HIGH-PERFORMANCE INTERACTIVE FLUID MOTION ENGINE =================
function init3DMotionBackground() {
  const canvas = document.getElementById('bg3dCanvas');
  const aurora = document.getElementById('interactiveAuroraGlow');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let shockwaves = [];
  const maxParticles = window.innerWidth > 768 ? 75 : 40;
  let motionPaused = document.hidden;

  const resizeCanvas = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const pointer = {
    x: width / 2,
    y: height / 2,
    targetX: width / 2,
    targetY: height / 2,
    isActive: false,
    radius: window.innerWidth > 768 ? 280 : 170
  };

  const updatePointer = (clientX, clientY) => {
    pointer.targetX = clientX;
    pointer.targetY = clientY;
    pointer.isActive = true;

    if (aurora) {
      aurora.style.left = `${clientX}px`;
      aurora.style.top = `${clientY}px`;
    }
  };

  window.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  class FluidNode {
    constructor() {
      this.init();
    }

    init() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.7;
      this.vy = (Math.random() - 0.5) * 0.7;
      this.radius = Math.random() * 2.2 + 1.2;
      this.angle = Math.random() * Math.PI * 2;
      this.angularSpeed = Math.random() * 0.015 + 0.005;
      this.colorRatio = Math.random();
    }

    update() {
      this.angle += this.angularSpeed;
      this.x += this.vx + Math.sin(this.angle) * 0.35;
      this.y += this.vy + Math.cos(this.angle) * 0.35;

      if (this.x < -30) this.x = width + 30;
      if (this.x > width + 30) this.x = -30;
      if (this.y < -30) this.y = height + 30;
      if (this.y > height + 30) this.y = -30;

      if (pointer.isActive) {
        const dx = pointer.x - this.x;
        const dy = pointer.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < pointer.radius) {
          const baseForce = window.innerWidth > 768 ? 8.5 : 4.5;
          const force = (1 - dist / pointer.radius) * baseForce;
          const angle = Math.atan2(dy, dx);
          this.x -= Math.cos(angle) * force;
          this.y -= Math.sin(angle) * force;
        }
      }

      shockwaves.forEach(sw => {
        const dx = this.x - sw.x;
        const dy = this.y - sw.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const waveDist = Math.abs(dist - sw.radius);

        if (waveDist < 40) {
          const waveForce = (1 - waveDist / 40) * sw.strength;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * waveForce;
          this.y += Math.sin(angle) * waveForce;
        }
      });
    }

    draw(theme) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      if (theme === 'light') {
        ctx.fillStyle = this.colorRatio > 0.5 ? 'rgba(124, 58, 237, 0.5)' : 'rgba(2, 132, 199, 0.5)';
      } else {
        ctx.fillStyle = this.colorRatio > 0.5 ? 'rgba(99, 102, 241, 0.8)' : 'rgba(14, 165, 233, 0.8)';
      }
      ctx.fill();
    }
  }

  for (let i = 0; i < maxParticles; i++) {
    particles.push(new FluidNode());
  }

  window.triggerCanvasShockwave = (x = width / 2, y = height / 2, color = '#6366f1') => {
    shockwaves.push({
      x: x || width / 2,
      y: y || height / 2,
      radius: 5,
      maxRadius: Math.max(width, height) * 0.8,
      speed: 16,
      opacity: 0.85,
      color: color,
      strength: 8
    });
  };

  document.addEventListener('visibilitychange', () => {
    motionPaused = document.hidden;
    if (!motionPaused) animate();
  });

  const animate = () => {
    if (motionPaused) return;
    ctx.clearRect(0, 0, width, height);

    pointer.x += (pointer.targetX - pointer.x) * 0.1;
    pointer.y += (pointer.targetY - pointer.y) * 0.1;

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    for (let s = shockwaves.length - 1; s >= 0; s--) {
      const sw = shockwaves[s];
      sw.radius += sw.speed;
      sw.opacity *= 0.96;
      sw.strength *= 0.95;

      if (sw.opacity > 0.02 && sw.radius < sw.maxRadius) {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color === '#6366f1' 
          ? `rgba(99, 102, 241, ${sw.opacity * 0.45})` 
          : `rgba(14, 165, 233, ${sw.opacity * 0.45})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        shockwaves.splice(s, 1);
      }
    }

    const maxConnectionDistance = window.innerWidth > 768 ? 150 : 95;
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(currentTheme);

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxConnectionDistance) {
          const alpha = (1 - dist / maxConnectionDistance) * (currentTheme === 'light' ? 0.25 : 0.45);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = currentTheme === 'light' 
            ? `rgba(124, 58, 237, ${alpha})` 
            : `rgba(99, 102, 241, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      if (pointer.isActive) {
        const pdx = pointer.x - particles[i].x;
        const pdy = pointer.y - particles[i].y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

        if (pdist < pointer.radius) {
          const palpha = (1 - pdist / pointer.radius) * 0.48;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = currentTheme === 'light' 
            ? `rgba(2, 132, 199, ${palpha})` 
            : `rgba(14, 165, 233, ${palpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  };

  animate();
}