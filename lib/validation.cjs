const { createHash } = require('node:crypto');
class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message); Object.assign(this, { status, code, fields });
  }
}
function validateEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_body', 'Please send a valid request.');
  const fields = {};
  const result = {};
  const limits = { name: [2, 120], venue: [2, 200], email: [3, 254], phone: [7, 30], message: [10, 4000] };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = typeof body[key] === 'string' ? body[key].trim().normalize('NFC') : '';
    result[key] = key === 'email' ? value.toLowerCase() : value;
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fields[key] = `Use ${min}–${max} characters.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fields.email = 'Enter a valid email address.';
  const digits = result.phone.replace(/\D/g, '');
  if (!/^[+\d\s().-]+$/.test(result.phone) || digits.length < 7 || digits.length > 15) fields.phone = 'Enter a valid phone number with 7–15 digits.';
  if (Object.keys(fields).length) throw new ApiError(422, 'validation_failed', 'Please check the highlighted fields.', fields);
  return result;
}
function payloadHash(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function requestKey(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'invalid_request_key', 'Refresh the page and try again.');
  return value.toLowerCase();
}
module.exports = { ApiError, validateEnquiry, payloadHash, requestKey };
