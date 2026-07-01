// Aswhani — Cloudflare Workers store (Hono + D1 + R2).
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import {
  hashPassword, verifyPassword, signSession, verifySession, razorpayValid,
  encodeCart, decodeCart, randomToken, slugify, orderNo, csv,
} from "./lib.js";
import * as V from "./views.js";
import * as A from "./admin_views.js";
import * as I from "./integrations.js";

const app = new Hono();

// Security response headers on every request. CSP/COEP/COOP/CORP are left off so
// the Tailwind/Alpine CDNs and the Razorpay checkout overlay keep working; the
// high-value ones (HSTS, nosniff, frame-options, referrer-policy) are enabled.
app.use("*", secureHeaders({
  xFrameOptions: "SAMEORIGIN",
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  strictTransportSecurity: "max-age=15552000; includeSubDomains",
  referrerPolicy: "strict-origin-when-cross-origin",
}));

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //
async function settingsMap(env) {
  const r = await env.DB.prepare("SELECT key,value FROM settings").all();
  const m = {};
  for (const row of r.results || []) m[row.key] = row.value;
  return m;
}
function totalsFor(ctx, rows, discount = 0) {
  const subtotal = rows.reduce((s, r) => s + r.price * r.qty, 0);
  discount = Math.min(discount, subtotal);
  const shipping = subtotal <= 0 ? 0 : (ctx.freeAbove && (subtotal - discount) >= ctx.freeAbove ? 0 : ctx.shippingFee);
  return { subtotal, discount, shipping, total: Math.max(0, subtotal - discount + shipping) };
}

// ---- Variant-aware stock ----
async function variantRows(env, productId) {
  return (await env.DB.prepare("SELECT size,color,stock FROM product_variants WHERE product_id=?").bind(productId).all()).results || [];
}
async function variantMap(env, productId) {
  const m = {};
  for (const v of await variantRows(env, productId)) m[`${(v.size || "").trim()}|${(v.color || "").trim()}`] = v.stock || 0;
  return m;
}
async function stockFor(env, product, size, color) {
  const vs = await variantRows(env, product.id);
  if (vs.length) {
    const v = vs.find((x) => (x.size || "").trim() === (size || "").trim() && (x.color || "").trim() === (color || "").trim());
    return v ? (v.stock || 0) : 0;
  }
  return product.stock || 0;
}
async function adjustStock(env, productId, size, color, delta) {
  const vs = await variantRows(env, productId);
  if (vs.length) {
    const r = await env.DB.prepare("UPDATE product_variants SET stock=MAX(0,stock+?) WHERE product_id=? AND size=? AND color=?").bind(delta, productId, size || "", color || "").run();
    if (r.meta.changes === 0) await env.DB.prepare("UPDATE products SET stock=MAX(0,stock+?) WHERE id=?").bind(delta, productId).run();
  } else {
    await env.DB.prepare("UPDATE products SET stock=MAX(0,stock+?) WHERE id=?").bind(delta, productId).run();
  }
}
async function commitStock(env, order) {
  if (order.stock_committed) return;
  const items = (await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  for (const it of items) await adjustStock(env, it.product_id, it.size, it.color, -it.qty);
  await env.DB.prepare("UPDATE orders SET stock_committed=1 WHERE id=?").bind(order.id).run();
}
async function restoreStock(env, order) {
  if (!order.stock_committed) return;
  const items = (await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  for (const it of items) await adjustStock(env, it.product_id, it.size, it.color, it.qty);
  await env.DB.prepare("UPDATE orders SET stock_committed=0 WHERE id=?").bind(order.id).run();
}
function couponDiscount(coupon, subtotal) {
  if (!coupon || !coupon.is_active || subtotal < (coupon.min_order || 0)) return 0;
  return coupon.kind === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(subtotal, coupon.value);
}
async function couponFromCookie(c) {
  const code = getCookie(c, "coupon");
  if (!code) return null;
  return await c.env.DB.prepare("SELECT * FROM coupons WHERE code=? AND is_active=1").bind(code.toUpperCase()).first();
}
// Single source of truth for coupon validity. Used by /cart/coupon AND /checkout —
// the client is never trusted. Returns {ok, discount, msg}.
async function validateCoupon(env, user, coupon, subtotal) {
  if (!coupon || !coupon.is_active) return { ok: false, discount: 0, msg: "Invalid or expired coupon." };
  if (coupon.expires_at && new Date().toISOString().slice(0, 10) > coupon.expires_at) return { ok: false, discount: 0, msg: "This coupon has expired." };
  if (subtotal < (coupon.min_order || 0)) return { ok: false, discount: 0, msg: `Spend at least ₹${coupon.min_order} to use ${coupon.code}.` };
  if (coupon.first_order_only) {
    if (!user) return { ok: false, discount: 0, msg: "Log in to use this coupon." };
    const prior = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE user_id=?").bind(user.id).first();
    if ((prior?.n || 0) > 0) return { ok: false, discount: 0, msg: "Valid only on your first order." };
  }
  if (coupon.once_per_user) {
    if (!user) return { ok: false, discount: 0, msg: "Log in to use this coupon." };
    const used = await env.DB.prepare("SELECT COUNT(*) n FROM coupon_uses WHERE coupon_id=? AND user_id=?").bind(coupon.id, user.id).first();
    if ((used?.n || 0) > 0) return { ok: false, discount: 0, msg: "You've already used this coupon." };
  }
  return { ok: true, discount: couponDiscount(coupon, subtotal), msg: "" };
}
async function recordCouponUse(env, coupon, userId, orderNo) {
  if (!coupon || !userId) return;
  await env.DB.prepare("INSERT INTO coupon_uses (coupon_id,user_id,order_no) VALUES (?,?,?)").bind(coupon.id, userId, orderNo).run();
}
function originOf(c) { return new URL(c.req.url).origin; }
async function cartRows(env, cart) {
  const rows = [];
  for (let i = 0; i < cart.length; i++) {
    const it = cart[i];
    const p = await env.DB.prepare(
      "SELECT id,name,slug,price,image,stock FROM products WHERE id=? AND is_active=1"
    ).bind(parseInt(it.product_id) || 0).first();
    if (!p) continue;
    // Sanitize qty at the trust boundary — the cart cookie is user-editable, so a
    // hand-crafted negative/fractional qty must never reach pricing or stock.
    const qty = Math.min(99, Math.max(1, parseInt(it.qty, 10) || 1));
    rows.push({ index: i, id: p.id, name: p.name, slug: p.slug, price: p.price,
      image: p.image, size: it.size || "", color: it.color || "", qty, stock: p.stock });
  }
  return rows;
}
function ctxOf(c) { return c.get("ctx"); }
function redirectMsg(c, path, ok, err) {
  const q = err ? "err=" + encodeURIComponent(err) : ok ? "ok=" + encodeURIComponent(ok) : "";
  return c.redirect(path + (q ? (path.includes("?") ? "&" : "?") + q : ""));
}

// Cookie options — Secure is enabled automatically on HTTPS (production) and off
// on plain-HTTP localhost so dev login keeps working.
function cookieOpts(c, extra = {}) {
  return { path: "/", sameSite: "Lax", secure: new URL(c.req.url).protocol === "https:", ...extra };
}

// ---- Simple D1-backed rate limiter (per IP + action sliding window) ----
async function rateLimited(c, action, limit, windowSec) {
  try {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "local";
    const bucket = action + ":" + ip;
    const now = Date.now();
    const since = now - windowSec * 1000;
    await c.env.DB.prepare("DELETE FROM rate_hits WHERE ts < ?").bind(since).run();
    const row = await c.env.DB.prepare("SELECT COUNT(*) n FROM rate_hits WHERE bucket=? AND ts>=?").bind(bucket, since).first();
    if ((row?.n || 0) >= limit) return true;
    await c.env.DB.prepare("INSERT INTO rate_hits (bucket, ts) VALUES (?,?)").bind(bucket, now).run();
    return false;
  } catch { return false; } // never break a route if the table is missing
}

// ---- Order access control ----
// A signed cookie remembers which order numbers were placed in THIS browser, so a
// guest can view their own order/invoice without leaking everyone else's PII.
async function myOrders(c) {
  const obj = await verifySession(c.env.SESSION_SECRET, getCookie(c, "myorders"));
  return obj && Array.isArray(obj.o) ? obj.o : [];
}
async function rememberOrder(c, no) {
  const list = await myOrders(c);
  if (!list.includes(no)) list.unshift(no);
  setCookie(c, "myorders", await signSession(c.env.SESSION_SECRET, { o: list.slice(0, 30) }),
    { ...cookieOpts(c), httpOnly: true, maxAge: 86400 * 60 });
}
// True only for the admin, the logged-in owner, the same browser that placed it,
// a valid per-order token (?t=), or a matching order email (?email=).
async function canViewOrder(c, order) {
  const ctx = ctxOf(c);
  if (isAdmin(ctx)) return true;
  if (ctx.user && order.user_id === ctx.user.id) return true;
  if ((await myOrders(c)).includes(order.order_no)) return true;
  const t = c.req.query("t");
  if (t && order.access_token && t === order.access_token) return true;
  const em = (c.req.query("email") || "").trim().toLowerCase();
  if (em && order.email && em === (order.email || "").toLowerCase()) return true;
  return false;
}

// --------------------------------------------------------------------------- //
// Context middleware
// --------------------------------------------------------------------------- //
app.use("*", async (c, next) => {
  const env = c.env;
  // Fail closed if the signing secret is missing — never fall back to a known
  // constant (that would let anyone forge an admin session).
  if (!env.SESSION_SECRET) return c.text("Server misconfigured: SESSION_SECRET is not set. Run `wrangler secret put SESSION_SECRET`.", 500);
  const s = await settingsMap(env);
  let sess = await verifySession(env.SESSION_SECRET, getCookie(c, "session"));
  if (sess && sess.exp && Date.now() > sess.exp) sess = null; // server-side expiry
  let user = null;
  if (sess && sess.uid) {
    user = await env.DB.prepare("SELECT id,name,email,is_admin FROM users WHERE id=?").bind(sess.uid).first();
  }
  let csrf = getCookie(c, "csrf");
  if (!csrf) { csrf = randomToken(16); setCookie(c, "csrf", csrf, { ...cookieOpts(c), httpOnly: true, maxAge: 86400 * 7 }); }
  const categories = (await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order").all()).results || [];
  const footerPages = (await env.DB.prepare("SELECT slug,title FROM pages WHERE in_footer=1 ORDER BY sort_order").all()).results || [];
  let wishCount = 0;
  if (user) wishCount = (await env.DB.prepare("SELECT COUNT(*) n FROM wishlist WHERE user_id=?").bind(user.id).first()).n;
  const cart = decodeCart(getCookie(c, "cart"));
  const ok = c.req.query("ok"), err = c.req.query("err");
  c.set("ctx", {
    storeName: s.store_name || "Aswhani", tagline: s.store_tagline || "Wear the vibe.",
    email: s.support_email || "", phone: s.support_phone || "",
    freeAbove: +(s.free_shipping_above || 999), shippingFee: +(s.shipping_fee || 49),
    ga: s.ga_id || "", categories, footerPages, cart, cartCount: cart.reduce((a, b) => a + (b.qty || 1), 0),
    wishCount, user, csrf, settings: s, path: new URL(c.req.url).pathname,
    razorpay: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    flash: err ? { msg: err, type: "error" } : ok ? { msg: ok, type: "success" } : null,
  });
  await next();
});

async function checkCsrf(c) {
  const body = await c.req.parseBody();
  if (!body.csrf || body.csrf !== getCookie(c, "csrf")) return null;
  return body;
}

// --------------------------------------------------------------------------- //
// R2 image serving
// --------------------------------------------------------------------------- //
app.get("/img/:key", async (c) => {
  const obj = await c.env.BUCKET.get(c.req.param("key"));
  if (!obj) return c.notFound();
  // Force a safe image content-type + nosniff so a stored file can never be
  // served as active HTML/SVG on our origin.
  const ct = obj.httpMetadata?.contentType || "image/jpeg";
  const safe = /^image\/(png|jpe?g|gif|webp|avif)$/.test(ct) ? ct : "application/octet-stream";
  return new Response(obj.body, {
    headers: { "content-type": safe, "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=31536000" },
  });
});

// --------------------------------------------------------------------------- //
// Storefront
// --------------------------------------------------------------------------- //
app.get("/", async (c) => {
  const ctx = ctxOf(c);
  const featured = (await c.env.DB.prepare("SELECT * FROM products WHERE is_active=1 AND is_featured=1 ORDER BY created_at DESC LIMIT 8").all()).results || [];
  const newest = (await c.env.DB.prepare("SELECT * FROM products WHERE is_active=1 ORDER BY created_at DESC LIMIT 8").all()).results || [];
  return c.html(V.layout(ctx, ctx.storeName, V.homeView(ctx, { featured, newest })));
});

app.get("/shop", async (c) => {
  const ctx = ctxOf(c);
  const slug = c.req.query("category");
  const q = (c.req.query("q") || "").trim();
  let category = null, sql = "SELECT * FROM products WHERE is_active=1", binds = [];
  if (slug) {
    category = ctx.categories.find((x) => x.slug === slug);
    if (category) { sql += " AND category_id=?"; binds.push(category.id); }
  }
  if (q) { sql += " AND (name LIKE ? OR description LIKE ?)"; binds.push("%" + q + "%", "%" + q + "%"); }
  sql += " ORDER BY created_at DESC";
  const products = (await c.env.DB.prepare(sql).bind(...binds).all()).results || [];
  const heading = category ? category.name : q ? `Results for "${q}"` : "All Products";
  return c.html(V.layout(ctx, heading, V.shopView(ctx, { products, heading, category })));
});

app.get("/product/:slug", async (c) => {
  const ctx = ctxOf(c);
  const p = await c.env.DB.prepare("SELECT * FROM products WHERE slug=? AND is_active=1").bind(c.req.param("slug")).first();
  if (!p) return c.html(V.layout(ctx, "Not found", `<div class="max-w-md mx-auto px-4 py-28 text-center"><div class="font-display text-7xl text-clay">404</div><p class="mt-3">Product not found.</p><a href="/shop" class="inline-block mt-6 bg-ink text-paper px-7 py-3 text-[12px] uppercase tracking-[0.2em]">Back to Shop</a></div>`), 404);
  const related = (await c.env.DB.prepare("SELECT * FROM products WHERE category_id=? AND id<>? AND is_active=1 LIMIT 4").bind(p.category_id, p.id).all()).results || [];
  const reviews = (await c.env.DB.prepare("SELECT * FROM reviews WHERE product_id=? AND approved=1 ORDER BY created_at DESC").bind(p.id).all()).results || [];
  const gallery = (await c.env.DB.prepare("SELECT url FROM product_images WHERE product_id=? ORDER BY sort_order").bind(p.id).all()).results || [];
  p.gallery = gallery.map((g) => g.url);
  const stockMap = await variantMap(c.env, p.id);
  const hasVariants = Object.keys(stockMap).length > 0;
  return c.html(V.layout(ctx, p.name, V.productView(ctx, { p, related, reviews, stockMap, hasVariants })));
});

// --------------------------------------------------------------------------- //
// Cart
// --------------------------------------------------------------------------- //
app.post("/cart/add", async (c) => {
  const body = await checkCsrf(c);
  if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c);
  const pid = parseInt(body.product_id);
  const p = await c.env.DB.prepare("SELECT id,slug,stock FROM products WHERE id=? AND is_active=1").bind(pid).first();
  if (!p) return redirectMsg(c, "/shop", null, "Product unavailable.");
  const cart = ctx.cart;
  const size = (body.size || "").trim(), color = (body.color || "").trim();
  const qty = Math.max(1, parseInt(body.qty) || 1);
  if ((await stockFor(c.env, p, size, color)) <= 0) {
    const pick = [size, color].filter(Boolean).join(" / ");
    return redirectMsg(c, "/product/" + p.slug, null, `Sorry, that${pick ? " (" + pick + ")" : ""} is sold out.`);
  }
  const ex = cart.find((i) => i.product_id === pid && i.size === size && i.color === color);
  if (ex) ex.qty = Math.min(99, ex.qty + qty);
  else cart.push({ product_id: pid, size, color, qty });
  setCookie(c, "cart", encodeCart(cart), { ...cookieOpts(c), httpOnly: true, maxAge: 86400 * 30 });
  return body.buy_now ? c.redirect("/checkout") : redirectMsg(c, "/cart", "Added to your bag.");
});
app.post("/cart/update", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const cart = ctxOf(c).cart; const i = parseInt(body.index); const qty = parseInt(body.qty);
  if (i >= 0 && i < cart.length) { if (qty <= 0) cart.splice(i, 1); else cart[i].qty = Math.min(99, qty); }
  setCookie(c, "cart", encodeCart(cart), { ...cookieOpts(c), httpOnly: true, maxAge: 86400 * 30 });
  return c.redirect("/cart");
});
app.post("/cart/remove", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const cart = ctxOf(c).cart; const i = parseInt(body.index);
  if (i >= 0 && i < cart.length) cart.splice(i, 1);
  setCookie(c, "cart", encodeCart(cart), { ...cookieOpts(c), httpOnly: true, maxAge: 86400 * 30 });
  return c.redirect("/cart");
});
app.get("/cart", async (c) => {
  const ctx = ctxOf(c); const rows = await cartRows(c.env, ctx.cart);
  return c.html(V.layout(ctx, "Your Bag", V.cartView(ctx, { rows, totals: totalsFor(ctx, rows) })));
});

// --------------------------------------------------------------------------- //
// Checkout + payment
// --------------------------------------------------------------------------- //
app.get("/checkout", async (c) => {
  const ctx = ctxOf(c); const rows = await cartRows(c.env, ctx.cart);
  if (!rows.length) return redirectMsg(c, "/shop", null, "Your bag is empty.");
  const subtotal = rows.reduce((s, r) => s + r.price * r.qty, 0);
  let coupon = await couponFromCookie(c);
  const v = await validateCoupon(c.env, ctx.user, coupon, subtotal);
  if (!v.ok) coupon = null;
  const totals = totalsFor(ctx, rows, v.discount);
  let addresses = [];
  if (ctx.user) addresses = (await c.env.DB.prepare("SELECT name,phone,line1,line2,city,state,pincode FROM addresses WHERE user_id=?").bind(ctx.user.id).all()).results || [];
  const codEnabled = ctx.settings.cod_enabled !== "0";
  return c.html(V.layout(ctx, "Checkout", V.checkoutView(ctx, { rows, totals, addresses, coupon, codEnabled })));
});

app.post("/cart/coupon", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (await rateLimited(c, "coupon", 15, 600)) return redirectMsg(c, "/checkout", null, "Too many coupon tries — wait a few minutes.");
  const code = (body.code || "").trim().toUpperCase().slice(0, 40);
  if (!code) { deleteCookie(c, "coupon", { path: "/" }); return redirectMsg(c, "/checkout", "Coupon removed."); }
  const coupon = await c.env.DB.prepare("SELECT * FROM coupons WHERE code=? AND is_active=1").bind(code).first();
  const subtotal = (await cartRows(c.env, ctxOf(c).cart)).reduce((s, r) => s + r.price * r.qty, 0);
  const v = await validateCoupon(c.env, ctxOf(c).user, coupon, subtotal);
  if (!v.ok) return redirectMsg(c, "/checkout", null, v.msg);
  setCookie(c, "coupon", code, { ...cookieOpts(c), httpOnly: true, maxAge: 86400 });
  return redirectMsg(c, "/checkout", `Coupon ${code} applied!`);
});

app.post("/checkout", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c);
  const rows = await cartRows(c.env, ctx.cart);
  if (!rows.length) return redirectMsg(c, "/shop", null, "Your bag is empty.");
  for (const r of rows) {
    const avail = await stockFor(c.env, { id: r.id, stock: r.stock }, r.size, r.color);
    if (avail < r.qty) return redirectMsg(c, "/cart", null, `${r.name} is out of stock.`);
  }
  const req = ["name", "phone", "line1", "city", "state", "pincode"];
  if (req.some((k) => !(body[k] || "").trim())) return redirectMsg(c, "/checkout", null, "Please fill all required fields.");
  const subtotal = rows.reduce((s, r) => s + r.price * r.qty, 0);
  let coupon = await couponFromCookie(c);
  const v = await validateCoupon(c.env, ctx.user, coupon, subtotal);
  if (!v.ok) coupon = null;
  const t = totalsFor(ctx, rows, v.discount);
  const method = body.payment_method === "online" ? (ctx.razorpay ? "razorpay" : "demo") : "cod";
  const no = orderNo();
  const atok = randomToken(16); // per-order bearer token for guest invoice/track links
  const res = await c.env.DB.prepare(
    `INSERT INTO orders (order_no,user_id,customer_name,email,phone,address_line1,address_line2,city,state,pincode,subtotal,discount,coupon_code,shipping_fee,total,payment_method,access_token,payment_status,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending','placed')`
  ).bind(no, ctx.user ? ctx.user.id : null, body.name.trim(), (body.email || "").trim(), body.phone.trim(),
    body.line1.trim(), (body.line2 || "").trim(), body.city.trim(), body.state.trim(), body.pincode.trim(),
    t.subtotal, t.discount, t.discount ? coupon.code : null, t.shipping, t.total, method, atok).run();
  const orderId = res.meta.last_row_id;
  for (const r of rows) {
    await c.env.DB.prepare("INSERT INTO order_items (order_id,product_id,name,image,price,size,color,qty) VALUES (?,?,?,?,?,?,?,?)")
      .bind(orderId, r.id, r.name, r.image, r.price, r.size, r.color, r.qty).run();
  }
  await rememberOrder(c, no); // authorize this browser to view its own order
  if (method === "cod") {
    await commitStock(c.env, { id: orderId, stock_committed: 0 });
    if (t.discount && coupon && ctx.user) await recordCouponUse(c.env, coupon, ctx.user.id, no);
    deleteCookie(c, "cart", { path: "/" });
    deleteCookie(c, "coupon", { path: "/" });
    await sendAlerts(c, no, "new");
    return c.redirect("/order/" + no);
  }
  return c.redirect("/pay/" + no);
});

async function sendAlerts(c, no, kind) {
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(no).first();
  if (!order) return;
  const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  I.notifyOwner(c.env, c.executionCtx, I.ownerAlertText(order, items, kind));
  if (order.email) {
    const trackUrl = originOf(c) + "/track?order_no=" + no + (order.access_token ? "&t=" + order.access_token : "");
    const heading = kind === "paid" ? "Payment received!" : "Thank you for your order!";
    I.sendEmail(c.env, c.executionCtx, order.email, `Order ${kind === "paid" ? "paid" : "confirmed"} — ${no} · Aswhani`,
      I.orderEmailHtml(order, items, trackUrl, heading, "We're getting your order ready for shipping."));
  }
}

app.get("/pay/:no", async (c) => {
  const ctx = ctxOf(c);
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.notFound();
  if (!(await canViewOrder(c, order))) return c.notFound();
  if (order.payment_status === "paid") return c.redirect("/order/" + order.order_no);
  if (order.payment_method === "razorpay") {
    if (!order.razorpay_order_id) {
      const rp = await I.razorpayCreateOrder(c.env, order.total, order.order_no);
      if (!rp) return redirectMsg(c, "/checkout", null, "Online payment is unavailable right now. Try COD.");
      await c.env.DB.prepare("UPDATE orders SET razorpay_order_id=? WHERE id=?").bind(rp.id, order.id).run();
      order.razorpay_order_id = rp.id;
    }
    return c.html(V.payRazorpayView(ctx, { order, keyId: c.env.RAZORPAY_KEY_ID }));
  }
  return c.html(V.layout(ctx, "Payment", V.payDemoView(ctx, { order })));
});

async function markPaid(c, order, paymentId) {
  // Atomic compare-and-set: only the first transition to 'paid' runs the side
  // effects, so a double-submit / replay can't double-commit stock or coupon use.
  const r = await c.env.DB.prepare("UPDATE orders SET payment_status='paid', razorpay_payment_id=? WHERE id=? AND payment_status!='paid'").bind(paymentId || null, order.id).run();
  if (r.meta.changes > 0) {
    await commitStock(c.env, { id: order.id, stock_committed: order.stock_committed });
    if (order.discount && order.coupon_code && order.user_id) {
      const coupon = await c.env.DB.prepare("SELECT * FROM coupons WHERE code=?").bind(order.coupon_code).first();
      if (coupon) await recordCouponUse(c.env, coupon, order.user_id, order.order_no);
    }
    await sendAlerts(c, order.order_no, "paid");
  }
  deleteCookie(c, "cart", { path: "/" });
  deleteCookie(c, "coupon", { path: "/" });
}

app.post("/pay/demo/:no", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.notFound();
  // Demo gateway is a stub for deployments WITHOUT Razorpay. Never let it mark a
  // real (razorpay/cod) order paid, and never run when real Razorpay is live.
  if (order.payment_method !== "demo" || (c.env.RAZORPAY_KEY_ID && c.env.RAZORPAY_KEY_SECRET)) return c.text("Not available", 403);
  if (!(await canViewOrder(c, order))) return c.notFound();
  await markPaid(c, order, "DEMO-" + order.order_no);
  return c.redirect("/order/" + order.order_no);
});

app.post("/pay/razorpay/verify", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(body.order_no).first();
  if (!order) return c.notFound();
  // Bind the signature to THIS order's stored razorpay_order_id (never the client
  // value), so a valid signature from one order can't settle a different one.
  if (order.payment_method !== "razorpay" || !order.razorpay_order_id) return redirectMsg(c, "/pay/" + order.order_no, null, "This order can't be paid online.");
  // Reject a payment id already consumed by another order (replay guard).
  const dup = await c.env.DB.prepare("SELECT id FROM orders WHERE razorpay_payment_id=? AND id<>?").bind(body.razorpay_payment_id || "", order.id).first();
  if (dup) return redirectMsg(c, "/pay/" + order.order_no, null, "Payment already used.");
  const ok = await razorpayValid(c.env.RAZORPAY_KEY_SECRET, order.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature);
  if (!ok) { await c.env.DB.prepare("UPDATE orders SET payment_status='failed' WHERE id=?").bind(order.id).run(); return redirectMsg(c, "/pay/" + order.order_no, null, "Payment verification failed."); }
  await markPaid(c, order, body.razorpay_payment_id);
  return c.redirect("/order/" + order.order_no);
});

app.get("/order/:no", async (c) => {
  const ctx = ctxOf(c);
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.notFound();
  if (!(await canViewOrder(c, order))) return c.notFound();
  await rememberOrder(c, order.order_no);
  const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  return c.html(V.layout(ctx, "Order Confirmed", V.successView(ctx, { order, items })));
});

app.get("/track", async (c) => {
  const ctx = ctxOf(c);
  const no = (c.req.query("order_no") || "").trim().toUpperCase();
  let order = null, returns = [], canReturn = false, authorized = false;
  if (no) {
    const found = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(no).first();
    // Only reveal order details to the owner / same browser / valid token / matching email.
    if (found && (await canViewOrder(c, found))) { order = found; authorized = true; await rememberOrder(c, no); }
  }
  const items = order ? (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results : [];
  if (order) {
    returns = (await c.env.DB.prepare("SELECT * FROM returns WHERE order_id=?").bind(order.id).all()).results || [];
    canReturn = !!(ctx.user && order.user_id === ctx.user.id && order.status === "delivered" && returns.length === 0);
  }
  return c.html(V.layout(ctx, "Track Order", V.trackView(ctx, { order, items, searched: !!no, authorized, order_no: no, canReturn, returns })));
});

app.post("/newsletter", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (await rateLimited(c, "newsletter", 10, 3600)) return redirectMsg(c, "/", null, "Please try again later.");
  const email = (body.email || "").trim().toLowerCase().slice(0, 200);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) await c.env.DB.prepare("INSERT OR IGNORE INTO newsletter (email) VALUES (?)").bind(email).run();
  return redirectMsg(c, "/", "Subscribed! Watch your inbox.");
});

// --------------------------------------------------------------------------- //
// Accounts
// --------------------------------------------------------------------------- //
app.get("/register", (c) => { const ctx = ctxOf(c); return ctx.user ? c.redirect("/account") : c.html(V.layout(ctx, "Register", V.registerView(ctx))); });
const SESSION_TTL = 86400 * 30 * 1000;       // customers: 30 days
const ADMIN_SESSION_TTL = 86400 * 7 * 1000;  // admin: 7 days
async function setSession(c, uid, ttl) {
  setCookie(c, "session", await signSession(c.env.SESSION_SECRET, { uid, exp: Date.now() + ttl }),
    { ...cookieOpts(c), httpOnly: true, maxAge: Math.floor(ttl / 1000) });
}
function safeNext(n) { return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/account"; }

app.post("/register", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (await rateLimited(c, "register", 10, 3600)) return redirectMsg(c, "/register", null, "Too many attempts. Please try again later.");
  const ctx = ctxOf(c);
  const name = (body.name || "").trim().slice(0, 120), email = (body.email || "").trim().toLowerCase().slice(0, 200), pw = body.password || "";
  if (!name || !email.includes("@") || pw.length < 6) return redirectMsg(c, "/register", null, "Name, a valid email and a 6+ char password are required.");
  const ex = await c.env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if (ex) return redirectMsg(c, "/register", null, "That email already has an account.");
  const res = await c.env.DB.prepare("INSERT INTO users (name,email,phone,password_hash) VALUES (?,?,?,?)")
    .bind(name, email, (body.phone || "").trim().slice(0, 20), await hashPassword(pw)).run();
  await setSession(c, res.meta.last_row_id, SESSION_TTL);
  return redirectMsg(c, "/account", "Welcome to Aswhani!");
});
app.get("/login", (c) => { const ctx = ctxOf(c); return ctx.user ? c.redirect("/account") : c.html(V.layout(ctx, "Login", V.loginView(ctx, { next: c.req.query("next") }))); });
app.post("/login", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (await rateLimited(c, "login", 10, 900)) return redirectMsg(c, "/login", null, "Too many login attempts. Please try again in a few minutes.");
  const email = (body.email || "").trim().toLowerCase();
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
  if (!u || !(await verifyPassword(body.password || "", u.password_hash))) return redirectMsg(c, "/login", null, "Invalid email or password.");
  await setSession(c, u.id, SESSION_TTL);
  return c.redirect(safeNext(body.next)); // same-origin paths only (no open redirect)
});
app.get("/logout", (c) => { deleteCookie(c, "session", { path: "/" }); return c.redirect("/"); });
app.get("/account", async (c) => {
  const ctx = ctxOf(c);
  if (!ctx.user) return c.redirect("/login?next=/account");
  const orders = (await c.env.DB.prepare("SELECT *, (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id=orders.id) AS item_count FROM orders WHERE user_id=? ORDER BY created_at DESC").bind(ctx.user.id).all()).results || [];
  const addresses = (await c.env.DB.prepare("SELECT * FROM addresses WHERE user_id=?").bind(ctx.user.id).all()).results || [];
  return c.html(V.layout(ctx, "My Account", V.accountView(ctx, { orders, addresses })));
});

// --------------------------------------------------------------------------- //
// Wishlist / addresses / reviews / pincode / invoice / returns / pages
// --------------------------------------------------------------------------- //
app.get("/wishlist", async (c) => {
  const ctx = ctxOf(c);
  if (!ctx.user) return c.redirect("/login?next=/wishlist");
  const products = (await c.env.DB.prepare("SELECT p.* FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.is_active=1 ORDER BY w.created_at DESC").bind(ctx.user.id).all()).results || [];
  return c.html(V.layout(ctx, "Wishlist", V.wishlistView(ctx, { products })));
});
app.post("/wishlist/toggle", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c);
  if (!ctx.user) return c.redirect("/login?next=" + encodeURIComponent(c.req.header("referer") || "/"));
  const pid = parseInt(body.product_id);
  const ex = await c.env.DB.prepare("SELECT id FROM wishlist WHERE user_id=? AND product_id=?").bind(ctx.user.id, pid).first();
  if (ex) await c.env.DB.prepare("DELETE FROM wishlist WHERE id=?").bind(ex.id).run();
  else await c.env.DB.prepare("INSERT INTO wishlist (user_id,product_id) VALUES (?,?)").bind(ctx.user.id, pid).run();
  return redirectMsg(c, c.req.header("referer") || "/", ex ? "Removed from wishlist." : "Saved to wishlist ♥");
});

app.post("/account/address", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c); if (!ctx.user) return c.redirect("/login");
  await c.env.DB.prepare("UPDATE addresses SET is_default=0 WHERE user_id=?").bind(ctx.user.id).run();
  await c.env.DB.prepare("INSERT INTO addresses (user_id,name,phone,line1,line2,city,state,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,1)")
    .bind(ctx.user.id, (body.name || "").trim(), (body.phone || "").trim(), (body.line1 || "").trim(), (body.line2 || "").trim(), (body.city || "").trim(), (body.state || "").trim(), (body.pincode || "").trim()).run();
  return redirectMsg(c, "/account", "Address saved.");
});
app.post("/account/address/:id/delete", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c); if (!ctx.user) return c.redirect("/login");
  await c.env.DB.prepare("DELETE FROM addresses WHERE id=? AND user_id=?").bind(c.req.param("id"), ctx.user.id).run();
  return redirectMsg(c, "/account", "Address removed.");
});
app.post("/account/address/:id/default", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c); if (!ctx.user) return c.redirect("/login");
  await c.env.DB.prepare("UPDATE addresses SET is_default=0 WHERE user_id=?").bind(ctx.user.id).run();
  await c.env.DB.prepare("UPDATE addresses SET is_default=1 WHERE id=? AND user_id=?").bind(c.req.param("id"), ctx.user.id).run();
  return redirectMsg(c, "/account", "Default address updated.");
});

app.post("/product/:slug/review", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c);
  const p = await c.env.DB.prepare("SELECT id,slug FROM products WHERE slug=?").bind(c.req.param("slug")).first();
  if (!p) return c.notFound();
  if (!ctx.user) return c.redirect("/login?next=/product/" + p.slug);
  const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 5));
  await c.env.DB.prepare("INSERT INTO reviews (product_id,user_id,name,rating,comment) VALUES (?,?,?,?,?)")
    .bind(p.id, ctx.user.id, ctx.user.name, rating, (body.comment || "").trim().slice(0, 1000)).run();
  return redirectMsg(c, "/product/" + p.slug + "#reviews", "Thanks for your review!");
});

app.get("/pincode/:pin", async (c) => {
  const pin = (c.req.param("pin") || "").trim();
  if (!/^[0-9]{6}$/.test(pin)) return c.json({ ok: false, msg: "Enter a valid 6-digit pincode." });
  const ctx = ctxOf(c);
  const days = parseInt(ctx.settings.delivery_days || "5") || 5;
  const d = "1234".includes(pin[0]) ? Math.max(2, days - 2) : days;
  const eta = new Date(Date.now() + d * 86400000).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  return c.json({ ok: true, msg: "Delivery by " + eta, cod: ctx.settings.cod_enabled !== "0" });
});

app.get("/order/:no/invoice", async (c) => {
  const ctx = ctxOf(c);
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.notFound();
  if (!(await canViewOrder(c, order))) return c.notFound();
  const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  return c.html(V.invoiceView(ctx, { order, items }));
});

app.post("/orders/:no/return", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c); if (!ctx.user) return c.redirect("/login");
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order || order.user_id !== ctx.user.id) return redirectMsg(c, "/account", null, "Not your order.");
  if (order.status !== "delivered") return redirectMsg(c, "/track?order_no=" + order.order_no, null, "You can request a return only after delivery.");
  await c.env.DB.prepare("INSERT INTO returns (order_id,user_id,kind,reason) VALUES (?,?,?,?)")
    .bind(order.id, ctx.user.id, body.kind === "exchange" ? "exchange" : "return", (body.reason || "").trim()).run();
  return redirectMsg(c, "/track?order_no=" + order.order_no, "Return/exchange request submitted.");
});

app.get("/page/:slug", async (c) => {
  const ctx = ctxOf(c);
  const page = await c.env.DB.prepare("SELECT * FROM pages WHERE slug=?").bind(c.req.param("slug")).first();
  if (!page) return c.notFound();
  return c.html(V.layout(ctx, page.title, V.pageView(ctx, { page })));
});
app.get("/contact", async (c) => {
  const ctx = ctxOf(c);
  const page = await c.env.DB.prepare("SELECT * FROM pages WHERE slug='contact'").first();
  return c.html(V.layout(ctx, "Contact Us", V.contactView(ctx, { page })));
});
app.post("/contact", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (await rateLimited(c, "contact", 5, 900)) return redirectMsg(c, "/contact", null, "Too many messages — please try again later.");
  const name = (body.name || "").trim().slice(0, 200), msg = (body.message || "").trim().slice(0, 2000), email = (body.email || "").trim().slice(0, 200);
  if (name && msg) {
    await c.env.DB.prepare("INSERT INTO contact_messages (name,email,message) VALUES (?,?,?)").bind(name, email, msg).run();
    I.notifyOwner(c.env, c.executionCtx, `New contact message from ${name.replace(/[\r\n]+/g, " ")} (${email}): ${msg.slice(0, 200).replace(/[\r\n]+/g, " ")}`);
    return redirectMsg(c, "/contact", "Thanks! We'll get back to you soon.");
  }
  return redirectMsg(c, "/contact", null, "Please add your name and message.");
});

app.get("/sitemap.xml", async (c) => {
  const origin = originOf(c);
  const prods = (await c.env.DB.prepare("SELECT slug FROM products WHERE is_active=1").all()).results || [];
  const pages = (await c.env.DB.prepare("SELECT slug FROM pages").all()).results || [];
  const urls = [origin + "/", origin + "/shop", ...prods.map((p) => origin + "/product/" + p.slug), ...pages.map((p) => origin + "/page/" + p.slug)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;
  return c.body(xml, 200, { "content-type": "application/xml" });
});
app.get("/robots.txt", (c) => c.body(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${originOf(c)}/sitemap.xml\n`, 200, { "content-type": "text/plain" }));

// --------------------------------------------------------------------------- //
// Admin
// --------------------------------------------------------------------------- //
async function ensureAdmin(c, email) {
  // Bootstrap the admin account from env on first login. Fail closed if no
  // ADMIN_PASSWORD is configured — never seed a known/default password.
  if (!c.env.ADMIN_PASSWORD) return;
  if (email !== (c.env.ADMIN_EMAIL || "").toLowerCase()) return;
  const ex = await c.env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if (!ex) {
    await c.env.DB.prepare("INSERT INTO users (name,email,password_hash,is_admin) VALUES (?,?,?,1)")
      .bind("Store Admin", email, await hashPassword(c.env.ADMIN_PASSWORD)).run();
  }
}
function isAdmin(ctx) { return ctx.user && ctx.user.is_admin; }

app.get("/admin", (c) => { const ctx = ctxOf(c); return isAdmin(ctx) ? c.redirect("/admin/") : c.html(A.adminLoginView(ctx)); });
app.post("/admin", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const ctx = ctxOf(c);
  if (await rateLimited(c, "admin-login", 8, 900)) { ctx.flash = { msg: "Too many attempts. Try again in a few minutes.", type: "error" }; return c.html(A.adminLoginView(ctx)); }
  const email = (body.email || "").trim().toLowerCase();
  await ensureAdmin(c, email);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE email=? AND is_admin=1").bind(email).first();
  if (!u || !(await verifyPassword(body.password || "", u.password_hash))) { ctx.flash = { msg: "Invalid admin credentials.", type: "error" }; return c.html(A.adminLoginView(ctx)); }
  await setSession(c, u.id, ADMIN_SESSION_TTL);
  return c.redirect("/admin/");
});
app.get("/admin/logout", (c) => { deleteCookie(c, "session", { path: "/" }); return c.redirect("/admin"); });

// Guard for all /admin/* below
app.use("/admin/*", async (c, next) => { if (!isAdmin(ctxOf(c))) return c.redirect("/admin"); await next(); });

app.get("/admin/", async (c) => {
  const ctx = ctxOf(c); const db = c.env.DB;
  const stats = {
    orders: (await db.prepare("SELECT COUNT(*) n FROM orders").first()).n,
    revenue: (await db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='paid' OR payment_method='cod'").first()).n,
    products: (await db.prepare("SELECT COUNT(*) n FROM products").first()).n,
    customers: (await db.prepare("SELECT COUNT(*) n FROM users WHERE is_admin=0").first()).n,
  };
  const recent = (await db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8").all()).results || [];
  const low = (await db.prepare("SELECT * FROM products WHERE stock<=5 ORDER BY stock LIMIT 8").all()).results || [];
  return c.html(A.dashboardView(ctx, { stats, recent, low }));
});

app.get("/admin/products", async (c) => {
  const products = (await c.env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all()).results || [];
  return c.html(A.adminProductsView(ctxOf(c), { products }));
});
app.get("/admin/products/new", (c) => c.html(A.productFormView(ctxOf(c), { p: null, categories: ctxOf(c).categories, variantMap: {}, gallery: [] })));

const IMG_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
async function saveProductImage(c, body, current) {
  const f = body.image_file;
  if (f && typeof f === "object" && f.size > 0) {
    // Allow-list real image types only; ignore the user-supplied filename/type for
    // the key and never persist svg/html (which /img could otherwise serve active).
    const ext = IMG_TYPES[f.type];
    if (!ext || f.size > 5 * 1024 * 1024) return current || ""; // reject; keep existing image
    const key = randomToken(8) + "." + ext;
    await c.env.BUCKET.put(key, await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
    return "/img/" + key;
  }
  if (body.image_url) return body.image_url.trim().slice(0, 500);
  return current || "";
}
function productFields(body) {
  return {
    name: (body.name || "").trim(), description: (body.description || "").trim(),
    size_chart: (body.size_chart || "").trim(),
    category_id: body.category_id ? parseInt(body.category_id) : null,
    price: parseInt(body.price) || 0, mrp: body.mrp ? parseInt(body.mrp) : null,
    sizes: (body.sizes || "").trim(), colors: (body.colors || "").trim(),
    stock: parseInt(body.stock) || 0, is_active: body.is_active ? 1 : 0,
  };
}
async function saveVariants(env, productId, body) {
  const posted = {};
  for (const k in body) if (k.startsWith("vstock[") && k.endsWith("]")) posted[k.slice(7, -1)] = Math.max(0, parseInt(body[k]) || 0);
  const existing = {};
  for (const v of (await env.DB.prepare("SELECT id,size,color FROM product_variants WHERE product_id=?").bind(productId).all()).results || [])
    existing[`${(v.size || "").trim()}|${(v.color || "").trim()}`] = v.id;
  for (const combo in posted) {
    const i = combo.indexOf("|"); const size = combo.slice(0, i), color = combo.slice(i + 1);
    if (existing[combo]) await env.DB.prepare("UPDATE product_variants SET stock=? WHERE id=?").bind(posted[combo], existing[combo]).run();
    else await env.DB.prepare("INSERT INTO product_variants (product_id,size,color,stock) VALUES (?,?,?,?)").bind(productId, size, color, posted[combo]).run();
  }
  for (const combo in existing) if (!(combo in posted)) await env.DB.prepare("DELETE FROM product_variants WHERE id=?").bind(existing[combo]).run();
}
app.post("/admin/products/new", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const f = productFields(body);
  if (!f.name || !f.price) return redirectMsg(c, "/admin/products/new", null, "Name and price required.");
  const image = await saveProductImage(c, body, "");
  const r = await c.env.DB.prepare("INSERT INTO products (name,slug,description,size_chart,category_id,price,mrp,image,sizes,colors,stock,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(f.name, slugify(f.name) + "-" + randomToken(2), f.description, f.size_chart, f.category_id, f.price, f.mrp, image, f.sizes || "S,M,L,XL", f.colors, f.stock, f.is_active).run();
  await saveVariants(c.env, r.meta.last_row_id, body);
  return redirectMsg(c, "/admin/products", "Product created.");
});
app.get("/admin/products/:id", async (c) => {
  const p = await c.env.DB.prepare("SELECT * FROM products WHERE id=?").bind(c.req.param("id")).first();
  if (!p) return c.redirect("/admin/products");
  const vm = await variantMap(c.env, p.id);
  const gallery = (await c.env.DB.prepare("SELECT id,url FROM product_images WHERE product_id=? ORDER BY sort_order").bind(p.id).all()).results || [];
  return c.html(A.productFormView(ctxOf(c), { p, categories: ctxOf(c).categories, variantMap: vm, gallery }));
});
app.post("/admin/products/:id", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first();
  if (!cur) return c.redirect("/admin/products");
  const f = productFields(body);
  const image = await saveProductImage(c, body, cur.image);
  await c.env.DB.prepare("UPDATE products SET name=?,description=?,size_chart=?,category_id=?,price=?,mrp=?,image=?,sizes=?,colors=?,stock=?,is_active=? WHERE id=?")
    .bind(f.name, f.description, f.size_chart, f.category_id, f.price, f.mrp, image, f.sizes, f.colors, f.stock, f.is_active, id).run();
  await saveVariants(c.env, parseInt(id), body);
  return redirectMsg(c, "/admin/products", "Product updated.");
});
app.post("/admin/products/:id/delete", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM product_variants WHERE product_id=?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM product_images WHERE product_id=?").bind(id).run();
  return redirectMsg(c, "/admin/products", "Product deleted.");
});
app.post("/admin/products/:id/image/add", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const id = c.req.param("id");
  const url = await saveProductImage(c, body, "");
  if (url) await c.env.DB.prepare("INSERT INTO product_images (product_id,url,sort_order) VALUES (?,?,0)").bind(id, url).run();
  return redirectMsg(c, "/admin/products/" + id, "Image added.");
});
app.post("/admin/products/image/:iid/delete", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const im = await c.env.DB.prepare("SELECT product_id FROM product_images WHERE id=?").bind(c.req.param("iid")).first();
  await c.env.DB.prepare("DELETE FROM product_images WHERE id=?").bind(c.req.param("iid")).run();
  return redirectMsg(c, im ? "/admin/products/" + im.product_id : "/admin/products", "Image removed.");
});

app.get("/admin/orders", async (c) => {
  const status = c.req.query("status");
  let sql = "SELECT * FROM orders", binds = [];
  if (status) { sql += " WHERE status=?"; binds.push(status); }
  sql += " ORDER BY created_at DESC";
  const orders = (await c.env.DB.prepare(sql).bind(...binds).all()).results || [];
  return c.html(A.adminOrdersView(ctxOf(c), { orders, status }));
});
app.get("/admin/orders/:no", async (c) => {
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.redirect("/admin/orders");
  const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  return c.html(A.adminOrderView(ctxOf(c), { order, items }));
});
app.post("/admin/orders/:no", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const no = c.req.param("no");
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(no).first();
  if (!order) return c.redirect("/admin/orders");
  if (body.action === "status") {
    const ns = body.status;
    let pay = order.payment_status;
    if (ns === "delivered" && order.payment_method === "cod") pay = "paid";
    if (ns === "cancelled" && order.status !== "cancelled") await restoreStock(c.env, order);
    else if (order.status === "cancelled" && ns !== "cancelled") await commitStock(c.env, { id: order.id, stock_committed: 0 });
    await c.env.DB.prepare("UPDATE orders SET status=?,payment_status=? WHERE id=?").bind(ns, pay, order.id).run();
    if (["shipped", "out_for_delivery", "delivered"].includes(ns) && order.email) {
      const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
      const label = { shipped: "Shipped", out_for_delivery: "Out for Delivery", delivered: "Delivered" }[ns];
      I.sendEmail(c.env, c.executionCtx, order.email, `Order ${label} — ${no} · Aswhani`, I.orderEmailHtml(order, items, originOf(c) + "/track?order_no=" + no + (order.access_token ? "&t=" + order.access_token : ""), "Order " + label, "Your order status has been updated."));
    }
  } else if (body.action === "shipping") {
    await c.env.DB.prepare("UPDATE orders SET courier_name=?,awb=? WHERE id=?").bind((body.courier_name || "").trim(), (body.awb || "").trim(), order.id).run();
  } else if (body.action === "payment") {
    await c.env.DB.prepare("UPDATE orders SET payment_status=? WHERE id=?").bind(body.payment_status, order.id).run();
  } else if (body.action === "shiprocket") {
    const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
    const r = await I.shiprocketPush(c.env, order, items);
    if (r.ok) await c.env.DB.prepare("UPDATE orders SET courier_name=CASE WHEN courier_name IS NULL OR courier_name='' THEN 'Shiprocket' ELSE courier_name END, awb=? WHERE id=?").bind(r.awb || order.awb || "", order.id).run();
    return redirectMsg(c, "/admin/orders/" + no, r.ok ? r.msg : null, r.ok ? null : r.msg);
  }
  return redirectMsg(c, "/admin/orders/" + no, "Order updated.");
});

// ---- Admin: invoice, coupons, reviews, returns, pages, reports, newsletter, messages, settings, import ----
app.get("/admin/orders/:no/invoice", async (c) => {
  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE order_no=?").bind(c.req.param("no")).first();
  if (!order) return c.redirect("/admin/orders");
  const items = (await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(order.id).all()).results || [];
  return c.html(V.invoiceView(ctxOf(c), { order, items }));
});

app.get("/admin/coupons", async (c) => c.html(A.couponsView(ctxOf(c), { coupons: (await c.env.DB.prepare("SELECT * FROM coupons ORDER BY id DESC").all()).results || [] })));
app.post("/admin/coupons", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const code = (body.code || "").trim().toUpperCase();
  const expires = (body.expires_at || "").trim() || null;
  if (code) await c.env.DB.prepare("INSERT OR IGNORE INTO coupons (code,kind,value,min_order,is_active,expires_at,first_order_only,once_per_user) VALUES (?,?,?,?,1,?,?,?)").bind(code, body.kind || "percent", parseInt(body.value) || 0, parseInt(body.min_order) || 0, expires, body.first_order_only ? 1 : 0, body.once_per_user ? 1 : 0).run();
  return redirectMsg(c, "/admin/coupons", "Coupon saved.");
});
app.post("/admin/coupons/:id/toggle", async (c) => { const b = await checkCsrf(c); if (!b) return c.text("Bad CSRF", 403); await c.env.DB.prepare("UPDATE coupons SET is_active=1-is_active WHERE id=?").bind(c.req.param("id")).run(); return c.redirect("/admin/coupons"); });
app.post("/admin/coupons/:id/delete", async (c) => { const b = await checkCsrf(c); if (!b) return c.text("Bad CSRF", 403); await c.env.DB.prepare("DELETE FROM coupons WHERE id=?").bind(c.req.param("id")).run(); return redirectMsg(c, "/admin/coupons", "Coupon deleted."); });

app.get("/admin/reviews", async (c) => c.html(A.reviewsView(ctxOf(c), { reviews: (await c.env.DB.prepare("SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC").all()).results || [] })));
app.post("/admin/reviews/:id/delete", async (c) => { const b = await checkCsrf(c); if (!b) return c.text("Bad CSRF", 403); await c.env.DB.prepare("DELETE FROM reviews WHERE id=?").bind(c.req.param("id")).run(); return redirectMsg(c, "/admin/reviews", "Review deleted."); });

app.get("/admin/returns", async (c) => c.html(A.returnsView(ctxOf(c), { returns: (await c.env.DB.prepare("SELECT rt.*, o.order_no FROM returns rt LEFT JOIN orders o ON o.id=rt.order_id ORDER BY rt.created_at DESC").all()).results || [] })));
app.post("/admin/returns", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  if (["requested", "approved", "rejected", "completed"].includes(body.status)) await c.env.DB.prepare("UPDATE returns SET status=? WHERE id=?").bind(body.status, body.id).run();
  return redirectMsg(c, "/admin/returns", "Return updated.");
});

app.get("/admin/pages", async (c) => c.html(A.pagesView(ctxOf(c), { pages: (await c.env.DB.prepare("SELECT * FROM pages ORDER BY sort_order").all()).results || [] })));
app.get("/admin/pages/new", (c) => c.html(A.pageFormView(ctxOf(c), { page: null })));
app.post("/admin/pages/new", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const title = (body.title || "").trim(); const slug = (body.slug || "").trim() || slugify(title);
  if (title) await c.env.DB.prepare("INSERT OR IGNORE INTO pages (slug,title,body,in_footer,sort_order) VALUES (?,?,?,?,9)").bind(slug, title, body.body || "", body.in_footer ? 1 : 0).run();
  return redirectMsg(c, "/admin/pages", "Page created.");
});
app.get("/admin/pages/:id", async (c) => { const page = await c.env.DB.prepare("SELECT * FROM pages WHERE id=?").bind(c.req.param("id")).first(); return page ? c.html(A.pageFormView(ctxOf(c), { page })) : c.redirect("/admin/pages"); });
app.post("/admin/pages/:id", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  await c.env.DB.prepare("UPDATE pages SET title=?,body=?,in_footer=? WHERE id=?").bind((body.title || "").trim(), body.body || "", body.in_footer ? 1 : 0, c.req.param("id")).run();
  return redirectMsg(c, "/admin/pages", "Page saved.");
});
app.post("/admin/pages/:id/delete", async (c) => { const b = await checkCsrf(c); if (!b) return c.text("Bad CSRF", 403); await c.env.DB.prepare("DELETE FROM pages WHERE id=?").bind(c.req.param("id")).run(); return redirectMsg(c, "/admin/pages", "Page deleted."); });

app.get("/admin/reports", async (c) => {
  const db = c.env.DB; const days = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(Date.now() - i * 86400000); const ds = start.toISOString().slice(0, 10);
    const row = await db.prepare("SELECT COALESCE(SUM(total),0) rev FROM orders WHERE substr(created_at,1,10)=?").bind(ds).first();
    days.push({ label: start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), rev: row.rev });
  }
  const maxrev = Math.max(1, ...days.map((d) => d.rev));
  const top = (await db.prepare("SELECT name, SUM(qty) q, SUM(price*qty) amt FROM order_items GROUP BY name ORDER BY q DESC LIMIT 8").all()).results || [];
  return c.html(A.reportsView(ctxOf(c), { days, maxrev, top }));
});

app.get("/admin/newsletter", async (c) => c.html(A.newsletterView(ctxOf(c), { subs: (await c.env.DB.prepare("SELECT * FROM newsletter ORDER BY created_at DESC").all()).results || [] })));
app.get("/admin/newsletter/export.csv", async (c) => {
  const subs = (await c.env.DB.prepare("SELECT email,created_at FROM newsletter ORDER BY created_at DESC").all()).results || [];
  const csvBody = "﻿Email,Subscribed\n" + subs.map((s) => `${s.email},${(s.created_at || "").slice(0, 10)}`).join("\n");
  return c.body(csvBody, 200, { "content-type": "text/csv", "content-disposition": "attachment; filename=newsletter.csv" });
});
app.get("/admin/messages", async (c) => c.html(A.messagesView(ctxOf(c), { messages: (await c.env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all()).results || [] })));

app.get("/admin/settings", async (c) => c.html(A.settingsView(ctxOf(c), { v: ctxOf(c).settings })));
app.post("/admin/settings", async (c) => {
  const body = await checkCsrf(c); if (!body) return c.text("Bad CSRF", 403);
  const keys = ["store_name", "store_tagline", "support_email", "support_phone", "shipping_fee", "free_shipping_above", "delivery_days", "seller_name", "seller_address", "gst_number", "gst_rate", "meta_description", "ga_id", "pixel_id"];
  for (const k of keys) await c.env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, (body[k] || "").trim()).run();
  await c.env.DB.prepare("INSERT INTO settings (key,value) VALUES ('cod_enabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(body.cod_enabled ? "1" : "0").run();
  return redirectMsg(c, "/admin/settings", "Settings saved.");
});

app.get("/admin/import", (c) => c.html(A.importView(ctxOf(c))));
app.post("/admin/import", async (c) => {
  const body = await c.req.parseBody();
  if (!body.csrf || body.csrf !== getCookie(c, "csrf")) return c.text("Bad CSRF", 403);
  const f = body.csv_file;
  if (!f || typeof f !== "object") return redirectMsg(c, "/admin/import", null, "Choose a CSV file.");
  if (f.size > 2 * 1024 * 1024) return redirectMsg(c, "/admin/import", null, "CSV too large (max 2 MB).");
  const text = await f.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return redirectMsg(c, "/admin/import", null, "Empty CSV.");
  const MAX_ROWS = 2000;
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const cats = {}; for (const cat of (await c.env.DB.prepare("SELECT id,name FROM categories").all()).results || []) cats[cat.name.toLowerCase()] = cat.id;
  let added = 0, updated = 0;
  for (let i = 1; i < lines.length && i <= MAX_ROWS; i++) {
    const cols = parseCsvLine(lines[i]); const row = {}; headers.forEach((h, j) => (row[h] = (cols[j] || "").trim()));
    if (!row.name) continue;
    const price = parseInt(row.price) || 0;
    const ex = await c.env.DB.prepare("SELECT id FROM products WHERE name=?").bind(row.name).first();
    const catId = cats[(row.category || "").toLowerCase()] || null;
    if (ex) { await c.env.DB.prepare("UPDATE products SET price=?,mrp=?,description=?,sizes=?,colors=?,stock=?,image=COALESCE(NULLIF(?,''),image),category_id=COALESCE(?,category_id),is_active=1 WHERE id=?").bind(price, parseInt(row.mrp) || null, row.description || "", row.sizes || "S,M,L,XL", row.colors || "", parseInt(row.stock) || 0, row.image || "", catId, ex.id).run(); updated++; }
    else { await c.env.DB.prepare("INSERT INTO products (name,slug,description,category_id,price,mrp,image,sizes,colors,stock,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,1)").bind(row.name, slugify(row.name) + "-" + randomToken(2), row.description || "", catId, price, parseInt(row.mrp) || null, row.image || "", row.sizes || "S,M,L,XL", row.colors || "", parseInt(row.stock) || 0).run(); added++; }
  }
  return redirectMsg(c, "/admin/products", `Import done — ${added} added, ${updated} updated.`);
});
function parseCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
  }
  out.push(cur); return out;
}

app.notFound((c) => {
  const ctx = ctxOf(c);
  return c.html(V.layout(ctx, "Not found", `<div class="max-w-md mx-auto px-4 py-28 text-center"><div class="font-display text-7xl text-clay">404</div><p class="mt-3 text-lg">Page not found.</p><a href="/" class="inline-block mt-6 bg-ink text-paper px-7 py-3 text-[12px] uppercase tracking-[0.2em]">Home</a></div>`), 404);
});

export default app;
