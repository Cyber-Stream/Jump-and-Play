const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../jumpplay_website (Shafin&Zawad).html'), 'utf8');
const start = source.indexOf('  function buildWhatsAppRequest(form) {');
const end = source.indexOf('  function handleSubmit(event)', start);
const build = vm.runInNewContext(source.slice(start, end) + '\nbuildWhatsAppRequest;', {
  FormData: class { constructor(values) { return new Map(Object.entries(values)); } }
});
const values = { name: '  Rahim Ahmed  ', venue: 'Gym & Gaming + Dhaka', email: 'rahim+demo@example.com', phone: '+880 1500000000', message: 'Demo request? Price = 50% & delivery #1\nSecond line.' };
test('WhatsApp recipient is the exact international business number', () => {
  const url = new URL(build(values));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/8801533580699');
  assert.deepEqual([...url.searchParams.keys()], ['text']);
});
test('all form details survive URL encoding with line breaks and reserved characters', () => {
  const text = new URL(build(values)).searchParams.get('text');
  assert.equal(text, [
    'Jump & Play - Platform Request', '', 'Name: Rahim Ahmed',
    'Gym / Gaming Zone / Organization: Gym & Gaming + Dhaka',
    'Email: rahim+demo@example.com', 'Phone: +880 1500000000', '', 'Message:', values.message
  ].join('\n'));
});
test('Bangla, accents, apostrophes, emojis and Unicode survive unchanged', () => {
  const message = "ঢাকায় ডেমো চাই 🎮 — café / O'Connor & ১০০% + #?= 🏃‍♂️";
  const text = new URL(build({ ...values, message })).searchParams.get('text');
  assert.ok(text.endsWith(message));
});
test('maximum-length messages are not truncated by our handoff', () => {
  const message = 'বাংলা & + % # 😀\n'.repeat(400).slice(0, 4000);
  assert.equal(new URL(build({ ...values, message })).searchParams.get('text').split('Message:\n')[1], message.trim());
});
