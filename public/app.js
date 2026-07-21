// SChat Ultra-Premium 3D Motion Chat Engine

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let authToken = localStorage.getItem('schat_token') || null;
  let currentUser = null;
  try {
    const storedUser = localStorage.getItem('schat_user');
    if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
      currentUser = JSON.parse(storedUser);
    }
  } catch (e) {
    currentUser = null;
  }

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

  // ================= 3D WEBGL MOTION ENGINE (Three.js) =================
  const init3DMotionEngine = () => {
    const canvas = document.getElementById('bg3dCanvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 40;

    // Interactive Floating Particle Flow Grid
    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const originalY = new Float32Array(particleCount);

    const colorA = new THREE.Color(0x8b5cf6); // Purple Glow
    const colorB = new THREE.Color(0x06b6d4); // Cyan Glow

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 120;
      const y = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      originalY[i] = y;

      const mixedColor = colorA.clone().lerp(colorB, Math.random());
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material Shader Point Texture Simulation
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 16;
    canvasTexture.height = 16;
    const ctx = canvasTexture.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);

    const pTexture = new THREE.CanvasTexture(canvasTexture);

    const material = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      map: pTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse Parallax Motion Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth Parallax Interpolation
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      camera.position.x = targetX * 8;
      camera.position.y = -targetY * 8;
      camera.lookAt(scene.position);

      // Particle Wave Displacement Motion
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const x = pos[i * 3];
        pos[i * 3 + 1] = originalY[i] + Math.sin(elapsedTime * 1.5 + x * 0.1) * 2.5;
      }
      geometry.attributes.position.needsUpdate = true;

      particles.rotation.y = elapsedTime * 0.04;

      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  };

  init3DMotionEngine();

  // ================= 3D TILT CARDS PARALLAX EFFECT =================
  const init3DTiltCards = () => {
    document.querySelectorAll('.3d-tilt-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        card.style.transform = `perspective(1000px) rotateX(${-y / 15}deg) rotateY(${x / 15}deg) translateZ(10px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
      });
    });
  };

  init3DTiltCards();

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
        console.log('⚡ PWA ServiceWorker registered:', reg.scope);
      }).catch((err) => {
        console.error('ServiceWorker registration failed:', err);
      });
    });
  }

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (filterInput) filterInput.focus();
    }
    if (e.key === 'Escape') {
      closeAboutModal();
      closeProfileModal();
      if (emojiPicker) emojiPicker.classList.add('hidden');
    }
  });

  // DOM Elements
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.classList.remove('hidden');
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Install outcome: ${outcome}`);
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

  // Modals
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutBtn = document.getElementById('closeAboutBtn');
  const authAboutBtn = document.getElementById('authAboutBtn');
  const sidebarAboutBtn = document.getElementById('sidebarAboutBtn');
  const headerAboutBtn = document.getElementById('headerAboutBtn');

  const profileModal = document.getElementById('profileModal');
  const myProfileCard = document.getElementById('myProfileCard');
  const closeProfileBtn = document.getElementById('closeProfileBtn');
  const profileForm = document.getElementById('profileForm');
  const profileBioInput = document.getElementById('profileBioInput');

  const openAboutModal = () => { if (aboutModal) aboutModal.classList.remove('hidden'); };
  const closeAboutModal = () => { if (aboutModal) aboutModal.classList.add('hidden'); };

  const openProfileModal = () => {
    if (profileModal) {
      if (profileBioInput && currentUser) profileBioInput.value = currentUser.bio || '';
      profileModal.classList.remove('hidden');
    }
  };
  const closeProfileModal = () => { if (profileModal) profileModal.classList.add('hidden'); };

  if (authAboutBtn) authAboutBtn.addEventListener('click', openAboutModal);
  if (sidebarAboutBtn) sidebarAboutBtn.addEventListener('click', openAboutModal);
  if (headerAboutBtn) headerAboutBtn.addEventListener('click', openAboutModal);
  if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeAboutModal);

  if (myProfileCard) myProfileCard.addEventListener('click', openProfileModal);
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfileModal);

  // Context Menu Handling
  const msgContextMenu = document.getElementById('msgContextMenu');
  let selectedContextMsgId = null;

  const showContextMenu = (e, msgId) => {
    e.preventDefault();
    selectedContextMsgId = msgId;
    if (msgContextMenu) {
      msgContextMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
      msgContextMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;
      msgContextMenu.classList.remove('hidden');
    }
  };

  const hideContextMenu = () => {
    if (msgContextMenu) msgContextMenu.classList.add('hidden');
  };

  document.addEventListener('click', hideContextMenu);

  // Audio Synthesizer Engine
  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'receive') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {}
  };

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });
  }

  // Theme Toggle
  const toggleTheme = () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('schat_theme', currentTheme);
    if (themeModeBtn) themeModeBtn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
    if (headerThemeBtn) headerThemeBtn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
  };

  if (themeModeBtn) themeModeBtn.addEventListener('click', toggleTheme);
  if (headerThemeBtn) headerThemeBtn.addEventListener('click', toggleTheme);

  // Mobile Sidebar Controls
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener('click', () => {
      chatSidebar.classList.add('mobile-open');
      sidebarOverlay.classList.add('active');
    });
  }

  const closeSidebar = () => {
    chatSidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
  };

  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Auth Switcher
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', () => {
      loginForm.classList.remove('active');
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      registerForm.classList.add('active');
    });
  }

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', () => {
      registerForm.classList.remove('active');
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      loginForm.classList.add('active');
    });
  }

  if (avatarPicker) {
    avatarPicker.addEventListener('click', (e) => {
      if (e.target.classList.contains('avatar-opt')) {
        document.querySelectorAll('.avatar-opt').forEach(opt => opt.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedAvatar = e.target.dataset.avatar;
      }
    });
  }

  const showAlert = (msg, type = 'error') => {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.className = `alert-banner ${type}`;
    authAlert.classList.remove('hidden');
    setTimeout(() => {
      authAlert.classList.add('hidden');
    }, 4000);
  };

  // Helper Escape HTML
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Switch Chat Tabs
  const switchChatTab = (recipient = null) => {
    activeRecipient = recipient;
    closeSidebar();
    setReplyState(null);

    if (!activeRecipient) {
      // Global Chat
      globalChannelBtn.classList.add('active');
      document.querySelectorAll('.online-user-item').forEach(el => el.classList.remove('active'));
      roomAvatar.textContent = '🌐';
      roomTitle.textContent = 'Global Channel';
      roomSubtitle.textContent = 'Realtime Active Community';

      if (welcomeTitle) welcomeTitle.textContent = 'Welcome to SChat!';
      if (welcomeSubtitle) welcomeSubtitle.textContent = 'Global interactive workspace with 3D ambient motion and end-to-end speed.';
    } else {
      // DM Chat
      globalChannelBtn.classList.remove('active');
      document.querySelectorAll('.online-user-item').forEach(el => {
        if (Number(el.dataset.userId) === Number(activeRecipient.id)) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
      roomAvatar.textContent = activeRecipient.avatar || '⚡';
      roomTitle.textContent = activeRecipient.username;
      roomSubtitle.textContent = 'Private Direct Message';

      if (welcomeTitle) welcomeTitle.textContent = `Direct Message with ${activeRecipient.username}`;
      if (welcomeSubtitle) welcomeSubtitle.textContent = 'Encrypted 1-on-1 private real-time session.';

      delete unreadCounts[activeRecipient.id];
      updateOnlineUsers();
    }

    fetchMessageHistory();
  };

  if (globalChannelBtn) {
    globalChannelBtn.addEventListener('click', () => switchChatTab(null));
  }

  // Fetch Message History
  const fetchMessageHistory = async () => {
    if (!authToken) return;
    try {
      const url = activeRecipient 
        ? `/api/messages?recipient_id=${activeRecipient.id}`
        : `/api/messages`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!res.ok) {
        if (res.status === 401) {
          console.warn('Session expired or invalid token');
          localStorage.removeItem('schat_token');
          localStorage.removeItem('schat_user');
          authToken = null;
          currentUser = null;
          if (ws) ws.close();
          authView.classList.remove('hidden');
          chatView.classList.add('hidden');
          showAlert('Session expired. Please sign in again.', 'error');
          return;
        }
        throw new Error('Failed to load message history');
      }
      const data = await res.json();
      renderMessageFeed(data.messages || []);
    } catch (err) {
      console.error('Fetch History Error:', err);
    }
  };

  // Render Message Feed
  const renderMessageFeed = (messages) => {
    const wTitle = welcomeTitle ? welcomeTitle.textContent : 'Welcome to SChat!';
    const wSub = welcomeSubtitle ? welcomeSubtitle.textContent : 'Global interactive workspace with 3D motion.';

    messagesFeed.innerHTML = `
      <div class="feed-welcome-hero">
        <div class="welcome-badge">✨ Motion 3D Active</div>
        <h2>${escapeHtml(wTitle)}</h2>
        <p>${escapeHtml(wSub)}</p>
      </div>
    `;

    messages.forEach(msg => {
      appendMessageCard(msg);
    });

    scrollToBottom();
  };

  const appendMessageCard = (msg) => {
    const isOutgoing = Number(msg.user_id) === Number(currentUser ? currentUser.id : 0);
    const card = document.createElement('div');
    card.className = `message-card ${isOutgoing ? 'outgoing' : 'incoming'} 3d-tilt-card`;
    card.dataset.msgId = msg.id;

    const formattedTime = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let replyHtml = '';
    if (msg.reply_to_user && msg.reply_to_text) {
      replyHtml = `
        <div class="msg-reply-box">
          <span class="msg-reply-author">↩️ @${escapeHtml(msg.reply_to_user)}</span>
          <span class="msg-reply-text">${escapeHtml(msg.reply_to_text)}</span>
        </div>
      `;
    }

    let blurredClass = msg.is_blurred ? 'blurred' : '';

    card.innerHTML = `
      <div class="msg-avatar">${msg.avatar || '⚡'}</div>
      <div class="msg-content-wrap">
        <div class="msg-meta">
          <span class="msg-author">${escapeHtml(msg.username)}</span>
          <span class="msg-time">${formattedTime}</span>
        </div>
        <div class="msg-bubble ${blurredClass}">
          ${replyHtml}
          <span class="msg-text">${escapeHtml(msg.content)}</span>
        </div>
      </div>
    `;

    const bubble = card.querySelector('.msg-bubble');
    if (msg.is_blurred) {
      bubble.addEventListener('click', () => {
        bubble.classList.toggle('unmasked');
      });
    }

    card.addEventListener('contextmenu', (e) => {
      showContextMenu(e, msg.id);
    });

    messagesFeed.appendChild(card);
  };

  const scrollToBottom = () => {
    messagesFeed.scrollTop = messagesFeed.scrollHeight;
  };

  // Quoted Reply State
  const setReplyState = (replyObj) => {
    activeReply = replyObj;
    if (activeReply) {
      replyUserLabel.textContent = `@${activeReply.username}`;
      replyTextSnippet.textContent = activeReply.text;
      replyPreviewBar.classList.remove('hidden');
    } else {
      replyPreviewBar.classList.add('hidden');
    }
  };

  if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', () => setReplyState(null));

  // Privacy Blur Toggle
  if (privacyBlurBtn) {
    privacyBlurBtn.addEventListener('click', () => {
      isPrivacyBlurActive = !isPrivacyBlurActive;
      privacyBlurBtn.classList.toggle('active', isPrivacyBlurActive);
      privacyBlurBtn.querySelector('.pill-label').textContent = isPrivacyBlurActive ? 'Blur On' : 'Blur Off';
    });
  }

  // WebSocket Connection Lifecycle
  const connectWebSocket = () => {
    if (!authToken) return;
    if (ws) ws.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${authToken}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('⚡ WebSocket Connected cleanly');
      clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketEvent(data);
      } catch (e) {
        console.error('WS Payload Parse Error:', e);
      }
    };

    ws.onclose = () => {
      console.warn('WebSocket Disconnected. Reconnecting in 3s...');
      setTimeout(() => {
        if (authToken) connectWebSocket();
      }, 3000);
    };
  };

  const handleWebSocketEvent = (data) => {
    if (data.type === 'auth_success') {
      updateOnlineUsers(data.onlineUsers || []);
    } else if (data.type === 'presence') {
      updateOnlineUsers(data.onlineUsers || []);
    } else if (data.type === 'new_message') {
      const currentUserId = currentUser ? currentUser.id : 0;
      const isForCurrentRoom = activeRecipient 
        ? ((Number(data.user_id) === Number(activeRecipient.id) && Number(data.recipient_id) === Number(currentUserId)) ||
           (Number(data.user_id) === Number(currentUserId) && Number(data.recipient_id) === Number(activeRecipient.id)))
        : (!data.recipient_id);

      if (isForCurrentRoom) {
        appendMessageCard(data);
        scrollToBottom();
        if (Number(data.user_id) !== Number(currentUserId)) playSound('receive');
      } else if (data.recipient_id && Number(data.recipient_id) === Number(currentUserId)) {
        unreadCounts[data.user_id] = (unreadCounts[data.user_id] || 0) + 1;
        playSound('receive');
      }
    } else if (data.type === 'typing') {
      handleTypingEvent(data);
    } else if (data.type === 'delete_message') {
      const card = document.querySelector(`.message-card[data-msg-id="${data.messageId}"]`);
      if (card) card.remove();
    }
  };

  const updateOnlineUsers = (users = []) => {
    if (!onlineUsersList) return;
    const currentUserId = currentUser ? currentUser.id : 0;
    const otherUsers = users.filter(u => Number(u.id) !== Number(currentUserId));
    if (onlineCountBadge) onlineCountBadge.textContent = otherUsers.length;
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

  // Auth Handler Forms
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showAlert('Please enter both username/email and password.', 'error');
      return;
    }

    try {
      if (loginBtn) {
        loginBtn.disabled = true;
        const txt = loginBtn.querySelector('.btn-text');
        if (txt) txt.textContent = 'Authenticating...';
      }

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      authToken = data.token;
      currentUser = data.user;

      localStorage.setItem('schat_token', authToken);
      localStorage.setItem('schat_user', JSON.stringify(currentUser));

      initializeChatSession();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        const txt = loginBtn.querySelector('.btn-text');
        if (txt) txt.textContent = 'Sign In';
      }
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const registerBtn = document.getElementById('registerBtn');
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!username || !email || !password) {
      showAlert('Please fill in all required fields.', 'error');
      return;
    }

    try {
      if (registerBtn) {
        registerBtn.disabled = true;
        const txt = registerBtn.querySelector('.btn-text');
        if (txt) txt.textContent = 'Creating Account...';
      }

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

      initializeChatSession();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      if (registerBtn) {
        registerBtn.disabled = false;
        const txt = registerBtn.querySelector('.btn-text');
        if (txt) txt.textContent = 'Register & Join';
      }
    }
  });

  const initializeChatSession = () => {
    if (!currentUser) return;
    if (myAvatarEl) myAvatarEl.textContent = currentUser.avatar || '⚡';
    if (myUsernameEl) myUsernameEl.textContent = currentUser.username;
    if (myBioEl) myBioEl.textContent = currentUser.bio || 'Click to edit bio...';

    authView.classList.add('hidden');
    chatView.classList.remove('hidden');

    connectWebSocket();
    fetchMessageHistory();
  };

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('schat_token');
      localStorage.removeItem('schat_user');
      authToken = null;
      currentUser = null;
      if (ws) ws.close();
      window.location.reload();
    });
  }

  // Send Message Logic
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showAlert('Connecting to server... Please try again.', 'error');
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
    if (emojiPicker) emojiPicker.classList.add('hidden');
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
    const currentUserId = currentUser ? currentUser.id : 0;
    const isRelevantTyping = activeRecipient 
      ? (Number(data.user_id) === Number(activeRecipient.id) && Number(data.recipient_id) === Number(currentUserId))
      : (!data.recipient_id && Number(data.user_id) !== Number(currentUserId));

    if (isRelevantTyping && data.isTyping) {
      typingText.textContent = `${data.username} is typing...`;
      typingBanner.classList.remove('hidden');
    } else {
      typingBanner.classList.add('hidden');
    }
  };

  if (emojiBtn) {
    emojiBtn.addEventListener('click', () => {
      emojiPicker.classList.toggle('hidden');
    });
  }

  if (emojiPicker) {
    emojiPicker.addEventListener('click', (e) => {
      if (e.target.classList.contains('emoji-item')) {
        messageInput.value += e.target.textContent;
        messageInput.focus();
      }
    });
  }

  if (filterInput) {
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
  }

  if (authToken && currentUser) {
    initializeChatSession();
  }
});

function togglePasswordVisibility(fieldId, btn) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}
