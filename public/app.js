/**
 * ============================================================================
 * SChat - Real-Time Messaging Platform
 * Copyright (c) 2026 Shreyash Dwivedi (@shreyashdwivedi36). All Rights Reserved.
 *
 * This software and its associated documentation are the exclusive proprietary
 * property of Shreyash Dwivedi. Unauthorized copying, modification, distribution,
 * sublicensing, or commercial use is strictly prohibited.
 * ============================================================================
 */
// SChat Realtime Animated Chat App Core Frontend Logic
import { MotionFX } from './motion-fx.js';


const startSChat = () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let myMutedChats = [];
  let activeRecipient = 'empty'; // 'empty' = Welcome Screen, null = Global Channel, { id, username, avatar } = Direct Message
  let activeReply = null; // null or { id, username, text }
  let unreadCounts = {};
  let totalUnreadDM = 0;
  let isPrivacyBlurActive = false;
  let deferredPrompt = null;
  let ws = null;
  let pingInterval = null;
  let selectedAvatar = '👤';
  let soundEnabled = true;
  let typingTimeout = null;
  let isSendingTyping = false;
  let allRegisteredUsers = [];
  let onlineUserIds = new Set();
  let chattedUserIds = new Set();
  let lastRenderedDate = null;

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

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  
  if (isAndroid && !isStandalone) {
    if (pwaInstallBtn) {
      pwaInstallBtn.classList.remove('hidden');
      const label = pwaInstallBtn.querySelector('.context-label');
      if (label) label.textContent = 'Download Android App';
    }
    if (dropdownPwaBtn) {
      dropdownPwaBtn.classList.remove('hidden');
      dropdownPwaBtn.innerHTML = '🤖 <span style="margin-left:8px">Download Android App</span>';
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isAndroid && !isStandalone) {
      if (pwaInstallBtn) pwaInstallBtn.classList.remove('hidden');
      if (dropdownPwaBtn) dropdownPwaBtn.classList.remove('hidden');
    }
  });

  const triggerPwaInstall = async () => {
    if (isAndroid) {
      if (confirm('For the absolute best experience on Android, please install our native Android App. Would you like to download the official APK now?')) {
        window.location.href = 'https://github.com/shreyashdwivedi36/schat-app/releases/download/v1.0.0/SChat.apk';
      }
      return;
    }
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
  const msgAudio = document.getElementById('msgAudio');
  if (msgAudio) msgAudio.volume = 0.3;

  // ==========================================
  // SUPER ADMIN GOD MODE LOGIC
  // ==========================================
  const adminBtn = document.getElementById('adminBtn');
  const adminModal = document.getElementById('adminModal');
  const closeAdminModal = document.getElementById('closeAdminModal');
  const adminUserList = document.getElementById('adminUserList');
  const adminAnnounceBtn = document.getElementById('adminAnnounceBtn');
  const adminAnnounceInput = document.getElementById('adminAnnounceInput');

  if (adminBtn && adminModal) {
    adminBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      adminModal.style.display = '';
      adminModal.classList.remove('hidden');
      const card = adminModal.querySelector('.modal-card');
      if (card) MotionFX.popIn(card);
      await fetchAdminUsers();
    });

    closeAdminModal.addEventListener('click', () => {
      adminModal.style.display = 'none';
      adminModal.classList.add('hidden');
    });

    adminAnnounceBtn.addEventListener('click', async () => {
      const message = adminAnnounceInput.value.trim();
      if (!message) return;
      
      try {
        const res = await fetch('/api/admin/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ message })
        });
        if (res.ok) {
          adminAnnounceInput.value = '';
          
          // Beautiful animated success modal for the admin
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.top = '0'; overlay.style.left = '0';
          overlay.style.width = '100vw'; overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
          overlay.style.backdropFilter = 'blur(5px)';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.zIndex = '999999';
          
          const modal = document.createElement('div');
          modal.style.background = 'var(--panel-bg)';
          modal.style.padding = '30px 40px';
          modal.style.borderRadius = '20px';
          modal.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(16, 185, 129, 0.15)';
          modal.style.textAlign = 'center';
          
          modal.innerHTML = `
            <div style="font-size: 3.5rem; margin-bottom: 10px; line-height: 1;">✨</div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">Broadcast Sent</h2>
            <p style="font-size: 0.95rem; color: var(--text-muted);">Your message is now echoing across all active sessions.</p>
          `;
          
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
          if (window.MotionFX) window.MotionFX.popIn(modal);
          
          setTimeout(() => {
            if (window.MotionFX) {
              window.MotionFX.exit(modal, { scale: 0.9 }).then(() => overlay.remove());
            } else {
              overlay.remove();
            }
          }, 2500);

        } else {
          const err = await res.json();
          alert(err.error || 'Failed to send broadcast');
        }
      } catch (e) {
        showAlert('Network error', 'error');
      }
    });
  }

  async function fetchAdminUsers() {
    if (!adminUserList) return;
    adminUserList.innerHTML = '<div style="text-align:center; padding: 1rem;">Loading users...</div>';
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const users = await res.json();
        adminUserList.innerHTML = users.map(u => `
          <div class="admin-user-item">
            <div class="admin-user-info">
              <div class="avatar">${u.avatar || '👤'}</div>
              <div>
                <div style="font-weight: 600;">${u.username}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${u.email} | ID: ${u.id}</div>
              </div>
            </div>
            <button class="ban-btn" onclick="banUser(${u.id}, '${u.username}')">Ban User</button>
          </div>
        `).join('');
      } else {
        adminUserList.innerHTML = '<div style="color: #ef4444;">Failed to load users</div>';
      }
    } catch (e) {
      adminUserList.innerHTML = '<div style="color: #ef4444;">Network error</div>';
    }
  }

  window.banUser = async (userId, username) => {
    if (!confirm(`Are you absolutely sure you want to permanently BAN and DELETE ${username} (ID: ${userId})?`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showAlert(`${username} has been permanently banned.`, 'success');
        fetchAdminUsers();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to ban user', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

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
    if (window.innerWidth <= 768 && typeof closeSidebar === 'function') {
      closeSidebar();
    }
    aboutModal.style.display = '';
    aboutModal.classList.remove('hidden');
    const card = aboutModal.querySelector('.modal-card');
    if (card) MotionFX.popIn(card);
  };
  const closeAboutModal = () => { if (aboutModal) { aboutModal.style.display = 'none'; aboutModal.classList.add('hidden'); } };

  const openProfileModal = () => {
    if (profileModal) {
      if (window.innerWidth <= 768 && typeof closeSidebar === 'function') {
        closeSidebar();
      }
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

  const showDesktopNotification = async (senderName, messageText) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const title = senderName.startsWith('Global:') ? senderName : `New DM from @${senderName}`;
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body: messageText,
            icon: '/logo.png',
            vibrate: [200, 100, 200]
          });
        } catch(e) {
          new Notification(title, { body: messageText, icon: '/logo.png' });
        }
      } else {
        new Notification(title, { body: messageText, icon: '/logo.png' });
      }
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

  let channelContextMenuTarget = null;

  if (ctxCloseChatBtn) {
    ctxCloseChatBtn.addEventListener('click', () => {
      closeChannelContextMenu();
      
      let isActive = false;
      if (channelContextMenuTarget === 'global' && !activeRecipient && activeRecipient !== 'empty') isActive = true;
      else if (activeRecipient && activeRecipient !== 'empty' && activeRecipient.id && activeRecipient.id.toString() === channelContextMenuTarget) isActive = true;
      
      if (isActive) {
        switchChatTab('empty');
      } else {
        if (channelContextMenuTarget === 'global') {
          switchChatTab(null);
        } else {
          // Fetch the user from the sidebar list (actually allRegisteredUsers is empty initially, so just create an object from DOM or fetch it)
          // Wait, switchChatTab takes a user object: {id, username, avatar}
          // The best way to get it is finding it in allRegisteredUsers, but wait, allRegisteredUsers might not have them?
          // The DOM has the info! Or we can use the existing `switchChatTab` click logic!
          const targetEl = document.querySelector(`.online-user-item[data-user-id="${channelContextMenuTarget}"]`);
          if (targetEl) targetEl.click();
        }
      }
    });
  }

  const ctxTogglePushBtn = document.getElementById('ctxTogglePushBtn');
  if (ctxTogglePushBtn) {
    ctxTogglePushBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!channelContextMenuTarget) return;
      const targetId = channelContextMenuTarget;
      const isMuted = !myMutedChats.includes(targetId);
      
      const ctxTogglePushSwitch = document.getElementById('ctxTogglePushSwitch');
      const ctxTogglePushIcon = document.getElementById('ctxTogglePushIcon');
      
      // Optimistic update
      if (isMuted) {
        if (ctxTogglePushSwitch) ctxTogglePushSwitch.classList.remove('active');
        if (ctxTogglePushIcon) ctxTogglePushIcon.textContent = '🔕';
      } else {
        if (ctxTogglePushSwitch) ctxTogglePushSwitch.classList.add('active');
        if (ctxTogglePushIcon) ctxTogglePushIcon.textContent = '🔔';
      }
      
      setTimeout(() => {
        closeChannelContextMenu();
      }, 250);
      
      try {
        const res = await fetch('/api/users/mute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ targetId: targetId, isMuted })
        });
        if (res.ok) {
          const data = await res.json();
          myMutedChats = data.muted_chats;
        }
      } catch (err) {
        showAlert('Failed to update mute settings', 'error');
      }
    });
  }

  const handleChannelContextMenu = (e) => {
    e.preventDefault();
    
    // Determine the target ID based on the clicked element
    let targetId = 'global';
    let currentEl = e.currentTarget || (e.target && e.target.closest('[data-user-id]'));
    if (currentEl && currentEl.dataset && currentEl.dataset.userId) {
      targetId = currentEl.dataset.userId;
    }
    channelContextMenuTarget = targetId;
    
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
      
      // Update label for Close/Open Chat
      const ctxCloseChatLabel = ctxCloseChatBtn.querySelector('.context-label');
      let isActive = false;
      if (channelContextMenuTarget === 'global' && !activeRecipient && activeRecipient !== 'empty') isActive = true;
      else if (activeRecipient && activeRecipient !== 'empty' && activeRecipient.id && activeRecipient.id.toString() === channelContextMenuTarget) isActive = true;
      
      if (isActive) {
        ctxCloseChatLabel.textContent = 'Close Chat';
      } else {
        ctxCloseChatLabel.textContent = 'Open Chat';
      }

      const ctxTogglePushBtn = document.getElementById('ctxTogglePushBtn');
      const ctxTogglePushSwitch = document.getElementById('ctxTogglePushSwitch');
      const ctxTogglePushIcon = document.getElementById('ctxTogglePushIcon');
      
      if (window.matchMedia('(display-mode: standalone)').matches) {
        if (ctxTogglePushBtn) ctxTogglePushBtn.style.display = 'flex';
        if (myMutedChats && myMutedChats.includes(targetId)) {
          if (ctxTogglePushIcon) ctxTogglePushIcon.textContent = '🔕';
          if (ctxTogglePushSwitch) ctxTogglePushSwitch.classList.remove('active');
        } else {
          if (ctxTogglePushIcon) ctxTogglePushIcon.textContent = '🔔';
          if (ctxTogglePushSwitch) ctxTogglePushSwitch.classList.add('active');
        }
      } else {
        if (ctxTogglePushBtn) ctxTogglePushBtn.style.display = 'none';
      }
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
hideElement(typingBanner);

    document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
    globalChannelBtn.classList.remove('active');

    const chatWrapper = document.querySelector('.chat-wrapper');

    if (activeRecipient === 'empty') {
      chatWrapper.classList.add('empty-state');
      document.querySelector('.chat-footer').style.display = '';
      if (window.innerWidth <= 768) {
        openSidebar();
      }
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

    try {
      const muteRes = await fetch('/api/users/muted_chats', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (muteRes.ok) {
        const data = await muteRes.json();
        myMutedChats = data.muted_chats || [];
      }
    } catch(err) {}

    myAvatarEl.textContent = currentUser.avatar || '👤';
    myUsernameEl.textContent = currentUser.username;
    if (myBioEl) myBioEl.textContent = currentUser.bio || 'Online';

    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      if (currentUser.role === 'super_admin') {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }

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
    await loadAllUsers();
    await loadMessageHistory();
    connectWebSocket();
    subscribeToPushNotifications();
  };

  const loadAllUsers = async () => {
    try {
      const [usersRes, convRes] = await Promise.all([
        fetch('/api/users', { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch('/api/conversations', { headers: { 'Authorization': `Bearer ${authToken}` } })
      ]);
      
      if (usersRes.ok) {
        const data = await usersRes.json();
        allRegisteredUsers = data.users || [];
      }
      
      if (convRes.ok) {
        const convData = await convRes.json();
        chattedUserIds = new Set(convData.conversationUserIds || []);
      }
      
      updateOnlineUsers();
    } catch (err) {
      console.error('Failed to load users/conversations:', err);
    }
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
      lastRenderedDate = null;

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


  document.addEventListener('visibilitychange', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'visibility', status: document.hidden ? 'background' : 'foreground' }));
    }
  });

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
        } else if (data.type === 'global_announcement') {
          if (currentUser && currentUser.role === 'super_admin') {
            return; // The sender already gets a "System broadcast sent!" toast in the send function.
          }
          
          const overlay = document.createElement('div');
          overlay.style.position = 'fixed';
          overlay.style.top = '0'; overlay.style.left = '0';
          overlay.style.width = '100vw'; overlay.style.height = '100vh';
          overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          overlay.style.backdropFilter = 'blur(10px)';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.zIndex = '999999';
          
          const modal = document.createElement('div');
          modal.style.background = 'var(--panel-bg)';
          modal.style.padding = '40px';
          modal.style.borderRadius = '24px';
          modal.style.border = '1px solid var(--primary-accent)';
          modal.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 40px rgba(138, 43, 226, 0.2)';
          modal.style.maxWidth = '500px';
          modal.style.width = '90%';
          modal.style.textAlign = 'center';
          
          // Escape the message to prevent XSS
          const escapedMessage = data.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          
          modal.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 20px;">📢</div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 16px;">Admin Broadcast</h2>
            <p style="font-size: 1.1rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 30px;">${escapedMessage}</p>
            <button class="btn btn-primary" style="width: 100%; border-radius: 12px; font-weight: 700;">Acknowledge</button>
          `;
          
          const btn = modal.querySelector('button');
          btn.onclick = () => {
            if (window.MotionFX) {
              window.MotionFX.exit(modal, { scale: 0.9 }).then(() => overlay.remove());
            } else {
              overlay.remove();
            }
          };
          
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
          if (window.MotionFX) window.MotionFX.popIn(modal);
        } else if (data.type === 'new_message') {
          if (data.user_id && Number(data.user_id) !== Number(currentUser.id)) {
            if (!chattedUserIds.has(Number(data.user_id))) {
              chattedUserIds.add(Number(data.user_id));
              updateOnlineUsers();
            }
          }
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
            if (activeRecipient && ws && ws.readyState === WebSocket.OPEN && Number(data.user_id) !== Number(currentUser.id)) {
              ws.send(JSON.stringify({ type: 'mark_read', sender_id: activeRecipient.id }));
            }
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
            if (myMutedChats && !myMutedChats.includes(senderId.toString())) {
              unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
              updateUnreadBadgesUI();
              showDesktopNotification(data.username, data.content);
            }
          } else if (!data.recipient_id && !isCurrentTab) {
            if (myMutedChats && !myMutedChats.includes('global') && !myMutedChats.includes(data.user_id.toString())) {
              unreadCounts['global'] = (unreadCounts['global'] || 0) + 1;
              updateUnreadBadgesUI();
              showDesktopNotification(`Global: ${data.username}`, data.content);
            }
          }

          if (Number(data.user_id) !== Number(currentUser.id)) {
            let targetCheck = data.recipient_id ? data.user_id.toString() : 'global';
            if (myMutedChats && !myMutedChats.includes(targetCheck) && !myMutedChats.includes(data.user_id.toString())) {
              playSound('receive');
            }
          }
        } else if (data.type === 'msg_status_update') {
          if (data.status === 'read' || data.status === 'delivered') {
            document.querySelectorAll('.msg-status-icon').forEach(icon => {
              if (data.status === 'read') {
                icon.textContent = '✓✓';
                icon.classList.remove('sent', 'delivered');
                icon.classList.add('read');
              } else if (data.status === 'delivered' && !icon.classList.contains('read')) {
                icon.textContent = '✓✓';
                icon.classList.remove('sent');
                icon.classList.add('delivered');
              }
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
      setTimeout(() => { if (authToken) connectWebSocket();
    subscribeToPushNotifications(); }, 3000);
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

    const isMedia = msg.content && (msg.content.startsWith('[AUDIO]') || msg.content.startsWith('data:audio/') || msg.content.startsWith('[IMAGE]') || msg.content.startsWith('[FILE]'));

    const ownerElements = msgContextMenuCard ? msgContextMenuCard.querySelectorAll('.owner-only') : [];
    ownerElements.forEach(el => {
      if (el.id === 'ctxEditBtn') {
        el.style.display = (!isMedia && (isOutgoing || currentUser.role === 'super_admin')) ? 'flex' : 'none';
      } else {
        el.style.display = (isOutgoing || currentUser.role === 'super_admin') ? 'flex' : 'none';
      }
    });

    const ctxTranslateBtn = document.getElementById('ctxTranslateBtn');
    const ctxCopyBtn = document.getElementById('ctxCopyBtn');
    const ctxDownloadBtn = document.getElementById('ctxDownloadBtn');
    if (ctxTranslateBtn) ctxTranslateBtn.style.display = isMedia ? 'none' : 'flex';
    if (ctxCopyBtn) ctxCopyBtn.style.display = isMedia ? 'none' : 'flex';
    if (ctxDownloadBtn) ctxDownloadBtn.style.display = isMedia ? 'flex' : 'none';

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

  const ctxDownloadBtnGlobal = document.getElementById('ctxDownloadBtn');
  if (ctxDownloadBtnGlobal) {
    ctxDownloadBtnGlobal.addEventListener('click', async () => {
      if (!activeContextMsg) return;
      const { msg } = activeContextMsg;
      closeMessageContextMenu();
      
      let url = '';
      let extension = '';
      if (msg.content.startsWith('[AUDIO]')) {
        url = msg.content.substring(7);
        extension = 'webm';
      } else if (msg.content.startsWith('data:audio/')) {
        url = msg.content;
        extension = 'webm';
      } else if (msg.content.startsWith('[IMAGE]')) {
        url = msg.content.substring(7);
        extension = 'webp';
      } else if (msg.content.startsWith('[FILE]')) {
        const fileData = msg.content.substring(6);
        const splitIdx = fileData.indexOf('|');
        if (splitIdx !== -1) {
          url = fileData.substring(splitIdx + 1);
          extension = fileData.substring(0, splitIdx).split('.').pop() || 'file';
        } else {
          url = fileData;
          extension = 'file';
        }
      }
      
      if (!url) return;
      
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = SChat_Media_.;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Failed to download media', err);
        showAlert('Failed to download media file', 'error');
      }
    });
  }
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

    const msgDateObj = new Date(msg.created_at || Date.now());
    const msgDateStr = msgDateObj.toDateString();
    
    if (msgDateStr !== lastRenderedDate) {
      lastRenderedDate = msgDateStr;
      const dateDivider = document.createElement('div');
      dateDivider.className = 'date-divider';
      
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (msgDateStr === today) {
        dateDivider.textContent = 'Today';
      } else if (msgDateStr === yesterday) {
        dateDivider.textContent = 'Yesterday';
      } else {
        dateDivider.textContent = msgDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      messagesFeed.appendChild(dateDivider);
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
    let isAudio = false;
    let audioSrc = '';
    let isImage = false;
    let imageSrc = '';
    let isFile = false;
    let fileSrc = '';
    let fileName = '';
    
    if (msg.content) {
      if (msg.content.startsWith('data:audio/')) {
        isAudio = true;
        audioSrc = msg.content;
      } else if (msg.content.startsWith('[AUDIO]')) {
        isAudio = true;
        audioSrc = msg.content.substring(7); // Remove [AUDIO]
      } else if (msg.content.startsWith('[IMAGE]')) {
        isImage = true;
        imageSrc = msg.content.substring(7);
      } else if (msg.content.startsWith('[FILE]')) {
        isFile = true;
        const fileData = msg.content.substring(6);
        const splitIdx = fileData.indexOf('|');
        if (splitIdx !== -1) {
          fileName = fileData.substring(0, splitIdx);
          fileSrc = fileData.substring(splitIdx + 1);
        } else {
          fileSrc = fileData;
          fileName = 'Document';
        }
      }
    }

    if (isImage) {
      contentHtml = `<img src="${imageSrc}" class="msg-image" alt="Image attachment" loading="lazy">`;
    } else if (isFile) {
      contentHtml = `
        <div class="msg-file-card" onclick="window.open('${fileSrc}', '_blank')">
          <span class="msg-file-icon">📄</span>
          <div class="msg-file-details">
            <span class="msg-file-name">${escapeHtml(fileName)}</span>
            <span class="msg-file-size">Click to view/download</span>
          </div>
        </div>
      `;
    } else if (isAudio) {
      contentHtml = `
        <div class="audio-player-ui">
          <button class="play-pause-btn" aria-label="Play">▶</button>
          <div class="audio-progress-bar"><div class="audio-progress-fill"></div></div>
          <span class="audio-time">0:00</span>
          <audio src="${audioSrc}" style="display: none;" preload="metadata"></audio>
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
      } else {
      // Add motion.dev scroll animation for historical messages
      scroll(
        animate(msgCard, { opacity: [0, 1], scale: [0.85, 1], y: [20, 0] }),
        { target: msgCard, offset: ["start end", "end center"] }
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
    const searchTerm = filterInput ? filterInput.value : '';
    if (users && users.length > 0) {
      onlineUserIds = new Set(users.map(u => Number(u.id)));
    }
    
    MotionFX.tickNumber(onlineCountBadge, onlineUserIds.has(Number(currentUser.id)) ? onlineUserIds.size - 1 : onlineUserIds.size);
    onlineUsersList.innerHTML = '';
    
    const query = (searchTerm || '').toLowerCase().trim();

    let displayUsers = allRegisteredUsers.filter(u => {
      if (Number(u.id) === Number(currentUser.id)) return false;
      if (query) {
         return u.username.toLowerCase().includes(query);
      }
      return chattedUserIds.has(Number(u.id));
    });

    if (displayUsers.length === 0) {
      onlineUsersList.innerHTML = `<li class="online-user-item disabled"><span class="u-name">${query ? 'No users found' : 'No recent chats'}</span></li>`;
      return;
    }

    displayUsers.forEach(u => {
      const isOnline = onlineUserIds.has(Number(u.id));
      const li = document.createElement('li');
      li.className = `online-user-item ${activeRecipient && Number(activeRecipient.id) === Number(u.id) ? 'active' : ''}`;
      li.dataset.userId = u.id;

      const unreadCount = unreadCounts[u.id] || 0;
      const unreadBadgeHtml = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
      const statusIndicatorHtml = `<span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>`;

      li.innerHTML = `
        <div class="u-avatar-wrapper">
          <span class="u-avatar">${u.avatar || '👤'}</span>
          ${statusIndicatorHtml}
        </div>
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

  const recordingUi = document.getElementById('recordingUi');
  const cancelRecordBtn = document.getElementById('cancelRecordBtn');
  const sendRecordBtn = document.getElementById('sendRecordBtn');
  const recordingTimer = document.getElementById('recordingTimer');

  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;
  let isCancelled = false;
  let recordingStartTime = 0;
  let timerInterval;
  let audioContext;
  let analyser;
  let animationFrameId;

  const updateTimer = () => {
    if (!recordingStartTime) return;
    const elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    if (recordingTimer) recordingTimer.textContent = `${mins}:${secs}`;
  };

  const drawWaveform = () => {
    if (!isRecording || !analyser) return;
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate total actual width needed for bars
    // Using 16 bars for a clean look
    const numBars = 16;
    const barWidth = canvas.width / numBars; 
    let x = 0;
    
    for(let i = 0; i < numBars; i++) {
      // Scale frequency data to canvas height
      // dataArray values go from 0 to 255
      const value = dataArray[i * 2] || 0; 
      const percent = value / 255;
      const barHeight = Math.max(2, percent * canvas.height);
      
      canvasCtx.fillStyle = '#ff3b30';
      canvasCtx.beginPath();
      canvasCtx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight, 2);
      canvasCtx.fill();
      
      x += barWidth;
    }
    
    animationFrameId = requestAnimationFrame(drawWaveform);
  };

  const uploadToCloudinary = async (blob, resourceType = 'video') => {
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', 'schat_uploads');
    
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/tigv7xfy/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Cloudinary upload failed');
      const data = await response.json();
      return data.secure_url;
    } catch (err) {
      console.error('Upload Error:', err);
      return null;
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Extreme Storage Optimization
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
      } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a')) {
        options = { mimeType: 'audio/mp4;codecs=mp4a', audioBitsPerSecond: 16000 };
      }

      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];
      isCancelled = false;

      // Audio Visualizer Setup
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 64; // Gives us 32 bins
      }

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(timerInterval);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
        }
        
        // Restore UI
        if (messageForm && recordingUi) {
          recordingUi.style.display = 'none';
          messageForm.style.display = 'flex';
        }
        
        const duration = Date.now() - recordingStartTime;
        recordingStartTime = 0;
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());

        // Cancel or Empty Check
        if (isCancelled) return;
        if (duration < 1000) {
          showAlert('Recording too short to send.', 'warning');
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        showAlert('Uploading voice note...', 'info');
        
        const fileUrl = await uploadToCloudinary(audioBlob);
        
        if (!fileUrl) {
          showAlert('Failed to upload voice note. Please try again.', 'error');
          return;
        }

        const audioPayload = '[AUDIO]' + fileUrl;
        
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          showAlert('Connecting to server... Please try sending again in a moment.', 'error');
          return;
        }

        const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

        if (activeRecipient) {
      chattedUserIds.add(Number(activeRecipient.id));
      // Re-render in case they weren't in the list
      updateOnlineUsers();
    }
    ws.send(JSON.stringify({
      type: 'chat_message',
          recipient_id: activeRecipient ? activeRecipient.id : null,
          content: audioPayload,
          is_blurred: isPrivacyBlurActive ? 1 : 0,
          timer_seconds: timerSeconds,
          reply_to_id: activeReply ? activeReply.id : null,
          reply_to_user: activeReply ? activeReply.username : null,
          reply_to_text: activeReply ? activeReply.text : null
        }));

        setReplyState(null);
hideElement(typingBanner);
        playSound('send');
      };

      // Update UI
      if (messageForm && recordingUi) {
        messageForm.style.display = 'none';
        recordingUi.style.display = 'flex';
      }
      if (recordingTimer) recordingTimer.textContent = '00:00';
      
      mediaRecorder.start();
      isRecording = true;
      recordingStartTime = Date.now();
      timerInterval = setInterval(updateTimer, 1000);
      drawWaveform();
      
      if (navigator.vibrate) navigator.vibrate(50);
      
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      showAlert('Microphone access denied. Please allow microphone permissions.', 'error');
    }
  };

  const stopRecording = (discard = false) => {
    if (!isRecording || !mediaRecorder) return;
    isCancelled = discard;
    mediaRecorder.stop();
    isRecording = false;
  };

  if (micBtn) {
    micBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startRecording();
    });
  }

  if (cancelRecordBtn) {
    cancelRecordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      stopRecording(true);
    });
  }

  if (sendRecordBtn) {
    sendRecordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      stopRecording(false);
    });
  }


  // --- IMAGE UPLOAD & COMPRESSION ---
  const attachBtn = document.getElementById('attachBtn');
  const attachDropdown = document.getElementById('attachDropdown');
  const optImageUpload = document.getElementById('optImageUpload');
  const optDocUpload = document.getElementById('optDocUpload');
  const imageUploadInput = document.getElementById('imageUploadInput');
  const docUploadInput = document.getElementById('docUploadInput');
  
  if (attachBtn) {
    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (attachDropdown) attachDropdown.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
      if (attachDropdown && !attachBtn.contains(e.target) && !attachDropdown.classList.contains('hidden')) {
        attachDropdown.classList.add('hidden');
      }
    });
    
    if (optImageUpload && imageUploadInput) {
      optImageUpload.addEventListener('click', () => {
        attachDropdown.classList.add('hidden');
        imageUploadInput.click();
      });
    }
    
    if (optDocUpload && docUploadInput) {
      optDocUpload.addEventListener('click', () => {
        attachDropdown.classList.add('hidden');
        docUploadInput.click();
      });
    }


    docUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 10 * 1024 * 1024) {
        showAlert('Document exceeds 10MB limit. Please upload a smaller file.', 'error');
        docUploadInput.value = '';
        return;
      }
      
      attachBtn.classList.add('uploading-indicator');
      
      try {
        const fileUrl = await uploadToCloudinary(file, 'raw');
        if (fileUrl) {
          const filePayload = [FILE]|;
          ws.send(JSON.stringify({
            type: 'chat_message',
            content: filePayload,
            recipient_id: activeRecipient && activeRecipient !== 'empty' ? activeRecipient.id : null,
            reply_to_id: activeReply ? activeReply.id : null,
            reply_to_user: activeReply ? activeReply.username : null,
            reply_to_text: activeReply ? activeReply.text : null
          }));
          setReplyState(null);
          scrollToBottom();
        } else {
          showAlert('Failed to upload document', 'error');
        }
      } catch (err) {
        console.error('Document upload error:', err);
        showAlert('Error processing document', 'error');
      } finally {
        attachBtn.classList.remove('uploading-indicator');
        docUploadInput.value = '';
      }
    });

    imageUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showAlert('Please select a valid image file.', 'error');
        return;
      }
      
      attachBtn.classList.add('uploading-indicator');
      
      try {
        const compressedBlob = await compressImage(file);
        const fileUrl = await uploadToCloudinary(compressedBlob, 'image');
        if (fileUrl) {
          const imagePayload = '[IMAGE]' + fileUrl;
          ws.send(JSON.stringify({
            type: 'chat_message',
            content: imagePayload,
            recipient_id: activeRecipient && activeRecipient !== 'empty' ? activeRecipient.id : null,
            reply_to_id: activeReply ? activeReply.id : null,
            reply_to_user: activeReply ? activeReply.username : null,
            reply_to_text: activeReply ? activeReply.text : null
          }));
          setReplyState(null);
          scrollToBottom();
        } else {
          showAlert('Failed to upload image', 'error');
        }
      } catch (err) {
        console.error('Image compression error:', err);
        showAlert('Error processing image', 'error');
      } finally {
        attachBtn.classList.remove('uploading-indicator');
        imageUploadInput.value = '';
      }
    });
  }

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/webp', 0.8);
        };
        img.onerror = (error) => reject(error);
        img.src = event.target.result;
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showAlert('Connecting to server... Please try sending again in a moment.', 'error');
      connectWebSocket();
    subscribeToPushNotifications();
      return;
    }

    const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

    if (activeRecipient) {
      chattedUserIds.add(Number(activeRecipient.id));
      // Re-render in case they weren't in the list
      updateOnlineUsers();
    }
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
hideElement(typingBanner);
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

    if (!isSendingTyping) {
      isSendingTyping = true;
      ws.send(JSON.stringify({
        type: 'typing',
        recipient_id: activeRecipient ? activeRecipient.id : null,
        isTyping: true
      }));
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isSendingTyping = false;
      ws.send(JSON.stringify({
        type: 'typing',
        recipient_id: activeRecipient ? activeRecipient.id : null,
        isTyping: false
      }));
    }, 2000);
  });

  const handleTypingEvent = (data) => {
    // If we're in the global chat, show anyone's typing.
    // If we're in a 1-on-1, only show if it's from the person we're chatting with.
    let isRelevantTyping = false;
    
    if (activeRecipient && activeRecipient !== 'empty') {
      isRelevantTyping = (Number(data.user_id) === Number(activeRecipient.id));
    } else if (!activeRecipient) {
      // Global chat
      isRelevantTyping = (!data.recipient_id && Number(data.user_id) !== Number(currentUser.id));
    }

    if (!isRelevantTyping) return;

    if (data.isTyping) {
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
    updateOnlineUsers();
    const term = e.target.value.toLowerCase();
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


async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('DEBUG: Browser does not support Service Workers or PushManager');
    return;
  }

  try {
    console.error('DEBUG: Checking notification permission...');
    const permission = await Notification.requestPermission();
    console.error('DEBUG: Permission is: ' + permission);
    if (permission !== 'granted') {
      console.error('DEBUG: Notification permission is not granted! It is: ' + permission);
      return;
    }

    console.error('DEBUG: Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.error('DEBUG: SW Registered. Getting existing sub...');
    let existingSub = await registration.pushManager.getSubscription();
    console.error('DEBUG: Existing sub is: ' + (existingSub ? 'true' : 'false'));
    
    // Force refresh subscription once to ensure it matches the new VAPID keys
    if (existingSub && !localStorage.getItem('push_key_v3')) {
      await existingSub.unsubscribe();
      existingSub = null;
      localStorage.setItem('push_key_v3', 'true');
    }

    if (existingSub) {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('schat_token')}`
        },
        body: JSON.stringify(existingSub)
      });
      console.error('DEBUG: Updated existing sub on server. Server responded: ' + res.status);
      return; // Already subscribed
    }

    const PUBLIC_VAPID_KEY = 'BFM7IVc9SVb-cpG8ZrsOc8CaMCNSee-uAsdaEoaJrdjK-_VzOglSKANVq82DZVpwg2PrqNdmvVxiXIW9MWmVZFk';
    
    // Convert base64 url safe string to Uint8Array
    const padding = '='.repeat((4 - PUBLIC_VAPID_KEY.length % 4) % 4);
    const base64 = (PUBLIC_VAPID_KEY + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const applicationServerKey = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      applicationServerKey[i] = rawData.charCodeAt(i);
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('schat_token')}`
      },
      body: JSON.stringify(subscription)
    });

    console.error('DEBUG: Created NEW sub on server. Server responded: ' + res.status);
  } catch (err) {
    console.error('DEBUG: Failed to subscribe: ' + err.message);
  }
}
