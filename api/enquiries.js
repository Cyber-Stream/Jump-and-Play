const { createHmac, randomUUID } = require('node:crypto');
const { ApiError, validateEnquiry, requestKey, payloadHash } = require('../lib/validation.cjs');
const { saveEnquiry } = require('../lib/database.cjs');
const { checkOrigin, readJson, reply } = require('../lib/http.cjs');

function createHandler(store = saveEnquiry) {
  return async function handler(req, res) {
    const trace = randomUUID();
    res.setHeader('X-Request-Id', trace);
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new ApiError(405, 'method_not_allowed', 'Use POST to submit an enquiry.'); }
      checkOrigin(req);
      const body = await readJson(req);
      if (typeof body.website === 'string' && body.website.trim()) throw new ApiError(422, 'invalid_submission', 'Unable to accept this submission.');
      const key = requestKey(req.headers['idempotency-key']);
      const data = validateEnquiry(body);
      if (!process.env.RATE_LIMIT_SECRET || process.env.RATE_LIMIT_SECRET.length < 32) throw new Error('Rate limit configuration missing');
      // Vercel overwrites this header; never trust a client-provided X-Forwarded-For.
      const ip = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
      const ipHash = createHmac('sha256', process.env.RATE_LIMIT_SECRET).update(String(ip || 'unknown').split(',')[0].trim()).digest('hex');
      const row = await store(data, key, payloadHash(data), ipHash);
      return reply(res, row.is_duplicate ? 200 : 201, { ok: true, reference: row.enquiry_id, receivedAt: row.received_at, message: 'Your request has been saved. You can also contact us on WhatsApp.' });
    } catch (error) {
      if (error.code === 'P0001' && error.message.includes('rate_limited')) { res.setHeader('Retry-After', '3600'); return reply(res, 429, { ok: false, code: 'rate_limited', message: 'Too many requests. Please try again in an hour or contact us on WhatsApp.' }); }
      if (error.code === 'P0001' && error.message.includes('idempotency_conflict')) return reply(res, 409, { ok: false, code: 'idempotency_conflict', message: 'This request changed. Please try sending it again.' });
      if (error instanceof ApiError) return reply(res, error.status, { ok: false, code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
      console.error(JSON.stringify({ event: 'enquiry_failed', requestId: trace, code: 'storage_unavailable' }));
      return reply(res, 503, { ok: false, code: 'temporarily_unavailable', message: 'We could not save your request. Please try again shortly or contact us on WhatsApp.', requestId: trace });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
