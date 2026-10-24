const { webkit, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const output = path.resolve(__dirname, '../.motion-qa');
fs.mkdirSync(output, { recursive: true });

async function advancing(page) {
  await page.waitForFunction(() => {
    const video = document.querySelector('.hero-bg-video');
    return !video.paused && video.readyState >= 2;
  }, null, { timeout: 20000 }).catch(async error => {
    console.error(await page.locator('.hero-bg-video').evaluate(v => ({ paused: v.paused, ready: v.readyState,
      error: v.error?.message, source: v.currentSrc, state: v.dataset.playback, autoplay: v.autoplay,
      button: document.querySelector('.hero-video-toggle').textContent, attempts: window.playAttempts })));
    throw error;
  });
  const before = await page.locator('.hero-bg-video').evaluate(v => v.currentTime);
  await page.waitForFunction(time => {
    const video = document.querySelector('.hero-bg-video');
    return !video.paused && Math.abs(video.currentTime - time) > .12;
  }, before, { timeout: 10000 });
}

async function framing(page) {
  const frame = await page.evaluate(() => {
    const video = document.querySelector('.hero-bg-video').getBoundingClientRect();
    const stage = document.querySelector('.hero-stage').getBoundingClientRect();
    const photos = document.querySelector('.platform-showcase').getBoundingClientRect();
    return { videoHeight: video.height, stageHeight: stage.height, videoWidth: video.width,
      viewport: innerWidth, overflow: document.documentElement.scrollWidth, photoTop: photos.top, stageBottom: stage.bottom };
  });
  assert.ok(Math.abs(frame.videoHeight - frame.stageHeight) < 2, 'Video escaped its introduction frame');
  assert.ok(frame.photoTop >= frame.stageBottom - 1, 'Video framing includes the product photos');
  assert.ok(frame.videoWidth <= frame.viewport + 1 && frame.overflow <= frame.viewport + 1, 'Horizontal overflow');
}

(async () => {
  const browser = await webkit.launch({ headless: true });
  try {
    for (const name of ['iPhone SE', 'iPhone 13', 'iPad (gen 7)']) {
      if (process.env.QA_DEVICE && process.env.QA_DEVICE !== name) continue;
      const context = await browser.newContext({ ...devices[name] });
      await context.addInitScript(() => {
        window.videoAudit = [];
        for (const method of ['play', 'pause']) {
          const original = HTMLMediaElement.prototype[method];
          HTMLMediaElement.prototype[method] = function(...args) {
            if (this.classList.contains('hero-bg-video')) window.videoAudit.push({ method, paused: this.paused, autoplay: this.autoplay, at: Math.round(performance.now()) });
            return original.apply(this, args);
          };
        }
        document.addEventListener('click', event => {
          if (event.target.closest('.hero-video-toggle')) window.videoAudit.push({ method: 'click', paused: document.querySelector('.hero-bg-video').paused, label: event.target.textContent, at: Math.round(performance.now()) });
        }, { capture: true });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof skipIntro === 'function');
      await page.evaluate(() => skipIntro());
      await advancing(page);
      assert.ok(await page.locator('.hero-bg-video').evaluate(v => v.autoplay && v.muted && v.defaultMuted && v.playsInline), 'Safari autoplay/inline properties missing');
      await framing(page);
      await page.screenshot({ path: path.join(output, `ios-${name.replace(/[^a-z0-9]/gi, '-')}.png`) });
      const portrait = page.viewportSize();
      await page.setViewportSize({ width: portrait.height, height: portrait.width });
      await advancing(page);
      await framing(page);
      await page.screenshot({ path: path.join(output, `ios-${name.replace(/[^a-z0-9]/gi, '-')}-landscape.png`) });
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      assert.ok(await page.locator('.hero-bg-video').evaluate(v => v.paused));
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await advancing(page);
      await page.locator('.hero-video-toggle').scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      if (await page.locator('.hero-bg-video').evaluate(v => v.paused)) {
        await page.locator('.hero-video-toggle').click();
        await advancing(page);
      }
      await page.locator('.hero-video-toggle').click();
      const pausedByUser = await page.locator('.hero-bg-video').evaluate(v => ({ paused: v.paused, autoplay: v.autoplay, state: v.dataset.playback, button: document.querySelector('.hero-video-toggle').textContent }));
      if (!pausedByUser.paused) console.error(await page.evaluate(() => window.videoAudit));
      assert.ok(pausedByUser.paused, `${name}: pause failed ${JSON.stringify(pausedByUser)}`);
      await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      assert.ok(await page.locator('.hero-bg-video').evaluate(v => v.paused && !v.autoplay), 'Returning to page overrode manual pause');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ device: name, autoplay: true, portraitAndLandscape: true, lifecycleRecovery: true, manualPausePreserved: true }));
      await context.close();
    }

    // Emulate an autoplay policy denial at both the native attribute and play() boundaries.
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    await context.route(`${base}/`, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('class="hero-bg-video" autoplay', 'class="hero-bg-video"') });
    });
    await context.addInitScript(() => {
      window.autoplayDenied = true;
      window.playAttempts = 0;
      document.addEventListener('click', event => {
        if (event.target.closest('.hero-video-toggle')) window.autoplayDenied = false;
      }, { capture: true });
      const original = HTMLMediaElement.prototype.play;
      const autoplay = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');
      Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', {
        configurable: true, get: autoplay.get,
        set(value) { autoplay.set.call(this, window.autoplayDenied ? false : value); }
      });
      HTMLMediaElement.prototype.play = function() {
        window.playAttempts++;
        return window.autoplayDenied ? Promise.reject(new DOMException('Autoplay denied', 'NotAllowedError')) : original.call(this);
      };
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.hero-bg-video').dataset.playback === 'blocked');
    // Reveal the content without a click that would itself unlock playback.
    await page.evaluate(() => skipIntro());
    await page.waitForTimeout(800);
    assert.ok(await page.locator('.hero-bg-video').evaluate(v => v.paused && v.poster.includes('hero-poster-v2')));
    assert.match(await page.locator('.hero-video-status').textContent(), /Tap Play/);
    const attempts = await page.evaluate(() => window.playAttempts);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.playAttempts), attempts, 'Blocked playback entered a retry loop');
    await page.locator('.hero-video-toggle').click();
    await advancing(page);
    assert.equal(await page.locator('.hero-video-status').textContent(), '');
    console.log(JSON.stringify({ device: 'iPhone 13', blockedAutoplayPoster: true, noRetryLoop: true, tapToPlay: true }));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
