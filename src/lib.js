// Helpers: password hashing (PBKDF2), signed sessions (HMAC), CSRF, cart, money.
// All built on the Web Crypto API available in Cloudflare Workers — no node deps.

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}
function b64u(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(str)));
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function randomToken(n = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(n)));
}

// ---- Password hashing (PBKDF2-SHA256) ----
async function pbkdf2(password, saltBytes, iterations = 100000) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2",
    false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toHex(salt) + ":" + (await pbkdf2(password, salt));
}
export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const got = await pbkdf2(password, fromHex(saltHex));
  return timingSafeEqual(got, hashHex);
}

// ---- HMAC ----
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}
export async function razorpayValid(secret, orderId, paymentId, signature) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = await hmacHex(secret, orderId + "|" + paymentId);
  return timingSafeEqual(expected, signature);
}

// ---- Signed session cookie ----
export async function signSession(secret, obj) {
  const payload = b64u(JSON.stringify(obj));
  return payload + "." + (await hmacHex(secret, payload));
}
export async function verifySession(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = await hmacHex(secret, payload);
  if (!timingSafeEqual(expected, sig)) return null;
  try { return JSON.parse(unb64u(payload)); } catch { return null; }
}

// ---- Cart cookie (base64 JSON; prices always recomputed server-side) ----
export function encodeCart(items) { return b64u(JSON.stringify(items || [])); }
export function decodeCart(str) {
  if (!str) return [];
  try { const v = JSON.parse(unb64u(str)); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// ---- Formatting ----
export function e(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function money(n) {
  n = Math.round(Number(n) || 0);
  const s = String(Math.abs(n));
  let body;
  if (s.length <= 3) body = s;
  else {
    let head = s.slice(0, -3);
    head = head.replace(/\B(?=(\d\d)+(?!\d))/g, ",");
    body = head + "," + s.slice(-3);
  }
  return (n < 0 ? "-" : "") + "₹" + body;
}
export function slugify(t) {
  return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || ("p" + randomToken(3));
}
export function orderNo() { return "ASW" + randomToken(6).toUpperCase(); }
export function csv(s) { return String(s || "").split(",").map((x) => x.trim()).filter(Boolean); }
