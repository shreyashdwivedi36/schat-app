const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const webpush = require('web-push');

if (true) {
  webpush.setVapidDetails(
    'mailto:shreyashdwivedi1626@gmail.com',
    process.env.PUBLIC_VAPID_KEY || 'BFM7IVc9SVb-cpG8ZrsOc8CaMCNSee-uAsdaEoaJrdjK-_VzOglSKANVq82DZVpwg2PrqNdmvVxiXIW9MWmVZFk',
    process.env.PRIVATE_VAPID_KEY || 'UdMu8RhJSTY6MdNckm591DXQwWio4m5VkoaRwcEJQRY'
  );
} else {
  console.warn('VAPID keys not configured. Web Push API will not work.');
}
const { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware, superAdminMiddleware } = require('./auth');

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || 'admin';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'godmode123';

const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// CORS Policy Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Renewed-Token']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));


const https = require('https');

// Real-Time Translation Engine Helper
function translateText(text, targetLang = 'en', sourceLang = 'auto') {
  if (!text || typeof text !== 'string') return Promise.resolve({ translatedText: text, targetLang });

  const encodedText = encodeURIComponent(text.trim().slice(0, 1500));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && Array.isArray(parsed[0])) {
            const translatedText = parsed[0].map(item => item[0]).filter(Boolean).join('');
            const detectedSourceLang = parsed[2] || sourceLang;
            resolve({
              translatedText: translatedText || text,
              detectedSourceLang,
              targetLang
            });
          } else {
            resolve({ translatedText: text, targetLang });
          }
        } catch (e) {
          resolve({ translatedText: text, targetLang });
        }
      });
    });

    req.on('error', () => resolve({ translatedText: text, targetLang }));
    req.on('timeout', () => { req.destroy(); resolve({ translatedText: text, targetLang }); });
  });
}

// Input Sanitization & Validation Helpers
function sanitizeString(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function isValidTimerValue(seconds) {
  const allowedTimers = [0, 10, 60, 300, 3600];
  return allowedTimers.includes(Number(seconds));
}

// REST Endpoints

// Register User
app.post('/api/register', async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 50);
    const email = sanitizeString(req.body.email, 255);
    const password = req.body.password;
    const avatar = sanitizeString(req.body.avatar, 10) || '⚡';
    const bio = sanitizeString(req.body.bio, 255) || 'Hey there! I am using SChat.';

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
      return res.status(400).json({ error: 'This username is reserved.' });
    }

    const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const hashedPassword = hashPassword(password);

    const result = await db.run(
      'INSERT INTO users (username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, avatar, bio]
    );

    const newUser = {
      id: result.id,
      username,
      email,
      avatar,
      bio
    };

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login User
app.post('/api/login', async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 255);
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Super Admin God Mode Intercept
    if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
      const adminData = {
        id: 0,
        username: 'Admin',
        email: 'admin@schat.local',
        avatar: '🛡️',
        bio: 'I am the Architect.',
        role: 'super_admin'
      };
      const token = generateToken(adminData);
      return res.json({
        message: 'God Mode Activated',
        token,
        user: adminData
      });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const isMatch = comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '⚡',
      bio: user.bio || 'Hey there! I am using SChat.'
    };

    const token = generateToken(userData);

    res.json({
      message: 'Login successful!',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Get Current Profile
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, email, avatar, bio, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get all users (for persistent sidebar)
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, avatar, bio, created_at FROM users WHERE id != ? ORDER BY username ASC', [req.user.id]);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

// Get users we have conversed with
app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const msgs = await db.all('SELECT user_id, recipient_id FROM messages WHERE user_id = ? OR recipient_id = ?', [req.user.id, req.user.id]);
    const ids = new Set();
    msgs.forEach(m => {
      if (m.user_id && m.user_id !== req.user.id) ids.add(m.user_id);
      if (m.recipient_id && m.recipient_id !== req.user.id) ids.add(m.recipient_id);
    });
    res.json({ conversationUserIds: Array.from(ids) });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching conversations.' });
  }
});

// Change Password REST API
app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const newHashedPassword = hashPassword(newPassword);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [newHashedPassword, req.user.id]);

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ error: 'Internal server error while changing password.' });
  }
});

// Update Profile Settings
app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    const avatar = sanitizeString(req.body.avatar, 10);
    const bio = sanitizeString(req.body.bio, 255);

    await db.run('UPDATE users SET avatar = ?, bio = ? WHERE id = ?', [avatar || '⚡', bio || 'Hey there!', req.user.id]);

    res.json({ message: 'Profile updated successfully!', avatar, bio });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Block User REST API
app.post('/api/users/block', authMiddleware, async (req, res) => {
  try {
    const targetId = parseInt(req.body.blocked_id, 10);
    if (isNaN(targetId) || targetId === req.user.id) {
      return res.status(400).json({ error: 'Invalid user to block.' });
    }
    await db.run('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', [req.user.id, targetId]);
    res.json({ message: 'User blocked successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

// Unblock User REST API
app.post('/api/users/unblock', authMiddleware, async (req, res) => {
  try {
    const targetId = parseInt(req.body.blocked_id, 10);
    await db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, targetId]);
    res.json({ message: 'User unblocked successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock user.' });
  }
});

// Get Chat Messages (Global or Private 1-on-1 DM)
app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    const recipientId = req.query.recipient_id ? parseInt(req.query.recipient_id, 10) : null;

    if (recipientId) {
      const messages = await db.all(
        'SELECT id, user_id, recipient_id, username, avatar, content, is_blurred, is_edited, is_pinned, reactions, expires_at, status, reply_to_id, reply_to_user, reply_to_text, created_at FROM messages WHERE ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?)) AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) ORDER BY id ASC LIMIT 100',
        [req.user.id, recipientId, recipientId, req.user.id]
      );
      return res.json({ messages });
    } else {
      const messages = await db.all(
        'SELECT id, user_id, recipient_id, username, avatar, content, is_blurred, is_edited, is_pinned, reactions, expires_at, status, reply_to_id, reply_to_user, reply_to_text, created_at FROM messages WHERE recipient_id IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) ORDER BY id ASC LIMIT 100'
      );
      return res.json({ messages });
    }
  } catch (err) {
    console.error('Fetch Messages Error:', err);
    res.status(500).json({ error: 'Failed to retrieve message history.' });
  }
});

// Real-Time Multi-Language Translation REST API

// --- WEB PUSH API ---

// --- SMART NOTIFICATIONS (MUTING) ---
app.get('/api/users/muted_chats', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT muted_chats FROM users WHERE id = ?', [req.user.id]);
    res.json({ muted_chats: JSON.parse(user?.muted_chats || '[]') });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/mute', authMiddleware, async (req, res) => {
  const { targetId, isMuted } = req.body;
  if (!targetId) return res.status(400).json({ error: 'Target ID required' });

  try {
    const user = await db.get('SELECT muted_chats FROM users WHERE id = ?', [req.user.id]);
    let muted = JSON.parse(user?.muted_chats || '[]');
    
    // Ensure targetId is stored consistently (as string for 'global', or int/string for user ID)
    const targetStr = targetId.toString();

    if (isMuted) {
      if (!muted.includes(targetStr)) muted.push(targetStr);
    } else {
      muted = muted.filter(id => id.toString() !== targetStr);
    }

    await db.run('UPDATE users SET muted_chats = ? WHERE id = ?', [JSON.stringify(muted), req.user.id]);
    res.json({ message: 'Mute settings updated', muted_chats: muted });
  } catch (err) {
    console.error('Mute API error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

  app.post('/api/messages/mark-delivered', async (req, res) => {
    try {
      const { message_id } = req.body;
      const msg = await db.get('SELECT * FROM messages WHERE id = ?', [message_id]);
      if (msg && msg.status === 'sent') {
        await db.run('UPDATE messages SET status = ? WHERE id = ?', ['delivered', message_id]);
        broadcast({ type: 'msg_status_update', recipient_id: msg.user_id, status: 'delivered' });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Database error.' });
    }
  });

  app.get('/api/debug/push-status/:username', async (req, res) => {
    try {
      const user = await db.get('SELECT push_subscription FROM users WHERE username = ?', [req.params.username]);
      if (!user) return res.json({ error: 'User not found' });
      res.json({ subscribed: !!user.push_subscription });
    } catch (err) {
      res.status(500).json({ error: 'Database error.' });
    }
  });

app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }
  
  try {
    await db.run('UPDATE users SET push_subscription = ? WHERE id = ?', [JSON.stringify(subscription), req.user.id]);
    res.status(201).json({ message: 'Push subscription saved.' });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/translate', authMiddleware, async (req, res) => {
  try {
    const text = req.body.text;
    const targetLang = sanitizeString(req.body.targetLang, 10) || 'en';
    const sourceLang = sanitizeString(req.body.sourceLang, 10) || 'auto';

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text to translate is required.' });
    }

    const result = await translateText(text, targetLang, sourceLang);
    res.json(result);
  } catch (err) {
    console.error('Translation Endpoint Error:', err);
    res.status(500).json({ error: 'Failed to translate message.' });
  }
});

// Search Chat Messages
app.get('/api/messages/search', authMiddleware, async (req, res) => {
  try {
    const query = sanitizeString(req.query.q, 100);
    if (!query) return res.json({ messages: [] });

    const messages = await db.all(
      'SELECT id, user_id, recipient_id, username, avatar, content, is_blurred, is_edited, is_pinned, created_at FROM messages WHERE content LIKE ? ORDER BY id DESC LIMIT 30',
      [`%${query}%`]
    );
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search messages.' });
  }
});

// Edit Message REST API
app.put('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const newContent = sanitizeString(req.body.content, 2000);

    if (!newContent) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msg || msg.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own messages.' });
    }

    await db.run('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND user_id = ?', [newContent, messageId, req.user.id]);

    broadcast({
      type: 'edit_message',
      messageId: messageId,
      newContent: newContent
    });

    res.json({ message: 'Message updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message.' });
  }
});


// Helper function for message deletion and pinned banner synchronization
async function handleMessageDeletion(msg, messageId) {
  await db.run('DELETE FROM messages WHERE id = ?', [messageId]);

  broadcast({
    type: 'delete_message',
    messageId: messageId
  });

  if (msg && msg.is_pinned === 1) {
    try {
      let nextPinned;
      if (msg.recipient_id) {
        nextPinned = await db.get(
          'SELECT id, content FROM messages WHERE ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?)) AND is_pinned = 1 ORDER BY id DESC LIMIT 1',
          [msg.user_id, msg.recipient_id, msg.recipient_id, msg.user_id]
        );
      } else {
        nextPinned = await db.get(
          'SELECT id, content FROM messages WHERE recipient_id IS NULL AND channel = ? AND is_pinned = 1 ORDER BY id DESC LIMIT 1',
          [msg.channel || 'global']
        );
      }

      if (nextPinned) {
        broadcast({
          type: 'update_pinned',
          messageId: nextPinned.id,
          is_pinned: 1,
          content: nextPinned.content
        });
      } else {
        broadcast({
          type: 'update_pinned',
          messageId: messageId,
          is_pinned: 0
        });
      }
    } catch (e) {
      console.error('Error syncing pinned message deletion:', e);
    }
  }
}

// Delete Message REST API
app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID.' });
    }

    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);

    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (msg.user_id !== req.user.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own messages.' });
    }

    await handleMessageDeletion(msg, messageId);

    res.json({ message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('Delete Message Error:', err);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// ==========================================
// SUPER ADMIN GOD MODE ROUTES
// ==========================================

app.get('/api/admin/users', superAdminMiddleware, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, email, avatar, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/admin/users/:id', superAdminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    // Delete user's messages first to maintain integrity
    await db.run('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [userId, userId]);
    // Delete user
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    
    // Broadcast to force client logout if online
    broadcast({ type: 'user_banned', userId });
    
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/admin/announce', superAdminMiddleware, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  // Broadcast system message to all connected clients
  broadcast({
    type: 'global_announcement',
    message: message,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Announcement sent' });
});

// WebSocket Implementation
const wss = new WebSocket.Server({ server });

const clients = new Map();

function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const [client, user] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(payload);
    }
  }
}

function sendToUser(userId, data) {
  const payload = JSON.stringify(data);
  for (const [client, user] of clients.entries()) {
    if (user && user.id === userId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function isUserOnline(userId) {
  for (const user of clients.values()) {
    if (user && Number(user.id) === Number(userId)) return true;
  }
  return false;
}

function isUserActive(userId) {
  for (const [client, user] of clients.entries()) {
    if (user && user.id === userId) {
      if (client.clientVisibility !== 'background') return true;
    }
  }
  return false;
}

function getOnlineUsersList() {
  const uniqueUsers = new Map();
  for (const user of clients.values()) {
    if (user && user.id) {
      uniqueUsers.set(user.id, {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio || 'Hey there! I am using SChat.'
      });
    }
  }
  return Array.from(uniqueUsers.values());
}

// Background cleanup timer for self-destructing messages
setInterval(async () => {
  try {
    const expired = await db.all('SELECT id FROM messages WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP');
    if (expired && expired.length > 0) {
      for (const m of expired) {
        await db.run('DELETE FROM messages WHERE id = ?', [m.id]);
        broadcast({
          type: 'delete_message',
          messageId: m.id
        });
      }
    }
  } catch (e) {}
}, 4000);

wss.on('connection', (ws, req) => {
  let currentUser = null;

  const urlParams = new URLSearchParams(req.url.replace(/^.*\?/, ''));
  const urlToken = urlParams.get('token');
  if (urlToken) {
    const decoded = verifyToken(urlToken);
    if (decoded) {
      currentUser = decoded;
      clients.set(ws, currentUser);

      const renewedWsToken = generateToken(currentUser);
      ws.send(JSON.stringify({
        type: 'auth_success',
        user: currentUser,
        token: renewedWsToken,
        onlineUsers: getOnlineUsersList()
      }));

      broadcast({
        type: 'presence',
        action: 'join',
        username: currentUser.username,
        avatar: currentUser.avatar,
        onlineUsers: getOnlineUsersList()
      });
      db.run('UPDATE messages SET status = ? WHERE recipient_id = ? AND status = ?', ['delivered', currentUser.id, 'sent']).then(() => {
        broadcast({ type: 'msg_status_update', recipient_id: currentUser.id, status: 'delivered' });
      }).catch(() => {});
    } else {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Token expired or invalid.' }));
    }
  }

  ws.on('message', async (messageBuffer) => {
    try {
      const data = JSON.parse(messageBuffer.toString());

      if (data.type === 'ping') {
        return ws.send(JSON.stringify({ type: 'pong' }));
      }

      if (data.type === 'visibility') {
        ws.clientVisibility = data.status;
        return;
      }
      if (data.type === 'auth') {
        const decoded = verifyToken(data.token);
        if (!decoded) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication failed.' }));
          return ws.close();
        }

        currentUser = decoded;
        clients.set(ws, currentUser);

        ws.send(JSON.stringify({
          type: 'auth_success',
          user: currentUser,
          onlineUsers: getOnlineUsersList()
        }));

        broadcast({
          type: 'presence',
          action: 'join',
          username: currentUser.username,
          avatar: currentUser.avatar,
          onlineUsers: getOnlineUsersList()
        });
        
        // Mark pending messages as delivered
        await db.run('UPDATE messages SET status = ? WHERE recipient_id = ? AND status = ?', ['delivered', currentUser.id, 'sent']);
        broadcast({ type: 'msg_status_update', recipient_id: currentUser.id, status: 'delivered' });
        return;
      }

      if (!currentUser) {
        return ws.send(JSON.stringify({ type: 'auth_error', message: 'Unauthorized WebSocket message.' }));
      }

      if (data.type === 'chat_message') {
        const content = sanitizeString(data.content, 2000);
        if (!content) return;

        const recipientId = (data.recipient_id && !isNaN(data.recipient_id)) ? parseInt(data.recipient_id, 10) : null;
        const channel = sanitizeString(data.channel, 50) || 'global';
        const isBlurred = data.is_blurred ? 1 : 0;
        const timerSeconds = isValidTimerValue(data.timer_seconds) ? parseInt(data.timer_seconds, 10) : 0;
        const replyToId = (data.reply_to_id && !isNaN(data.reply_to_id)) ? parseInt(data.reply_to_id, 10) : null;
        const replyToUser = sanitizeString(data.reply_to_user, 50) || null;
        const replyToText = sanitizeString(data.reply_to_text, 200) || null;

        let expiresAtIso = null;
        if (timerSeconds > 0) {
          expiresAtIso = new Date(Date.now() + timerSeconds * 1000).toISOString();
        }

        const initialStatus = (recipientId && isUserOnline(recipientId)) ? 'delivered' : 'sent';
        let insertedId = Date.now();

        try {
          const result = await db.run(
            'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content, is_blurred, expires_at, status, reply_to_id, reply_to_user, reply_to_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [currentUser.id, recipientId, channel, currentUser.username, currentUser.avatar || '⚡', content, isBlurred, expiresAtIso, initialStatus, replyToId, replyToUser, replyToText]
          );
          if (result && result.id) insertedId = result.id;
        } catch (dbErr) {
          console.error('Database write warning:', dbErr.message);
        }

        const msgPayload = {
          type: 'new_message',
          id: insertedId,
          user_id: currentUser.id,
          recipient_id: recipientId,
          channel: channel,
          username: currentUser.username,
          avatar: currentUser.avatar || '⚡',
          content,
          is_blurred: isBlurred,
          is_edited: 0,
          is_pinned: 0,
          reactions: '{}',
          expires_at: expiresAtIso,
          status: initialStatus,
          reply_to_id: replyToId,
          reply_to_user: replyToUser,
          reply_to_text: replyToText,
          created_at: new Date().toISOString()
        };

        if (recipientId) {
          sendToUser(recipientId, msgPayload);
          if (recipientId !== currentUser.id) {
            sendToUser(currentUser.id, msgPayload);
          }
          
          // Always attempt Web Push. The client's Service Worker will drop it if they are actively focused on the app.
          try {
            const recipient = await db.get('SELECT push_subscription, muted_chats FROM users WHERE id = ?', [Number(recipientId)]);
              if (recipient && recipient.push_subscription) {
                const mutedChats = JSON.parse(recipient.muted_chats || '[]');
                const senderStr = currentUser.id.toString();
                if (!mutedChats.includes(senderStr)) {
                const subscription = JSON.parse(recipient.push_subscription);
                const payload = JSON.stringify({
                  message_id: insertedId,
                  title: `New message from ${currentUser.username}`,
                  body: content.startsWith('data:audio') ? '🎤 Voice Message' : (isBlurred ? '[Hidden Message]' : content),
                  icon: currentUser.avatar || '/logo.png',
                  url: '/'
                });
                webpush.sendNotification(subscription, payload, { urgency: 'high', TTL: 86400 }).catch(err => {
                  global.pushLogs = global.pushLogs || [];
                  global.pushLogs.push({ status: 'error', user: recipientId, err: err.message, code: err.statusCode, body: err.body, time: new Date() });
                  if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired or invalid, remove it
                    db.run('UPDATE users SET push_subscription = NULL WHERE id = ?', [recipientId]);
                  } else {
                    console.error('Push notification error:', err);
                  }
                });
                }
              }
            } catch (err) {
              console.error('Error checking push subscription:', err);
          }
        } else {
          broadcast(msgPayload);
          
          if (initialStatus === 'sent' || !isUserActive(recipientId)) {
            try {
              const allUsers = await db.all('SELECT id, push_subscription, muted_chats FROM users WHERE push_subscription IS NOT NULL');
              const payload = JSON.stringify({
                message_id: insertedId,
                title: `Global Chat: ${currentUser.username}`,
                body: content.startsWith('data:audio') ? '🎤 Voice Message' : (isBlurred ? '[Hidden Message]' : content),
                icon: currentUser.avatar || '/logo.png',
                url: '/'
              });
              
              allUsers.forEach(user => {
                if (user.id === currentUser.id) return;

                
                const mutedChats = JSON.parse(user.muted_chats || '[]');
                if (!mutedChats.includes('global') && !mutedChats.includes(currentUser.id.toString())) {
                  const subscription = JSON.parse(user.push_subscription);
                  webpush.sendNotification(subscription, payload, { urgency: 'high', TTL: 86400 }).catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                      db.run('UPDATE users SET push_subscription = NULL WHERE id = ?', [user.id]);
                    }
                  });
                }
              });
            } catch (err) {
              console.error('Error sending global push:', err);
            }
          }
        }
      } else if (data.type === 'toggle_reaction') {
        const messageId = parseInt(data.messageId, 10);
        const emoji = sanitizeString(data.emoji, 10);

        if (isNaN(messageId) || !emoji) return;

        const msg = await db.get('SELECT reactions FROM messages WHERE id = ?', [messageId]);
        if (msg) {
          let rx = {};
          try { rx = JSON.parse(msg.reactions || '{}'); } catch(e){}
          if (!rx[emoji]) rx[emoji] = [];
          
          if (rx[emoji].includes(currentUser.username)) {
            rx[emoji] = rx[emoji].filter(u => u !== currentUser.username);
            if (rx[emoji].length === 0) delete rx[emoji];
          } else {
            rx[emoji].push(currentUser.username);
          }

          const rxJson = JSON.stringify(rx);
          await db.run('UPDATE messages SET reactions = ? WHERE id = ?', [rxJson, messageId]);

          broadcast({
            type: 'update_reactions',
            messageId: messageId,
            reactions: rx
          });
        }
      } else if (data.type === 'edit_message') {
        const messageId = parseInt(data.messageId, 10);
        const newContent = sanitizeString(data.newContent, 2000);

        if (!isNaN(messageId) && newContent) {
          const msg = await db.get('SELECT user_id FROM messages WHERE id = ?', [messageId]);
          if (msg && msg.user_id === currentUser.id) {
            await db.run('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND user_id = ?', [newContent, messageId, currentUser.id]);
            broadcast({
              type: 'edit_message',
              messageId: messageId,
              newContent: newContent
            });
          }
        }
      } else if (data.type === 'toggle_pin') {
        const messageId = parseInt(data.messageId, 10);
        if (!isNaN(messageId)) {
          const msg = await db.get('SELECT user_id, is_pinned FROM messages WHERE id = ?', [messageId]);
          if (msg) {
            if (msg.user_id !== currentUser.id) {
              ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: Only the message sender can pin or unpin this message.' }));
              return;
            }
            const newPinState = msg.is_pinned ? 0 : 1;
            await db.run('UPDATE messages SET is_pinned = ? WHERE id = ?', [newPinState, messageId]);
            broadcast({
              type: 'update_pinned',
              messageId: messageId,
              is_pinned: newPinState
            });
          }
        }
      } else if (data.type === 'mark_read') {
        const senderId = (data.sender_id && !isNaN(data.sender_id)) ? parseInt(data.sender_id, 10) : null;
        try {
          if (senderId) {
            await db.run('UPDATE messages SET status = ? WHERE user_id = ? AND recipient_id = ? AND status != ?', ['read', senderId, currentUser.id, 'read']);
            sendToUser(senderId, {
              type: 'msg_status_update',
              status: 'read',
              sender_id: senderId,
              recipient_id: currentUser.id
            });
          }
        } catch (e) {}
      } else if (data.type === 'delete_message') {
        const messageId = parseInt(data.messageId, 10);
        if (isNaN(messageId)) return;

        try {
          const msg = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);
          if (msg && (msg.user_id === currentUser.id || currentUser.role === 'super_admin')) {
            await handleMessageDeletion(msg, messageId);
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Forbidden: You can only delete your own messages.' }));
          }
        } catch (e) {
          console.error('WS Delete Authorization Error:', e);
        }
      } else if (data.type === 'typing') {
        const recipientId = (data.recipient_id && !isNaN(data.recipient_id)) ? parseInt(data.recipient_id, 10) : null;
        const typingPayload = {
          type: 'typing',
          user_id: currentUser.id,
          recipient_id: recipientId,
          username: currentUser.username,
          isTyping: !!data.isTyping
        };

        if (recipientId) {
          sendToUser(recipientId, typingPayload);
        } else {
          broadcast(typingPayload, ws);
        }
      }
    } catch (err) {
      console.error('WS Message Handler Error:', err);
    }
  });

  ws.onclose = () => {
    if (currentUser) {
      clients.delete(ws);
      broadcast({
        type: 'presence',
        action: 'leave',
        username: currentUser.username,
        onlineUsers: getOnlineUsersList()
      });
    }
  };
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 SChat Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSockets active on ws://localhost:${PORT}`);
  console.log(`================================================`);
});

app.get('/api/debug/push-logs', (req, res) => { res.json({ logs: global.pushLogs || [] }); });
