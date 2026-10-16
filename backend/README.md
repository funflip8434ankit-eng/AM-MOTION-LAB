# AM Motion Lab — Payment Backend

Keeps the Razorpay **secret key** off the website. The frontend only ever holds the public Key ID.

## Required environment variables
Set these in `backend/.env` locally and in the backend host's secret environment settings in production:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random private secret of at least 32 characters |
| `RAZORPAY_KEY_ID` | Razorpay public checkout key; test key for testing, live key only after go-live checks |
| `RAZORPAY_KEY_SECRET` | Razorpay server-only secret |
| `RAZORPAY_WEBHOOK_SECRET` | Private secret configured for the Razorpay webhook endpoint |
| `GEMINI_API_KEY` | Google AI Studio key used by the study assistant; backend only |
| `GEMINI_MODEL` | Optional Gemini model name; defaults to `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Optional first backup model; defaults to `gemini-3.6-flash` |
| `PORT` | Local port; Render sets this automatically in production |

The startup SQL in `course-schema.sql` creates the account, enrollment, progress and certificate tables. It uses `CREATE TABLE IF NOT EXISTS`; review any existing production database before changing its structure.

## Where credentials go
| Value | File | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | `backend/.env` **and** `PAYMENT_CONFIG.keyId` in `script.js` | Public. `rzp_test_…` for testing, `rzp_live_…` for real money |
| `RAZORPAY_KEY_SECRET` | `backend/.env` **only** | Never in HTML/CSS/JS. Never commit `.env` |

## Run
```
cd backend
npm install
cp .env.example .env     # then edit .env
npm start                # http://localhost:3000 (site + /api)
```

## Endpoints
- `POST /api/create-order` — requires a student login, looks up the price server-side, and creates the Razorpay order for that account.
- `POST /api/verify-payment` — receives Razorpay's order/payment/signature, checks the HMAC with the secret. Returns `{verified:true}` only if genuine. The website shows success only on this reply.
- `POST /api/webhooks/razorpay` — verifies Razorpay's raw-body signature and records captured payments idempotently. Subscribe this endpoint to `payment.captured` in the Razorpay Dashboard and use the same webhook secret in the backend environment.
- `GET /health` — checks the API process and its PostgreSQL connection; configure this as the Render health-check path.
- `POST /api/study/ask` — requires a student login; answers learning questions from the course outline and hands off questions it cannot answer confidently.

## Keep in sync
Course progress and certificates:
- `GET /api/learning/courses/:courseId?levelId=basic|advanced|professional` returns a student's lessons and saved progress.
- `POST /api/learning/courses/:courseId/lessons/:lessonId/complete` records a completed lesson and issues a certificate when every lesson in that level is complete.
- `GET /api/learning/certificates` and `GET /api/learning/certificates/:id` list and retrieve the logged-in student's certificates.
- Progress tables are created from `course-schema.sql` when the server starts. Editable starter curricula for the five catalog courses are in `curriculum.js`.
- API requests are limited to 300 per IP per 15 minutes. Login/register remain limited to 20 attempts, and checkout order creation/payment verification share a 20-request limit per IP per 15 minutes.

Students mark each lesson complete after finishing it. Progress is tied to their account and requires paid course access; certificate issuance is saved once per course level.

Prices exist in `server.js` (authoritative) and `script.js` (display). Change both together.

## Still to add before going live
1. Configure the Razorpay Dashboard webhook for `payment.captured` and set `RAZORPAY_WEBHOOK_SECRET` in the backend environment.
2. Verify Google Sign-In and Gmail contact-email delivery. The local callback stores the Gmail refresh token in ignored `backend/.env`; never commit it.
3. Confirm production HTTPS, database backups, environment variables and GitHub Pages/Render deploy settings.

## Google and Gmail setup
- Google Sign-In is shown on the student login and registration pages. The browser receives only the public Client ID; the backend verifies Google ID tokens before creating the site's own session token.
- Email/password sign-ins and new email/password registrations require a 6-digit Gmail OTP (10-minute expiry, maximum 5 code attempts, resend cooldown). Google Sign-In continues to rely on Google's verified email identity.
- For local Gmail authorization, enable Gmail API and add `http://localhost:3000/api/gmail/oauth/callback` as an Authorized redirect URI on the Web OAuth client.
- Set the Google Client ID and Client Secret in `backend/.env`, start the backend, then open `http://localhost:3000/api/gmail/connect` on that same computer and authorize the support mailbox. The callback stores the refresh token in the ignored local `.env` file. The connect route only starts from loopback.
- `GMAIL_SUPPORT_EMAIL` is the enquiry destination. The configured Gmail sender and `GMAIL_REFRESH_TOKEN` are also used to deliver student login OTPs. Production authorization must be completed separately after the deployed callback URL is configured.
- Add a Gemini API key from Google AI Studio as `GEMINI_API_KEY`. The key stays in backend environment settings and must never go in website JavaScript. Student chat questions and study enquiry text are sent to Gemini to generate answers; questions are not saved by this feature. If Gemini cannot answer confidently, enquiry email gets a receipt and the support inbox can reply manually.
