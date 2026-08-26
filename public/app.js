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
  // Dismiss Startup Splash Screen with Smooth Cinematic Dissolve
  const dismissSplashScreen = () => {
    const splash = document.getElementById('appSplashScreen');
    if (!splash) return;
    setTimeout(() => {
      splash.classList.add('fade-out');
      setTimeout(() => {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 550);
    }, 750);
  };

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // ==========================================
  // UNIVERSAL FLOATING TOAST ENGINE
  // ==========================================
  function getToastContainer() {
    let container = document.getElementById('globalToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalToastContainer';
      document.body.appendChild(container);
    }
    return container;
  }

  function showAppToast(message, type = 'info') {
    if (!message) return;
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `global-toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';
    
    toast.innerHTML = `<span style="font-size: 1.1rem; line-height: 1;">${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leaving');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3200);
  }

  function showAlert(message, type = 'error') {
    showAppToast(message, type);
    if (typeof authAlert !== 'undefined' && authAlert) {
      authAlert.textContent = message;
      authAlert.className = `alert-banner ${type}`;
      authAlert.classList.remove('hidden');
      setTimeout(() => authAlert.classList.add('hidden'), 4000);
    }
  }
  window.showAlert = showAlert;
  window.showAppToast = showAppToast;

  // ==========================================
  // PROTECTED AVATARS & COMPRESSION HELPERS
  // ==========================================
  const isImageAvatar = (avatar) => {
    if (!avatar) return false;
    return typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:image/') || avatar.startsWith('/'));
  };

  const renderAvatarHTML = (avatar, username = '', extraClass = '', onClickAttr = '') => {
    const isImg = isImageAvatar(avatar);
    const escapedUser = escapeHtml(username || 'User');
    const clickHandler = onClickAttr ? `onclick="${onClickAttr}"` : '';
    
    if (isImg) {
      const safeUrl = escapeHtml(avatar);
      return `<div class="avatar-shield ${extraClass}" style="background-image: url('${safeUrl}');" aria-label="${escapedUser}'s avatar" ${clickHandler}></div>`;
    } else {
      const char = escapeHtml(avatar || '👤');
      return `<div class="avatar-shield avatar-shield-emoji ${extraClass}" aria-label="${escapedUser}'s avatar" ${clickHandler}>${char}</div>`;
    }
  };

  const compressAndProcessAvatar = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const TARGET_SIZE = 256;
          canvas.width = TARGET_SIZE;
          canvas.height = TARGET_SIZE;
          const ctx = canvas.getContext('2d');

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, TARGET_SIZE, TARGET_SIZE);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              canvas.toBlob((jpgBlob) => resolve(jpgBlob), 'image/jpeg', 0.84);
            }
          }, 'image/webp', 0.84);
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  };

  async function uploadToCloudinary(blob, resourceType = 'video') {
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
  }

  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = JSON.parse(localStorage.getItem('schat_user')) || null;
  let currentTheme = localStorage.getItem('schat_theme') || 'dark';
  let myMutedChats = [];
  let activeRecipient = 'empty'; // 'empty' = Privacy Standby Screen, null = Global Channel, { id, username, avatar } = Direct Message // 'empty' = Welcome Screen, null = Global Channel, { id, username, avatar } = Direct Message
  let activeReply = null; // null or { id, username, text }
  let unreadCounts = {};
  let totalUnreadDM = 0;
  let isPrivacyBlurActive = false;
  const outboundMessageQueue = [];

  const flushOutboundQueue = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || outboundMessageQueue.length === 0) return;
    while (outboundMessageQueue.length > 0) {
      const item = outboundMessageQueue.shift();
      try {
        ws.send(JSON.stringify(item));
      } catch (e) {
        console.error('Failed to dispatch queued message:', e);
      }
    }
  };
  let deferredPrompt = null;
  let ws = null;
  let pingInterval = null;
  let selectedAvatar = '/avatars/cosmic-astronaut.svg';
  let soundEnabled = true;
  let typingTimeout = null;
  let isSendingTyping = false;
  let allRegisteredUsers = [];
  // Active Sessions & Privacy Contacts State
  let acceptedContacts = [];
  let incomingContactRequests = [];
  let outgoingContactRequests = [];

  let onlineUserIds = new Set();
  let chattedUserIds = new Set();
  let lastRenderedDate = null;

  document.documentElement.setAttribute('data-theme', currentTheme);

  init3DMotionBackground();
  MotionFX.boot();

  // Register PWA Service Worker (Safe non-looping registration)
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
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
      if (!currentUser || currentUser.role !== 'super_admin') {
        adminModal.style.display = 'none';
        adminModal.classList.add('hidden');
        return;
      }
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

  let currentAdminFilter = 'all';
  let loadedAdminUsers = [];

  function setupAdminFilterButtons() {
    document.querySelectorAll('[data-admin-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-admin-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAdminFilter = btn.dataset.adminFilter;
        renderAdminUsersList();
      });
    });
  }

  function renderAdminUsersList() {
    if (!adminUserList) return;
    
    const countAll = loadedAdminUsers.length;
    const countSuspended = loadedAdminUsers.filter(u => Number(u.is_banned) === 1 || u.is_banned === true || u.is_banned === '1').length;
    const countActive = countAll - countSuspended;

    const elAll = document.getElementById('countAll');
    const elActive = document.getElementById('countActive');
    const elSuspended = document.getElementById('countSuspended');
    if (elAll) elAll.textContent = countAll;
    if (elActive) elActive.textContent = countActive;
    if (elSuspended) elSuspended.textContent = countSuspended;

    let filtered = loadedAdminUsers;
    if (currentAdminFilter === 'active') {
      filtered = loadedAdminUsers.filter(u => !(Number(u.is_banned) === 1 || u.is_banned === true || u.is_banned === '1'));
    } else if (currentAdminFilter === 'suspended') {
      filtered = loadedAdminUsers.filter(u => Number(u.is_banned) === 1 || u.is_banned === true || u.is_banned === '1');
    }

    if (filtered.length === 0) {
      adminUserList.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No ${currentAdminFilter === 'all' ? '' : currentAdminFilter} users found.</div>`;
      return;
    }

    adminUserList.innerHTML = filtered.map(u => {
      const isBanned = Boolean(Number(u.is_banned) === 1 || u.is_banned === true || u.is_banned === '1');
      const isSuperAdmin = (u.username || '').toLowerCase() === 'admin';

      const statusBadge = isBanned 
        ? '<span class="admin-status-badge banned">Suspended</span>' 
        : '<span class="admin-status-badge active">Active</span>';
      
      let actionBtn = '';
      if (isSuperAdmin) {
        actionBtn = '<span style="font-size: 0.75rem; color: var(--primary-accent); font-weight: 700;">Super Admin</span>';
      } else if (isBanned) {
        actionBtn = `<button type="button" class="unban-btn" onclick="unbanUser(${u.id}, '${escapeHtml(u.username)}')">Unban User</button>`;
      } else {
        actionBtn = `<button type="button" class="ban-btn" onclick="banUser(${u.id}, '${escapeHtml(u.username)}')">Ban User</button>`;
      }

      return `
        <div class="admin-user-item ${isBanned ? 'is-banned-card' : ''}">
          <div class="admin-user-info">
            <div class="avatar">${renderAvatarHTML(u.avatar, u.username, "", `openAvatarLightboxById(${u.id})`)}</div>
            <div>
              <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                ${escapeHtml(u.username)}
                ${statusBadge}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(u.email || '')} | ID: ${u.id}</div>
            </div>
          </div>
          <div class="admin-user-actions">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  }

  async function fetchAdminUsers() {
    if (!adminUserList) return;
    adminUserList.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Loading users...</div>';
    try {
      setupAdminFilterButtons();
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        loadedAdminUsers = await res.json() || [];
        renderAdminUsersList();
      } else {
        adminUserList.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 1rem;">Failed to load users</div>';
      }
    } catch (e) {
      adminUserList.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 1rem;">Network error</div>';
    }
  }

  window.banUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to SUSPEND and BAN @${username} (ID: ${userId})? They will be immediately disconnected and prevented from logging in.`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showAlert(`@${username} has been suspended.`, 'success');
        // Update local object immediately for instant response
        const target = loadedAdminUsers.find(u => Number(u.id) === Number(userId));
        if (target) target.is_banned = 1;
        renderAdminUsersList();
        fetchAdminUsers();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to ban user', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  window.unbanUser = async (userId, username) => {
    if (!confirm(`Do you want to UNBAN and restore access for @${username} (ID: ${userId})?`)) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showAlert(`@${username} access has been restored.`, 'success');
        // Update local object immediately for instant response
        const target = loadedAdminUsers.find(u => Number(u.id) === Number(userId));
        if (target) target.is_banned = 0;
        renderAdminUsersList();
        fetchAdminUsers();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to unban user', 'error');
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
  const headerRemoveContactBtn = document.getElementById('headerRemoveContactBtn');

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
  const dropdownSessionsBtn = document.getElementById('dropdownSessionsBtn');

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

  const closeChatBtn = document.getElementById('closeChatBtn');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
      if (typeof switchChatTab === 'function') {
        switchChatTab('empty');
      }
    });
  }

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

  
  // ==========================================
  // PROFILE SETTINGS TAB CONTROLLER
  // ==========================================
  const profileTabBtns = document.querySelectorAll('.settings-tab-btn');
  const profileTabPanels = {
    general: document.getElementById('tabGeneralPanel'),
    security: document.getElementById('tabSecurityPanel'),
    sessions: document.getElementById('tabSessionsPanel')
  };

  profileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      profileTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      Object.keys(profileTabPanels).forEach(key => {
        if (profileTabPanels[key]) {
          if (key === targetTab) {
            profileTabPanels[key].classList.add('active');
            if (key === 'sessions' && typeof fetchUserSessions === 'function') {
              fetchUserSessions();
            }
          } else {
            profileTabPanels[key].classList.remove('active');
          }
        }
      });
    });
  });

  // Staged avatar for profile editing (only saved on 'Save Changes' submit)
  let stagedAvatar = null;

  const openProfileModal = () => {
    if (profileModal) {
      if (window.innerWidth <= 768 && typeof closeSidebar === 'function') {
        closeSidebar();
      }
      
      stagedAvatar = currentUser?.avatar || '/avatars/cosmic-astronaut.svg';

      if (profileBioInput && currentUser) profileBioInput.value = currentUser.bio || '';
      const profileHeroUsername = document.getElementById('profileHeroUsername');
      const profileHeroEmail = document.getElementById('profileHeroEmail');
      const profileAvatarPreview = document.getElementById('profileAvatarPreview');
      
      if (currentUser) {
        if (profileHeroUsername) profileHeroUsername.textContent = `@${currentUser.username}`;
        if (profileHeroEmail) profileHeroEmail.textContent = currentUser.email || '';
        if (profileAvatarPreview) profileAvatarPreview.innerHTML = renderAvatarHTML(stagedAvatar, currentUser.username, 'no-hover');
      }

      // Highlight active preset avatar card ONLY IF staged avatar matches
      document.querySelectorAll('.preset-avatar-card').forEach(card => {
        if (card.dataset.avatarUrl && card.dataset.avatarUrl === stagedAvatar) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });

      const pwdAlertEl = document.getElementById('pwdAlert');
      const changeCurrPwdEl = document.getElementById('changeCurrentPwd');
      const changeNewPwdEl = document.getElementById('changeNewPwd');
      if (pwdAlertEl) pwdAlertEl.classList.add('hidden');
      if (changeCurrPwdEl) changeCurrPwdEl.value = '';
      if (changeNewPwdEl) changeNewPwdEl.value = '';
      
      // Default to General tab
      const firstTab = document.querySelector('.settings-tab-btn[data-tab="general"]');
      if (firstTab) firstTab.click();

      profileModal.style.display = 'flex';
      profileModal.classList.remove('hidden');
    }
  };
  const closeProfileModal = () => { if (profileModal) { profileModal.style.display = 'none'; profileModal.classList.add('hidden'); } };
  window.openProfileModal = openProfileModal;
  window.closeProfileModal = closeProfileModal;

  if (myProfileCard) myProfileCard.addEventListener('click', (e) => {
    if (e.target.closest('#logoutBtn')) return;
    if (e.target.closest('#myAvatar')) {
      e.stopPropagation();
      window.openAvatarLightbox(currentUser);
      return;
    }
    openProfileModal();
  });
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);

  // Save Profile Changes (Commits staged avatar and bio to server & database)
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newBio = profileBioInput ? profileBioInput.value.trim() : (currentUser?.bio || '');
      const finalAvatar = stagedAvatar || currentUser?.avatar || '/avatars/cosmic-astronaut.svg';

      try {
        const res = await fetch('/api/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ bio: newBio, avatar: finalAvatar })
        });

        if (res.ok) {
          currentUser.bio = newBio;
          currentUser.avatar = finalAvatar;
          localStorage.setItem('schat_user', JSON.stringify(currentUser));
          
          if (myBioEl) myBioEl.textContent = newBio;
          const myAvatar = document.getElementById('myAvatar');
          if (myAvatar) myAvatar.innerHTML = renderAvatarHTML(finalAvatar, currentUser.username, 'no-hover');

          closeProfileModal();
          showAppToast('Changes saved successfully!', 'success');

          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'profile_update', avatar: finalAvatar, bio: newBio }));
          }
        } else {
          const err = await res.json();
          showAlert(err.error || 'Failed to save changes.', 'error');
        }
      } catch (err) {
        console.error('Save profile error:', err);
        showAlert('Error saving profile changes.', 'error');
      }
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
  if (dropdownSessionsBtn) {
    dropdownSessionsBtn.addEventListener('click', () => {
      closeOptionsDropdown();
      if (sessionsModal) {
        showElement(sessionsModal);
        fetchUserSessions();
      }
    });
  }

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
    const iconSvg = currentTheme === 'dark' 
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const label = currentTheme === 'dark' ? 'Dark' : 'Light';
    if (themeModeBtn) themeModeBtn.innerHTML = iconSvg;
    if (headerThemeBtn) headerThemeBtn.innerHTML = iconSvg;
    if (dropdownThemeIcon) dropdownThemeIcon.innerHTML = iconSvg;
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

  if (avatarPicker) {
    avatarPicker.addEventListener('click', (e) => {
      const opt = e.target.closest('.avatar-opt');
      if (!opt) return;
      avatarPicker.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('selected'));
      opt.classList.add('selected');
      selectedAvatar = opt.dataset.avatar;
      MotionFX.press(opt);
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggleBtn.innerHTML = soundEnabled 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
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

  const performLogout = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ endpoint: sub.endpoint })
          }).catch(() => {});
          await sub.unsubscribe();
        }
      }
    } catch(e) {}
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
    closeSidebar();
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

  
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Welcome back';
  };

  const switchChatTab = (recipient) => {
    activeRecipient = recipient;
    setReplyState(null);
    hideElement(typingBanner);
    closeSidebar();

    document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
    globalChannelBtn.classList.remove('active');

    const chatWrapper = document.querySelector('.chat-wrapper');

    const closeChatBtn = document.getElementById('closeChatBtn');
    if (closeChatBtn) closeChatBtn.style.display = activeRecipient === 'empty' ? 'none' : '';

    if (activeRecipient === 'empty') {
      chatWrapper.classList.add('empty-state');
      const welcomeGreeting = document.getElementById('welcomeGreeting');
      if (welcomeGreeting && typeof currentUser !== 'undefined' && currentUser) {
        const greeting = getTimeGreeting();
        welcomeGreeting.innerHTML = `${greeting}, <span style="opacity: 0.9; font-weight: 600;">${currentUser.username}</span>.`;
      }
      return;
    }

    chatWrapper.classList.remove('empty-state');
    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) chatFooter.style.display = '';

    const attachBtnGlobal = document.getElementById('attachBtn');
    const micBtnGlobal = document.getElementById('micBtn');

    if (!activeRecipient) {
      if (attachBtnGlobal) attachBtnGlobal.style.display = 'none';
      if (micBtnGlobal) micBtnGlobal.style.display = 'none';
      if (headerRemoveContactBtn) headerRemoveContactBtn.style.display = 'none';
      globalChannelBtn.classList.add('active');
      roomAvatar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
      roomTitle.textContent = 'Global Channel';
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Realtime Active';
// Global welcome header rendered by loadMessageHistory
    } else {
      if (attachBtnGlobal) attachBtnGlobal.style.display = 'flex';
      if (micBtnGlobal) micBtnGlobal.style.display = 'flex';
      if (headerRemoveContactBtn) headerRemoveContactBtn.style.display = 'flex';
      if (unreadCounts[activeRecipient.id]) {
        unreadCounts[activeRecipient.id] = 0;
      }
      updateUnreadBadgesUI();

      const userEl = document.querySelector(`.online-user-item[data-user-id="${activeRecipient.id}"]`);
      if (userEl) userEl.classList.add('active');

      roomAvatar.innerHTML = renderAvatarHTML(activeRecipient.avatar, activeRecipient.username, 'no-hover');
      roomAvatar.onclick = () => window.openAvatarLightbox(activeRecipient);
      roomAvatar.style.cursor = 'pointer';
      roomTitle.textContent = `DM with @${activeRecipient.username}`;
      roomSubtitle.innerHTML = '<span class="pulse-dot"></span> Private Direct Message';
// DM welcome header rendered by loadMessageHistory

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
      document.title = `(${totalUnreadDM}) New DM — SChat™`;
    } else {
      document.title = 'SChat™ — Real-Time Messaging Platform';
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

    // Immediate fail-safe data dispatch
    loadAllUsers();
    loadMessageHistory();
    connectWebSocket();

    try {
      myAvatarEl.innerHTML = renderAvatarHTML(currentUser.avatar, currentUser.username, 'no-hover');
      myAvatarEl.onclick = () => window.openAvatarLightbox(currentUser);
      const profileAvatarPreview = document.getElementById('profileAvatarPreview');
      const profileAvatarResetBtn = document.getElementById('profileAvatarResetBtn');
      if (profileAvatarPreview) {
        profileAvatarPreview.innerHTML = renderAvatarHTML(currentUser.avatar, currentUser.username, 'no-hover');
        if (profileAvatarResetBtn) {
          if (isImageAvatar(currentUser.avatar)) {
            profileAvatarResetBtn.classList.remove('hidden');
          } else {
            profileAvatarResetBtn.classList.add('hidden');
          }
        }
      }
      myUsernameEl.textContent = currentUser.username;
      if (myBioEl) myBioEl.textContent = currentUser.bio || 'Online';
    } catch(e) { console.error('Avatar init error:', e); }

    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
      if (currentUser && currentUser.role === 'super_admin') {
        adminBtn.classList.remove('hidden');
        adminBtn.style.display = 'inline-flex';
      } else {
        adminBtn.classList.add('hidden');
        adminBtn.style.display = 'none';
      }
    }

    

  
  // ================= INTERACTIVE POINTER SPOTLIGHT (STANDBY) =================
  const pointerHalo = document.getElementById('pointerHalo');
  const chatMain = document.querySelector('.chat-main');

  if (pointerHalo && chatMain) {
    let haloTimeout = null;
    const updateHalo = (clientX, clientY) => {
      const rect = chatMain.getBoundingClientRect();
      const x = clientX - rect.left - 300;
      const y = clientY - rect.top - 300;
      pointerHalo.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      pointerHalo.classList.add('active');

      clearTimeout(haloTimeout);
      haloTimeout = setTimeout(() => {
        pointerHalo.classList.remove('active');
      }, 1000);
    };

    chatMain.addEventListener('mousemove', (e) => {
      if (activeRecipient === 'empty') {
        updateHalo(e.clientX, e.clientY);
      }
    }, { passive: true });

    chatMain.addEventListener('touchmove', (e) => {
      if (activeRecipient === 'empty' && e.touches && e.touches[0]) {
        updateHalo(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    chatMain.addEventListener('mouseleave', () => {
      pointerHalo.classList.remove('active');
    });
  }

const enterChat = () => {
      authView.classList.add('hidden');
      authView.style.opacity = '';
      authView.style.filter = '';
      authView.style.transform = '';
      chatView.classList.remove('hidden');

      if (activeRecipient === 'empty') {
        document.querySelector('.chat-wrapper').classList.add('empty-state');
        if (globalChannelBtn) globalChannelBtn.classList.remove('active');
        document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
        const welcomeGreeting = document.getElementById('welcomeGreeting');
        if (welcomeGreeting && typeof currentUser !== 'undefined' && currentUser) {
          const greeting = getTimeGreeting();
          welcomeGreeting.innerHTML = `${greeting}, <span style="opacity: 0.9; font-weight: 600;">${currentUser.username}</span>.`;
        }
      } else {
        const chatWrapper = document.querySelector('.chat-wrapper');
        if (chatWrapper) chatWrapper.classList.remove('empty-state');
        if (globalChannelBtn) globalChannelBtn.classList.add('active');
      }

      try {
        MotionFX.enter(chatView, { y: 16, bounce: 0.08 });
        MotionFX.staggerIn(chatView.querySelectorAll('.chat-sidebar > *, .chat-header, .welcome-banner, .chat-footer'), { y: 10, step: 0.03 });
      } catch(e) {}
    };
    enterChat();

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
      
      await fetchUserContacts();
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
      const introIcon = activeRecipient
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';

      messagesFeed.innerHTML = `
        <div class="chat-intro-watermark">
          <div class="intro-icon-ring">${introIcon}</div>
          <h3 id="welcomeTitle" class="intro-title">${activeRecipient ? activeRecipient.username : 'Global Channel'}</h3>
          <p id="welcomeSubtitle" class="intro-subtitle">${activeRecipient ? 'Direct end-to-end conversation channel.' : 'Public broadcast channel. Real-time across all devices.'}</p>
        </div>
      `;
      lastRenderedDate = null;

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg) => renderMessage(msg, { animateEnter: false }));
        scrollToBottom();

        if (activeRecipient && ws && ws.readyState === WebSocket.OPEN) {
          // Explicitly ACK all received messages as read
          ws.send(JSON.stringify({
            type: 'client_ack_read',
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

  let wsReconnectTimer = null;

  const connectWebSocket = () => {
    if (!authToken) return;
    
    // Single-instance connection guard: never recreate if already open or connecting
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?token=${encodeURIComponent(authToken)}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch(e) {
      console.error('WebSocket instantiation error:', e);
      return;
    }

    ws.onopen = () => {
      console.log('⚡ Connected to SChat WebSocket Server');
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
      
      flushOutboundQueue();

      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);

      if (activeRecipient) {
        ws.send(JSON.stringify({
          type: 'client_ack_read',
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
          // Instantly ACK delivery if this message is for me (prevents Sender from needing refresh)
          if (data.recipient_id && Number(data.recipient_id) === Number(currentUser.id) && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'client_ack_delivered', message_ids: [data.id || data.messageId] }));
          }

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
            const rawIds = Array.isArray(data.message_ids) ? data.message_ids : (data.messageId ? [data.messageId] : []);
            
            if (rawIds.length > 0) {
              rawIds.forEach(id => {
                const card = document.querySelector(`.message-card[data-msg-id="${id}"]`);
                if (card && card.classList.contains('outgoing')) {
                  const icon = card.querySelector('.msg-status-icon');
                  if (icon) {
                    if (data.status === 'read') {
                      icon.textContent = '●';
                      icon.classList.remove('sent', 'delivered');
                      icon.classList.add('read');
                    } else if (data.status === 'delivered' && !icon.classList.contains('read')) {
                      icon.textContent = '◑';
                      icon.classList.remove('sent');
                      icon.classList.add('delivered');
                    }
                  }
                }
              });
            } else if (data.sender_id && data.status === 'read') {
              // Mark all outgoing messages in currently open DM as read
              document.querySelectorAll('.message-card.outgoing').forEach(card => {
                const icon = card.querySelector('.msg-status-icon');
                if (icon) {
                  icon.textContent = '●';
                  icon.classList.remove('sent', 'delivered');
                  icon.classList.add('read');
                }
              });
            } else if (data.recipient_id && data.status === 'delivered') {
              // Bulk update for offline users reconnecting
              document.querySelectorAll('.message-card.outgoing').forEach(card => {
                if (card.dataset.recipientId == data.recipient_id) {
                  const icon = card.querySelector('.msg-status-icon');
                  if (icon && !icon.classList.contains('read')) {
                    icon.textContent = '◑';
                    icon.classList.remove('sent');
                    icon.classList.add('delivered');
                  }
                }
              });
            }
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
        } else if (data.type === 'user_banned') {
          if (currentUser && Number(data.userId) === Number(currentUser.id)) {
            performLogout();
            showAlert('Your account has been suspended by administrator.', 'error');
          }
        } else if (data.type === 'session_revoked') {
          if (currentUser && Number(data.userId) === Number(currentUser.id) && currentUser.sessionId === data.sessionId) {
            performLogout();
            showAlert('This session was terminated from another device.', 'error');
          }
        } else if (data.type === 'all_other_sessions_terminated') {
          if (currentUser && Number(data.userId) === Number(currentUser.id) && currentUser.sessionId !== data.keepSessionId) {
            performLogout();
            showAlert('All other active sessions were logged out.', 'info');
          }
        } else if (data.type === 'contact_request_received') {
          if (currentUser && Number(data.toUserId) === Number(currentUser.id)) {
            playSound('incoming');
            showAlert(`New chat request from @${data.requester.username}!`, 'info');
            fetchUserContacts();
            if (typeof window.triggerRenderSearchResults === 'function') window.triggerRenderSearchResults();
          }
        } else if (data.type === 'contact_request_accepted') {
          if (currentUser && (Number(data.user1) === Number(currentUser.id) || Number(data.user2) === Number(currentUser.id))) {
            playSound('join');
            showAlert('Chat request accepted! Contact added to your messages.', 'success');
            fetchUserContacts();
          }
        } else if (data.type === 'contact_removed') {
          if (currentUser && (Number(data.user1) === Number(currentUser.id) || Number(data.user2) === Number(currentUser.id))) {
            fetchUserContacts();
          }
        } else if (data.type === 'contact_request_cancelled') {
          if (currentUser && Number(data.recipient_id) === Number(currentUser.id)) {
            fetchUserContacts();
            if (pendingRequestsModal && pendingRequestsModal.style.display !== 'none') {
              renderPendingRequests();
            }
          }
        } else if (data.type === 'contact_request_declined') {
          if (currentUser && Number(data.requester_id) === Number(currentUser.id)) {
            showAlert('Your chat request was declined.', 'info');
            outgoingContactRequests = outgoingContactRequests.filter(r => Number(r.id) !== Number(data.recipient_id));
            fetchUserContacts();
            renderContactSearchResults();
          }
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (!wsReconnectTimer && authToken) {
        wsReconnectTimer = setTimeout(() => {
          wsReconnectTimer = null;
          connectWebSocket();
        }, 3000);
      }
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
        showAlert('Message text copied to clipboard!', 'success');
      }
      closeMessageContextMenu();
    });
  }

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
        if (url.includes('cloudinary.com')) {
          const parts = url.split('/upload/');
          if (parts.length === 2) {
            url = parts[0] + '/upload/fl_attachment/' + parts[1];
          }
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = "SChat_Media_" + Date.now() + "." + extension;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('Failed to download media', err);
        showAlert('Failed to download media file', 'error');
      }
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
    msgCard.dataset.recipientId = msg.recipient_id || '';
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
      let haloSymbol = '○';
      if (status === 'delivered') haloSymbol = '◑';
      else if (status === 'read') haloSymbol = '●';
      const isReadClass = status === 'read' ? 'read' : (status === 'delivered' ? 'delivered' : 'sent');
      statusIconHtml = `<span class="msg-status-icon ${isReadClass}" title="${status.toUpperCase()}">${haloSymbol}</span>`;
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
      let blurUrl = imageSrc;
      let highResUrl = imageSrc;
      const uploadIdx = imageSrc.indexOf('/upload/');
      if (uploadIdx !== -1) {
        blurUrl = imageSrc.substring(0, uploadIdx + 8) + 'w_20,e_blur:200,f_auto,q_10/' + imageSrc.substring(uploadIdx + 8);
        highResUrl = imageSrc.substring(0, uploadIdx + 8) + 'w_1280,f_auto,q_auto/' + imageSrc.substring(uploadIdx + 8);
      }
      contentHtml = `<div class="image-wrapper blur-placeholder-container" style="background-image: url('${blurUrl}'); background-size: cover; border-radius: 12px; overflow: hidden; min-height: 150px; min-width: 150px;">
                       <img src="${highResUrl}" class="msg-image fade-in-image" style="cursor: zoom-in; opacity: 0; transition: opacity 0.3s ease; width: 100%; height: auto; display: block;" alt="Image attachment" loading="lazy" onclick="openLightbox('${highResUrl}')" onload="this.style.opacity='1'" onerror="this.parentElement.style.backgroundImage='none'; this.parentElement.innerHTML='<div style=\\'padding: 30px 20px; text-align: center; color: var(--text-muted); background: var(--bg-hover);\\'>📸 Media Archived<br><small style=\\'font-size: 0.8em; opacity: 0.7;\\'>Cache Expired</small></div>'">
                     </div>`;
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
      <div class="msg-avatar">${renderAvatarHTML(msg.avatar, msg.username, "no-hover")}</div>
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
    }, { passive: true });

    msgCard.addEventListener('touchmove', () => {
      if (longPressTimer) clearTimeout(longPressTimer);
    }, { passive: true });

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

    let displayUsers = acceptedContacts.filter(u => {
      if (Number(u.id) === Number(currentUser.id)) return false;
      if (query) {
         return u.username.toLowerCase().includes(query);
      }
      return true;
    });

    if (displayUsers.length === 0) {
      if (query) {
        onlineUsersList.innerHTML = `<li class="online-user-item disabled"><span class="u-name">No contacts found</span></li>`;
      } else {
        onlineUsersList.innerHTML = `
          <li class="online-user-item empty-contacts-prompt" style="cursor: pointer; justify-content: center; text-align: center; padding: 14px 10px;" onclick="document.getElementById('addContactBtn')?.click()">
            <div style="font-size: 0.78rem; color: var(--primary-accent); font-weight: 600;">+ Find & Add Contacts</div>
          </li>
        `;
      }
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
          ${renderAvatarHTML(u.avatar, u.username, "u-avatar", `openAvatarLightboxById(${u.id})`)}
          ${statusIndicatorHtml}
        </div>
        <span class="u-name">${escapeHtml(u.username)}</span>
        ${unreadBadgeHtml}
      `;

      li.addEventListener('click', () => {
        closeSidebar();
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

  
  // ==========================================
  // ACTIVE SESSIONS & DEVICE MANAGEMENT LOGIC
  // ==========================================
  const sessionsModal = document.getElementById('sessionsModal');
  const openSessionsModalBtn = document.getElementById('openSessionsModalBtn');
  const closeSessionsModal = document.getElementById('closeSessionsModal');
  const sessionsList = document.getElementById('sessionsList');
  const revokeAllOtherSessionsBtn = document.getElementById('revokeAllOtherSessionsBtn');

  
  const headerSessionsBtn = document.getElementById('headerSessionsBtn');
  if (headerSessionsBtn) {
    headerSessionsBtn.addEventListener('click', () => {
      if (sessionsModal) {
        showElement(sessionsModal);
        fetchUserSessions();
      }
    });
  }

  if (openSessionsModalBtn) {
    openSessionsModalBtn.addEventListener('click', () => {
      if (profileModal) hideElement(profileModal);
      if (sessionsModal) {
        showElement(sessionsModal);
        fetchUserSessions();
      }
    });
  }

  
  let cameFromProfileSettings = false;
  const openSessionsFromProfileBtn = document.getElementById('openSessionsFromProfileBtn');
  const backToProfileSettingsBtn = document.getElementById('backToProfileSettingsBtn');

  if (openSessionsFromProfileBtn && sessionsModal) {
    openSessionsFromProfileBtn.addEventListener('click', () => {
      cameFromProfileSettings = true;
      if (profileModal) hideElement(profileModal);
      if (backToProfileSettingsBtn) {
        backToProfileSettingsBtn.style.display = 'inline-block';
        backToProfileSettingsBtn.classList.remove('hidden');
      }
      showElement(sessionsModal);
      fetchUserSessions();
    });
  }

  if (backToProfileSettingsBtn && sessionsModal && profileModal) {
    backToProfileSettingsBtn.addEventListener('click', () => {
      hideElement(sessionsModal);
      showElement(profileModal);
    });
  }

  if (closeSessionsModal && sessionsModal) {
    closeSessionsModal.addEventListener('click', () => hideElement(sessionsModal));
  }

  async function fetchUserSessions() {
    if (!sessionsList) return;
    sessionsList.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Loading active sessions...</div>';
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const sessions = data.sessions || [];
        if (sessions.length === 0) {
          sessionsList.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">No active sessions found.</div>';
          return;
        }
        sessionsList.innerHTML = sessions.map(s => {
          const isCurrent = Boolean(s.is_current);
          const icon = s.device.includes('Mobile') || s.device.includes('Android') || s.device.includes('iOS') ? '📱' : '💻';
          const lastActiveDate = new Date(s.last_active || s.created_at).toLocaleString([], {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });

          const actionBtn = isCurrent
            ? '<span class="current-badge">This Device</span>'
            : `<button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; cursor: pointer;" onclick="revokeSession('${s.session_id}')">Revoke</button>`;

          return `
            <div class="session-card ${isCurrent ? 'is-current-session' : ''}">
              <div style="display: flex; align-items: center;">
                <div class="session-icon">${icon}</div>
                <div class="session-details">
                  <div class="session-title">
                    ${escapeHtml(s.device)}
                    <span style="font-size: 0.78rem; font-weight: 500; opacity: 0.85;">— ${escapeHtml(s.browser)}</span>
                  </div>
                  <div class="session-meta">
                    IP: ${escapeHtml(s.ip_address)} • Last active: ${lastActiveDate}
                  </div>
                </div>
              </div>
              <div>
                ${actionBtn}
              </div>
            </div>
          `;
        }).join('');
      } else {
        sessionsList.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 1rem;">Failed to load sessions</div>';
      }
    } catch (e) {
      sessionsList.innerHTML = '<div style="color: #ef4444; text-align:center; padding: 1rem;">Network error</div>';
    }
  }

  window.revokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to terminate this remote session? That device will be immediately logged out.')) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showAlert('Session terminated successfully.', 'success');
        fetchUserSessions();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to revoke session', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  if (revokeAllOtherSessionsBtn) {
    revokeAllOtherSessionsBtn.addEventListener('click', async () => {
      if (!confirm('Log out all other active devices? Only your current device will remain signed in.')) return;
      try {
        const res = await fetch('/api/sessions', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          showAlert('All other devices have been logged out.', 'success');
          fetchUserSessions();
        } else {
          const err = await res.json();
          showAlert(err.error || 'Failed to revoke other sessions', 'error');
        }
      } catch (e) {
        showAlert('Network error', 'error');
      }
    });
  }


  // ==========================================
  // PRIVACY CONTACTS & CHAT REQUESTS LOGIC
  // ==========================================
  const addContactBtn = document.getElementById('addContactBtn');
  const addContactModal = document.getElementById('addContactModal');
  const closeAddContactModal = document.getElementById('closeAddContactModal');
  const contactSearchInput = document.getElementById('contactSearchInput');
  const contactSearchBtn = document.getElementById('contactSearchBtn');
  const contactSearchResults = document.getElementById('contactSearchResults');

  const pendingRequestsBtn = document.getElementById('pendingRequestsBtn');
  const pendingRequestsModal = document.getElementById('pendingRequestsModal');
  const closePendingRequestsModal = document.getElementById('closePendingRequestsModal');
  const pendingRequestsList = document.getElementById('pendingRequestsList');
  const requestsCountText = document.getElementById('requestsCountText');
  const ctxRemoveContactBtn = document.getElementById('ctxRemoveContactBtn');

  if (addContactBtn && addContactModal) {
    addContactBtn.addEventListener('click', () => {
      showElement(addContactModal);
      if (contactSearchInput) {
        contactSearchInput.value = '';
        contactSearchInput.focus();
      }
      if (contactSearchResults) contactSearchResults.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--text-muted);">Enter a username above to search.</div>';
    });
  }

  if (closeAddContactModal && addContactModal) {
    closeAddContactModal.addEventListener('click', () => hideElement(addContactModal));
  }

  
  const viewRequestsBannerBtn = document.getElementById('viewRequestsBannerBtn');
  if (viewRequestsBannerBtn && pendingRequestsModal) {
    viewRequestsBannerBtn.addEventListener('click', () => {
      showElement(pendingRequestsModal);
      renderPendingRequests();
    });
  }

  if (pendingRequestsBtn && pendingRequestsModal) {
    pendingRequestsBtn.addEventListener('click', () => {
      showElement(pendingRequestsModal);
      renderPendingRequests();
    });
  }

  if (closePendingRequestsModal && pendingRequestsModal) {
    closePendingRequestsModal.addEventListener('click', () => hideElement(pendingRequestsModal));
  }

  
  // Sidebar Tab Switching (Messages vs Requests)
  const tabDirectMessages = document.getElementById('tabDirectMessages');
  const tabIncomingRequests = document.getElementById('tabIncomingRequests');
  const sidebarMessagesContent = document.getElementById('sidebarMessagesContent');
  const sidebarRequestsContent = document.getElementById('sidebarRequestsContent');
  const sidebarRequestsList = document.getElementById('sidebarRequestsList');
  const sidebarRequestsBadge = document.getElementById('sidebarRequestsBadge');

  if (tabDirectMessages && tabIncomingRequests) {
    tabDirectMessages.addEventListener('click', () => {
      tabDirectMessages.classList.add('active');
      tabIncomingRequests.classList.remove('active');
      if (sidebarMessagesContent) {
        sidebarMessagesContent.style.display = 'block';
        sidebarMessagesContent.classList.remove('hidden');
      }
      if (sidebarRequestsContent) {
        sidebarRequestsContent.style.display = 'none';
        sidebarRequestsContent.classList.add('hidden');
      }
    });

    tabIncomingRequests.addEventListener('click', () => {
      tabIncomingRequests.classList.add('active');
      tabDirectMessages.classList.remove('active');
      if (sidebarRequestsContent) {
        sidebarRequestsContent.style.display = 'block';
        sidebarRequestsContent.classList.remove('hidden');
      }
      if (sidebarMessagesContent) {
        sidebarMessagesContent.style.display = 'none';
        sidebarMessagesContent.classList.add('hidden');
      }
      renderSidebarRequestsList();
    });
  }

  function renderSidebarRequestsList() {
    if (!sidebarRequestsList) return;
    if (incomingContactRequests.length === 0) {
      sidebarRequestsList.innerHTML = '<div style="text-align:center; padding: 1.5rem 10px; color: var(--text-muted); font-size: 0.8rem;">No pending chat requests.</div>';
      return;
    }

    sidebarRequestsList.innerHTML = incomingContactRequests.map(req => `
      <div class="sidebar-request-card">
        <div class="sidebar-request-user">
          <div class="avatar">${renderAvatarHTML(req.avatar, req.username, "", `openAvatarLightboxById(${req.id})`)}</div>
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">@${escapeHtml(req.username)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(req.bio || 'Wants to chat')}</div>
          </div>
        </div>
        <div class="sidebar-request-actions">
          <button type="button" class="unban-btn" onclick="acceptContactRequest(${req.id}, '${escapeHtml(req.username)}')">Accept</button>
          <button type="button" class="ban-btn" onclick="declineContactRequest(${req.id})">Decline</button>
        </div>
      </div>
    `).join('');
  }

  async function fetchUserContacts() {
    try {
      const res = await fetch('/api/contacts', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        acceptedContacts = data.accepted_contacts || [];
        incomingContactRequests = data.incoming_requests || [];
        outgoingContactRequests = data.outgoing_requests || [];

        const incomingCount = incomingContactRequests.length;
        if (sidebarRequestsBadge) {
          if (incomingCount > 0) {
            sidebarRequestsBadge.textContent = incomingCount;
            sidebarRequestsBadge.style.display = 'inline-block';
          } else {
            sidebarRequestsBadge.style.display = 'none';
          }
        }

        renderSidebarRequestsList();
        updateOnlineUsers();

        // If search modal is open, re-render results live
        if (typeof window.triggerRenderSearchResults === 'function') {
          window.triggerRenderSearchResults();
        }
      }
    } catch (e) {
      console.error('Fetch contacts error:', e);
    }
  }

  function renderPendingRequests() {
    if (!pendingRequestsList) return;
    if (incomingContactRequests.length === 0) {
      pendingRequestsList.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No incoming requests right now.</div>';
      return;
    }

    pendingRequestsList.innerHTML = incomingContactRequests.map(req => `
      <div class="contact-item-row">
        <div class="contact-user-info">
          <div class="avatar">${renderAvatarHTML(req.avatar, req.username, "", `openAvatarLightboxById(${req.id})`)}</div>
          <div>
            <div style="font-weight: 700; font-size: 0.9rem;">@${escapeHtml(req.username)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(req.bio || 'Wants to connect with you')}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="unban-btn" onclick="acceptContactRequest(${req.id}, '${escapeHtml(req.username)}')">Accept</button>
          <button type="button" class="ban-btn" onclick="declineContactRequest(${req.id})">Decline</button>
        </div>
      </div>
    `).join('');
  }

  window.acceptContactRequest = async (requesterId, username) => {
    try {
      const res = await fetch('/api/contacts/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ requester_id: requesterId })
      });
      if (res.ok) {
        showAlert(`Connected with @${username}!`, 'success');
        if (pendingRequestsModal) hideElement(pendingRequestsModal);
        fetchUserContacts();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to accept request', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  window.declineContactRequest = async (requesterId) => {
    try {
      const res = await fetch('/api/contacts/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ requester_id: requesterId })
      });
      if (res.ok) {
        showAlert('Request declined.', 'info');
        incomingContactRequests = incomingContactRequests.filter(r => Number(r.id) !== Number(requesterId));
        renderPendingRequests();
        if (pendingRequestsBtn && requestsCountText) {
          if (incomingContactRequests.length > 0) {
            requestsCountText.textContent = `Requests (${incomingContactRequests.length})`;
          } else {
            pendingRequestsBtn.style.display = 'none';
            if (pendingRequestsModal) hideElement(pendingRequestsModal);
          }
        }
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  // Hoisted Contact Search Renderer (Zero-Refresh State Toggle)
  const renderContactSearchResults = () => {
    if (!contactSearchInput || !contactSearchResults) return;
    const q = (contactSearchInput.value || '').trim().toLowerCase();
    if (!q) {
      contactSearchResults.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Type a username above to search.</div>';
      return;
    }

    const results = allRegisteredUsers.filter(u => {
      if (currentUser && Number(u.id) === Number(currentUser.id)) return false;
      return (u.username && u.username.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
    });

    if (results.length === 0) {
      contactSearchResults.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No users found matching that username.</div>';
      return;
    }

    contactSearchResults.innerHTML = results.map(u => {
      const isContact = acceptedContacts.some(c => Number(c.id) === Number(u.id));
      const isOutgoing = outgoingContactRequests.some(r => Number(r.id) === Number(u.id));
      const isIncoming = incomingContactRequests.some(r => Number(r.id) === Number(u.id));

      let actionBtn = '';
      if (isContact) {
        actionBtn = `
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-primary" style="padding: 5px 12px; font-size: 0.78rem;" onclick="startChatWithContact(${u.id}, '${escapeHtml(u.username)}')">Chat</button>
            <button type="button" class="btn-danger-outline" style="padding: 5px 10px; font-size: 0.78rem; border-radius: 8px; cursor: pointer;" onclick="removeContactPermanently(${u.id}, '${escapeHtml(u.username)}')">Remove</button>
          </div>
        `;
      } else if (isOutgoing) {
        actionBtn = `<button type="button" class="btn-danger-outline" style="padding: 5px 12px; font-size: 0.78rem; border-radius: 8px; cursor: pointer;" onclick="cancelContactRequest(${u.id}, '${escapeHtml(u.username)}')">Cancel Request</button>`;
      } else if (isIncoming) {
        actionBtn = `<button type="button" class="unban-btn" onclick="acceptContactRequest(${u.id}, '${escapeHtml(u.username)}')">Accept Request</button>`;
      } else {
        actionBtn = `<button type="button" class="btn btn-primary" style="padding: 5px 12px; font-size: 0.78rem;" onclick="sendContactRequest(${u.id}, '${escapeHtml(u.username)}')">Send Request</button>`;
      }

      return `
        <div class="contact-item-row">
          <div class="contact-user-info">
            <div class="avatar">${renderAvatarHTML(u.avatar, u.username, "", `openAvatarLightboxById(${u.id})`)}</div>
            <div>
              <div style="font-weight: 700; font-size: 0.9rem;">@${escapeHtml(u.username)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(u.bio || 'SChat User')}</div>
            </div>
          </div>
          <div>
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  };
  window.triggerRenderSearchResults = renderContactSearchResults;

  if (contactSearchBtn && contactSearchInput) {
    contactSearchInput.addEventListener('input', renderContactSearchResults);
    contactSearchBtn.addEventListener('click', renderContactSearchResults);
    contactSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderContactSearchResults(); });
  }

  window.sendContactRequest = async (targetId, username) => {
    try {
      const res = await fetch('/api/contacts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ target_id: targetId })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(data.message || `Chat request sent to @${username}!`, 'success');
        // Update local outgoing list immediately
        if (!outgoingContactRequests.some(r => Number(r.id) === Number(targetId))) {
          outgoingContactRequests.push({ id: targetId, username });
        }
        renderContactSearchResults();
        fetchUserContacts();
      } else {
        showAlert(data.error || 'Failed to send request', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  window.cancelContactRequest = async (targetId, username) => {
    try {
      const res = await fetch('/api/contacts/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ target_id: targetId })
      });
      if (res.ok) {
        showAlert(`Request to @${username} cancelled.`, 'info');
        outgoingContactRequests = outgoingContactRequests.filter(r => Number(r.id) !== Number(targetId));
        renderContactSearchResults();
        fetchUserContacts();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to cancel request', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

  window.startChatWithContact = (targetId, username) => {
    if (addContactModal) hideElement(addContactModal);
    const target = allRegisteredUsers.find(u => Number(u.id) === Number(targetId)) || { id: targetId, username };
    switchChatTab(target);
  };

  
  window.removeContactPermanently = async (targetId, username) => {
    if (!confirm(`Remove @${username} from your contacts and chat list?`)) return;
    try {
      const res = await fetch(`/api/contacts/${targetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showAlert(`@${username} removed from contacts.`, 'info');
        if (activeRecipient && activeRecipient !== 'empty' && activeRecipient.id && activeRecipient.id.toString() === targetId.toString()) {
          switchChatTab('empty');
        }
        acceptedContacts = acceptedContacts.filter(c => Number(c.id) !== Number(targetId));
        renderContactSearchResults();
        fetchUserContacts();
      } else {
        const err = await res.json();
        showAlert(err.error || 'Failed to remove contact', 'error');
      }
    } catch (e) {
      showAlert('Network error', 'error');
    }
  };

    if (headerRemoveContactBtn) {
    headerRemoveContactBtn.addEventListener('click', () => {
      if (activeRecipient && activeRecipient !== 'empty' && activeRecipient.id) {
        removeContactPermanently(activeRecipient.id, activeRecipient.username);
      }
    });
  }

  if (ctxRemoveContactBtn) {
    ctxRemoveContactBtn.addEventListener('click', async () => {
      if (channelContextMenuTarget === 'global') return;
      const targetUser = allRegisteredUsers.find(u => u.id.toString() === channelContextMenuTarget.toString());
      const username = targetUser ? targetUser.username : 'user';

      if (!confirm(`Remove @${username} from your contacts and chat list?`)) return;

      try {
        const res = await fetch(`/api/contacts/${channelContextMenuTarget}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          showAlert(`@${username} removed from contacts.`, 'info');
          if (activeRecipient && activeRecipient !== 'empty' && activeRecipient.id && activeRecipient.id.toString() === channelContextMenuTarget.toString()) {
            switchChatTab('empty');
          }
          fetchUserContacts();
        } else {
          const err = await res.json();
          showAlert(err.error || 'Failed to remove contact', 'error');
        }
      } catch (e) {
        showAlert('Network error', 'error');
      }
    });
  }

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
        const localAudioUrl = URL.createObjectURL(audioBlob);
        const tempId = `temp_upload_${Date.now()}`;
        const tempMsg = {
          id: tempId,
          user_id: currentUser.id,
          recipient_id: activeRecipient && activeRecipient !== 'empty' ? activeRecipient.id : null,
          username: currentUser.username,
          avatar: currentUser.avatar,
          content: `[AUDIO]${localAudioUrl}`,
          created_at: new Date().toISOString(),
          status: 'sending'
        };
        renderMessage(tempMsg);
        const optimisticCard = document.querySelector(`.message-card[data-msg-id="${tempId}"]`);
        if (optimisticCard) optimisticCard.classList.add('media-uploading');
        scrollToBottom();

        
        const fileUrl = await uploadToCloudinary(audioBlob);
        
        if (!fileUrl) {
          showAlert('Failed to upload voice note. Please try again.', 'error');
          if (typeof optimisticCard !== 'undefined' && optimisticCard) optimisticCard.remove();
          return;
        }

        
        if (optimisticCard) {
          optimisticCard.style.opacity = '0';
          setTimeout(() => optimisticCard.remove(), 250);
        }
const audioPayload = '[AUDIO]' + fileUrl;
        
        const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

        if (activeRecipient) {
          chattedUserIds.add(Number(activeRecipient.id));
          updateOnlineUsers();
        }

        const audioMsgPayload = {
          type: 'chat_message',
          recipient_id: activeRecipient ? activeRecipient.id : null,
          content: audioPayload,
          is_blurred: isPrivacyBlurActive ? 1 : 0,
          timer_seconds: timerSeconds,
          reply_to_id: activeReply ? activeReply.id : null,
          reply_to_user: activeReply ? activeReply.username : null,
          reply_to_text: activeReply ? activeReply.text : null
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(audioMsgPayload));
        } else {
          outboundMessageQueue.push(audioMsgPayload);
          connectWebSocket();
        }

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
      const tempId = `temp_upload_${Date.now()}`;
      const tempMsg = {
        id: tempId,
        user_id: currentUser.id,
        recipient_id: activeRecipient && activeRecipient !== 'empty' ? activeRecipient.id : null,
        username: currentUser.username,
        avatar: currentUser.avatar,
        content: `[FILE]${file.name}|#`,
        created_at: new Date().toISOString(),
        status: 'sending'
      };
      renderMessage(tempMsg);
      const optimisticCard = document.querySelector(`.message-card[data-msg-id="${tempId}"]`);
      if (optimisticCard) optimisticCard.classList.add('media-uploading');
      scrollToBottom();

      
      try {
        const fileHash = await generateFileHash(file);
        let fileUrl = null;
        if (fileHash) {
          const res = await fetch(`/api/media/check/${fileHash}`);
          if (res.ok) {
            const data = await res.json();
            fileUrl = data.url;
          }
        }
        
        if (!fileUrl) {
          fileUrl = await uploadToCloudinary(file, 'raw');
        }
        
        if (fileUrl) {
          const filePayload = `[FILE]${file.name}|${fileUrl}`;
          ws.send(JSON.stringify({
            type: 'chat_message',
            content: filePayload,
            file_hash: fileHash,
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
        if (typeof optimisticCard !== 'undefined' && optimisticCard) optimisticCard.remove();
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
      const fileUrlLocal = URL.createObjectURL(file);
      const tempId = `temp_upload_${Date.now()}`;
      const tempMsg = {
        id: tempId,
        user_id: currentUser.id,
        recipient_id: activeRecipient && activeRecipient !== 'empty' ? activeRecipient.id : null,
        username: currentUser.username,
        avatar: currentUser.avatar,
        content: `[IMAGE]${fileUrlLocal}`,
        created_at: new Date().toISOString(),
        status: 'sending'
      };
      renderMessage(tempMsg);
      const optimisticCard = document.querySelector(`.message-card[data-msg-id="${tempId}"]`);
      if (optimisticCard) optimisticCard.classList.add('media-uploading');
      scrollToBottom();

      
      try {
        const fileHash = await generateFileHash(file);
        let fileUrl = null;
        if (fileHash) {
          const res = await fetch(`/api/media/check/${fileHash}`);
          if (res.ok) {
            const data = await res.json();
            fileUrl = data.url;
          }
        }

        if (!fileUrl) {
          const compressedBlob = await compressImage(file);
          fileUrl = await uploadToCloudinary(compressedBlob, 'image');
        }

        
          if (optimisticCard) {
            optimisticCard.style.opacity = '0';
            setTimeout(() => optimisticCard.remove(), 250);
          }
if (fileUrl) {
          const imagePayload = '[IMAGE]' + fileUrl;
          ws.send(JSON.stringify({
            type: 'chat_message',
            content: imagePayload,
            file_hash: fileHash,
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
        if (typeof optimisticCard !== 'undefined' && optimisticCard) optimisticCard.remove();
      }
    });
  }

  const generateFileHash = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (err) {
      console.error('Hashing error:', err);
      return null;
    }
  };

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

    const timerSeconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;

    if (activeRecipient) {
      chattedUserIds.add(Number(activeRecipient.id));
      updateOnlineUsers();
    }

    const payload = {
      type: 'chat_message',
      recipient_id: activeRecipient ? activeRecipient.id : null,
      content: content,
      is_blurred: isPrivacyBlurActive ? 1 : 0,
      timer_seconds: timerSeconds,
      reply_to_id: activeReply ? activeReply.id : null,
      reply_to_user: activeReply ? activeReply.username : null,
      reply_to_text: activeReply ? activeReply.text : null
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      outboundMessageQueue.push(payload);
      connectWebSocket();
    }

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

  // ==========================================
  // FULL UNICODE EMOJI PICKER CONTROLLER
  // ==========================================
  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (attachDropdown) hideElement(attachDropdown);
      
      if (emojiPicker.classList.contains('hidden')) {
        emojiPicker.classList.remove('hidden');
        emojiPicker.style.display = 'block';
      } else {
        emojiPicker.classList.add('hidden');
      }
    });

    // Handle full unicode emoji selection from <emoji-picker>
    const pickerComponent = emojiPicker.querySelector('emoji-picker') || emojiPicker;
    pickerComponent.addEventListener('emoji-click', (event) => {
      const emoji = event.detail?.unicode || (typeof event.detail === 'string' ? event.detail : '');
      if (emoji && messageInput) {
        const start = messageInput.selectionStart ?? messageInput.value.length;
        const end = messageInput.selectionEnd ?? messageInput.value.length;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Outside Click & Escape Key Dismissal
    document.addEventListener('click', (e) => {
      if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn && !emojiBtn.contains(e.target)) {
        emojiPicker.classList.add('hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && emojiPicker && !emojiPicker.classList.contains('hidden')) {
        emojiPicker.classList.add('hidden');
      }
    });
  }

  filterInput.addEventListener('input', (e) => {
    updateOnlineUsers();
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.message-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(term) ? 'flex' : 'none';
    });
  });

  
  // Register background session heartbeat for multi-device monitoring
  if (authToken) {
    fetch('/api/sessions/heartbeat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    }).catch(() => {});
  }

  
  // ==========================================
  // LIGHTBOX & PROFILE AVATAR UPLOAD CONTROLLERS
  // ==========================================
  const avatarLightboxModal = document.getElementById('avatarLightboxModal');
  const closeAvatarLightboxBtn = document.getElementById('closeAvatarLightboxBtn');
  const closeAvatarLightboxBackdrop = document.getElementById('closeAvatarLightboxBackdrop');
  const lightboxAvatarShield = document.getElementById('lightboxAvatarShield');
  const lightboxWatermark = document.getElementById('lightboxWatermark');
  const lightboxUsername = document.getElementById('lightboxUsername');
  const lightboxBio = document.getElementById('lightboxBio');
  const lightboxActions = document.getElementById('lightboxActions');

  window.openAvatarLightbox = (userOrAvatar, username = '', bio = '') => {
    let avatarUrl = '';
    let uname = '';
    let userBio = '';
    let isSelf = false;

    if (typeof userOrAvatar === 'object' && userOrAvatar !== null) {
      avatarUrl = userOrAvatar.avatar || '👤';
      uname = userOrAvatar.username || 'User';
      userBio = userOrAvatar.bio || 'Hey there! I am using SChat.';
      isSelf = currentUser && Number(userOrAvatar.id) === Number(currentUser.id);
    } else {
      avatarUrl = userOrAvatar || '👤';
      uname = username || 'User';
      userBio = bio || 'Hey there! I am using SChat.';
      isSelf = currentUser && (uname === currentUser.username);
    }

    if (!avatarLightboxModal) return;

    // Close any other open modals to prevent layering clash
    if (profileModal) hideElement(profileModal);
    if (aboutModal) hideElement(aboutModal);
    if (sessionsModal) hideElement(sessionsModal);

    const isImg = isImageAvatar(avatarUrl);
    if (isImg) {
      lightboxAvatarShield.style.backgroundImage = `url('${avatarUrl}')`;
      lightboxAvatarShield.innerHTML = '';
    } else {
      lightboxAvatarShield.style.backgroundImage = 'none';
      lightboxAvatarShield.innerHTML = `<span style="font-size: 6rem; display: flex; align-items: center; justify-content: center; height: 100%;">${avatarUrl}</span>`;
    }

    if (lightboxUsername) lightboxUsername.textContent = `@${uname}`;
    if (lightboxBio) lightboxBio.textContent = userBio || 'Hey there! I am using SChat.';

    if (lightboxActions) {
      if (isSelf) {
        lightboxActions.innerHTML = `
          <button type="button" class="cinematic-pill-btn primary" onclick="window.hideAvatarLightbox(); window.openProfileModal();">
            🎨 Change Avatar
          </button>
        `;
      } else {
        lightboxActions.innerHTML = `
          <button type="button" class="cinematic-pill-btn primary" onclick="window.hideAvatarLightbox();">
            ✕ Close Preview
          </button>
        `;
      }
    }

    showElement(avatarLightboxModal);
  };

  window.openAvatarLightboxById = (userId) => {
    const numId = Number(userId);
    const target = (currentUser && Number(currentUser.id) === numId) ? currentUser
      : (allRegisteredUsers.find(u => Number(u.id) === numId)
      || acceptedContacts.find(u => Number(u.id) === numId)
      || incomingContactRequests.find(u => Number(u.id) === numId)
      || outgoingContactRequests.find(u => Number(u.id) === numId)
      || { id: numId, username: 'User', avatar: '👤' });
    
    window.openAvatarLightbox(target);
  };

  window.hideAvatarLightbox = () => {
    if (avatarLightboxModal) hideElement(avatarLightboxModal);
  };

  if (closeAvatarLightboxBtn) closeAvatarLightboxBtn.addEventListener('click', window.hideAvatarLightbox);
  if (closeAvatarLightboxBackdrop) closeAvatarLightboxBackdrop.addEventListener('click', window.hideAvatarLightbox);



  // Preset Avatars Gallery Selection (Staging only - previews without auto-saving)
  const presetAvatarsGrid = document.getElementById('presetAvatarsGrid');
  if (presetAvatarsGrid) {
    presetAvatarsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.preset-avatar-card');
      if (!card) return;
      
      const avatarUrl = card.dataset.avatarUrl;
      if (!avatarUrl) return;

      stagedAvatar = avatarUrl;

      // Update UI active card
      presetAvatarsGrid.querySelectorAll('.preset-avatar-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Instant live staging preview in Hero Card
      const profileAvatarPreview = document.getElementById('profileAvatarPreview');
      if (profileAvatarPreview) {
        profileAvatarPreview.innerHTML = renderAvatarHTML(stagedAvatar, currentUser?.username || 'User', 'no-hover');
      }
    });
  }

  // ==========================================
  // INTERACTIVE CIRCULAR AVATAR CROPPER ENGINE
  // ==========================================
  const avatarCropperModal = document.getElementById('avatarCropperModal');
  const cropperCanvas = document.getElementById('cropperCanvas');
  const cropperViewport = document.getElementById('cropperViewport');
  const cropperZoomSlider = document.getElementById('cropperZoomSlider');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const closeCropperBtn = document.getElementById('closeCropperBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const profileAvatarInput = document.getElementById('profileAvatarInput');
  const profileAvatarUploadBtn = document.getElementById('profileAvatarUploadBtn');

  let cropperImg = null;
  let cropperScale = 1;
  let cropperOffsetX = 0;
  let cropperOffsetY = 0;
  let isDraggingCrop = false;
  let cropDragStartX = 0;
  let cropDragStartY = 0;

  function renderCropper() {
    if (!cropperCanvas || !cropperImg) return;
    const ctx = cropperCanvas.getContext('2d');
    const width = cropperCanvas.width;
    const height = cropperCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Base dimensions fitting canvas
    const imgAspect = cropperImg.width / cropperImg.height;
    let drawW, drawH;
    if (imgAspect > 1) {
      drawH = height * cropperScale;
      drawW = drawH * imgAspect;
    } else {
      drawW = width * cropperScale;
      drawH = drawW / imgAspect;
    }

    const drawX = (width - drawW) / 2 + cropperOffsetX;
    const drawY = (height - drawH) / 2 + cropperOffsetY;

    ctx.drawImage(cropperImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  function openCropperWithImage(imgSrc) {
    cropperImg = new Image();
    cropperImg.onload = () => {
      cropperScale = 1;
      cropperOffsetX = 0;
      cropperOffsetY = 0;
      if (cropperZoomSlider) cropperZoomSlider.value = '1';
      renderCropper();
      if (avatarCropperModal) {
        avatarCropperModal.style.display = 'flex';
        avatarCropperModal.classList.remove('hidden');
      }
    };
    cropperImg.src = imgSrc;
  }

  function closeCropper() {
    if (avatarCropperModal) {
      avatarCropperModal.style.display = 'none';
      avatarCropperModal.classList.add('hidden');
    }
    if (profileAvatarInput) profileAvatarInput.value = '';
  }

  if (cancelCropBtn) cancelCropBtn.addEventListener('click', closeCropper);
  if (closeCropperBtn) closeCropperBtn.addEventListener('click', closeCropper);

  // Zoom Slider Event
  if (cropperZoomSlider) {
    cropperZoomSlider.addEventListener('input', (e) => {
      cropperScale = parseFloat(e.target.value);
      renderCropper();
    });
  }

  // Mouse & Touch Pan Dragging
  if (cropperViewport) {
    const handleDragStart = (x, y) => {
      isDraggingCrop = true;
      cropDragStartX = x - cropperOffsetX;
      cropDragStartY = y - cropperOffsetY;
    };

    const handleDragMove = (x, y) => {
      if (!isDraggingCrop) return;
      cropperOffsetX = x - cropDragStartX;
      cropperOffsetY = y - cropDragStartY;
      renderCropper();
    };

    const handleDragEnd = () => {
      isDraggingCrop = false;
    };

    // Mouse Events
    cropperViewport.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleDragEnd);

    // Touch Events for Mobile
    cropperViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDraggingCrop && e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', handleDragEnd);
  }

  // Dual-Context Cropper: Tracks whether cropper was opened from Lightbox or Profile Settings
  let cropperSourceContext = 'profile'; // 'profile' or 'lightbox'

  window.triggerLightboxPhotoUpload = () => {
    cropperSourceContext = 'lightbox';
    if (profileAvatarInput) profileAvatarInput.click();
  };

  // Apply Crop & Save/Staging Engine
  if (applyCropBtn) {
    applyCropBtn.addEventListener('click', async () => {
      if (!cropperCanvas || !cropperImg) return;

      // Render circular 256x256 crop
      const cropOutputCanvas = document.createElement('canvas');
      const TARGET_SIZE = 256;
      cropOutputCanvas.width = TARGET_SIZE;
      cropOutputCanvas.height = TARGET_SIZE;
      const outCtx = cropOutputCanvas.getContext('2d');

      // Clip circle
      outCtx.save();
      outCtx.beginPath();
      outCtx.arc(TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, 0, Math.PI * 2);
      outCtx.clip();

      // Render scaled and offset image
      const srcCanvasW = cropperCanvas.width;
      const srcCanvasH = cropperCanvas.height;
      const imgAspect = cropperImg.width / cropperImg.height;
      let drawW, drawH;
      if (imgAspect > 1) {
        drawH = srcCanvasH * cropperScale;
        drawW = drawH * imgAspect;
      } else {
        drawW = srcCanvasW * cropperScale;
        drawH = drawW / imgAspect;
      }

      const drawX = (srcCanvasW - drawW) / 2 + cropperOffsetX;
      const drawY = (srcCanvasH - drawH) / 2 + cropperOffsetY;

      // Scale to target output size
      const scaleFactor = TARGET_SIZE / srcCanvasW;
      outCtx.drawImage(cropperImg, drawX * scaleFactor, drawY * scaleFactor, drawW * scaleFactor, drawH * scaleFactor);
      outCtx.restore();

      const croppedDataUrl = cropOutputCanvas.toDataURL('image/webp', 0.88);

      // Unify staged state and live DOM updates immediately
      stagedAvatar = croppedDataUrl;
      if (currentUser) {
        currentUser.avatar = croppedDataUrl;
        localStorage.setItem('schat_user', JSON.stringify(currentUser));
      }

      const profileAvatarPreview = document.getElementById('profileAvatarPreview');
      if (profileAvatarPreview) {
        profileAvatarPreview.innerHTML = renderAvatarHTML(croppedDataUrl, currentUser?.username || 'User', 'no-hover');
      }

      const myAvatar = document.getElementById('myAvatar');
      if (myAvatar) {
        myAvatar.innerHTML = renderAvatarHTML(croppedDataUrl, currentUser?.username || 'User', 'no-hover');
      }

      const lightboxAvatarShield = document.getElementById('lightboxAvatarShield');
      if (lightboxAvatarShield) {
        lightboxAvatarShield.style.backgroundImage = `url('${croppedDataUrl}')`;
        lightboxAvatarShield.innerHTML = '';
      }

      if (presetAvatarsGrid) {
        presetAvatarsGrid.querySelectorAll('.preset-avatar-card').forEach(c => c.classList.remove('active'));
      }

      closeCropper();

      // Direct Save to Backend Database in background
      try {
        fetch('/api/profile/avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ avatar: croppedDataUrl })
        }).then(res => {
          if (res.ok && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'profile_update', avatar: croppedDataUrl }));
          }
        }).catch(err => {
          console.error('Avatar background save error:', err);
        });
      } catch (err) {
        console.error('Avatar save error:', err);
      }
    });
  }

  // Profile Avatar Upload Handler (Triggers interactive cropper)
  if (profileAvatarUploadBtn && profileAvatarInput) {
    profileAvatarUploadBtn.addEventListener('click', () => {
      cropperSourceContext = 'profile';
      profileAvatarInput.click();
    });

    profileAvatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        openCropperWithImage(event.target.result);
      };
      reader.readAsDataURL(file);
    });
  }




  if (authToken && currentUser) {
    initializeChatSession();
    dismissSplashScreen();
  } else {
    authView.classList.remove('hidden');
    MotionFX.enter(authView, { y: 18 });
    dismissSplashScreen();
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
  if (!canvas || window.innerWidth <= 768) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let shockwaves = [];
  const maxParticles = window.innerWidth > 768 ? 60 : 35;
  let motionPaused = document.hidden;
  let activeFramesRemaining = 120;
  let isLoopRunning = false;

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isActive: false,
    radius: window.innerWidth > 768 ? 260 : 160
  };

  function wakeAnimation(frames = 90) {
    activeFramesRemaining = Math.max(activeFramesRemaining, frames);
    if (!isLoopRunning && !motionPaused) {
      isLoopRunning = true;
      requestAnimationFrame(animate);
    }
  }

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (pointer.x === 0 && pointer.y === 0) {
      pointer.x = pointer.targetX = width / 2;
      pointer.y = pointer.targetY = height / 2;
    }
    wakeAnimation(60);
  }

  function updatePointer(clientX, clientY) {
    pointer.targetX = clientX;
    pointer.targetY = clientY;
    pointer.isActive = true;
    wakeAnimation(75);

    if (aurora) {
      aurora.style.left = `${clientX}px`;
      aurora.style.top = `${clientY}px`;
    }
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

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
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = Math.random() * 2 + 1;
      this.angle = Math.random() * Math.PI * 2;
      this.angularSpeed = Math.random() * 0.012 + 0.004;
      this.colorRatio = Math.random();
    }

    update() {
      this.angle += this.angularSpeed;
      this.x += this.vx + Math.sin(this.angle) * 0.3;
      this.y += this.vy + Math.cos(this.angle) * 0.3;

      if (this.x < -30) this.x = width + 30;
      if (this.x > width + 30) this.x = -30;
      if (this.y < -30) this.y = height + 30;
      if (this.y > height + 30) this.y = -30;

      if (pointer.isActive) {
        const dx = pointer.x - this.x;
        const dy = pointer.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < pointer.radius) {
          const baseForce = window.innerWidth > 768 ? 7.5 : 4.0;
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
        ctx.fillStyle = this.colorRatio > 0.5 ? 'rgba(79, 70, 229, 0.45)' : 'rgba(2, 132, 199, 0.45)';
      } else {
        ctx.fillStyle = this.colorRatio > 0.5 ? 'rgba(99, 102, 241, 0.7)' : 'rgba(14, 165, 233, 0.7)';
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
    wakeAnimation(120);
  };

  document.addEventListener('visibilitychange', () => {
    motionPaused = document.hidden;
    if (!motionPaused) wakeAnimation(60);
  });

  function animate() {
    if (motionPaused) {
      isLoopRunning = false;
      return;
    }

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

    const maxConnectionDistance = window.innerWidth > 768 ? 140 : 90;
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(currentTheme);

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxConnectionDistance) {
          const alpha = (1 - dist / maxConnectionDistance) * (currentTheme === 'light' ? 0.15 : 0.3);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = currentTheme === 'light' 
            ? `rgba(79, 70, 229, ${alpha})` 
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
          const palpha = (1 - pdist / pointer.radius) * 0.35;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = currentTheme === 'light' 
            ? `rgba(79, 70, 229, ${palpha})` 
            : `rgba(99, 102, 241, ${palpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    activeFramesRemaining--;
    if (activeFramesRemaining > 0 || shockwaves.length > 0) {
      requestAnimationFrame(animate);
    } else {
      isLoopRunning = false;
    }
  }

  wakeAnimation(120);
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
    if (existingSub && !localStorage.getItem('push_key_v4')) {
      await existingSub.unsubscribe();
      existingSub = null;
      localStorage.setItem('push_key_v4', 'true');
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

    const subJson = subscription.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('schat_token')}`
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth
        }
      })
    });

    console.error('DEBUG: Created NEW sub on server. Server responded: ' + res.status);
  } catch (err) {
    console.error('DEBUG: Failed to subscribe: ' + err.message);
  }
}


// --- Lightbox Logic ---
window.openLightbox = (url) => {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
  
  if (!lightbox || !lightboxImg) return;
  
  lightboxImg.src = url;
  lightbox.classList.remove('hidden');
  
  lightboxDownloadBtn.onclick = () => {
    let dlUrl = url;
    if (dlUrl.includes('cloudinary.com')) {
      const parts = dlUrl.split('/upload/');
      if (parts.length === 2) {
        dlUrl = parts[0] + '/upload/fl_attachment/' + parts[1];
      }
    }
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = "SChat_Image_" + Date.now() + ".webp";
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
};

// Bind Lightbox globally
const lightbox = document.getElementById('imageLightbox');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

if (lightbox && lightboxCloseBtn) {
  lightboxCloseBtn.addEventListener('click', () => {
    lightbox.classList.add('hidden');
    setTimeout(() => { document.getElementById('lightboxImg').src = ''; }, 300);
  });
  
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.classList.add('hidden');
      setTimeout(() => { document.getElementById('lightboxImg').src = ''; }, 300);
    }
  });
}


// ==========================================
// SPATIAL UI & PHYSICS INTERACTION ENGINE
// ==========================================

const initSpatialPhysics = () => {
  // 1. Magnetic Hover Effects
  const magneticElements = document.querySelectorAll('[data-magnetic]');
  magneticElements.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const h = rect.width / 2;
      const v = rect.height / 2;
      const x = e.clientX - rect.left - h;
      const y = e.clientY - rect.top - v;
      
      // Pull strength factor = 0.25
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px) scale(1.02)`;
    });
    
    el.addEventListener('mouseleave', () => {
      // Spring bounce back to origin
      el.style.transform = `translate(0px, 0px) scale(1)`;
    });
    
    // Tactile press state
    el.addEventListener('mousedown', () => {
      el.style.transform = `translate(0px, 0px) scale(0.92)`;
    });
    el.addEventListener('mouseup', () => {
      el.style.transform = `translate(0px, 0px) scale(1.02)`;
    });
  });

  // 2. 3D Parallax Tilt Effects
  const tiltElements = document.querySelectorAll('[data-tilt]');
  tiltElements.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      // Don't tilt if interacting with inner magnetic buttons
      if (e.target.closest('[data-magnetic]')) return; 
      
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      
      // Max tilt of 6 degrees for elegance
      const tiltX = y * -6; 
      const tiltY = x * 6;
      
      el.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    });
  });
};

// Initialize physics engine on load
window.addEventListener('DOMContentLoaded', initSpatialPhysics);



