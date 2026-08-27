const pool = require('../db');

async function logAudit(userId, action, objectType, objectId, detail) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, object_type, object_id, detail) VALUES (:userId, :action, :objectType, :objectId, :detail)',
      {
        userId: userId || null,
        action,
        objectType: objectType || null,
        objectId: objectId || null,
        detail: detail ? JSON.stringify(detail) : null,
      }
    );
  } catch (err) {
    console.error('Gagal menulis audit log', err);
  }
}

module.exports = { logAudit };
