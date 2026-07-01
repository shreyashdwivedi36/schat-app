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
  console.log('ws package not installed. Installing simple standard WebSocket wrapper...');
  WebSocket = require('ws');
}

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST Endpoints

// Register User
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check existing
    const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const hashedPassword = hashPassword(password);
    const selectedAvatar = avatar || '⚡';

    const result = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, selectedAvatar]
    );

    const newUser = {
      id: result.id,
      username,
      email,
      avatar: selectedAvatar
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
    const { username, password } = req.body;

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
      avatar: user.avatar || '⚡'
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
    const user = await db.get('SELECT id, username, email, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Get Chat Message History
app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await db.all('SELECT id, user_id, username, avatar, content, created_at FROM messages ORDER BY id ASC LIMIT 100');
    res.json({ messages });
  } catch (err) {
    console.error('Fetch Messages Error:', err);
    res.status(500).json({ error: 'Failed to retrieve message history.' });
  }
});

// WebSocket Implementation
const wss = new WebSocket.Server({ server });

// Map of socket -> user payload
const clients = new Map();

function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const [client, user] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(payload);
    }
  }
}

function getOnlineUsersList() {
  const uniqueUsers = new Map();
  for (const user of clients.values()) {
    if (user && user.id) {
      uniqueUsers.set(user.id, {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      });
    }
  }
  return Array.from(uniqueUsers.values());
}

wss.on('connection', (ws, req) => {
  let currentUser = null;

  // Handle URL token query if present
  const urlParams = new URLSearchParams(req.url.replace(/^.*\?/, ''));
  const urlToken = urlParams.get('token');
  if (urlToken) {
    const decoded = verifyToken(urlToken);
    if (decoded) {
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
    }
  }

  ws.on('message', async (messageBuffer) => {
    try {
      const data = JSON.parse(messageBuffer.toString());

      if (data.type === 'auth') {
        const decoded = verifyToken(data.token);
        if (!decoded) {
          ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed.' }));
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
        return ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized WebSocket message.' }));
      }

      if (data.type === 'chat_message') {
        const content = (data.content || '').trim();
        if (!content) return;

        const result = await db.run(
          'INSERT INTO messages (user_id, username, avatar, content) VALUES (?, ?, ?, ?)',
          [currentUser.id, currentUser.username, currentUser.avatar || '⚡', content]
        );

        const msgPayload = {
          type: 'new_message',
          id: result.id,
          user_id: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar || '⚡',
          content,
          created_at: new Date().toISOString()
        };

        broadcast(msgPayload);
      } else if (data.type === 'typing') {
        broadcast({
          type: 'typing',
          user_id: currentUser.id,
          username: currentUser.username,
          isTyping: !!data.isTyping
        }, ws);
      } else if (data.type === 'reaction') {
        broadcast({
          type: 'reaction',
          messageId: data.messageId,
          emoji: data.emoji,
          username: currentUser.username
        });
      }
    } catch (err) {
      console.error('WS Message Handler Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentUser) {
      clients.delete(ws);
      broadcast({
        type: 'presence',
        action: 'leave',
        username: currentUser.username,
        onlineUsers: getOnlineUsersList()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 Pulse Chat Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSockets active on ws://localhost:${PORT}`);
  console.log(`================================================`);
});
