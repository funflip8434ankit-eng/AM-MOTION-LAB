# AM Motion Lab Backend

This Express backend serves the public website, student accounts, course access, certificates, Razorpay payments, contact/enquiry email, and Study Q&A. The student dashboard page has been removed; students can still log in and log out, access courses, and view certificates.

## Environment variables
Set these in `backend/.env` locally and in the backend host's secret environment settings in production:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Private random secret of at least 32 characters for student sessions and OTP codes |
| `RAZORPAY_KEY_ID` | Razorpay public checkout key; use a test key while testing |
| `RAZORPAY_KEY_SECRET` | Razorpay server-only secret |
| `RAZORPAY_WEBHOOK_SECRET` | Private secret configured for the Razorpay webhook endpoint |
| `GEMINI_API_KEY` | Google AI Studio key used by Study Q&A; backend only |
| `GEMINI_MODEL` | Optional Gemini model name |
| `GEMINI_FALLBACK_MODEL` | Optional backup model |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client used only to authorize the Gmail sender |
| `GMAIL_REFRESH_TOKEN` | Gmail sender refresh token |
| `GMAIL_SUPPORT_EMAIL` | Contact/enquiry destination |
| `PORT` | Local port; Render sets this automatically in production |

`course-schema.sql` creates or updates the student, enrollment, OTP, progress, and certificate tables on startup. It uses `CREATE TABLE IF NOT EXISTS` and does not delete existing student records.

## Run locally

```powershell
cd backend
npm install
# Copy .env.example to .env and fill in the required values
npm.cmd start
```

The backend also serves the website at `http://localhost:3000`.

## Endpoints

- `POST /api/auth/register`, `/login`, `/login/verify-otp`, and `/google` create or authenticate student accounts. Email/password sign-in uses a 6-digit email code.
- `POST /api/auth/password/forgot` and `/password/reset` reset account passwords by email code.
- `POST /api/create-order` requires a logged-in student; the server looks up the authoritative price.
- `POST /api/verify-payment` verifies the Razorpay signature and captured payment before granting course access.
- `POST /api/webhooks/razorpay` verifies Razorpay's raw-body signature and records captured enrollments idempotently.
- `POST /api/contact` sends contact/enquiry emails.
- `POST /api/study/ask` answers logged-in students' Study Q&A questions; it is rate-limited.
- `/api/learning/*` provides enrolled course lessons, progress tracking, and certificates.
- `GET /health` checks the API process and PostgreSQL connection.

## Security checks

Run `npm test` from this directory for a mocked student journey covering
registration, email-code verification, server-priced checkout, captured-payment
verification, purchased course access, and denial of another student's access.
The tests use an in-memory database/payment adapter and never charge a real card.

GitHub Actions runs these tests, `npm audit --omit=dev`, and CodeQL on pushes to
`main` and pull requests. Dependabot checks backend npm packages and workflow
actions weekly. Enable dependency alerts and code scanning in repository settings
so findings appear in the Security tab.

The API uses bearer JWTs (not cookies), so browser requests do not rely on
ambient cookie credentials and CSRF tokens are not used. Frontend tokens are
stored in browser storage; prevent XSS and keep the token lifetime limited.
There are no admin routes or server-side file-upload endpoints today. Add
separate roles/MFA and upload validation if those features are introduced.

The Express security headers apply to responses served by this backend. Static
HTML pages also carry a CSP meta policy because GitHub Pages does not inherit
Express response headers. A meta policy cannot set `frame-ancestors`; the
backend sends that directive as a response header for pages it serves.

Prices are maintained in `server.js` (authoritative) and `script.js` (display). Change both together.

## Gmail setup

Enable Gmail API and add `http://localhost:3000/api/gmail/oauth/callback` as an Authorized redirect URI on the Web OAuth client. Set the OAuth client ID and secret in the backend environment, start the backend, then visit `http://localhost:3000/api/gmail/connect` on the same computer to authorize the support mailbox. The route stores the refresh token in the ignored local `.env`; never commit that file.

## Before going live

1. Configure the Razorpay webhook for `payment.captured` and set `RAZORPAY_WEBHOOK_SECRET`.
2. Set a strong `JWT_SECRET`, configure Google Sign-In origins, and verify Gmail OTP delivery.
3. Verify Study Q&A using production environment credentials.
4. Confirm HTTPS, database backups and a restore, environment variables, and
   GitHub Pages/Render deployment settings. See the repository `SECURITY.md`.
