const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Require or validate strong JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' 
  ? (() => { throw new Error('FATAL: JWT_SECRET environment variable must be set in production.'); })() 
  : 'schat_dev_local_secret_key_change_in_production_2026');

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user, sessionId = null) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'user'
  };
  if (sessionId || user.sessionId) {
    payload.sessionId = sessionId || user.sessionId;
  }
  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function verifyUserSession(token) {
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Enforce session ID presence for all tokens
  if (!decoded.sessionId) return null;

  if (db) {
    try {
      // 1. Verify user exists and is not banned
      const user = await db.get('SELECT id, is_banned FROM users WHERE id = ?', [decoded.id]);
      if (!user || user.is_banned) return null;

      // 2. Verify session is still active in user_sessions (both normal users & admin)
      const activeSession = await db.get(
        'SELECT id FROM user_sessions WHERE user_id = ? AND session_id = ?',
        [decoded.id, decoded.sessionId]
      );
      if (!activeSession) return null;
    } catch (err) {
      console.error('Fail-closed: User session verification database error:', err);
      return null;
    }
  }
  return decoded;
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyUserSession(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Session has been revoked or expired. Please log in again.' });
    }

    req.user = decoded;
    // Sliding Session: issue a renewed token on every authenticated request
    const renewedToken = generateToken(decoded, decoded.sessionId);
    res.setHeader('X-Renewed-Token', renewedToken);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal authentication verification error.' });
  }
}

function superAdminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user && req.user.role === 'super_admin') {
      next();
    } else {
      res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
    }
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  verifyUserSession,
  authMiddleware,
  superAdminMiddleware,
  JWT_SECRET
};
