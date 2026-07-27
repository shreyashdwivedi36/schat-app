const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware } = require('./auth');

let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  WebSocket = require('ws');
}

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

    if (msg.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own messages.' });
    }

    await handleMessageDeletion(msg, messageId);

    res.json({ message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('Delete Message Error:', err);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
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
    if (user && user.id === userId) return true;
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
        } else {
          broadcast(msgPayload);
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
          const msg = await db.get('SELECT is_pinned FROM messages WHERE id = ?', [messageId]);
          if (msg) {
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
          if (msg && msg.user_id === currentUser.id) {
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
