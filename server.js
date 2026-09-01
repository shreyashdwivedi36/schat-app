const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const webpush = require('web-push');

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@schat-live.onrender.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('⚠️ VAPID keys not configured in environment. Web Push notifications will be inactive.');
}

const { hashPassword, comparePassword, generateToken, verifyToken, verifyUserSession, authMiddleware, superAdminMiddleware } = require('./auth');

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

const WebSocket = require('ws');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// In-Memory Authentication Rate Limiter (Sliding Window: 15 attempts / 15 mins)
const loginAttemptMap = new Map();
function authRateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 15;

  let record = loginAttemptMap.get(ip);
  if (!record || (now - record.firstAttempt > windowMs)) {
    record = { count: 1, firstAttempt: now };
    loginAttemptMap.set(ip, record);
  } else {
    record.count += 1;
  }

  if (record.count > maxAttempts) {
    return res.status(429).json({ error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' });
  }
  next();
}

// CORS Policy Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Renewed-Token']
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

// Health Check Endpoint for Database & WebSocket Uptime Monitoring
app.get('/api/health', async (req, res) => {
  try {
    let dbStatus = 'disconnected';
    if (db) {
      await db.get('SELECT 1');
      dbStatus = 'connected';
    }
    res.json({
      status: 'ok',
      service: 'SChat Core Engine',
      database: dbStatus,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Health Check Database Ping Failure:', err);
    res.status(503).json({
      status: 'degraded',
      service: 'SChat Core Engine',
      database: 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }
});


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

function parseUserAgent(ua) {
  if (!ua) return { device: 'Web (Desktop)', browser: 'Browser' };
  let device = 'Desktop';
  if (/mobile/i.test(ua)) device = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

  let os = 'Device';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Web Browser';
  if (/edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { device: `${os} (${device})`, browser };
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
app.post('/api/register', authRateLimiter, async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 255);
    const email = sanitizeString(req.body.email, 255);
    const password = req.body.password;
    const avatar = sanitizeString(req.body.avatar, 500000) || '⚡';
    const bio = sanitizeString(req.body.bio, 500) || 'Hey there! I am using SChat.';

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (SUPER_ADMIN_USERNAME && username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
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

    const sessionId = crypto.randomUUID();
    const uaInfo = parseUserAgent(req.headers['user-agent'] || '');
    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');

    await db.run(
      'INSERT INTO user_sessions (session_id, user_id, device, browser, ip_address, last_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, result.id, uaInfo.device, uaInfo.browser, ip, new Date().toISOString()]
    );

    const token = generateToken(newUser, sessionId);

    res.status(201).json({
      message: 'Registration successful!',
      token,
      sessionId,
      user: newUser
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login User
app.post('/api/login', authRateLimiter, async (req, res) => {
  try {
    const username = sanitizeString(req.body.username, 255);
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Super Admin Authentication
    if (SUPER_ADMIN_USERNAME && SUPER_ADMIN_PASSWORD && 
        username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase() && 
        password === SUPER_ADMIN_PASSWORD) {
      
      let adminRow = null;
      if (db) {
        adminRow = await db.get('SELECT id, username, email, avatar, bio, is_banned FROM users WHERE username = ?', [SUPER_ADMIN_USERNAME]);
        if (!adminRow) {
          const hashed = hashPassword(SUPER_ADMIN_PASSWORD);
          const ins = await db.run(
            'INSERT INTO users (username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?)',
            [SUPER_ADMIN_USERNAME, 'admin@schat.local', hashed, '🛡️', 'Platform Administrator']
          );
          adminRow = {
            id: ins.id,
            username: SUPER_ADMIN_USERNAME,
            email: 'admin@schat.local',
            avatar: '🛡️',
            bio: 'Platform Administrator'
          };
        }
      }

      const adminId = adminRow ? adminRow.id : 1;
      const adminData = {
        id: adminId,
        username: SUPER_ADMIN_USERNAME,
        email: adminRow?.email || 'admin@schat.local',
        avatar: adminRow?.avatar || '🛡️',
        bio: adminRow?.bio || 'Platform Administrator',
        role: 'super_admin'
      };

      const adminSessionId = crypto.randomUUID();
      const uaInfo = parseUserAgent(req.headers['user-agent'] || '');
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

      if (db) {
        await db.run(
          'INSERT INTO user_sessions (session_id, user_id, device, browser, ip_address, last_active) VALUES (?, ?, ?, ?, ?, ?)',
          [adminSessionId, adminId, uaInfo.device, uaInfo.browser, ip, new Date().toISOString()]
        );
      }

      const token = generateToken(adminData, adminSessionId);
      return res.json({
        message: 'Admin authentication successful.',
        token,
        sessionId: adminSessionId,
        user: adminData
      });
    }

    const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'This account has been suspended or banned.' });
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

    const sessionId = crypto.randomUUID();
    const uaInfo = parseUserAgent(req.headers['user-agent'] || '');
    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');

    await db.run(
      'INSERT INTO user_sessions (session_id, user_id, device, browser, ip_address, last_active) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, user.id, uaInfo.device, uaInfo.browser, ip, new Date().toISOString()]
    );

    const token = generateToken(userData, sessionId);

    res.json({
      message: 'Login successful!',
      token,
      sessionId,
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
app.get('/api/media/check/:hash', authMiddleware, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB not connected' });
  try {
    const hash = req.params.hash;
    const result = await db.get('SELECT url FROM media_hashes WHERE hash = ?', [hash]);
    if (result && result.url) {
      return res.json({ url: result.url });
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

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

// Update Profile Avatar (Accepts Cloudinary URLs & WebP Data URLs up to 200KB)
app.post('/api/profile/avatar', authMiddleware, async (req, res) => {
  try {
    const avatar = sanitizeString(req.body.avatar, 500000);
    if (!avatar) return res.status(400).json({ error: 'Avatar is required.' });
    
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.id]);
    res.json({ success: true, avatar, message: 'Profile photo updated successfully!' });
  } catch (err) {
    console.error('Update avatar error:', err);
    res.status(500).json({ error: 'Failed to update profile photo.' });
  }
});

app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    const avatar = sanitizeString(req.body.avatar, 500000);
    const bio = sanitizeString(req.body.bio, 255);

    await db.run('UPDATE users SET avatar = ?, bio = ? WHERE id = ?', [avatar || '/avatars/cosmic-astronaut.svg', bio || 'Hey there!', req.user.id]);

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
    const alreadyBlocked = await db.get('SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, targetId]);
    if (alreadyBlocked) {
      return res.status(409).json({ error: 'User is already blocked.' });
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

  

// Return dynamic VAPID public key to client
app.get('/api/push/vapid-public-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notification service is not configured in environment.' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register device push subscription
app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  try {
    const keys = subscription.keys || {};
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    await db.run(`
      INSERT INTO device_tokens (user_id, endpoint, p256dh, auth, user_agent, last_active)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (endpoint) DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        last_active = CURRENT_TIMESTAMP
    `, [req.user.id, subscription.endpoint, keys.p256dh || null, keys.auth || null, userAgent]);

    res.json({ message: 'Device token registered successfully', success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Acknowledge message delivery via authenticated REST fallback
app.post('/api/messages/mark-delivered', authMiddleware, async (req, res) => {
  try {
    const { message_id } = req.body;
    if (!message_id) return res.status(400).json({ error: 'Message ID required.' });
    const msg = await db.get('SELECT id, user_id, recipient_id, status FROM messages WHERE id = ?', [message_id]);
    if (msg && Number(msg.recipient_id) === Number(req.user.id) && msg.status === 'sent') {
      await db.run('UPDATE messages SET status = ? WHERE id = ?', ['delivered', message_id]);
      sendToUser(msg.user_id, { type: 'msg_status_update', message_ids: [message_id], status: 'delivered' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error.' });
  }
});

app.post('/api/push/unsubscribe', authMiddleware, async (req, res) => {
  const { endpoint } = req.body;
  try {
    if (endpoint) {
      await db.run('DELETE FROM device_tokens WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
    } else {
      await db.run('DELETE FROM device_tokens WHERE user_id = ?', [req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
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

// Search Chat Messages (Scoped to Global Chat and User's Private DMs)
app.get('/api/messages/search', authMiddleware, async (req, res) => {
  try {
    const query = sanitizeString(req.query.q, 100);
    if (!query) return res.json({ messages: [] });

    const messages = await db.all(
      'SELECT id, user_id, recipient_id, username, avatar, content, is_blurred, is_edited, is_pinned, created_at FROM messages WHERE content LIKE ? AND (recipient_id IS NULL OR user_id = ? OR recipient_id = ?) ORDER BY id DESC LIMIT 30',
      [`%${query}%`, req.user.id, req.user.id]
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



// Auto-seed past chat history into contacts table
(async () => {
  try {
    const pastConversations = await db.all('SELECT DISTINCT user_id, recipient_id FROM messages WHERE recipient_id IS NOT NULL');
    for (const conv of (pastConversations || [])) {
      const u1 = Math.min(Number(conv.user_id), Number(conv.recipient_id));
      const u2 = Math.max(Number(conv.user_id), Number(conv.recipient_id));
      if (u1 && u2 && u1 !== u2) {
        const existing = await db.get('SELECT id FROM contacts WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)', [u1, u2, u2, u1]);
        if (!existing) {
          await db.run('INSERT INTO contacts (requester_id, recipient_id, status) VALUES (?, ?, ?)', [u1, u2, 'accepted']);
        }
      }
    }
  } catch (e) {}
})();


// ==========================================
// UNIVERSAL MULTI-DEVICE SESSION TRACKER
// ==========================================
async function upsertUserSession(userId, sessionId, userAgentHeader, ipAddress) {
  if (!userId) return null;
  try {
    const userAgentInfo = parseUserAgent(userAgentHeader || '');
    const ip = (ipAddress || '127.0.0.1').split(',')[0].trim();
    // Device-specific unique deterministic session ID if not in JWT
    const sessId = sessionId || `sess_${userId}_${Buffer.from(userAgentInfo.device + userAgentInfo.browser).toString('hex').slice(0, 16)}`;

    const existing = await db.get('SELECT id FROM user_sessions WHERE user_id = ? AND session_id = ?', [userId, sessId]);
    if (existing) {
      await db.run('UPDATE user_sessions SET last_active = ?, ip_address = ?, device = ?, browser = ? WHERE id = ?', [new Date().toISOString(), ip, userAgentInfo.device, userAgentInfo.browser, existing.id]);
    } else {
      await db.run(
        'INSERT INTO user_sessions (session_id, user_id, device, browser, ip_address, last_active) VALUES (?, ?, ?, ?, ?, ?)',
        [sessId, userId, userAgentInfo.device, userAgentInfo.browser, ip, new Date().toISOString()]
      );
    }
    return sessId;
  } catch (e) {
    console.error('Session upsert error:', e);
    return null;
  }
}

// ==========================================
// ACTIVE SESSIONS & DEVICE MANAGEMENT API
// ==========================================


app.post('/api/sessions/heartbeat', authMiddleware, async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    await upsertUserSession(req.user.id, req.user.sessionId, req.headers['user-agent'], ip);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.get('/api/sessions', authMiddleware, async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const currentSessionId = await upsertUserSession(req.user.id, req.user.sessionId, req.headers['user-agent'], ip);

    const allRawSessions = await db.all('SELECT session_id, device, browser, ip_address, last_active, created_at FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC', [req.user.id]);
    
    // Deduplicate by session_id
    const seen = new Set();
    const uniqueSessions = [];
    (allRawSessions || []).forEach(s => {
      if (!seen.has(s.session_id)) {
        seen.add(s.session_id);
        uniqueSessions.push(s);
      }
    });

    const formatted = uniqueSessions.map(s => ({
      ...s,
      is_current: s.session_id === currentSessionId || s.session_id === req.user.sessionId
    }));

    if (!formatted.some(s => s.is_current) && formatted.length > 0) {
      formatted[0].is_current = true;
    }

    res.json({ sessions: formatted });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Failed to retrieve active sessions.' });
  }
});

app.delete('/api/sessions/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'Session ID required.' });
  if (sessionId === req.user.sessionId) {
    return res.status(400).json({ error: 'Cannot revoke your current active session here. Use Logout instead.' });
  }

  try {
    await db.run('DELETE FROM user_sessions WHERE session_id = ? AND user_id = ?', [sessionId, req.user.id]);
    // Force disconnect revoked session via WebSocket
    broadcast({ type: 'session_revoked', sessionId, userId: req.user.id });
    res.json({ message: 'Session revoked successfully.' });
  } catch (err) {
    console.error('Revoke session error:', err);
    res.status(500).json({ error: 'Failed to revoke session.' });
  }
});

app.delete('/api/sessions', authMiddleware, async (req, res) => {
  const currentSessionId = req.user.sessionId;
  if (!currentSessionId) return res.status(400).json({ error: 'Current session identifier missing.' });

  try {
    await db.run('DELETE FROM user_sessions WHERE user_id = ? AND session_id != ?', [req.user.id, currentSessionId]);
    broadcast({ type: 'all_other_sessions_terminated', userId: req.user.id, keepSessionId: currentSessionId });
    res.json({ message: 'All other sessions have been logged out.' });
  } catch (err) {
    console.error('Revoke all sessions error:', err);
    res.status(500).json({ error: 'Failed to revoke other sessions.' });
  }
});


// ==========================================
// PRIVACY CONTACTS & CHAT REQUESTS API
// ==========================================

app.get('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const allUsers = await db.all('SELECT id, username, email, avatar, bio, is_banned FROM users WHERE id != ?', [req.user.id]);
    const userMap = {};
    (allUsers || []).forEach(u => { userMap[u.id] = u; });

    const allContacts = await db.all('SELECT requester_id, recipient_id, status, created_at FROM contacts WHERE requester_id = ? OR recipient_id = ?', [req.user.id, req.user.id]);

    const accepted = [];
    const incomingPending = [];
    const outgoingPending = [];

    (allContacts || []).forEach(c => {
      if (c.status === 'accepted') {
        const partnerId = Number(c.requester_id) === Number(req.user.id) ? c.recipient_id : c.requester_id;
        if (userMap[partnerId]) {
          accepted.push({
            ...userMap[partnerId],
            connected_at: c.created_at
          });
        }
      } else if (c.status === 'pending') {
        if (Number(c.recipient_id) === Number(req.user.id)) {
          if (userMap[c.requester_id]) {
            incomingPending.push({
              ...userMap[c.requester_id],
              request_date: c.created_at
            });
          }
        } else if (Number(c.requester_id) === Number(req.user.id)) {
          if (userMap[c.recipient_id]) {
            outgoingPending.push({
              ...userMap[c.recipient_id],
              request_date: c.created_at
            });
          }
        }
      }
    });

    res.json({
      accepted_contacts: accepted,
      incoming_requests: incomingPending,
      outgoing_requests: outgoingPending
    });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Failed to retrieve contacts.' });
  }
});

app.post('/api/contacts/request', authMiddleware, async (req, res) => {
  const { target_id, username } = req.body;
  try {
    let targetUser = null;
    if (target_id) {
      const parsedId = parseInt(target_id, 10);
      targetUser = await db.get('SELECT id, username, avatar FROM users WHERE id = ?', [parsedId]);
    } else if (username) {
      targetUser = await db.get('SELECT id, username, avatar FROM users WHERE username = ?', [username.trim()]);
    }

    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (Number(targetUser.id) === Number(req.user.id)) return res.status(400).json({ error: 'Cannot send a contact request to yourself.' });

    // Check existing contact relationship
    const existing = await db.get(
      'SELECT id, requester_id, recipient_id, status FROM contacts WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)',
      [req.user.id, targetUser.id, targetUser.id, req.user.id]
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: 'You are already contacts with @' + targetUser.username });
      }
      if (existing.status === 'pending') {
        if (Number(existing.requester_id) === Number(req.user.id)) {
          return res.status(409).json({ error: 'Contact request already pending.' });
        } else {
          // If the other user already sent a request, auto-accept it!
          await db.run('UPDATE contacts SET status = ? WHERE id = ?', ['accepted', existing.id]);
          broadcast({
            type: 'contact_request_accepted',
            user1: req.user.id,
            user2: targetUser.id
          });
          return res.json({ message: 'Request accepted! You are now connected with @' + targetUser.username, status: 'accepted' });
        }
      }
    }

    await db.run('INSERT INTO contacts (requester_id, recipient_id, status) VALUES (?, ?, ?)', [req.user.id, targetUser.id, 'pending']);

    // Send real-time notification to recipient
    broadcast({
      type: 'contact_request_received',
      toUserId: targetUser.id,
      requester: {
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar
      }
    });

    res.json({ message: `Chat request sent to @${targetUser.username}!`, status: 'pending' });
  } catch (err) {
    console.error('Send contact request error:', err);
    res.status(500).json({ error: 'Failed to send contact request.' });
  }
});

app.post('/api/contacts/accept', authMiddleware, async (req, res) => {
  const { requester_id } = req.body;
  if (!requester_id) return res.status(400).json({ error: 'Requester ID required.' });

  try {
    const existingReq = await db.get(
      'SELECT id FROM contacts WHERE requester_id = ? AND recipient_id = ? AND status = ?',
      [requester_id, req.user.id, 'pending']
    );
    if (!existingReq) {
      return res.status(404).json({ error: 'No pending contact request found from this user.' });
    }

    await db.run('UPDATE contacts SET status = ? WHERE id = ?', ['accepted', existingReq.id]);
    
    broadcast({
      type: 'contact_request_accepted',
      user1: req.user.id,
      user2: requester_id
    });

    res.json({ message: 'Contact request accepted!' });
  } catch (err) {
    console.error('Accept contact error:', err);
    res.status(500).json({ error: 'Failed to accept contact request.' });
  }
});

app.post('/api/contacts/cancel', authMiddleware, async (req, res) => {
  const { target_id } = req.body;
  if (!target_id) return res.status(400).json({ error: 'Target ID required.' });
  const parsedTargetId = parseInt(target_id, 10);

  try {
    await db.run('DELETE FROM contacts WHERE requester_id = ? AND recipient_id = ? AND status = ?', [req.user.id, parsedTargetId, 'pending']);
    
    // Notify recipient to clear banner
    broadcast({
      type: 'contact_request_cancelled',
      requester_id: req.user.id,
      recipient_id: parsedTargetId
    });

    res.json({ message: 'Chat request cancelled.' });
  } catch (err) {
    console.error('Cancel contact request error:', err);
    res.status(500).json({ error: 'Failed to cancel contact request.' });
  }
});

app.post('/api/contacts/decline', authMiddleware, async (req, res) => {
  const { requester_id } = req.body;
  if (!requester_id) return res.status(400).json({ error: 'Requester ID required.' });
  const parsedRequesterId = parseInt(requester_id, 10);

  try {
    await db.run('DELETE FROM contacts WHERE requester_id = ? AND recipient_id = ? AND status = ?', [parsedRequesterId, req.user.id, 'pending']);
    
    // Notify requester that request was declined
    broadcast({
      type: 'contact_request_declined',
      requester_id: parsedRequesterId,
      recipient_id: req.user.id
    });

    res.json({ message: 'Contact request declined.' });
  } catch (err) {
    console.error('Decline contact error:', err);
    res.status(500).json({ error: 'Failed to decline contact request.' });
  }
});

app.delete('/api/contacts/:targetId', authMiddleware, async (req, res) => {
  const { targetId } = req.params;
  if (!targetId) return res.status(400).json({ error: 'Target ID required.' });
  const parsedTargetId = parseInt(targetId, 10);

  try {
    await db.run(
      'DELETE FROM contacts WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)',
      [req.user.id, parsedTargetId, parsedTargetId, req.user.id]
    );

    broadcast({
      type: 'contact_removed',
      user1: req.user.id,
      user2: targetId
    });

    res.json({ message: 'Contact removed successfully.' });
  } catch (err) {
    console.error('Remove contact error:', err);
    res.status(500).json({ error: 'Failed to remove contact.' });
  }
});

// ==========================================
// ADMINISTRATIVE MANAGEMENT ROUTES
// ==========================================

app.get('/api/admin/users', superAdminMiddleware, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, email, avatar, bio, is_banned, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users/:id/ban', superAdminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    await db.run('UPDATE users SET is_banned = 1 WHERE id = ?', [userId]);
    
    // Broadcast to force immediate client logout if online
    broadcast({ type: 'user_banned', userId });
    
    res.json({ message: 'User suspended successfully.' });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/api/admin/users/:id/unban', superAdminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    await db.run('UPDATE users SET is_banned = 0 WHERE id = ?', [userId]);
    
    res.json({ message: 'User unbanned successfully.' });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

app.delete('/api/admin/users/:id', superAdminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    await db.run('DELETE FROM messages WHERE user_id = ? OR recipient_id = ?', [userId, userId]);
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    
    broadcast({ type: 'user_banned', userId });
    res.json({ message: 'User permanently deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
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

// WebSocket Implementation with 64KB Frame Limit
const wss = new WebSocket.Server({ server, maxPayload: 65536 });

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

// Background cleanup timer for self-destructing messages (Active only when clients are connected)
setInterval(async () => {
  if (!clients || clients.size === 0) return;
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

wss.on('connection', async (ws, req) => {
  const origin = req.headers.origin;
  if (allowedOrigins !== '*' && origin && !allowedOrigins.includes(origin)) {
    ws.send(JSON.stringify({ type: 'auth_error', message: 'Cross-Site WebSocket connection rejected.' }));
    return ws.close();
  }

  let currentUser = null;
  const msgRate = { count: 0, resetAt: Date.now() + 60000 };
  const typingRate = { count: 0, resetAt: Date.now() + 5000 };

  const urlParams = new URLSearchParams(req.url.replace(/^.*\?/, ''));
  const urlToken = urlParams.get('token');
  if (urlToken) {
    const decoded = await verifyUserSession(urlToken);
    if (decoded) {
      currentUser = decoded;
      clients.set(ws, currentUser);

      const renewedWsToken = generateToken(currentUser, currentUser.sessionId);
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
      // Notify distinct senders that their messages were delivered to this user
      db.all('SELECT DISTINCT user_id FROM messages WHERE recipient_id = ? AND status = ?', [currentUser.id, 'sent']).then(senders => {
        return db.run('UPDATE messages SET status = ? WHERE recipient_id = ? AND status = ?', ['delivered', currentUser.id, 'sent']).then(() => {
          (senders || []).forEach(s => {
            sendToUser(s.user_id, { type: 'msg_status_update', recipient_id: currentUser.id, status: 'delivered' });
          });
        });
      }).catch(() => {});
    } else {
      ws.send(JSON.stringify({ type: 'auth_error', message: 'Token expired, revoked, or account suspended.' }));
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
        const decoded = await verifyUserSession(data.token);
        if (!decoded) {
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication failed. Session revoked or invalid.' }));
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
        
        // Mark pending messages as delivered and notify only relevant senders
        const pendingSenders = await db.all('SELECT DISTINCT user_id FROM messages WHERE recipient_id = ? AND status = ?', [currentUser.id, 'sent']);
        await db.run('UPDATE messages SET status = ? WHERE recipient_id = ? AND status = ?', ['delivered', currentUser.id, 'sent']);
        (pendingSenders || []).forEach(s => {
          sendToUser(s.user_id, { type: 'msg_status_update', recipient_id: currentUser.id, status: 'delivered' });
        });
        return;
      }

      if (!currentUser) {
        return ws.send(JSON.stringify({ type: 'auth_error', message: 'Unauthorized WebSocket message.' }));
      }

      if (data.type === 'chat_message') {
        // Enforce per-connection message rate limit (max 45 messages / min)
        const now = Date.now();
        if (now > msgRate.resetAt) {
          msgRate.count = 1;
          msgRate.resetAt = now + 60000;
        } else {
          msgRate.count += 1;
          if (msgRate.count > 45) {
            return ws.send(JSON.stringify({
              type: 'rate_limit_exceeded',
              message: 'Rate limit exceeded: Please slow down message sending.'
            }));
          }
        }
        const content = sanitizeString(data.content, 2000);
        if (!content) return;

        const recipientId = (data.recipient_id && !isNaN(data.recipient_id)) ? parseInt(data.recipient_id, 10) : null;

        // Server-Side Authorization for Direct Messages
        if (recipientId && recipientId !== currentUser.id && db) {
          // 1. Verify not blocked in either direction
          const isBlocked = await db.get(
            'SELECT id FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
            [currentUser.id, recipientId, recipientId, currentUser.id]
          );
          if (isBlocked) {
            return ws.send(JSON.stringify({ type: 'error', message: 'Unable to send message. User interaction is blocked.' }));
          }

          // 2. Verify mutual contact authorization (accepted status)
          const isContact = await db.get(
            'SELECT id FROM contacts WHERE status = ? AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))',
            ['accepted', currentUser.id, recipientId, recipientId, currentUser.id]
          );
          if (!isContact) {
            return ws.send(JSON.stringify({ type: 'error', message: 'Direct messages require mutual contact authorization.' }));
          }
        }

        if (data.file_hash && db) {
          let rawUrl = '';
          if (content.startsWith('[IMAGE]')) rawUrl = content.substring(7);
          else if (content.startsWith('[AUDIO]')) rawUrl = content.substring(7);
          else if (content.startsWith('[FILE]')) rawUrl = content.substring(6).split('|').pop();
          if (rawUrl) {
            db.run('INSERT INTO media_hashes (hash, url) VALUES (?, ?) ON CONFLICT DO NOTHING', [data.file_hash, rawUrl]).catch(err => console.error('Hash save error:', err));
          }
        }

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
        let insertedId;

        try {
          const result = await db.run(
            'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content, is_blurred, expires_at, status, reply_to_id, reply_to_user, reply_to_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [currentUser.id, recipientId, channel, currentUser.username, currentUser.avatar || '⚡', content, isBlurred, expiresAtIso, initialStatus, replyToId, replyToUser, replyToText]
          );
          if (result && result.id) {
            insertedId = result.id;
          } else {
            insertedId = Date.now();
          }
        } catch (dbErr) {
          console.error('Database message persistence error:', dbErr.message);
          return ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message: Database persistence error.' }));
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
            const recipientIdNum = Number(recipientId);
            const userMutes = await db.get('SELECT muted_chats FROM users WHERE id = ?', [recipientIdNum]);
            const mutedChats = JSON.parse(userMutes?.muted_chats || '[]');
            const senderStr = currentUser.id.toString();

            if (!mutedChats.includes(senderStr)) {
              // 1. Get sender's current device endpoints to strictly prevent self-notifications
              const senderDevices = await db.all('SELECT endpoint FROM device_tokens WHERE user_id = ?', [currentUser.id]);
              const senderEndpointSet = new Set((senderDevices || []).map(d => d.endpoint));

              // 2. Get recipient's device tokens from isolated device_tokens table
              let devices = await db.all('SELECT endpoint, p256dh, auth FROM device_tokens WHERE user_id = ?', [recipientIdNum]);
              
              if (!devices || devices.length === 0) {
                // Fallback to legacy subscription!
                const legacyUser = await db.get('SELECT push_subscription FROM users WHERE id = ?', [recipientIdNum]);
                if (legacyUser && legacyUser.push_subscription) {
                  try {
                    const sub = JSON.parse(legacyUser.push_subscription);
                    if (sub && sub.endpoint) {
                      devices = [{
                        endpoint: sub.endpoint,
                        p256dh: sub.keys?.p256dh,
                        auth: sub.keys?.auth
                      }];
                    }
                  } catch(e) {}
                }
              }

              if (devices && devices.length > 0) {
                const payload = JSON.stringify({
                  message_id: insertedId,
                  title: `New message from ${currentUser.username}`,
                  body: content.startsWith('data:audio') ? '🎤 Voice Message' : (isBlurred ? '[Hidden Message]' : content),
                  icon: currentUser.avatar || '/logo.png',
                  badge: '/badge.png',
                  url: '/'
                });

                devices.forEach(dev => {
                  // Never push to sender's own device!
                  if (senderEndpointSet.has(dev.endpoint)) return;

                  const sub = {
                    endpoint: dev.endpoint,
                    keys: { p256dh: dev.p256dh, auth: dev.auth }
                  };
                  webpush.sendNotification(sub, payload, {
                    urgency: 'high',
                    TTL: 86400,
                    headers: { 'Urgency': 'high' }
                  }).catch(err => {
                    console.error('Push notification failed for endpoint:', dev.endpoint, 'Status:', err.statusCode, 'Body:', err.body);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                      db.run('DELETE FROM device_tokens WHERE endpoint = ?', [dev.endpoint]).catch(() => {});
                    }
                  });
                });
              }
            }
          } catch (err) {
            console.error('Error dispatching DM push notification:', err);
          }
                } else {
          broadcast(msgPayload);
          
          try {
            // Dispatch global push strictly via device_tokens table, excluding sender
            let allDevices = await db.all(
              'SELECT dt.user_id, dt.endpoint, dt.p256dh, dt.auth, u.muted_chats FROM device_tokens dt JOIN users u ON dt.user_id = u.id WHERE dt.user_id != ?',
              [currentUser.id]
            );

            if (!allDevices || allDevices.length === 0) {
              const legacyUsers = await db.all('SELECT id, push_subscription, muted_chats FROM users WHERE id != ? AND push_subscription IS NOT NULL', [currentUser.id]);
              allDevices = [];
              for (const lu of legacyUsers) {
                try {
                  const sub = JSON.parse(lu.push_subscription);
                  if (sub && sub.endpoint) {
                    allDevices.push({
                      user_id: lu.id,
                      endpoint: sub.endpoint,
                      p256dh: sub.keys?.p256dh,
                      auth: sub.keys?.auth,
                      muted_chats: lu.muted_chats
                    });
                  }
                } catch(e) {}
              }
            }

            if (allDevices && allDevices.length > 0) {
              const payload = JSON.stringify({
                message_id: insertedId,
                title: `Global Chat: ${currentUser.username}`,
                body: content.startsWith('data:audio') ? '🎤 Voice Message' : (isBlurred ? '[Hidden Message]' : content),
                icon: currentUser.avatar || '/logo.png',
                badge: '/badge.png',
                url: '/'
              });

              allDevices.forEach(dev => {
                const mutedChats = JSON.parse(dev.muted_chats || '[]');
                if (!mutedChats.includes('global') && !mutedChats.includes(currentUser.id.toString())) {
                  const sub = {
                    endpoint: dev.endpoint,
                    keys: { p256dh: dev.p256dh, auth: dev.auth }
                  };
                  webpush.sendNotification(sub, payload, {
                    urgency: 'high',
                    TTL: 86400,
                    headers: { 'Urgency': 'high' }
                  }).catch(err => {
                    console.error('Global Push notification failed for endpoint:', dev.endpoint, 'Status:', err.statusCode, 'Body:', err.body);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                      db.run('DELETE FROM device_tokens WHERE endpoint = ?', [dev.endpoint]).catch(() => {});
                    }
                  });
                }
              });
            }
          } catch (err) {
            console.error('Error sending global push:', err);
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
      } else if (data.type === 'client_ack_delivered') {
        // Deterministic Delivery ACK sent by recipient's device
        const rawIds = Array.isArray(data.message_ids) ? data.message_ids : [data.message_id];
        const messageIds = rawIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        
        if (messageIds.length > 0) {
          try {
            const placeholders = messageIds.map(() => '?').join(',');
            const messages = await db.all(
              `SELECT id, user_id FROM messages WHERE id IN (${placeholders}) AND recipient_id = ? AND status = 'sent'`,
              [...messageIds, currentUser.id]
            );

            if (messages && messages.length > 0) {
              const idsToUpdate = messages.map(m => m.id);
              const updatePlaceholders = idsToUpdate.map(() => '?').join(',');
              await db.run(
                `UPDATE messages SET status = 'delivered' WHERE id IN (${updatePlaceholders})`,
                idsToUpdate
              );

              // Group by sender and notify each sender directly
              const sendersMap = {};
              messages.forEach(m => {
                sendersMap[m.user_id] = sendersMap[m.user_id] || [];
                sendersMap[m.user_id].push(m.id);
              });

              Object.keys(sendersMap).forEach(senderId => {
                sendToUser(parseInt(senderId, 10), {
                  type: 'msg_status_update',
                  status: 'delivered',
                  message_ids: sendersMap[senderId],
                  recipient_id: currentUser.id
                });
              });
            }
          } catch(e) {
            console.error('Error handling client_ack_delivered:', e);
          }
        }
      } else if (data.type === 'client_ack_read' || data.type === 'mark_read') {
        // Deterministic Read ACK sent when recipient opens conversation tab
        const senderId = (data.sender_id && !isNaN(data.sender_id)) ? parseInt(data.sender_id, 10) : null;
        const rawIds = Array.isArray(data.message_ids) ? data.message_ids : (data.message_id ? [data.message_id] : []);
        const messageIds = rawIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

        try {
          if (senderId) {
            const unreadMsgs = await db.all(
              "SELECT id FROM messages WHERE user_id = ? AND recipient_id = ? AND status != 'read'",
              [senderId, currentUser.id]
            );

            if (unreadMsgs && unreadMsgs.length > 0) {
              const unreadIds = unreadMsgs.map(m => m.id);
              await db.run(
                "UPDATE messages SET status = 'read' WHERE user_id = ? AND recipient_id = ? AND status != 'read'",
                [senderId, currentUser.id]
              );

              sendToUser(senderId, {
                type: 'msg_status_update',
                status: 'read',
                message_ids: unreadIds,
                sender_id: senderId,
                recipient_id: currentUser.id
              });
            }
          } else if (messageIds.length > 0) {
            const placeholders = messageIds.map(() => '?').join(',');
            const messages = await db.all(
              `SELECT id, user_id FROM messages WHERE id IN (${placeholders}) AND recipient_id = ? AND status != 'read'`,
              [...messageIds, currentUser.id]
            );

            if (messages && messages.length > 0) {
              const idsToUpdate = messages.map(m => m.id);
              const updatePlaceholders = idsToUpdate.map(() => '?').join(',');
              await db.run(
                `UPDATE messages SET status = 'read' WHERE id IN (${updatePlaceholders})`,
                idsToUpdate
              );

              const sendersMap = {};
              messages.forEach(m => {
                sendersMap[m.user_id] = sendersMap[m.user_id] || [];
                sendersMap[m.user_id].push(m.id);
              });

              Object.keys(sendersMap).forEach(sId => {
                sendToUser(parseInt(sId, 10), {
                  type: 'msg_status_update',
                  status: 'read',
                  message_ids: sendersMap[sId],
                  recipient_id: currentUser.id
                });
              });
            }
          }
        } catch (e) {
          console.error('Error handling client_ack_read:', e);
        }
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
        const now = Date.now();
        if (now > typingRate.resetAt) {
          typingRate.count = 1;
          typingRate.resetAt = now + 5000;
        } else {
          typingRate.count += 1;
          if (typingRate.count > 10) return; // Drop spam typing events
        }
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
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🚀 SChat Server running on http://localhost:${PORT}`);
    console.log(`⚡ WebSockets active on ws://localhost:${PORT}`);
    console.log(`================================================`);
  });
}

module.exports = { app, server, wss, db };

// Admin Push Diagnostics
app.get('/api/admin/push-logs', superAdminMiddleware, (req, res) => {
  res.json({ logs: global.pushLogs || [] });
});

// --- AUTO-PURGE CRON JOB ---
const AUTO_PURGE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(async () => {
  if (!db || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.log('[Auto-Purge] Skipping: Missing Cloudinary credentials or DB.');
    return;
  }

  try {
    console.log('[Auto-Purge] Starting automated 30-day media cleanup...');
    const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.all('SELECT hash, url FROM media_hashes WHERE created_at < ?', [cutoffIso]);
    
    const rows = result || [];
    if (rows.length === 0) {
      console.log('[Auto-Purge] No expired media found.');
      return;
    }

    const auth = Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + process.env.CLOUDINARY_API_SECRET).toString('base64');
    
    for (const row of rows) {
      try {
        const parts = row.url.split('/');
        const filename = parts[parts.length - 1];
        const publicId = filename.split('.')[0];

        const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?public_ids[]=${publicId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (response.ok) {
          await db.run('DELETE FROM media_hashes WHERE hash = ?', [row.hash]);
          console.log(`[Auto-Purge] Successfully deleted and unregistered: ${publicId}`);
        } else {
          console.error(`[Auto-Purge] Failed to delete ${publicId} from Cloudinary: ${response.statusText}`);
        }
      } catch (err) {
        console.error(`[Auto-Purge] Error processing hash ${row.hash}:`, err);
      }
    }
    console.log('[Auto-Purge] Cleanup cycle complete.');
  } catch (err) {
    console.error('[Auto-Purge] Critical failure in cleanup loop:', err);
  }
}, AUTO_PURGE_INTERVAL);
