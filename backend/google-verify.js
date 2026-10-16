const crypto = require("crypto");

let cachedKeys = null;
let keysExpireAt = 0;

async function getGoogleKeys() {
  if (cachedKeys && Date.now() < keysExpireAt) return cachedKeys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("Could not load Google signing keys.");
  cachedKeys = await response.json();
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number((cacheControl.match(/max-age=(\d+)/i) || [])[1] || 300);
  keysExpireAt = Date.now() + Math.max(60, maxAge) * 1000;
  return cachedKeys;
}

async function verifyGoogleIdToken(token, expectedAudience) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Malformed Google ID token.");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google ID token.");

  const keys = await getGoogleKeys();
  const jwk = (keys.keys || []).find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Unknown Google signing key.");
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const signature = Buffer.from(parts[2], "base64url");
  const signedContent = Buffer.from(parts[0] + "." + parts[1]);
  if (!crypto.verify("RSA-SHA256", signedContent, publicKey, signature)) throw new Error("Invalid Google ID token signature.");

  const now = Math.floor(Date.now() / 1000);
  const issuers = ["https://accounts.google.com", "accounts.google.com"];
  if (!issuers.includes(payload.iss) || payload.aud !== expectedAudience || (payload.azp && payload.azp !== expectedAudience)) {
    throw new Error("Google ID token audience or issuer mismatch.");
  }
  if (!payload.exp || payload.exp <= now || !payload.iat || payload.iat > now + 60) throw new Error("Expired or invalid Google ID token.");
  return payload;
}

module.exports = { verifyGoogleIdToken };
