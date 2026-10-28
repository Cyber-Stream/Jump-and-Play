const { chromium, webkit, firefox } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:3000';
const cases = [
  ['chromium-phone', chromium, 390, 844, true],
  ['chromium-desktop', chromium, 1440, 900, false],
  ['webkit-phone', webkit, 375, 667, true],
  ['webkit-tablet', webkit, 768, 1024, true],
  ['firefox-desktop', firefox, 1366, 768, false]
];
async function main() {
  for (const [name, type, width, height, mobile] of cases) {
    const browser = await type.launch(type === chromium ? { channel: 'chrome', headless: true } : { headless: true });
    try {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
      let handoff, writes = 0;
      // Inspect the real navigation while preventing any external WhatsApp request.
      await context.route('https://wa.me/**', async route => {
        handoff = route.request().url();
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>WhatsApp handoff verified</h1>' });
      });
      await context.route('**/api/enquiries', route => { writes++; return route.abort(); });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof submitEnquiry === 'function');
      await page.evaluate(() => skipIntro());
      const form = page.locator('.contact-form');
      await form.locator('button[type=submit]').click();
      assert.equal(handoff, undefined, 'Empty form navigated to WhatsApp');
      const values = { name: "Rahim O'Connor", venue: 'Gym & Play + Dhaka #1', email: 'direct-test@example.invalid', phone: '+880 1500000000', message: 'ঢাকায় প্ল্যাটফর্ম চাই 🎮 & ১০০% + #?=\nPlease send pricing and availability.' };
      for (const [key, value] of Object.entries(values)) await form.locator(`[name=${key}]`).fill(value);
      await form.locator('[name=phone]').fill('invalid number');
      await form.locator('button[type=submit]').click();
      assert.equal(handoff, undefined, 'Invalid phone navigated to WhatsApp');
      await form.locator('[name=phone]').fill(values.phone);
      await Promise.all([
        page.waitForURL(url => url.hostname === 'wa.me'),
        form.locator('button[type=submit]').click()
      ]);
      const url = new URL(handoff);
      assert.equal(url.origin, 'https://wa.me');
      assert.equal(url.pathname, '/8801533580699');
      assert.deepEqual([...url.searchParams.keys()], ['text']);
      const text = url.searchParams.get('text');
      assert.ok(Object.values(values).every(value => text.includes(value)), 'Some form details were lost');
      assert.ok(!text.includes('Request reference:'), 'Unexpected database prerequisite');
      assert.equal(writes, 0, 'Direct handoff waited for a database write');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ browser: name, directWhatsApp: true, correctRecipient: true, allFieldsAndUnicode: true, validation: true, databaseRequests: writes, externalMessageSent: false }));
    } finally { await browser.close(); }
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
