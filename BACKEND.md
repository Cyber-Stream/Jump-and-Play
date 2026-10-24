# Jump & Play backend

The contact form saves product enquiries in PostgreSQL, then offers a WhatsApp link containing the original form details and saved reference. Visitors must tap Send in WhatsApp to deliver their message. If saving fails because of a network issue, server outage, or submission limit, the prefilled link remains available without claiming the enquiry was saved. A copy-message button and manual-copy fallback support browsers that cannot prefill or use the clipboard. There is no admin dashboard, public enquiry listing, automatic email, payment processing, or appointment reservation. A saved enquiry is a request for follow-up, not a confirmed booking.

## Production

- Website: https://jump-and-play-bd.vercel.app
- `POST /api/enquiries`: submit JSON containing `name`, `venue`, `email`, `phone`, `message`, and an empty `website` honeypot.
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

The local site runs at http://localhost:3000. Database integration tests use uniquely labelled test data and remove their own rows. `python scripts/check-backend-browser.py` runs a real Chrome form test against the local server, including a network failure and safe retry. It uses the existing local websocket test dependency in `.video-tools`.

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

The production build publishes only assets referenced by the final HTML and CSS. Simulated 3D scenes and prototype/demo copy are excluded. Original footage remains in the workspace; runtime videos use H.264, yuv420p, AAC when audio exists, and fast-start MP4 metadata. Mobile background video is selected below 768 px. Posters, explicit play/pause controls, retry handling, and direct video links cover blocked autoplay and playback errors. Background video pauses offscreen and in hidden tabs; reduced-motion and data-saving preferences disable automatic playback while preserving manual play.

Run `npm run test:responsive` after `npm run build` and `npm run dev` to test Chromium, WebKit, and Firefox across phone, tablet, and desktop viewports. Install test engines once with `npx playwright install webkit firefox`; Chromium uses the installed Google Chrome. `npm run test:responsive -- https://jump-and-play-bd.vercel.app` checks the deployed site. Results and screenshots are stored in ignored `.motion-qa/`. Emulation checks browser behavior and responsive layouts; physical-device and low-power-mode testing still depends on real hardware.
