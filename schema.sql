-- Aswhani — D1 schema + seed. Idempotent for tables (CREATE IF NOT EXISTS).
-- Note: changing columns on an existing DB needs a fresh DB or ALTER. For a new
-- deploy this file creates everything correctly.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, image TEXT, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '', size_chart TEXT DEFAULT '',
  category_id INTEGER, price INTEGER NOT NULL, mrp INTEGER, image TEXT,
  sizes TEXT DEFAULT 'S,M,L,XL', colors TEXT DEFAULT '', stock INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1, is_featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER, size TEXT DEFAULT '', color TEXT DEFAULT '', stock INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER, url TEXT NOT NULL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT,
  password_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, name TEXT, phone TEXT, line1 TEXT, line2 TEXT,
  city TEXT, state TEXT, pincode TEXT, is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL, user_id INTEGER,
  customer_name TEXT, email TEXT, phone TEXT,
  address_line1 TEXT, address_line2 TEXT, city TEXT, state TEXT, pincode TEXT,
  subtotal INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, coupon_code TEXT,
  shipping_fee INTEGER DEFAULT 0, total INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'cod', payment_status TEXT DEFAULT 'pending',
  razorpay_order_id TEXT, razorpay_payment_id TEXT,
  status TEXT DEFAULT 'placed', courier_name TEXT, awb TEXT,
  stock_committed INTEGER DEFAULT 0,
  access_token TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
-- A given Razorpay payment may settle only ONE order (replay/double-spend guard).
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_rpid ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER, product_id INTEGER,
  name TEXT, image TEXT, price INTEGER, size TEXT, color TEXT, qty INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, kind TEXT DEFAULT 'percent', value INTEGER DEFAULT 0,
  min_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
  expires_at TEXT, first_order_only INTEGER DEFAULT 0, once_per_user INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER, user_id INTEGER, order_no TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER, user_id INTEGER, name TEXT, rating INTEGER DEFAULT 5,
  comment TEXT DEFAULT '', approved INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, product_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER, user_id INTEGER, kind TEXT DEFAULT 'return',
  reason TEXT DEFAULT '', status TEXT DEFAULT 'requested', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE, title TEXT, body TEXT DEFAULT '',
  in_footer INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- Rate-limit hits (login / admin / coupon / contact brute-force throttle).
CREATE TABLE IF NOT EXISTS rate_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT, ts INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rate_bucket ON rate_hits(bucket, ts);

-- ---- Seed ----
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name','Aswhani'), ('store_tagline','Wear the vibe.'),
  ('support_email','support@aswhani.com'), ('support_phone','+91 90000 00000'),
  ('shipping_fee','49'), ('free_shipping_above','999'), ('cod_enabled','1'),
  ('seller_name','Aswhani Apparel'), ('seller_address','Indore, Madhya Pradesh, India'),
  ('gst_number',''), ('gst_rate','5'), ('delivery_days','5'),
  ('meta_description','Shop the latest clothing for men, women and kids at Aswhani.'),
  ('ga_id',''), ('pixel_id','');

INSERT OR IGNORE INTO categories (name, slug, image, sort_order) VALUES
  ('Men','men','/images/category-men.jpg',0),
  ('Women','women','/images/category-women.jpg',1),
  ('Kids','kids','/images/category-kids.jpg',2),
  ('Winter Wear','winter-wear','/images/category-winter.jpg',3),
  ('Accessories','accessories','/images/category-accessories.jpg',4);

INSERT OR IGNORE INTO products (name, slug, description, size_chart, category_id, price, mrp, image, sizes, colors, stock, is_featured) VALUES
  ('Classic Oversized Cotton Tee','classic-oversized-cotton-tee','Soft premium cotton, relaxed everyday fit.','S = chest 38in\nM = 40in\nL = 42in\nXL = 44in',1,699,1199,'/images/classic-oversized-cotton-tee.jpg','S,M,L,XL,XXL','Black,White,Olive',100,1),
  ('Slim Fit Stretch Denim Jeans','slim-fit-stretch-denim-jeans','Comfort-stretch denim with a clean slim cut.','',1,1299,2499,'/images/slim-fit-stretch-denim-jeans.jpg','30,32,34,36','Blue,Black',100,1),
  ('Linen Casual Shirt','linen-casual-shirt','Breathable linen for easy summer days.','',1,1099,1799,'/images/linen-casual-shirt.jpg','S,M,L,XL','Beige,Sky Blue',100,0),
  ('Hooded Sweatshirt','hooded-sweatshirt','Cozy fleece-lined hoodie for layering.','',1,1399,2199,'/images/hooded-sweatshirt.jpg','M,L,XL','Grey,Navy',100,0),
  ('Floral Summer Dress','floral-summer-dress','Flowy floral dress with a flattering fit.','',2,1499,2799,'/images/floral-summer-dress.jpg','XS,S,M,L','Yellow,Pink',100,1),
  ('Embroidered Kurti','embroidered-kurti','Hand-feel embroidery, festive-ready.','',2,1199,1999,'/images/embroidered-kurti.jpg','S,M,L,XL,XXL','Teal,Rust',100,1),
  ('High-Waist Palazzo Pants','high-waist-palazzo-pants','Breezy palazzo with a high waist.','',2,899,1599,'/images/high-waist-palazzo-pants.jpg','S,M,L,XL','Black,Maroon',100,0),
  ('Kids Graphic T-Shirt','kids-graphic-tshirt','Fun graphic tee in soft cotton.','',3,399,699,'/images/kids-graphic-tshirt.jpg','2-3Y,4-5Y,6-7Y,8-9Y','Red,Blue',100,0),
  ('Kids Denim Dungaree','kids-denim-dungaree','Playful denim dungaree, easy to wear.','',3,999,1599,'/images/kids-denim-dungaree.jpg','2-3Y,4-5Y,6-7Y','Blue',100,1),
  ('Cozy Puffer Jacket','cozy-puffer-jacket','Lightweight warmth for the cold.','',4,2499,3999,'/images/cozy-puffer-jacket.jpg','M,L,XL,XXL','Black,Mustard',100,1),
  ('Wool Blend Pullover','wool-blend-pullover','Soft wool-blend knit pullover.','',4,1599,2599,'/images/wool-blend-pullover.jpg','S,M,L,XL','Charcoal,Camel',100,0),
  ('Canvas Tote Bag','canvas-tote-bag','Sturdy everyday canvas tote.','',5,499,899,'/images/canvas-tote-bag.jpg','Free','Natural,Black',100,0),
  ('Classic Aviator Sunglasses','classic-aviator-sunglasses','Timeless aviators with UV protection.','',5,899,1499,'/images/classic-aviator-sunglasses.jpg','Free','Gold,Silver',100,1);

INSERT OR IGNORE INTO coupons (code, kind, value, min_order, is_active) VALUES
  ('WELCOME10','percent',10,0,1), ('FLAT200','flat',200,1499,1);

INSERT OR IGNORE INTO coupons (code, kind, value, min_order, is_active, first_order_only, once_per_user) VALUES
  ('FIRST150','flat',150,999,1,1,1);

INSERT OR IGNORE INTO pages (slug, title, body, in_footer, sort_order) VALUES
  ('about','About Us','<p>Aswhani is a contemporary clothing label built on one idea — everyday essentials that are easy to wear and built to last. Every piece is quality-checked before it ships from our studio in India.</p>',1,1),
  ('shipping-policy','Shipping Policy','<p>We ship across India. Orders are processed in 1-2 business days and usually delivered in 3-7 business days. Free shipping over the cart threshold; a flat fee applies below it. You get a tracking link once shipped.</p>',1,3),
  ('return-policy','Return &amp; Exchange Policy','<p>Request a return or exchange within <b>7 days</b> of delivery. Items must be unworn, unwashed and tagged. Refunds go to the original method (store credit for COD) after a quick quality check.</p>',1,4),
  ('privacy-policy','Privacy Policy','<p>We collect only what we need to fulfil your order and never sell your data. Payments are handled by our secure payment partner; we do not store card details.</p>',1,5),
  ('terms','Terms &amp; Conditions','<p>By placing an order you agree to these terms. Prices and availability may change. We may cancel an order in case of a pricing error or suspected fraud.</p>',1,6);

-- ---- Local image migration (idempotent; safe to re-run) ----
-- Points every seeded category/product at a file in /public/images so a plain
-- `npm run db:local` (or db:remote) also upgrades an already-seeded database from
-- the old placeholder URLs to your local photos. Only rewrites the seeded rows /
-- old placeholder hosts — it never touches images you uploaded via the admin (R2 /img/...).
UPDATE categories SET image='/images/category-' || (CASE WHEN slug='winter-wear' THEN 'winter' ELSE slug END) || '.jpg'
  WHERE image IS NULL OR image='' OR image LIKE 'https://picsum.photos/%';
UPDATE products SET image='/images/' || slug || '.jpg'
  WHERE image IS NULL OR image='' OR image LIKE 'https://picsum.photos/%';
