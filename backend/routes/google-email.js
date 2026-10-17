const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { generateStudyAnswer } = require("../study-assistant");

const router = express.Router();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "http://localhost:3000/api/gmail/oauth/callback";
const SUPPORT_EMAIL = process.env.GMAIL_SUPPORT_EMAIL || "funflip8434ankit@gmail.com";
const pendingStates = new Map();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many enquiries. Please wait a little and try again." },
});

function isLocalBrowser(req) {
  const address = req.socket.remoteAddress || "";
  const localAddress = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
  return localAddress && ["localhost", "127.0.0.1"].includes(req.hostname);
}

function renderPage(message, isError) {
  const color = isError ? "#f87171" : "#34d399";
  return "<!doctype html><html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>AM Motion Lab Gmail setup</title>" +
    "<body style=\"margin:0;background:#090e1a;color:#f8fafc;font:16px system-ui;display:grid;place-items:center;min-height:100vh\"><main style=\"max-width:520px;padding:32px;border:1px solid #334155;border-radius:18px;background:#111827\"><h1 style=\"color:" + color + "\">" + message + "</h1><p>You may close this tab and return to AM Motion Lab.</p></main></body></html>";
}

function replaceEnvValue(file, key, value) {
  if (!fs.existsSync(file)) throw new Error("Local backend/.env file was not found.");
  let content = fs.readFileSync(file, "utf8");
  const line = key + "=" + value;
  const keyPattern = new RegExp("^" + key + "=.*$", "m");
  if (keyPattern.test(content)) content = content.replace(keyPattern, line);
  else content = content.replace(/\s*$/, "") + "\n" + line + "\n";
  fs.writeFileSync(file, content, "utf8");
  process.env[key] = value;
}

function getAccessToken() {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN || "";
  if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) throw new Error("Gmail sender is not connected yet.");
  return fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }).then(async (response) => {
    const body = await response.json();
    if (!response.ok || !body.access_token) throw new Error("Google could not authorize the Gmail sender.");
    return body.access_token;
  });
}

function encodeSubject(value) {
  return "=?UTF-8?B?" + Buffer.from(value, "utf8").toString("base64") + "?=";
}

async function sendGmailMessage(accessToken, to, subject, messageText, replyTo) {
  const headers = [
    "To: " + to.replace(/[\r\n]/g, ""),
    replyTo ? "Reply-To: " + replyTo.replace(/[\r\n]/g, "") : "",
    "Subject: " + encodeSubject(subject),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean).join("\r\n");
  const encodedBody = Buffer.from(messageText, "utf8").toString("base64").match(/.{1,76}/g).join("\r\n");
  const rawMessage = headers + "\r\n\r\n" + encodedBody;
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(rawMessage).toString("base64url") }),
  });
  if (!response.ok) throw new Error("Gmail API could not send a message.");
}

async function sendLoginOtp(to, name, code) {
  const accessToken = await getAccessToken();
  const greeting = String(name || "Student").replace(/[\r\n]/g, " ").slice(0, 100);
  await sendGmailMessage(accessToken, to, "Your AM Motion Lab sign-in code",
    "Hi " + greeting + ",\n\nYour AM Motion Lab sign-in code is " + code + ". It expires in 10 minutes.\n\nIf you did not try to sign in, you can ignore this email. Do not share this code with anyone.");
}

async function sendPasswordResetOtp(to, name, code) {
  const accessToken = await getAccessToken();
  const greeting = String(name || "Student").replace(/[\r\n]/g, " ").slice(0, 100);
  await sendGmailMessage(accessToken, to, "Your AM Motion Lab password reset code",
    "Hi " + greeting + ",\n\nYour password reset code is " + code + ". It expires in 10 minutes. If you did not request this, ignore this email.");
}

/* One-time Gmail owner authorization. This route only starts from the local machine. */
router.get("/gmail/connect", (req, res) => {
  if (!isLocalBrowser(req)) return res.sendStatus(404);
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(503).send(renderPage("Google OAuth credentials are missing from backend/.env.", true));
  const state = crypto.randomBytes(32).toString("hex");
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  for (const [key, expiry] of pendingStates) if (expiry < Date.now()) pendingStates.delete(key);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  res.redirect(url.toString());
});

router.get("/gmail/oauth/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!state || !expiry || expiry < Date.now()) return res.status(400).send(renderPage("Gmail authorization expired. Start the connect step again locally.", true));
  if (req.query.error) return res.status(400).send(renderPage("Gmail authorization was not completed.", true));

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code || ""),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.refresh_token) throw new Error("Google did not return a refresh token. Reconnect with consent.");
    replaceEnvValue(path.join(__dirname, "..", ".env"), "GMAIL_REFRESH_TOKEN", tokens.refresh_token);
    res.send(renderPage("Gmail connected successfully.", false));
  } catch (err) {
    console.error("Gmail OAuth callback failed:", err && err.message);
    res.status(500).send(renderPage("Could not finish Gmail connection. Check the local setup and try again.", true));
  }
});

router.post("/contact", contactLimiter, async (req, res) => {
  const body = req.body || {};
  const fields = {};
  ["fullName", "email", "phone", "interest", "experience", "message"].forEach((key) => {
    fields[key] = String(body[key] || "").trim();
  });
  const fileName = String(body.fileName || "").replace(/[\\/\r\n\0]/g, "").slice(0, 200);
  if (
    fields.fullName.length < 2 || fields.fullName.length > 100 ||
    fields.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) ||
    fields.phone.length < 7 || fields.phone.length > 30 ||
    !fields.interest || fields.interest.length > 80 ||
    !fields.experience || fields.experience.length > 40 ||
    fields.message.length < 5 || fields.message.length > 4000
  ) return res.status(400).json({ error: "Please check the enquiry details and try again." });
  if (!process.env.GMAIL_REFRESH_TOKEN) return res.status(503).json({ error: "The enquiry email service is not connected yet." });

  try {
    const accessToken = await getAccessToken();
    const messageText = [
      "New AM Motion Lab enquiry",
      "",
      "Name: " + fields.fullName,
      "Student email: " + fields.email,
      "Phone: " + fields.phone,
      "Interested in: " + fields.interest,
      "Experience: " + fields.experience,
      "",
      "Message:",
      fields.message,
      fileName ? "\nReference filename (file itself is not attached): " + fileName : "",
    ].filter(Boolean).join("\n");
    await sendGmailMessage(
      accessToken,
      SUPPORT_EMAIL,
      "AM Motion Lab enquiry: " + fields.interest,
      messageText,
      fields.email
    );

    let aiAnswer = "";
    let aiSource = "";
    if (process.env.GEMINI_API_KEY) {
      try {
        const studyResult = await generateStudyAnswer(
          "Student selected area: " + fields.interest + "\n\nStudent question: " + fields.message,
          { emailReply: true }
        );
        if (studyResult.answered) {
          aiAnswer = studyResult.answer;
          aiSource = studyResult.source || "gemini";
        }
      } catch (aiError) {
        console.error("contact AI reply failed:", aiError && aiError.message);
      }
    }

    // A failed receipt must not make the student resubmit an enquiry that we already received.
    let confirmationSent = true;
    try {
      const confirmationText = [
        "Hi " + fields.fullName + ",",
        "",
        "We received your enquiry about " + fields.interest + ".",
        "",
        "Your question:",
        fields.message,
        "",
        "Our response:",
        aiAnswer
          ? (aiSource === "course-faq"
            ? "Here is a quick study answer from our course FAQ:\n\n" + aiAnswer + "\n\nIf you need more help, reply to this email and our team can help."
            : "Here is an AI-generated first response based on the available course outline:\n\n" + aiAnswer + "\n\nIf this does not answer your question fully, reply to this email and our team can help.")
          : "Our team will review it and get back to you.",
        "",
        "This is an automatic message from AM Motion Lab.",
      ].join("\n");
      await sendGmailMessage(
        accessToken,
        fields.email,
        "We received your enquiry - AM Motion Lab",
        confirmationText
      );
    } catch (confirmationError) {
      confirmationSent = false;
      console.error("contact confirmation email failed:", confirmationError && confirmationError.message);
    }

    res.status(202).json({ sent: true, confirmationSent, aiAnswered: Boolean(aiAnswer), aiSource });
  } catch (err) {
    console.error("contact email failed:", err && err.message);
    res.status(502).json({ error: "Could not send the enquiry right now. Please try again or contact us directly." });
  }
});

router.sendLoginOtp = sendLoginOtp;
router.sendPasswordResetOtp = sendPasswordResetOtp;
module.exports = router;
