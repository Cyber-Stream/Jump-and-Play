const { ApiError } = require('./validation.cjs');
const origins = ['https://jump-and-play-bd.vercel.app', 'https://jump-and-play-ruby.vercel.app'];
function checkOrigin(req) {
  const allowed = new Set([...origins, ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)]);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_ENV !== 'production') allowed.add('http://localhost:3000');
  if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && !allowed.has(req.headers.origin))) throw new ApiError(403, 'origin_denied', 'Please submit your request from the Jump & Play website.');
}
async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  if (Number(req.headers['content-length']) > 16384) throw new ApiError(413, 'body_too_large', 'Your request is too large.');
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : String(req.body);
  else {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 16384) throw new ApiError(413, 'body_too_large', 'Your request is too large.');
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > 16384) throw new ApiError(413, 'body_too_large', 'Your request is too large.');
  try { return JSON.parse(raw); } catch { throw new ApiError(400, 'invalid_json', 'Please send valid JSON.'); }
}
function reply(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(data);
}
module.exports = { checkOrigin, readJson, reply };
