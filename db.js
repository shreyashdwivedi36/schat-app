const fs = require('fs');
const path = require('path');

let dbInstance = null;

// Check if PostgreSQL connection string exists (e.g. on Render)
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Initialize Postgres tables
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
      // Convert SQLite ? placeholders to $1, $2, etc. for PostgreSQL
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
  // SQLite & JSON Fallback for local development
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
          const [user_id, username, avatar, content] = params;
          const newMsg = { id: data.messages.length + 1, user_id, username, avatar: avatar || '⚡', content, created_at: new Date().toISOString() };
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
        if (sql.includes('FROM messages')) return data.messages.slice(-100);
        return [];
      }
    };
  }
}

module.exports = dbInstance;
