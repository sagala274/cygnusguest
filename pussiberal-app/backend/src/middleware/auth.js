const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Algoritma dikunci ke HS256 (satu-satunya yang dipakai jwt.sign() di
    // routes/auth.js) -- tanpa ini, jwt.verify menerima algoritma apa pun
    // yang tertulis di header token itu sendiri, celah klasik "algorithm
    // confusion" (mis. token dipalsukan dengan alg "none" atau menyalahgunakan
    // kunci publik sebagai secret HMAC kalau suatu saat dicampur dengan RS256).
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk aksi ini' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
