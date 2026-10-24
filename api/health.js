const { database } = require('../lib/database.cjs');
const { reply } = require('../lib/http.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return reply(res, 405, { ok: false }); }
  try {
    if (!process.env.RATE_LIMIT_SECRET || process.env.RATE_LIMIT_SECRET.length < 32) throw new Error('Configuration missing');
    const rows = await database()`SELECT version FROM schema_migrations WHERE version = 1`;
    if (!rows.length) throw new Error('Migration missing');
    return reply(res, 200, { ok: true, service: 'jump-and-play-api' });
  } catch { return reply(res, 503, { ok: false, service: 'jump-and-play-api' }); }
};
