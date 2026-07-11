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
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          avatar VARCHAR(50) DEFAULT '⚡',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          recipient_id INTEGER DEFAULT NULL,
          username VARCHAR(255) NOT NULL,
          avatar VARCHAR(50) DEFAULT '⚡',
          content TEXT NOT NULL,
          is_blurred INTEGER DEFAULT 0,
          expires_at TIMESTAMP DEFAULT NULL,
          status VARCHAR(20) DEFAULT 'sent',
          reply_to_id INTEGER DEFAULT NULL,
          reply_to_user VARCHAR(255) DEFAULT NULL,
          reply_to_text TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `);
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id INTEGER DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_blurred INTEGER DEFAULT 0;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_user VARCHAR(255) DEFAULT NULL;`); } catch(e){}
      try { await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT DEFAULT NULL;`); } catch(e){}
      console.log('Connected to PostgreSQL Database cleanly.');
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
  let data = { users: [], messages: [] };
  if (fs.existsSync(fallbackPath)) {
    try { data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8')); } catch (e) {}
  }
  const saveData = () => fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), 'utf8');

  dbInstance = {
    async run(sql, params = []) {
      if (sql.includes('INSERT INTO users')) {
        const [username, email, password, avatar] = params;
        const newUser = { id: data.users.length + 1, username, email, password, avatar: avatar || '⚡', created_at: new Date().toISOString() };
        data.users.push(newUser);
        saveData();
        return { id: newUser.id, changes: 1 };
      }
      if (sql.includes('INSERT INTO messages')) {
        const [user_id, recipient_id, username, avatar, content, is_blurred, expires_at, status, reply_to_id, reply_to_user, reply_to_text] = params;
        const newMsg = {
          id: data.messages.length + 1,
          user_id,
          recipient_id: recipient_id || null,
          username,
          avatar: avatar || '⚡',
          content,
          is_blurred: is_blurred || 0,
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
      if (sql.includes('UPDATE messages SET status')) {
        const status = params[0];
        data.messages.forEach(m => {
          if (m.status !== 'read') m.status = status;
        });
        saveData();
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM messages')) {
        const id = params[0];
        data.messages = data.messages.filter(m => m.id !== id);
        saveData();
        return { changes: 1 };
      }
    },
    async get(sql, params = []) {
      if (sql.includes('FROM users WHERE username = ?')) return data.users.find(u => u.username === params[0] || u.email === params[0]) || null;
      if (sql.includes('FROM users WHERE email = ?')) return data.users.find(u => u.email === params[0]) || null;
      if (sql.includes('FROM users WHERE id = ?')) return data.users.find(u => u.id === params[0]) || null;
      if (sql.includes('FROM messages WHERE id = ?')) return data.messages.find(m => m.id === params[0]) || null;
      return null;
    },
    async all(sql, params = []) {
      if (sql.includes('FROM messages')) {
        const nowIso = new Date().toISOString();
        let validMsgs = data.messages.filter(m => !m.expires_at || m.expires_at > nowIso);
        if (params.length === 4) {
          const [u1, u2] = params;
          return validMsgs.filter(m => (m.user_id === u1 && m.recipient_id === u2) || (m.user_id === u2 && m.recipient_id === u1));
        } else {
          return validMsgs.filter(m => !m.recipient_id).slice(-100);
        }
      }
      return [];
    }
  };
}

module.exports = dbInstance;
