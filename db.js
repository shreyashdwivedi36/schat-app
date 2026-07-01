const fs = require('fs');
const path = require('path');

// We provide a unified Database interface using SQLite3, with a lightweight fallback if native bindings are absent.
let dbInstance = null;
let useFallback = false;

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  useFallback = true;
  console.log('sqlite3 module not found, using file-backed JSON database fallback.');
}

const dbPath = path.join(__dirname, 'chat.db');
const fallbackPath = path.join(__dirname, 'db_fallback.json');

if (!useFallback) {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('Connected to SQLite database.');
    }
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
  // File-backed JSON Fallback Database implementation
  let data = { users: [], messages: [] };
  if (fs.existsSync(fallbackPath)) {
    try {
      data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    } catch (e) {
      console.error('Error reading JSON DB fallback, starting fresh:', e);
    }
  }

  const saveData = () => {
    fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), 'utf8');
  };

  dbInstance = {
    async run(sql, params = []) {
      if (sql.includes('INSERT INTO users')) {
        const [username, email, password, avatar] = params;
        if (data.users.some(u => u.username === username || u.email === email)) {
          throw new Error('UNIQUE constraint failed: user already exists');
        }
        const newUser = {
          id: data.users.length + 1,
          username,
          email,
          password,
          avatar: avatar || '⚡',
          created_at: new Date().toISOString()
        };
        data.users.push(newUser);
        saveData();
        return { id: newUser.id, changes: 1 };
      }
      if (sql.includes('INSERT INTO messages')) {
        const [user_id, username, avatar, content] = params;
        const newMsg = {
          id: data.messages.length + 1,
          user_id,
          username,
          avatar: avatar || '⚡',
          content,
          created_at: new Date().toISOString()
        };
        data.messages.push(newMsg);
        saveData();
        return { id: newMsg.id, changes: 1 };
      }
    },
    async get(sql, params = []) {
      if (sql.includes('FROM users WHERE username = ?')) {
        return data.users.find(u => u.username === params[0]) || null;
      }
      if (sql.includes('FROM users WHERE email = ?')) {
        return data.users.find(u => u.email === params[0]) || null;
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return data.users.find(u => u.id === params[0]) || null;
      }
      return null;
    },
    async all(sql, params = []) {
      if (sql.includes('FROM messages')) {
        return data.messages.slice(-100); // return last 100
      }
      return [];
    }
  };
}

module.exports = dbInstance;
