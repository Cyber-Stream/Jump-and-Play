# Jump & Play backend

The contact form saves demonstration enquiries in PostgreSQL, then offers a WhatsApp link containing the original form details and saved reference. Visitors must tap Send in WhatsApp to deliver their message. If saving fails because of a network issue, server outage, or submission limit, the prefilled link remains available without claiming the enquiry was saved. A copy-message button and manual-copy fallback support browsers that cannot prefill or use the clipboard. There is no admin dashboard, public enquiry listing, automatic email, payment processing, or appointment reservation. A saved enquiry is a request for follow-up, not a confirmed booking.

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
