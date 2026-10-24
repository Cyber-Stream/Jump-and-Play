# Jump & Play backend

The contact form opens WhatsApp directly with the visitor's name, organization, email, phone, and message prefilled for +8801533580699. Visitors tap Send inside WhatsApp to deliver the message. This handoff runs synchronously from the submit gesture and does not wait for, or make, a database request. The form retains entered values; manual WhatsApp and copy-message fallbacks remain available when visitors return to the site.

The PostgreSQL enquiry API remains available for explicit integrations, with no admin dashboard or public enquiry listing. A database record is not a WhatsApp delivery confirmation. No automatic WhatsApp sending or email service is configured.

## Production

- Website: https://jump-and-play-bd.vercel.app
- The website form uses WhatsApp directly. `POST /api/enquiries` remains available for separate integrations: submit JSON containing `name`, `venue`, `email`, `phone`, `message`, and an empty `website` honeypot.
- Send a UUID v4 in `Idempotency-Key`. Retry the same payload with the same key after a timeout. Changed payloads require a new key.
- `GET /api/health`: checks the database migration is available; exposes no credentials or visitor information.
- Enquiries are available to the owner through the Neon database linked to the `jump-and-play` project in Vercel Storage. No enquiry data is exposed through a public read API.

## Local development

Use Node.js 24. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local` and configure a PostgreSQL connection and random secret, or pull the linked Vercel environment. Never commit environment files.

```
npm run db:migrate
npm test
npm run test:database
npm run build
npm run dev
```

The local site runs at http://localhost:3000. Database integration tests use uniquely labelled test data and remove their own rows. `npm run test:whatsapp` verifies direct WhatsApp navigation in Chromium, WebKit, and Firefox, including validation and Unicode. It intercepts the external navigation, sends no WhatsApp messages, and writes no database records. `python scripts/check-backend-browser.py` remains a compatibility wrapper for this test.

## Operational behavior

- Parameterized queries, server-side field validation, JSON-only requests, a 16 KiB body limit, same-site origin checks, and a honeypot protect submission handling.
- Five new submissions per IP per UTC clock hour. The shared database enforces limits atomically. Retries do not consume another submission. This is basic abuse control, not a CAPTCHA or a guarantee against distributed spam.
- Raw client IPs are never stored. An HMAC-derived value is retained in rate-limit buckets; expired buckets are removed as new submissions arrive.
- Idempotency and database writes are transactional. A successful response means the request is committed. Database outages return a retryable error without claiming success.
- Application error logs contain a request ID and generic failure code, not form contents or credentials.
- Required production secrets: `DATABASE_URL`, `RATE_LIMIT_SECRET`. Optional `ALLOWED_ORIGINS` accepts comma-separated additional exact origins.
- Functions and database run in Singapore. Secrets stay in server-side code; the static build contains no environment variables.
- The free database plan has provider quotas. Review usage, restore options, and business data-retention requirements in Neon as the service grows. Enquiries are retained until the owner removes them; there is no automatic enquiry deletion.

## Release

Apply the idempotent database migration before deploying API changes. Run tests and the static build, then `vercel deploy --prod --scope astro-kinetics`. The chosen hostname is a project production domain and should follow future production deployments. Check `/api/health` and the form after each release.

GitHub push still requires GitHub authorization. A direct Vercel deployment does not publish local commits to GitHub.

## Responsive site and media

The production build publishes assets referenced by the final HTML and CSS, including declared scene/runtime assets. Original footage remains in the workspace; runtime videos use H.264, yuv420p, AAC when audio exists, and fast-start MP4 metadata. Mobile background video is selected below 768 px. Posters, explicit play/pause controls, retry handling, and direct video links cover blocked autoplay and playback errors. Background video pauses offscreen and in hidden tabs; reduced-motion and data-saving preferences disable automatic playback while preserving manual play.

The original six-step 3D setup walkthrough and synchronized jump-to-dinosaur animation are restored, along with the branded intro timing, floating product photos, pulsing accents, word-by-word captions, and gallery rotation speed. Scene code loads only as its section approaches the viewport. Mobile scenes use a capped pixel ratio, smaller shadow maps, and a 30 fps rendering target; both scenes stop drawing offscreen, respect reduced motion, and retain pause/replay controls. Devices without WebGL receive explanatory text and the setup steps. `npm run test:animations` verifies scene rendering, all six setup stages, pause/replay, lazy loading, offscreen suspension, and reduced motion in desktop/mobile Chrome and a WebKit phone profile.

The hero uses a separate introduction frame so the video does not stretch across the product photos. Small phones use compact typography; safe-area insets protect navigation on notched screens. Short landscape viewports contain the portrait footage rather than cropping its top and bottom. The background loop is a silent, 10.5-second H.264 Constrained Baseline Level 3.1 MP4 at the original 464 x 832 portrait resolution, with a clear action poster and no opening black title frames. Regenerate just these assets with `python scripts/prepare-media.py --hero-only` (requires the local FFmpeg path in that script).

Safari's native muted inline autoplay remains enabled when motion and data preferences permit. Readiness, visibility, orientation, and page-return events recover interrupted playback; explicit pauses are retained while the page remains loaded. Page-hide state prevents delayed layout callbacks from restarting video while navigating away. A denied autoplay attempt leaves a poster, accessible status, and a synchronous tap-to-play control without a repeated retry loop. iOS can still require a tap in Low Power Mode or under browser autoplay restrictions; the site cannot override those settings. See [WebKit's iOS video policies](https://webkit.org/blog/6784/new-video-policies-for-ios/) and [its Low Power Mode explanation](https://bugs.webkit.org/show_bug.cgi?id=219889).

`npm run test:ios` checks WebKit with iPhone SE, iPhone 13, and iPad device profiles, portrait/landscape framing, video clock advancement, page-return recovery, preserved manual pause, and a simulated autoplay-policy denial followed by tap-to-play. Pass a production URL to check the deployed version.

Run `npm run test:responsive` after `npm run build` and `npm run dev` to test Chromium, WebKit, and Firefox across phone, tablet, and desktop viewports. Install test engines once with `npx playwright install webkit firefox`; Chromium uses the installed Google Chrome. `npm run test:responsive -- https://jump-and-play-bd.vercel.app` checks the deployed site. Results and screenshots are stored in ignored `.motion-qa/`. Emulation checks browser behavior and responsive layouts; physical-device and low-power-mode testing still depends on real hardware.
