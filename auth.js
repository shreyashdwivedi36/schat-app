const crypto = require('crypto');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  bcrypt = {
    hashSync: (pwd) => crypto.createHash('sha256').update(pwd + 'salt_key_123').digest('hex'),
    compareSync: (pwd, hash) => crypto.createHash('sha256').update(pwd + 'salt_key_123').digest('hex') === hash
  };
}

let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  jwt = {
    sign: (payload, secret, opts = {}) => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
      const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      return `${header}.${body}.${signature}`;
    },
    verify: (token, secret) => {
      const [header, body, signature] = token.split('.');
      if (!header || !body || !signature) throw new Error('Invalid token');
      const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      if (signature !== expectedSig) throw new Error('Signature mismatch');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
      return payload;
    }
  };
}

// Stable JWT Secret for consistent authentication across server restarts
const JWT_SECRET = process.env.JWT_SECRET || 'schat_stable_production_jwt_secret_key_2026';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = decoded;
  next();
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  JWT_SECRET
};
