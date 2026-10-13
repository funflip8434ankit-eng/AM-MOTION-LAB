# AM Motion Lab — Payment Backend

Keeps the Razorpay **secret key** off the website. The frontend only ever holds the public Key ID.

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
- `POST /api/create-order` — receives `{courseId, levelId, student}`, looks up the price server-side, creates the Razorpay order.
- `POST /api/verify-payment` — receives Razorpay's order/payment/signature, checks the HMAC with the secret. Returns `{verified:true}` only if genuine. The website shows success only on this reply.

## Keep in sync
Course progress and certificates:
- `GET /api/learning/courses/:courseId?levelId=basic|advanced|professional` returns a student's lessons and saved progress.
- `POST /api/learning/courses/:courseId/lessons/:lessonId/complete` records a completed lesson and issues a certificate when every lesson in that level is complete.
- `GET /api/learning/certificates` and `GET /api/learning/certificates/:id` list and retrieve the logged-in student's certificates.
- Progress tables are created from `course-schema.sql` when the server starts. Editable starter curricula for the five catalog courses are in `curriculum.js`.

Students mark each lesson complete after finishing it. Progress is tied to their account and requires paid course access; certificate issuance is saved once per course level.

Prices exist in `server.js` (authoritative) and `script.js` (display). Change both together.

## Still to add before going live
1. Fulfilment at the `TODO` in `server.js` (save enrolment / email student).
2. A Razorpay webhook for `payment.captured` / `order.paid`.
3. Rate-limiting and HTTPS on the hosting side.
