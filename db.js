const fs = require('fs');
const path = require('path');

let dbInstance = null;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      avatar VARCHAR(50) DEFAULT '⚡',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      recipient_id INTEGER DEFAULT NULL,
      username VARCHAR(255) NOT NULL,
      avatar VARCHAR(50) DEFAULT '⚡',
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `).then(() => {
    console.log('Connected to PostgreSQL Database.');
  }).catch(err => {
    console.error('PostgreSQL Init Error:', err);
  });

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
  let sqlite3;
  let useFallback = false;
  try {
    sqlite3 = require('sqlite3').verbose();
  } catch (err) {
    useFallback = true;
  }

  const dbPath = path.join(__dirname, 'chat.db');
  const fallbackPath = path.join(__dirname, 'db_fallback.json');

  if (!useFallback) {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (!err) console.log('Connected to SQLite database.');
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          avatar TEXT DEFAULT '⚡',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          recipient_id INTEGER DEFAULT NULL,
          username TEXT NOT NULL,
          avatar TEXT DEFAULT '⚡',
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);
    });

    dbInstance = {
      run: (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      }),
      get: (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      all: (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    };
  } else {
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
          const [user_id, recipient_id, username, avatar, content] = params;
          const newMsg = { id: data.messages.length + 1, user_id, recipient_id: recipient_id || null, username, avatar: avatar || '⚡', content, created_at: new Date().toISOString() };
          data.messages.push(newMsg);
          saveData();
          return { id: newMsg.id, changes: 1 };
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
          if (params.length === 2) {
            // Private DM filter: (user_id = p0 AND recipient_id = p1) OR (user_id = p1 AND recipient_id = p0)
            const [u1, u2] = params;
            return data.messages.filter(m => (m.user_id === u1 && m.recipient_id === u2) || (m.user_id === u2 && m.recipient_id === u1));
          } else {
            // Global messages (recipient_id IS NULL)
            return data.messages.filter(m => !m.recipient_id).slice(-100);
          }
        }
        return [];
      }
    };
  }
}

module.exports = dbInstance;
