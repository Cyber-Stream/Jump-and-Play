const { chromium, webkit, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://localhost:3000';
const output = path.resolve(__dirname, '../.motion-qa');
fs.mkdirSync(output, { recursive: true });
async function stoppedDrawing(page, id) {
  let previous = await page.evaluate(id => window.sceneDraws[id], id), quiet = 0;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(200);
    const current = await page.evaluate(id => window.sceneDraws[id], id);
    quiet = current === previous ? quiet + 1 : 0;
    if (quiet === 3) return;
    previous = current;
  }
  assert.fail(`${id}: paused animation kept drawing`);
}
const showViewport = host => host.locator('.experience-viewport').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));

(async () => {
  for (const [name, engine, options] of [
    ['chrome-desktop', chromium, { viewport: { width: 1440, height: 900 } }],
    ['chrome-phone', chromium, { ...devices['iPhone 13'], defaultBrowserType: undefined }],
    ['webkit-phone', webkit, { ...devices['iPhone 13'] }]
  ]) {
    if (process.env.QA_BROWSER && !name.startsWith(process.env.QA_BROWSER)) continue;
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome', headless: true } : { headless: true });
    try {
      const context = await browser.newContext(options);
      await context.addInitScript(() => {
        window.sceneDraws = {};
        for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
          for (const method of ['drawElements', 'drawArrays']) {
            const original = type.prototype[method];
            type.prototype[method] = function(...args) {
              const id = this.canvas.closest('[data-scene]')?.id;
              if (id) window.sceneDraws[id] = (window.sceneDraws[id] || 0) + 1;
              return original.apply(this, args);
            };
          }
        }
      });
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#heroContent').classList.contains('show'));
      assert.equal(await page.locator('.platform-img-wrap').first().evaluate(e => getComputedStyle(e).animationName), 'float');
      assert.equal(await page.locator('.hero-eyebrow').evaluate(e => getComputedStyle(e, '::before').animationName), 'blink');
      assert.ok(requests.some(url => /three\.min\.js\?rev=original-602d465/.test(url)), 'Original 3D runtime did not load with the page');
      assert.equal(await page.locator('#howExperience[data-ready="true"],#jumpExperience[data-ready="true"]').count(), 2, 'Original scenes did not initialize with the page');
      const rendered = [];
      for (const id of ['howExperience', 'jumpExperience']) {
        const host = page.locator(`#${id}`);
        await host.scrollIntoViewIfNeeded();
        await page.waitForFunction(id => {
          const host = document.getElementById(id);
          return host.dataset.ready === 'true' || host.classList.contains('experience-fallback');
        }, id, { timeout: 30000 });
        await showViewport(host);
        const fallback = await host.evaluate(e => e.classList.contains('experience-fallback'));
        if (fallback) {
          assert.equal(engine, webkit, `${name}: WebGL unavailable`);
          assert.ok((await host.locator('.experience-status').textContent()).length > 20);
          rendered.push({ id, fallback: true });
          continue;
        }
        await page.waitForFunction(id => window.sceneDraws[id] > 0, id);
        const before = await page.evaluate(id => window.sceneDraws[id], id);
        await page.waitForFunction(({ id, before }) => window.sceneDraws[id] > before, { id, before });
        await host.locator('.experience-pause').click();
        await showViewport(host);
        // A paused scene still paints once when it becomes visible or is resized.
        await stoppedDrawing(page, id);
        if (id === 'howExperience') {
          for (let i = 0; i < 6; i++) {
            await host.locator('.walkthrough-stage-button').nth(i).click();
            await showViewport(host);
            await page.waitForFunction(({ id, stage }) => document.getElementById(id).dataset.stage === stage, { id, stage: String(i) });
          }
        }
        await page.screenshot({ path: path.join(output, `restored-${name}-${id}.png`) });
        await host.locator('.experience-replay').click();
        await showViewport(host);
        const replay = await page.evaluate(id => window.sceneDraws[id], id);
        await page.waitForFunction(({ id, before }) => window.sceneDraws[id] > before, { id, before: replay });
        rendered.push({ id, rendered: true, pause: true, replay: true, steps: id === 'howExperience' ? 6 : undefined });
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(600);
      const offscreen = await page.evaluate(() => ({ ...window.sceneDraws }));
      await page.waitForTimeout(400);
      assert.deepEqual(await page.evaluate(() => window.sceneDraws), offscreen, 'Offscreen scenes continued rendering');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.platform-img-wrap')).animationName === 'none');
      assert.equal(await page.locator('.platform-img-wrap').first().evaluate(e => getComputedStyle(e).animationName), 'none');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile layout overflow');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ browser: name, floatingImages: true, pulsingAccents: true, originalScenesInitialized: true, offscreenPause: true, reducedMotion: true, scenes: rendered }));
      await context.close();
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
