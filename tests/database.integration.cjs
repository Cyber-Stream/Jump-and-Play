const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { database, saveEnquiry } = require('../lib/database.cjs');
const { payloadHash } = require('../lib/validation.cjs');
test('real PostgreSQL: concurrent retries, conflicts, rate limits, and parameter safety', async () => {
  const sql = database();
  const ip = `integration-${randomUUID()}`;
  const data = { name: "Test O'Connor", venue: 'Integration Test', email: 'backend-test@example.invalid', phone: '+8801500000000', message: "Automated test only; quote '); DROP TABLE enquiries; --" };
  const keys = Array.from({ length: 7 }, () => randomUUID());
  try {
    const rows = await Promise.all(Array.from({ length: 8 }, () => saveEnquiry(data, keys[0], payloadHash(data), ip)));
    assert.equal(new Set(rows.map(row => row.enquiry_id)).size, 1);
    assert.equal(rows.filter(row => !row.is_duplicate).length, 1);
    const saved = await sql`SELECT message FROM enquiries WHERE request_key = ${keys[0]}::uuid`;
    assert.equal(saved[0].message, data.message);
    await assert.rejects(saveEnquiry({ ...data, venue: 'Changed' }, keys[0], payloadHash({ ...data, venue: 'Changed' }), ip), /idempotency_conflict/);
    const burst = await Promise.allSettled(keys.slice(1).map(key => saveEnquiry(data, key, payloadHash(data), ip)));
    assert.equal(burst.filter(r => r.status === 'fulfilled').length, 4);
    assert.equal(burst.filter(r => r.status === 'rejected' && r.reason.message.includes('rate_limited')).length, 2);
    const count = await sql`SELECT count(*)::int AS count FROM enquiries WHERE request_key = ANY(${keys}::uuid[])`;
    assert.equal(count[0].count, 5);
    const retry = await saveEnquiry(data, keys[0], payloadHash(data), ip);
    assert.equal(retry.is_duplicate, true);
  } finally {
    await sql.transaction([
      sql`DELETE FROM enquiries WHERE request_key = ANY(${keys}::uuid[])`,
      sql`DELETE FROM submission_limits WHERE ip_hash = ${ip}`
    ]);
  }
});
