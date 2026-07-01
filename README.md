<div align="center">

# Aswhani — Cloudflare Store

### *Wear the vibe.* — a complete, animated clothing storefront that runs **100% on Cloudflare's free tier**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![D1](https://img.shields.io/badge/D1-SQLite-003B57?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![R2](https://img.shields.io/badge/R2-Object%20Storage-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CDN-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Alpine.js](https://img.shields.io/badge/Alpine.js-3.x-8BC0D0?logo=alpinedotjs&logoColor=white)](https://alpinejs.dev/)
![No credit card](https://img.shields.io/badge/free%20tier-no%20card-16a34a)

Storefront · Customer accounts · Full admin panel · Real payments · Live tracking · **Motion-designed UI**

</div>

---

Aswhani is an editorial‑style fashion e‑commerce store built on Cloudflare Workers. It's fast (server‑rendered at the edge), **data‑safe** (D1 + R2 are persistent — they don't pause or wipe like Supabase free), and now ships with an **advanced animation layer** and a **drop‑in local image system**.

- **Cloudflare Workers** (Hono) — the app/server, rendered at the edge
- **D1** — SQLite database (products, orders, users) — *persistent, never pauses or wipes*
- **R2** — admin image uploads · **`/public/images`** — your site's hero/category/product photos
- Storefront + customer accounts + full **admin panel**
- **Per‑size/colour stock**, **coupons**, **reviews & ratings**, **wishlist**, **returns/exchange**
- **GST invoice** (print/PDF), **size chart**, **multiple addresses**, **product gallery**, **pincode delivery check**
- **Policy/About/Contact pages** (editable), **bulk CSV import**, **sales reports**, **newsletter**, **SEO** (sitemap/robots, GA/Pixel)
- Payments: **Cash on Delivery** + **real Razorpay** (UPI/cards) + a demo gateway when no keys
- Optional **customer emails** (Resend), **owner Telegram alerts**, **Shiprocket** auto‑shipment — all gracefully disabled until you add keys

---

## ✨ What's new — Motion & design

The storefront now has a hand‑built, dependency‑free animation system (no GSAP, no bloat — just IntersectionObserver + CSS):

| Effect | Where |
|--------|-------|
| **Hero parallax** | Home hero image drifts as you scroll |
| **Staggered headline reveal** | Hero eyebrow → title → subtitle → CTA rise in sequence |
| **Scroll‑reveal** | Every section, product card & category tile fades/zooms in on entry, with per‑item stagger |
| **Editorial story band** | New split "Crafted to last / Our promise" section with left/right reveals |
| **Product hover** | Image zoom + card lift + slide‑in "View Product" bar |
| **Sticky product gallery** | Main image stays in view on desktop while you read details |
| **Details accordion** | Description / Fabric & Care / Shipping & Returns, animated |
| **Sticky mobile buy bar** | Price + Add‑to‑Bag pinned to the bottom on phones |
| **Micro‑interactions** | Shimmer sweep on the primary CTA, cart‑badge pop, animated nav underlines |

Everything is **accessibility‑aware**: it fully respects `prefers-reduced-motion`, and degrades gracefully with **JavaScript disabled** (content is always visible, never hidden behind an animation that never runs).

---

## 🖼️ Your images — drop‑in, zero code

Site photos live in **[`public/images/`](public/images/)** and are served straight from Cloudflare's edge at `/images/…`.

1. Open **[`public/images/README.md`](public/images/README.md)** — it lists every filename and the size to use.
2. Drop your `.jpg` (or `.webp`) files in with those exact names, e.g. `hero.jpg`, `category-men.jpg`, `classic-oversized-cotton-tee.jpg`.
3. Restart `npm run dev` (or redeploy). Done — they're live.

Until a file exists, the site shows an **on‑brand fabric placeholder** (generated inline, no network) — so it **never shows a broken image**, before or after you add photos. Product/category image paths are seeded in `schema.sql`; the seed's migration block also upgrades an already‑seeded database to the local paths on the next `npm run db:local` / `db:remote`.

> Need photos? See the **[AI image prompts appendix](#-appendix-ai-image-prompts)** at the bottom — copy‑paste‑ready prompts, tuned to the store's warm clay/paper/ink palette.

---

## 🚀 Run locally (test before deploying)
```bash
npm install
npm run db:local        # creates + seeds the local D1 database
npm run dev             # http://localhost:8787  (admin at /admin)
```
Default admin login (from `.dev.vars`): `admin@aswhani.com` / `admin123`.

---

## ☁️ Deploy to Cloudflare (free)
1. **Log in** (opens browser, no card):
   ```bash
   npx wrangler login
   ```
2. **Create the database** and paste the returned `database_id` into `wrangler.toml`:
   ```bash
   npx wrangler d1 create aswhani-db
   ```
3. **Create the image bucket** (for admin uploads):
   ```bash
   npx wrangler r2 bucket create aswhani-images
   ```
4. **Load the schema + sample products** into the live database:
   ```bash
   npm run db:remote
   ```
5. **Set secrets** (one prompt each). **`SESSION_SECRET` and `ADMIN_PASSWORD` are REQUIRED** — the site fails closed (500 / no admin) if `SESSION_SECRET` is missing, and it will **not** create the admin account without `ADMIN_PASSWORD` (no insecure default). Generate a strong secret, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   ```bash
   npx wrangler secret put SESSION_SECRET     # REQUIRED — 32+ random bytes (see above)
   npx wrangler secret put ADMIN_EMAIL        # your admin email
   npx wrangler secret put ADMIN_PASSWORD     # REQUIRED — a strong password (no default!)
   # optional — real online payments:
   npx wrangler secret put RAZORPAY_KEY_ID
   npx wrangler secret put RAZORPAY_KEY_SECRET
   # optional — customer emails (free key at resend.com):
   npx wrangler secret put RESEND_API_KEY
   # optional — owner Telegram alerts:
   npx wrangler secret put STORE_TG_TOKEN
   npx wrangler secret put STORE_TG_CHAT
   # optional — Shiprocket auto-shipment:
   npx wrangler secret put SHIPROCKET_EMAIL
   npx wrangler secret put SHIPROCKET_PASSWORD
   ```
   All optional integrations are **gracefully disabled** (just logged) until you add their keys — the store works fully without them.
6. **Deploy** (`./public` ships automatically as static assets):
   ```bash
   npm run deploy
   ```
   You'll get a live URL like `https://aswhani.<you>.workers.dev`.

### Add your custom domain
Cloudflare dashboard → **Workers & Pages → your worker → Settings → Domains & Routes → Add → Custom Domain**. Free SSL is provisioned automatically. (Add the site under "Websites" first so its nameservers are on Cloudflare.)

---

## 🛠️ Admin
`/admin` → log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The admin user is created automatically on first login. From there: dashboard, products (add/edit/delete, image upload to R2, gallery, per‑variant stock), orders (status, courier + AWB, Shiprocket push), coupons, reviews, returns, pages, reports, newsletter, messages, settings, and bulk CSV import.

## ✅ Why "free forever, data‑safe"
- D1 + R2 are **persistent** — data does NOT vanish on inactivity (the Supabase problem) or on redeploy.
- Free‑tier limits (plenty for a small store): Workers **100k req/day**, D1 **5 GB**, R2 **10 GB**.
- **No credit card** needed. Custom domain + free SSL included.

## 🔒 Security (built‑in)
This build is hardened against the common store attacks:
- **Sessions** are HMAC‑signed with a server‑side expiry; cookies are `HttpOnly` + `Secure` (HTTPS) + `SameSite=Lax`. No usable secret/password defaults — missing config fails closed.
- **Payments**: the Razorpay signature is verified against the order's *stored* id (no cross‑order replay), each payment id can settle only one order (`UNIQUE` index), and the demo gateway can never mark a real order paid. `markPaid` is an atomic compare‑and‑set.
- **Order privacy**: order/invoice/pay pages are visible only to the admin, the logged‑in owner, the same browser that placed the order, or a valid per‑order token / matching email — guessing an order number leaks nothing.
- **Input**: every D1 query is parameterized; cart quantity is sanitized server‑side; prices are always recomputed from the DB; output is HTML‑escaped; uploads accept JPG/PNG/WebP/GIF/AVIF only and are served `nosniff`.
- **Abuse**: CSRF on every state‑changing POST, per‑IP rate limits on login / admin / register / coupon / contact, security headers (HSTS, X‑Frame‑Options, nosniff, Referrer‑Policy), and an open‑redirect guard on login.

> **Upgrading an already‑deployed DB?** The schema is `CREATE … IF NOT EXISTS`; re‑run `npm run db:remote`. The one new column on older DBs is `orders.access_token` — add it once with `ALTER TABLE orders ADD COLUMN access_token TEXT;`. Back up anytime: `npx wrangler d1 export aswhani-db --remote --output backup.sql`.

## 📁 Structure
```
public/images/      # ← your site photos (hero, categories, products) + naming guide
src/index.js        # all routes (Hono) + D1/R2 wiring + static-asset fallthrough
src/lib.js          # crypto auth (PBKDF2), signed sessions, CSRF, cart, helpers
src/views.js        # storefront HTML + the motion system (reveal/parallax/fallback)
src/admin_views.js  # admin panel HTML
schema.sql          # D1 tables + seed + local-image migration
wrangler.toml       # bindings (D1, R2) + [assets] static hosting
```

---

## 🎨 Appendix: AI image prompts

Copy any prompt into your image generator (Higgsfield, Midjourney, DALL·E, FLUX, etc.). They're tuned to the store's palette — **ink** `#23190f` (espresso), **paper** `#f3ece0` (warm cream), **clay** `#bf5836` (terracotta) — for a consistent editorial look. Save each result into `public/images/` with the filename shown.

**House style (append to every prompt):**
> *editorial fashion e‑commerce photography, warm natural window light, soft shadows, minimal cream/terracotta styling, matte film look, high detail, no text, no watermark.*

### Hero — `hero.jpg` (landscape 1600×1000)
> Wide lifestyle banner: a relaxed model in neutral everyday clothing walking through a sunlit minimal studio with a warm cream backdrop, negative space on the left for text, terracotta accent prop.

### Categories (portrait 900×1200)
- `category-men.jpg` — Menswear flat‑lay/model: neutral tee, denim & linen shirt on a warm cream background.
- `category-women.jpg` — Womenswear: floral dress & kurti styled on a model, soft daylight.
- `category-kids.jpg` — Kids' clothing: playful graphic tee & denim dungaree, bright but warm.
- `category-winter.jpg` — Winter wear: puffer jacket & wool pullover, cosy warm tones.
- `category-accessories.jpg` — Accessories: canvas tote & aviator sunglasses styled on cream fabric.

### Products (portrait 1000×1250, product centered on cream)
- `classic-oversized-cotton-tee.jpg` — black oversized cotton t‑shirt on a model, relaxed fit.
- `slim-fit-stretch-denim-jeans.jpg` — blue slim‑fit stretch denim jeans, clean cut.
- `linen-casual-shirt.jpg` — beige breathable linen shirt, summer styling.
- `hooded-sweatshirt.jpg` — grey fleece‑lined hoodie, cosy.
- `floral-summer-dress.jpg` — flowy yellow floral summer dress on a model.
- `embroidered-kurti.jpg` — teal embroidered kurti, festive, hand‑feel detail.
- `high-waist-palazzo-pants.jpg` — black high‑waist palazzo pants, breezy drape.
- `kids-graphic-tshirt.jpg` — red kids' graphic cotton t‑shirt.
- `kids-denim-dungaree.jpg` — blue kids' denim dungaree, playful.
- `cozy-puffer-jacket.jpg` — black lightweight puffer jacket, warm.
- `wool-blend-pullover.jpg` — charcoal wool‑blend knit pullover.
- `canvas-tote-bag.jpg` — natural sturdy canvas tote bag on cream.
- `classic-aviator-sunglasses.jpg` — gold classic aviator sunglasses, close product shot.

### Optional editorial (landscape 1400×1000)
- `editorial-1.jpg` — close crafted detail: hands adjusting a garment / stitching, warm light ("Crafted to last").
- `editorial-2.jpg` — folded stack of neutral everyday essentials on cream linen.

<div align="center"><sub>Built on Cloudflare · UPI · Cards · Cash on Delivery</sub></div>
