const fs = require('fs');
const path = require('path');

let dbInstance = null;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  async function initPg() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          is_banned INTEGER DEFAULT 0,
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          avatar TEXT DEFAULT '⚡',
          bio VARCHAR(255) DEFAULT 'Hey there! I am using SChat.',
          push_subscription TEXT DEFAULT NULL,
          muted_chats TEXT DEFAULT '[]',
          muted_chats TEXT DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS media_hashes (
          hash VARCHAR(64) PRIMARY KEY,
          url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE media_hashes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        CREATE TABLE IF NOT EXISTS channels (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          description TEXT DEFAULT '',
          created_by INTEGER DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          recipient_id INTEGER DEFAULT NULL,
          channel VARCHAR(50) DEFAULT 'global',
          username VARCHAR(255) NOT NULL,
          avatar TEXT DEFAULT '⚡',
          content TEXT NOT NULL,
          is_blurred INTEGER DEFAULT 0,
          is_edited INTEGER DEFAULT 0,
          is_pinned INTEGER DEFAULT 0,
          reactions TEXT DEFAULT '{}',
          expires_at TIMESTAMP DEFAULT NULL,
          status VARCHAR(20) DEFAULT 'sent',
          reply_to_id INTEGER DEFAULT NULL,
          reply_to_user VARCHAR(255) DEFAULT NULL,
          reply_to_text TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
                CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(64) UNIQUE NOT NULL,
          user_id INTEGER NOT NULL,
          device VARCHAR(100) DEFAULT 'Unknown Device',
          browser VARCHAR(100) DEFAULT 'Unknown Browser',
          ip_address VARCHAR(45) DEFAULT '127.0.0.1',
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
        CREATE TABLE IF NOT EXISTS contacts (
          id SERIAL PRIMARY KEY,
          requester_id INTEGER NOT NULL,
          recipient_id INTEGER NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(requester_id, recipient_id)
        );
                CREATE TABLE IF NOT EXISTS device_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT,
          auth TEXT,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
                CREATE TABLE IF NOT EXISTS device_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT,
          auth TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS blocked_users (
          id SERIAL PRIMARY KEY,
          blocker_id INTEGER NOT NULL,
          blocked_id INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(blocker_id, blocked_id)
        );
      `);
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(255) DEFAULT 'Hey there! I am using SChat.';`); } catch(e){}
      try { await pool.query(`ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;`); } catch(e){}
      try { await pool.query(`ALTER TABLE users ALTER COLUMN bio TYPE TEXT;`); } catch(e){}
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INTEGER DEFAULT 0;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id INTEGER DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'global';`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_blurred INTEGER DEFAULT 0;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited INTEGER DEFAULT 0;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned INTEGER DEFAULT 0;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions TEXT DEFAULT '{}';`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_user VARCHAR(255) DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_chats TEXT DEFAULT '[]';`); } catch(e){}
            // Auto-migrate past messages into accepted contacts
      try {
        await pool.query(`
          INSERT INTO contacts (requester_id, recipient_id, status)
          SELECT DISTINCT LEAST(user_id, recipient_id), GREATEST(user_id, recipient_id), 'accepted'
          FROM messages
          WHERE recipient_id IS NOT NULL AND user_id != recipient_id
          ON CONFLICT (requester_id, recipient_id) DO NOTHING;
        `);
      } catch (e) {}
      console.log('Connected to PostgreSQL Database cleanly with all 9 features.');
    } catch (err) {
      console.error('PostgreSQL Init Error:', err);
    }
  }
  initPg();

  dbInstance = {
    async run(sql, params = []) {
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      const finalSql = isInsert ? `${pgSql} RETURNING id` : pgSql;
      
      const res = await pool.query(finalSql, params);
      return { id: res.rows[0] ? res.rows[0].id : null, changes: res.rowCount };
    },
    async get(sql, params = []) {
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgSql, params);
      return res.rows[0] || null;
    },
    async all(sql, params = []) {
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      const res = await pool.query(pgSql, params);
      return res.rows;
    }
  };
} else {
  // Pure JSON File fallback for zero-dependency local dev
  const fallbackPath = path.join(__dirname, 'db_fallback.json');
    let data = { users: [], messages: [], channels: [], blocked_users: [], user_sessions: [], contacts: [], lastUserId: 0, lastMsgId: 0, lastChanId: 0, lastSessionId: 0, lastContactId: 0 };

  if (fs.existsSync(fallbackPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      data.users = raw.users || [];
      data.messages = raw.messages || [];
      data.channels = raw.channels || [];
      data.blocked_users = raw.blocked_users || [];
      data.user_sessions = raw.user_sessions || [];
      // Deduplicate sessions keeping latest per session_id
      const uniqueSessionsMap = new Map();
      (data.user_sessions || []).forEach(s => {
        if (!uniqueSessionsMap.has(s.session_id) || new Date(s.last_active) > new Date(uniqueSessionsMap.get(s.session_id).last_active)) {
          uniqueSessionsMap.set(s.session_id, s);
        }
      });
      data.user_sessions = Array.from(uniqueSessionsMap.values());
      data.contacts = raw.contacts || [];
      data.lastUserId = raw.lastUserId || data.users.length;
      data.lastMsgId = raw.lastMsgId || data.messages.length;
      data.lastChanId = raw.lastChanId || data.channels.length;
    } catch (e) {}
  }

    // Auto-seed past message conversations into accepted contacts
  if (data.messages && data.messages.length > 0) {
    data.messages.forEach(m => {
      if (m.recipient_id && Number(m.user_id) !== Number(m.recipient_id)) {
        const u1 = Math.min(Number(m.user_id), Number(m.recipient_id));
        const u2 = Math.max(Number(m.user_id), Number(m.recipient_id));
        const exists = data.contacts.some(c => (
          (Number(c.requester_id) === u1 && Number(c.recipient_id) === u2) ||
          (Number(c.requester_id) === u2 && Number(c.recipient_id) === u1)
        ));
        if (!exists) {
          data.lastContactId += 1;
          data.contacts.push({
            id: data.lastContactId,
            requester_id: u1,
            recipient_id: u2,
            status: 'accepted',
            created_at: m.created_at || new Date().toISOString(),
            updated_at: m.created_at || new Date().toISOString()
          });
        }
      }
    });
  }
  const saveData = () => fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), 'utf8');

  dbInstance = {
    async run(sql, params = []) {
      if (sql.includes('INSERT INTO users')) {
        const [username, email, password, avatar, bio] = params;
        data.lastUserId += 1;
        const newUser = {
          id: data.lastUserId,
          username,
          email,
          password,
          avatar: avatar || '⚡',
          bio: bio || 'Hey there! I am using SChat.',
          is_banned: 0,
          created_at: new Date().toISOString()
        };
        data.users.push(newUser);
        saveData();
        return { id: newUser.id, changes: 1 };
      }
      if (sql.includes('INSERT INTO messages')) {
        const [user_id, recipient_id, channel, username, avatar, content, is_blurred, expires_at, status, reply_to_id, reply_to_user, reply_to_text] = params;
        data.lastMsgId += 1;
        const newMsg = {
          id: data.lastMsgId,
          user_id,
          recipient_id: recipient_id || null,
          channel: channel || 'global',
          username,
          avatar: avatar || '⚡',
          content,
          is_blurred: is_blurred || 0,
          is_edited: 0,
          is_pinned: 0,
          reactions: '{}',
          expires_at: expires_at || null,
          status: status || 'sent',
          reply_to_id: reply_to_id || null,
          reply_to_user: reply_to_user || null,
          reply_to_text: reply_to_text || null,
          created_at: new Date().toISOString()
        };
        data.messages.push(newMsg);
        saveData();
        return { id: newMsg.id, changes: 1 };
      }
      if (sql.includes('UPDATE messages SET content = ?')) {
        const [content, id, user_id] = params;
        const msg = data.messages.find(m => m.id === id && m.user_id === user_id);
        if (msg) {
          msg.content = content;
          msg.is_edited = 1;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('UPDATE messages SET reactions = ?')) {
        const [reactions, id] = params;
        const msg = data.messages.find(m => m.id === id);
        if (msg) {
          msg.reactions = reactions;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('UPDATE messages SET is_pinned = ?')) {
        const [is_pinned, id] = params;
        const msg = data.messages.find(m => m.id === id);
        if (msg) {
          msg.is_pinned = is_pinned;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
                  if (sql.includes('UPDATE user_sessions SET')) {
        const [last_active, ip_address, device, browser, id] = params;
        const sess = (data.user_sessions || []).find(s => Number(s.id) === Number(id));
        if (sess) {
          sess.last_active = last_active;
          sess.ip_address = ip_address;
          sess.device = device;
          sess.browser = browser;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('UPDATE users SET avatar = ? WHERE id = ?')) {
        const [avatar, id] = params;
        const user = data.users.find(u => Number(u.id) === Number(id));
        if (user) {
          user.avatar = avatar;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('INSERT INTO user_sessions')) {
        const [session_id, user_id, device, browser, ip_address] = params;
        data.lastSessionId += 1;
        const newSession = {
          id: data.lastSessionId,
          session_id,
          user_id: Number(user_id),
          device: device || 'Desktop',
          browser: browser || 'Browser',
          ip_address: ip_address || '127.0.0.1',
          last_active: new Date().toISOString(),
          created_at: new Date().toISOString()
        };
        data.user_sessions.push(newSession);
        saveData();
        return { id: newSession.id, changes: 1 };
      }
      if (sql.includes('DELETE FROM user_sessions WHERE session_id = ? AND user_id = ?')) {
        const [session_id, user_id] = params;
        const initLen = data.user_sessions.length;
        data.user_sessions = data.user_sessions.filter(s => !(s.session_id === session_id && Number(s.user_id) === Number(user_id)));
        saveData();
        return { changes: initLen - data.user_sessions.length };
      }
      if (sql.includes('DELETE FROM user_sessions WHERE user_id = ? AND session_id != ?')) {
        const [user_id, keep_session_id] = params;
        const initLen = data.user_sessions.length;
        data.user_sessions = data.user_sessions.filter(s => !(Number(s.user_id) === Number(user_id) && s.session_id !== keep_session_id));
        saveData();
        return { changes: initLen - data.user_sessions.length };
      }
      if (sql.includes('INSERT INTO contacts')) {
        const [requester_id, recipient_id, status] = params;
        data.lastContactId += 1;
        const newContact = {
          id: data.lastContactId,
          requester_id: Number(requester_id),
          recipient_id: Number(recipient_id),
          status: status || 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        data.contacts.push(newContact);
        saveData();
        return { id: newContact.id, changes: 1 };
      }
      if (sql.includes('UPDATE contacts SET status = ?')) {
        const [status, requester_id, recipient_id] = params;
        const c = data.contacts.find(con => Number(con.requester_id) === Number(requester_id) && Number(con.recipient_id) === Number(recipient_id));
        if (c) {
          c.status = status;
          c.updated_at = new Date().toISOString();
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('DELETE FROM contacts WHERE')) {
        const initLen = data.contacts.length;
        if (params.length === 3) {
          const [u1, u2, status] = params;
          data.contacts = data.contacts.filter(c => !(
            Number(c.requester_id) === Number(u1) &&
            Number(c.recipient_id) === Number(u2) &&
            (!status || c.status === status)
          ));
        } else if (params.length === 4 || params.length === 2) {
          const u1 = Number(params[0]);
          const u2 = Number(params[1]);
          data.contacts = data.contacts.filter(c => !(
            (Number(c.requester_id) === u1 && Number(c.recipient_id) === u2) ||
            (Number(c.requester_id) === u2 && Number(c.recipient_id) === u1)
          ));
        }
        saveData();
        return { changes: initLen - data.contacts.length };
      }
      if (sql.includes('INSERT INTO blocked_users')) {
        const [blocker_id, blocked_id] = params;
        data.blocked_users.push({ id: data.blocked_users.length + 1, blocker_id, blocked_id });
        saveData();
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM blocked_users')) {
        const [blocker_id, blocked_id] = params;
        data.blocked_users = data.blocked_users.filter(b => !(b.blocker_id === blocker_id && b.blocked_id === blocked_id));
        saveData();
        return { changes: 1 };
      }
      if (sql.includes('UPDATE users SET is_banned = ?')) {
        const [is_banned, id] = params;
        const user = data.users.find(u => Number(u.id) === Number(id));
        if (user) {
          user.is_banned = Number(is_banned);
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('UPDATE users SET')) {
        const [avatar, bio, id] = params;
        const u = data.users.find(user => user.id === id);
        if (u) {
          if (avatar) u.avatar = avatar;
          if (bio) u.bio = bio;
          saveData();
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('DELETE FROM messages')) {
        const id = params[0];
        const initialLen = data.messages.length;
        data.messages = data.messages.filter(m => m.id !== id);
        saveData();
        return { changes: initialLen - data.messages.length };
      }
    },
    async get(sql, params = []) {
            if (sql.includes('FROM user_sessions WHERE user_id = ? AND session_id = ?')) {
        const [userId, sessionId] = params;
        return (data.user_sessions || []).find(s => Number(s.user_id) === Number(userId) && s.session_id === sessionId) || null;
      }
      if (sql.includes('FROM users WHERE username = ?')) {
        const query = (params[0] || '').toLowerCase();
        return data.users.find(u => (u.username && u.username.toLowerCase() === query) || (u.email && u.email.toLowerCase() === query)) || null;
      }
      if (sql.includes('FROM users WHERE email = ?')) {
        const query = (params[0] || '').toLowerCase();
        return data.users.find(u => u.email && u.email.toLowerCase() === query) || null;
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return data.users.find(u => Number(u.id) === Number(params[0])) || null;
      }
      if (sql.includes('FROM messages WHERE id = ?')) {
        return data.messages.find(m => Number(m.id) === Number(params[0])) || null;
      }
      if (sql.includes('FROM contacts WHERE')) {
        if (params.length === 4) {
          const [u1, u2, u3, u4] = params;
          return data.contacts.find(c => (
            (Number(c.requester_id) === Number(u1) && Number(c.recipient_id) === Number(u2)) ||
            (Number(c.requester_id) === Number(u3) && Number(c.recipient_id) === Number(u4))
          )) || null;
        } else if (params.length === 2) {
          const [u1, u2] = params;
          return data.contacts.find(c => (
            (Number(c.requester_id) === Number(u1) && Number(c.recipient_id) === Number(u2)) ||
            (Number(c.requester_id) === Number(u2) && Number(c.recipient_id) === Number(u1))
          )) || null;
        }
      }
      return null;
    },
    async all(sql, params = []) {
            if (sql.includes('FROM user_sessions WHERE user_id = ?')) {
        const [uId] = params;
        return data.user_sessions.filter(s => Number(s.user_id) === Number(uId));
      }
      if (sql.includes('FROM contacts WHERE')) {
        if (sql.includes('requester_id = ? OR recipient_id = ?')) {
          const uId = Number(params[0]);
          return data.contacts.filter(c => Number(c.requester_id) === uId || Number(c.recipient_id) === uId);
        }
        if (params.length === 4) {
          const [u1, u2, u3, u4] = params;
          return data.contacts.filter(c => (
            (Number(c.requester_id) === Number(u1) && Number(c.recipient_id) === Number(u2)) ||
            (Number(c.requester_id) === Number(u3) && Number(c.recipient_id) === Number(u4))
          ));
        }
        if (params.length === 2) {
          const [u1, u2] = params;
          return data.contacts.filter(c => (
            (Number(c.requester_id) === Number(u1) && Number(c.recipient_id) === Number(u2)) ||
            (Number(c.requester_id) === Number(u2) && Number(c.recipient_id) === Number(u1))
          ));
        }
        if (params.length === 1) {
          const [uId] = params;
          return data.contacts.filter(c => Number(c.requester_id) === Number(uId) || Number(c.recipient_id) === Number(uId));
        }
      }
      if (sql.includes('FROM blocked_users')) {
        const blocker_id = params[0];
        return data.blocked_users.filter(b => b.blocker_id === blocker_id);
      }
      if (sql.includes('FROM users')) {
        return data.users;
      }
      if (sql.includes('FROM messages')) {
        const nowIso = new Date().toISOString();
        let validMsgs = data.messages.filter(m => !m.expires_at || m.expires_at > nowIso);
        if (sql.includes('is_pinned = 1')) {
          return validMsgs.filter(m => m.is_pinned === 1);
        }
        if (params.length === 4) {
          const [u1, u2] = params;
          return validMsgs.filter(m => (m.user_id === u1 && m.recipient_id === u2) || (m.user_id === u2 && m.recipient_id === u1));
        } else if (sql.includes('user_id = ? OR recipient_id = ?')) {
          const [uId] = params;
          return validMsgs.filter(m => m.user_id === uId || m.recipient_id === uId);
        } else {
          return validMsgs.filter(m => !m.recipient_id).slice(-100);
        }
      }
      return [];
    }
  };
}

module.exports = dbInstance;
