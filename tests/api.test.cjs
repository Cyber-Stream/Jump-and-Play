const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { createHandler } = require('../api/enquiries.js');
const { validateEnquiry } = require('../lib/validation.cjs');
process.env.RATE_LIMIT_SECRET = 'test-only-secret-which-is-at-least-32-characters';
const valid = { name: 'Test Visitor', venue: 'Test Gym', email: 'visitor@example.com', phone: '+880 1500000000', message: 'Please arrange a platform demonstration.' };
function request(changes = {}) {
  return { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://jump-and-play-bd.vercel.app', 'idempotency-key': randomUUID() }, socket: { remoteAddress: '127.0.0.1' }, body: valid, ...changes };
}
function response() { return { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } }; }
async function run(req, store) {
  const res = response();
  await createHandler(store || (async () => ({ enquiry_id: randomUUID(), received_at: new Date().toISOString(), is_duplicate: false })))(req, res);
  return res;
}
test('valid enquiry saved; response exposes only reference and timestamp', async () => {
  const res = await run(request());
  assert.equal(res.statusCode, 201); assert.ok(res.body.reference);
  assert.equal(res.body.email, undefined); assert.equal(res.headers['cache-control'], 'no-store');
});
test('normalizes whitespace, Unicode and email case', () => {
  const result = validateEnquiry({ ...valid, name: '  Test Visitor  ', email: 'VISITOR@EXAMPLE.COM' });
  assert.equal(result.name, 'Test Visitor'); assert.equal(result.email, 'visitor@example.com');
});
for (const [field, value] of [['name', ' '], ['venue', 'x'], ['email', 'bad'], ['phone', 'abcd1234567'], ['message', 'short'], ['message', 'x'.repeat(4001)], ['name', 'Test\u0000Visitor']]) {
  test(`rejects invalid ${field}: ${String(value).slice(0, 15)}`, async () => {
    const res = await run(request({ body: { ...valid, [field]: value } }), async () => assert.fail('must not save invalid data'));
    assert.equal(res.statusCode, 422); assert.ok(res.body.fields[field]);
  });
}
test('disallows public read and modification methods', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
    const res = await run(request({ method })); assert.equal(res.statusCode, 405); assert.equal(res.headers.allow, 'POST');
  }
});
test('rejects foreign origins and cross-site requests', async () => {
  for (const headers of [{ origin: 'https://attacker.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const req = request(); Object.assign(req.headers, headers);
    assert.equal((await run(req)).statusCode, 403);
  }
});
test('requires JSON and valid retry key', async () => {
  let req = request(); req.headers['content-type'] = 'text/plain'; assert.equal((await run(req)).statusCode, 415);
  req = request(); delete req.headers['idempotency-key']; assert.equal((await run(req)).statusCode, 400);
});
test('rejects malformed JSON, arrays, and oversized bodies', async () => {
  assert.equal((await run(request({ body: '{bad' }))).statusCode, 400);
  assert.equal((await run(request({ body: [] }))).statusCode, 400);
  assert.equal((await run(request({ body: { message: 'x'.repeat(17000) } }))).statusCode, 413);
});
test('limits streamed request size before parsing', async () => {
  const req = Readable.from(['x'.repeat(17000)]); Object.assign(req, request({ body: undefined }));
  assert.equal((await run(req)).statusCode, 413);
});
test('honeypot rejects bots before writing', async () => {
  assert.equal((await run(request({ body: { ...valid, website: 'spam.example' } }))).statusCode, 422);
});
test('retry returns success without a fresh confirmation reference', async () => {
  const id = randomUUID(); const res = await run(request(), async () => ({ enquiry_id: id, received_at: '2026-10-24T00:00:00Z', is_duplicate: true }));
  assert.equal(res.statusCode, 200); assert.equal(res.body.reference, id);
});
test('maps database rate limit and retry conflict to usable responses', async () => {
  for (const [message, status] of [['rate_limited', 429], ['idempotency_conflict', 409]]) {
    const res = await run(request(), async () => { throw Object.assign(new Error(message), { code: 'P0001' }); });
    assert.equal(res.statusCode, status);
    if (status === 429) assert.equal(res.headers['retry-after'], '3600');
  }
});
test('hashes IP and never passes the raw address to storage', async () => {
  await run(request(), async (data, key, hash, ipHash) => {
    assert.match(ipHash, /^[a-f0-9]{64}$/); assert.match(hash, /^[a-f0-9]{64}$/);
    return { enquiry_id: randomUUID() };
  });
});
test('database failures do not expose exception details', async () => {
  const res = await run(request(), async () => { throw new Error('postgresql://secret-password@private-host'); });
  assert.equal(res.statusCode, 503); assert.ok(!JSON.stringify(res.body).includes('secret-password'));
});
