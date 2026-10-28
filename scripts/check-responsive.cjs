const { chromium, webkit, firefox } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:3000';
const out = path.resolve(__dirname, '../.motion-qa');
fs.mkdirSync(out, { recursive: true });
const results = [];
const configurations = [
  ['chromium', chromium, [[320,740],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]]],
  ['webkit', webkit, [[375,667],[768,1024],[1440,900]]],
  ['firefox', firefox, [[390,844],[1024,768],[1440,900]]]
];
async function advancing(video) {
  await video.evaluate(v => { v.muted = true; });
  try {
    await video.page().waitForFunction(el => !el.paused && el.readyState >= 2, await video.elementHandle(), { timeout: 20000 });
  } catch (error) {
    console.error(JSON.stringify(await video.evaluate(v => ({ paused: v.paused, readyState: v.readyState, currentTime: v.currentTime,
      error: v.error?.message, visibility: document.visibilityState, bounds: v.getBoundingClientRect().toJSON(),
      button: document.querySelector('.hero-video-toggle').textContent, scrollY }))));
    await video.page().screenshot({ path: path.join(out, 'playback-failure.png') });
    throw error;
  }
  const before = await video.evaluate(v => v.currentTime);
  await video.page().waitForTimeout(450);
  assert.ok((await video.evaluate(v => v.currentTime)) > before, 'Video clock did not advance');
}
async function noOverflow(page, label) {
  const measurements = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(measurements.scroll <= measurements.width + 1, `${label}: horizontal overflow ${JSON.stringify(measurements)}`);
}
async function run() {
  for (const [name, type, sizes] of configurations) {
    if (process.env.QA_BROWSER && name !== process.env.QA_BROWSER) continue;
    const browser = await type.launch(name === 'chromium' ? { channel: 'chrome', headless: true } : { headless: true });
    try {
      for (const [width, height] of sizes) {
        if (process.env.QA_WIDTH && width !== Number(process.env.QA_WIDTH)) continue;
        const mobile = name !== 'firefox' && width < 1100;
        const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        const requests = [];
        page.on('request', request => requests.push(request.url()));
        await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForFunction(() => typeof skipIntro === 'function' && document.querySelector('.hero-bg-video').dataset.playback);
        await page.evaluate(() => skipIntro());
        await page.waitForTimeout(1000);
        await noOverflow(page, `${name} ${width}`);
        assert.equal(await page.locator('#howExperience,#jumpExperience').count(), 2, 'Restored animations are missing');
        const copy = await page.locator('body').innerText();
        assert.ok(!/\b(?:demo|prototype|placeholder|coming soon)\b/i.test(copy), 'Unfinished copy remained');
        assert.ok(requests.some(url => /three\.min/.test(url)) && requests.some(url => /how-it-works\.js/.test(url)) && requests.some(url => /jumpplay-experience\.js/.test(url)), 'Original scene scripts did not load');
        const hero = page.locator('.hero-bg-video');
        await advancing(hero);
        assert.ok(await hero.evaluate(v => v.muted && v.playsInline), 'Background video is not muted and inline');
        const source = await hero.evaluate(v => v.currentSrc);
        assert.ok(source.includes(width <= 767 ? 'hero-mobile' : 'hero-desktop'), `Incorrect responsive source: ${source}`);
        await page.locator('.hero-video-toggle').click();
        assert.ok(await hero.evaluate(v => v.paused), 'Manual pause failed');
        await page.locator('#contact').scrollIntoViewIfNeeded();
        await noOverflow(page, `${name} ${width} contact`);
        if (width < 640) assert.ok(await page.locator('#contact-email').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 16), 'Input can trigger mobile zoom');
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(200);
        assert.ok(await hero.evaluate(v => v.paused), 'Scroll overrode manual pause');
        await page.locator('.hero-video-toggle').click();
        await advancing(hero);
        await page.locator('#action').scrollIntoViewIfNeeded();
        await page.waitForFunction(el => { const bounds = el.getBoundingClientRect(); return bounds.bottom <= 0 || bounds.top >= innerHeight; }, await hero.elementHandle(), { timeout: 5000 });
        await page.waitForFunction(el => el.paused, await hero.elementHandle(), { timeout: 5000 });
        assert.ok(await hero.evaluate(v => v.paused), 'Offscreen background video continued running');
        // Test every real clip in each engine, with real pointer/touch activation.
        if (width === sizes[0][0]) {
          const cards = page.locator('.action-card');
          for (let i = 0; i < await cards.count(); i++) {
            const card = cards.nth(i), video = card.locator('video');
            await card.locator('.action-toggle').click();
            await advancing(video);
            await card.locator('.action-toggle').click();
            assert.ok(await video.evaluate(v => v.paused), `Clip ${i} did not pause`);
            assert.ok(await video.evaluate(v => !!v.poster && v.playsInline), `Clip ${i} has no mobile poster/inline support`);
          }
        }
        for (const gallery of ['platform','tech']) {
          await page.locator(`#${gallery}GalleryOpen`).click();
          const dialog = page.locator(`#${gallery}Gallery`);
          await page.waitForTimeout(400);
          await dialog.locator('.carousel-pause').click();
          const before = await dialog.locator('.carousel-ring').evaluate(e => e.style.transform);
          await page.waitForTimeout(300);
          assert.equal(await dialog.locator('.carousel-ring').evaluate(e => e.style.transform), before, 'Paused gallery kept animating');
          await dialog.locator('.carousel-next').click();
          await page.waitForTimeout(900);
          assert.notEqual(await dialog.locator('.carousel-ring').evaluate(e => e.style.transform), before, 'Gallery next button failed');
          const bounds = await dialog.boundingBox();
          assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Gallery exceeds viewport');
          await dialog.locator('.gallery-close').click();
          await page.waitForTimeout(300);
          assert.equal(await dialog.evaluate(e => e.open), false);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForTimeout(250);
        assert.ok(await hero.evaluate(v => v.paused), 'Reduced motion did not stop background video');
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        const hiddenContent = await page.locator('.reveal').evaluateAll(nodes => nodes.filter(e => Number(getComputedStyle(e).opacity) < .99).map(e => ({ element: e.className, opacity: getComputedStyle(e).opacity })));
        assert.deepEqual(hiddenContent, [], `Reduced motion hid content: ${name} ${width}`);
        assert.deepEqual(errors, [], 'Browser JavaScript errors');
        const navigation = await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0];
          return { documentBytes: n.decodedBodySize, domReadyMs: Math.round(n.domContentLoadedEventEnd) };
        });
        assert.ok(navigation.documentBytes < 50000, 'Document grew beyond the optimized budget');
        if (name === 'chromium' && [390,768,1440].includes(width)) await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        const report = { browser: name, width, height, heroPlayback: true, responsiveVideo: true, clipPlayback: width === sizes[0][0], galleryControls: true, reducedMotion: true, errors, ...navigation };
        results.push(report); console.log(JSON.stringify(report));
        await context.close();
      }
      if (name === 'chromium') {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await context.addInitScript(() => {
          const nativePlay = HTMLMediaElement.prototype.play;
          window.blockBackgroundPlayback = true;
          HTMLMediaElement.prototype.play = function() {
            if (this.classList.contains('hero-bg-video') && window.blockBackgroundPlayback) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
            return nativePlay.call(this);
          };
        });
        const page = await context.newPage();
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof skipIntro === 'function');
        await page.evaluate(() => skipIntro());
        await page.waitForTimeout(600);
        const video = page.locator('.hero-bg-video');
        assert.ok(await video.evaluate(v => v.paused && !!v.poster), 'Blocked autoplay has no poster');
        await page.evaluate(() => { window.blockBackgroundPlayback = false; });
        await page.locator('.hero-video-toggle').click();
        await advancing(video);
        console.log(JSON.stringify({ browser: name, blockedAutoplayFallback: true, tapToPlay: true }));
        await context.close();
        const saving = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        await saving.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, addEventListener() {} } });
          const nativePlay = HTMLMediaElement.prototype.play;
          window.blockClipPlayback = true;
          HTMLMediaElement.prototype.play = function() {
            if (this.classList.contains('action-video') && window.blockClipPlayback) return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
            return nativePlay.call(this);
          };
        });
        const savePage = await saving.newPage();
        await savePage.goto(base, { waitUntil: 'domcontentloaded' });
        await savePage.waitForFunction(() => typeof skipIntro === 'function' && document.querySelector('.hero-bg-video').dataset.playback);
        await savePage.evaluate(() => skipIntro());
        assert.ok(await savePage.locator('.hero-bg-video').evaluate(v => v.paused), 'Data-saving preference was ignored');
        await savePage.locator('.hero-video-toggle').click();
        await advancing(savePage.locator('.hero-bg-video'));
        const firstCard = savePage.locator('.action-card').first();
        await firstCard.locator('.action-toggle').click();
        await savePage.waitForFunction(() => document.querySelector('.action-card .video-status').textContent.includes('Unable to play'));
        assert.ok(await firstCard.locator('.video-direct').isVisible(), 'No direct link after playback failure');
        await savePage.evaluate(() => { window.blockClipPlayback = false; });
        await firstCard.locator('.action-toggle').click();
        await advancing(firstCard.locator('video'));
        console.log(JSON.stringify({ browser: name, dataSaverRespected: true, explicitPlayWorks: true, clipFailureRetry: true, directVideoFallback: true }));
        await saving.close();
      }
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(out, 'responsive-results.json'), JSON.stringify(results, null, 2));
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
