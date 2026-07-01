// Server-rendered HTML (editorial fashion design) for the Cloudflare store.
import { e, money, csv } from "./lib.js";

export const STATUS_FLOW = [
  ["placed", "Order Placed"], ["confirmed", "Confirmed"], ["packed", "Packed"],
  ["shipped", "Shipped"], ["out_for_delivery", "Out for Delivery"], ["delivered", "Delivered"],
];
export const STATUS_LABELS = Object.fromEntries([...STATUS_FLOW, ["cancelled", "Cancelled"]]);

function head(ctx, title) {
  return `<!doctype html><html lang="en" class="scroll-smooth"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)} · ${e(ctx.storeName)}</title>
<meta name="description" content="${e(ctx.tagline)}">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={theme:{extend:{colors:{ink:'#23190f',paper:'#f3ece0',clay:{DEFAULT:'#bf5836',dark:'#9c4527',soft:'#ecdccf'}},fontFamily:{sans:['"Hanken Grotesk"','sans-serif'],display:['Fraunces','serif']}}}}</script>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  [x-cloak]{display:none!important}
  body::after{content:"";position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:.05;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  .input{width:100%;border:1px solid rgba(35,25,15,.14);background:rgba(255,255,255,.55);padding:.7rem .9rem;font-size:.9rem;color:#23190f;outline:none}
  .input:focus{border-color:#23190f;background:#fff}
  .lbl{display:block;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#7d7a63;margin-bottom:.35rem}
  .eyebrow{font-size:11px;letter-spacing:.28em;text-transform:uppercase}
  .marquee{display:flex;width:max-content;white-space:nowrap;animation:mq 34s linear infinite}
  @keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  .nav-link{position:relative}.nav-link::after{content:"";position:absolute;left:0;bottom:-5px;height:1px;width:100%;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .4s}.nav-link:hover::after{transform:scaleX(1);transform-origin:left}
  ::selection{background:#bf5836;color:#f3ece0}
  .line1{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
  .line2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
  /* ---- motion system (progressive: no-JS & reduced-motion safe) ---- */
  .js-anim [data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.22,.61,.36,1),transform .8s cubic-bezier(.22,.61,.36,1);will-change:opacity,transform}
  .js-anim [data-reveal].in{opacity:1;transform:none}
  .js-anim [data-reveal][data-anim="zoom"]{transform:scale(.94)}
  .js-anim [data-reveal][data-anim="left"]{transform:translateX(-32px)}
  .js-anim [data-reveal][data-anim="right"]{transform:translateX(32px)}
  .js-anim [data-reveal][data-anim="zoom"].in,.js-anim [data-reveal][data-anim="left"].in,.js-anim [data-reveal][data-anim="right"].in{transform:none}
  @media (prefers-reduced-motion:reduce){.js-anim [data-reveal]{opacity:1!important;transform:none!important;transition:none}}
  @keyframes riseIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
  .hero-line{opacity:0;animation:riseIn 1s cubic-bezier(.22,.61,.36,1) forwards}
  @media (prefers-reduced-motion:reduce){.hero-line{animation:none;opacity:1}[data-parallax]{transform:none!important}}
  .btn-sheen{position:relative;overflow:hidden}
  .btn-sheen::after{content:"";position:absolute;top:0;left:-130%;width:55%;height:100%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);pointer-events:none}
  .btn-sheen:hover::after{animation:sheen .85s ease}
  @keyframes sheen{to{left:140%}}
  @keyframes pop{0%{transform:scale(.6);opacity:.4}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
  .cart-pop{animation:pop .45s cubic-bezier(.22,.61,.36,1)}
  .lift{transition:transform .5s cubic-bezier(.22,.61,.36,1)}
  .group:hover .lift{transform:translateY(-6px)}
  .u-line{background-image:linear-gradient(currentColor,currentColor);background-size:0% 1px;background-repeat:no-repeat;background-position:0 100%;transition:background-size .4s ease}
  .u-line:hover{background-size:100% 1px}
</style>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
<script>
(function(){document.documentElement.classList.add('js-anim');
var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
window.imgFallback=function(el){if(!el||el.dataset.fb)return;el.dataset.fb='1';el.onerror=null;var t=((el.getAttribute('alt')||'Aswhani')+'').replace(/[<&>"]/g,'').slice(0,26).toUpperCase();var s='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe4d5"/><stop offset="1" stop-color="#e2d1bf"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><g fill="none" stroke="#bf5836" stroke-opacity="0.16" stroke-width="1.4"><circle cx="400" cy="450" r="118"/><circle cx="400" cy="450" r="176"/></g><text x="400" y="462" font-family="Georgia,serif" font-style="italic" font-size="40" fill="#9c4527" text-anchor="middle">Aswhani</text><text x="400" y="512" font-family="Arial,sans-serif" font-size="17" letter-spacing="3" fill="#7d6a55" text-anchor="middle">'+t+'</text></svg>';el.src='data:image/svg+xml,'+encodeURIComponent(s)};
function boot(){var els=[].slice.call(document.querySelectorAll('[data-reveal]'));
var show=function(el){var d=+(el.getAttribute('data-delay')||0);d?setTimeout(function(){el.classList.add('in')},d):el.classList.add('in')};
if(RM||!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('in')})}
else{var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting||en.boundingClientRect.top<0){show(en.target);io.unobserve(en.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:0});els.forEach(function(el){io.observe(el)});
// backstop: reveal anything at/above the fold that IO hasn't flipped yet (fast-scroll / no-scroll-event safety)
var scan=function(){var vh=window.innerHeight||document.documentElement.clientHeight;[].slice.call(document.querySelectorAll('[data-reveal]:not(.in)')).forEach(function(el){if(el.getBoundingClientRect().top<vh*0.95){show(el);io.unobserve(el)}})};
var t=false,onS=function(){if(!t){t=true;requestAnimationFrame(function(){t=false;scan()})}};window.addEventListener('scroll',onS,{passive:true});window.addEventListener('resize',onS,{passive:true});window.addEventListener('load',scan)}
if(!RM){var px=[].slice.call(document.querySelectorAll('[data-parallax]'));if(px.length){var tick=false,upd=function(){tick=false;var y=window.pageYOffset;px.forEach(function(el){var sp=+(el.getAttribute('data-parallax')||0.12);el.style.transform='translate3d(0,'+(y*sp).toFixed(1)+'px,0) scale(1.12)'})};window.addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});upd()}}}
if(document.readyState!=='loading')boot();else document.addEventListener('DOMContentLoaded',boot)})();
</script>
${ctx.ga ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(ctx.ga)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${e(ctx.ga)}')</script>` : ""}
</head>`;
}

function flash(ctx) {
  if (!ctx.flash) return "";
  const tone = ctx.flash.type === "error" ? "border-l-clay text-clay-dark" : "border-l-green-600 text-green-900";
  return `<div class="max-w-[1400px] mx-auto w-full px-5 sm:px-8 mt-4">
    <div x-data="{s:1}" x-show="s" class="flex items-start justify-between gap-3 bg-white/70 border border-ink/10 border-l-[3px] ${tone} px-4 py-3 text-sm">
    <span>${e(ctx.flash.msg)}</span><button @click="s=0" class="opacity-50">✕</button></div></div>`;
}

function header(ctx) {
  const cats = ctx.categories.map((c) =>
    `<a href="/shop?category=${e(c.slug)}" class="nav-link">${e(c.name)}</a>`).join("");
  const catsM = ctx.categories.map((c) =>
    `<a href="/shop?category=${e(c.slug)}" class="block py-2 uppercase tracking-[0.15em] text-sm">${e(c.name)}</a>`).join("");
  const badge = ctx.cartCount ? `<span class="cart-pop absolute top-0 right-0 bg-clay text-paper text-[10px] font-700 rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">${ctx.cartCount}</span>` : "";
  return `<div class="bg-ink text-paper overflow-hidden"><div class="marquee py-2 text-[11px] uppercase tracking-[0.28em]">
    ${Array(2).fill(`<span class="px-5">Free shipping over ${money(ctx.freeAbove)}</span><span class="px-5 opacity-50">✦</span><span class="px-5">New season just dropped</span><span class="px-5 opacity-50">✦</span>`).join("")}
  </div></div>
  <header x-data="{open:false,scrolled:false}" @scroll.window="scrolled=window.scrollY>16" class="sticky top-0 z-40 transition-all duration-300" :class="scrolled?'bg-paper/85 backdrop-blur-md border-b border-ink/10':'bg-paper border-b border-transparent'">
    <div class="max-w-[1400px] mx-auto px-5 sm:px-8"><div class="flex items-center justify-between gap-4 transition-all duration-300" :class="scrolled?'h-16':'h-20'">
      <button @click="open=!open" class="md:hidden p-2 -ml-2"><svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <a href="/" class="font-display font-600 text-[26px] leading-none tracking-tight italic">${e(ctx.storeName)}<span class="text-clay not-italic">.</span></a>
      <nav class="hidden md:flex items-center gap-8 text-[12px] uppercase tracking-[0.18em] font-500"><a href="/shop" class="nav-link">Shop</a>${cats}</nav>
      <div class="flex items-center gap-1 sm:gap-2">
        <a href="/track" class="hidden sm:block p-2 hover:text-clay" title="Track">📦</a>
        <a href="${ctx.user ? "/wishlist" : "/login"}" class="relative p-2 hover:text-clay" title="Wishlist"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>${ctx.wishCount ? `<span class="absolute top-0 right-0 bg-clay text-paper text-[10px] font-700 rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center">${ctx.wishCount}</span>` : ""}</a>
        <a href="${ctx.user ? "/account" : "/login"}" class="p-2 hover:text-clay" title="Account"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></a>
        <a href="/cart" class="relative p-2 hover:text-clay" title="Bag"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>${badge}</a>
      </div>
    </div></div>
    <div x-show="open" x-cloak class="md:hidden border-t border-ink/10 px-5 py-4 bg-paper"><a href="/shop" class="block py-2 uppercase tracking-[0.15em] text-sm">Shop All</a>${catsM}<a href="/track" class="block py-2 uppercase tracking-[0.15em] text-sm">Track Order</a></div>
  </header>${flash(ctx)}`;
}

function footer(ctx) {
  const cats = ctx.categories.slice(0, 4).map((c) => `<li><a href="/shop?category=${e(c.slug)}" class="hover:text-clay">${e(c.name)}</a></li>`).join("");
  return `<footer class="bg-ink text-paper/80 mt-24">
    <div class="border-b border-paper/10"><div class="max-w-[1400px] mx-auto px-5 sm:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
      <div><div class="font-display italic text-2xl text-paper">Join the list</div><p class="text-sm text-paper/50">New drops, offers & 10% off your first order.</p></div>
      <form action="/newsletter" method="post" class="flex gap-2 w-full md:w-auto"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input name="email" type="email" required placeholder="Your email" class="bg-paper/10 border border-paper/20 text-paper placeholder-paper/40 px-4 py-3 text-sm outline-none w-full md:w-64"><button class="bg-clay text-paper text-[12px] uppercase tracking-[0.18em] px-6 hover:bg-clay-dark whitespace-nowrap">Subscribe</button></form>
    </div></div>
    <div class="max-w-[1400px] mx-auto px-5 sm:px-8 pt-16 pb-10 grid grid-cols-2 md:grid-cols-4 gap-10">
      <div class="col-span-2 md:col-span-1"><div class="font-display italic font-600 text-3xl text-paper">${e(ctx.storeName)}<span class="text-clay not-italic">.</span></div><p class="text-sm mt-3 text-paper/50">${e(ctx.tagline)}</p></div>
      <div><h4 class="text-paper text-[11px] uppercase tracking-[0.2em] mb-4">Shop</h4><ul class="space-y-2.5 text-sm text-paper/60"><li><a href="/shop" class="hover:text-clay">All Products</a></li>${cats}</ul></div>
      <div><h4 class="text-paper text-[11px] uppercase tracking-[0.2em] mb-4">Help</h4><ul class="space-y-2.5 text-sm text-paper/60"><li><a href="/track" class="hover:text-clay">Track Order</a></li><li><a href="/contact" class="hover:text-clay">Contact Us</a></li>${(ctx.footerPages || []).map((p) => `<li><a href="/page/${e(p.slug)}" class="hover:text-clay">${p.title}</a></li>`).join("")}<li><a href="/admin" class="hover:text-clay">Admin</a></li></ul></div>
      <div><h4 class="text-paper text-[11px] uppercase tracking-[0.2em] mb-4">Contact</h4><ul class="space-y-2.5 text-sm text-paper/60"><li>${e(ctx.email)}</li><li>${e(ctx.phone)}</li></ul></div>
    </div>
    <div class="border-t border-paper/10"><div class="max-w-[1400px] mx-auto px-5 sm:px-8 py-5 text-center text-[11px] uppercase tracking-[0.18em] text-paper/40">© ${e(ctx.storeName)} · UPI · Cards · Cash on Delivery · Hosted on Cloudflare</div></div>
    ${ctx.path && ctx.path.startsWith("/product/") ? `<div class="md:hidden" style="height:76px" aria-hidden="true"></div>` : ""}
  </footer>`;
}

export function layout(ctx, title, body) {
  return `${head(ctx, title)}<body class="font-sans text-ink bg-paper antialiased min-h-screen flex flex-col">
    ${header(ctx)}<main class="flex-1">${body}</main>${footer(ctx)}</body></html>`;
}

export function productCard(p, ctx) {
  const disc = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const heart = ctx ? `<form action="/wishlist/toggle" method="post" class="absolute top-3 right-3 z-10"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="product_id" value="${p.id}"><button type="submit" title="Save to wishlist" class="w-9 h-9 rounded-full bg-paper/85 flex items-center justify-center text-ink hover:bg-clay hover:text-paper"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button></form>` : "";
  return `<div class="group relative" data-reveal>${heart}
    <a href="/product/${e(p.slug)}" class="block"><div class="relative aspect-[4/5] overflow-hidden bg-[#e7dccd] lift">
      <img src="${e(p.image)}" alt="${e(p.name)}" loading="lazy" onerror="imgFallback(this)" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
      ${disc ? `<span class="absolute top-3 left-3 bg-paper/90 text-ink text-[10px] font-600 uppercase tracking-[0.12em] px-2 py-1">−${disc}%</span>` : ""}
      ${p.stock <= 0 ? `<span class="absolute inset-0 bg-paper/70 flex items-center justify-center text-[11px] uppercase tracking-[0.2em]">Sold out</span>` : ""}
      <div class="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500"><div class="bg-ink text-paper text-[11px] uppercase tracking-[0.22em] text-center py-3">View Product</div></div>
    </div>
    <div class="mt-3.5"><h3 class="text-[15px] font-500 line1 group-hover:text-clay">${e(p.name)}</h3>
      <div class="mt-1 flex items-center gap-2 font-display"><span class="text-[17px]">${money(p.price)}</span>${p.mrp && p.mrp > p.price ? `<span class="text-[13px] text-ink/40 line-through">${money(p.mrp)}</span>` : ""}</div></div></a>
  </div>`;
}

export function homeView(ctx, { featured, newest }) {
  const cats = ctx.categories.map((c, i) => `<a href="/shop?category=${e(c.slug)}" data-reveal data-anim="zoom" data-delay="${i * 90}" class="group relative aspect-[3/4] overflow-hidden bg-[#e7dccd]">
    <img src="${e(c.image)}" alt="${e(c.name)}" loading="lazy" onerror="imgFallback(this)" class="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"><div class="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"></div>
    <div class="absolute bottom-0 left-0 p-4 sm:p-5 flex items-end justify-between w-full">
      <span class="font-display text-paper text-xl sm:text-2xl translate-y-0 group-hover:-translate-y-0.5 transition-transform duration-300">${e(c.name)}</span>
      <span class="text-paper/0 group-hover:text-paper -translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-lg">→</span>
    </div></a>`).join("");
  const grid = (arr) => `<div class="grid grid-cols-2 md:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-10">${arr.map((p) => productCard(p, ctx)).join("")}</div>`;
  return `<section class="relative max-w-[1400px] mx-auto px-5 sm:px-8 pt-4">
    <div class="relative h-[82vh] min-h-[460px] overflow-hidden">
      <img src="/images/hero.jpg" alt="${e(ctx.storeName)} new season" data-parallax="0.14" onerror="imgFallback(this)" class="absolute inset-0 w-full h-full object-cover scale-[1.12]">
      <div class="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/25 to-ink/10"></div>
      <div class="relative h-full flex flex-col justify-end pb-14 sm:pb-20 text-paper">
        <p class="hero-line eyebrow mb-4" style="animation-delay:.1s">✦ New Season</p>
        <h1 class="hero-line font-display font-500 leading-[0.92] text-[13.5vw] sm:text-[8.5vw] lg:text-[112px] max-w-[16ch]" style="animation-delay:.25s">End of Season Sale</h1>
        <p class="hero-line mt-5 text-base sm:text-lg text-paper/80 max-w-[42ch]" style="animation-delay:.45s">Up to 60% off everyday essentials.</p>
        <a href="/shop" class="hero-line group mt-8 inline-flex w-max items-center gap-3 text-[12px] uppercase tracking-[0.22em] border-b border-paper/50 pb-1 hover:border-clay hover:text-clay" style="animation-delay:.6s">Shop the drop <span class="group-hover:translate-x-1.5 transition-transform">→</span></a>
      </div>
    </div></section>
  <section class="max-w-[1400px] mx-auto px-5 sm:px-8 py-16 sm:py-24 border-b border-ink/10"><p data-reveal class="font-display italic text-[28px] sm:text-[44px] leading-[1.15] max-w-[22ch]">Everyday essentials, cut clean — designed to be worn, not just looked at.</p></section>
  <section class="max-w-[1400px] mx-auto px-5 sm:px-8 mt-16 sm:mt-20"><div class="flex items-baseline gap-4 mb-8" data-reveal><span class="eyebrow text-clay">01</span><h2 class="font-display text-3xl sm:text-4xl">Shop by Category</h2></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">${cats}</div></section>
  ${featured.length ? `<section class="max-w-[1400px] mx-auto px-5 sm:px-8 mt-20 sm:mt-28"><div class="flex items-baseline gap-4 mb-8" data-reveal><span class="eyebrow text-clay">02</span><h2 class="font-display text-3xl sm:text-4xl">Trending Now</h2></div>${grid(featured)}</section>` : ""}
  <section class="max-w-[1400px] mx-auto px-5 sm:px-8 mt-20 sm:mt-28"><div class="grid md:grid-cols-2 gap-3 sm:gap-4 items-stretch">
    <div data-reveal data-anim="left" class="relative overflow-hidden bg-[#e7dccd] aspect-[4/3] group"><img src="/images/editorial-1.jpg" alt="Crafted to last" loading="lazy" onerror="imgFallback(this)" class="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-105"><div class="absolute inset-0 bg-ink/25"></div><div class="absolute bottom-0 p-6 sm:p-8 text-paper"><p class="eyebrow mb-2 text-paper/70">Made well</p><h3 class="font-display text-2xl sm:text-3xl">Crafted to last</h3></div></div>
    <div data-reveal data-anim="right" class="relative overflow-hidden bg-ink text-paper aspect-[4/3] md:aspect-auto flex flex-col justify-center p-8 sm:p-12">
      <p class="eyebrow text-clay mb-3">The Aswhani promise</p>
      <p class="font-display italic text-2xl sm:text-3xl leading-snug">Considered fabrics, honest prices, and a fit that shows up for you — drop after drop.</p>
      <a href="/page/about" class="mt-6 inline-flex w-max items-center gap-2 text-[12px] uppercase tracking-[0.2em] u-line">Our story <span>→</span></a>
    </div></div></section>
  <section class="max-w-[1400px] mx-auto px-5 sm:px-8 mt-20 sm:mt-28"><div data-reveal data-anim="zoom" class="bg-ink text-paper px-6 sm:px-16 py-14 sm:py-20 grid grid-cols-1 sm:grid-cols-3 gap-10 text-center"><div><div class="font-display text-2xl text-clay mb-2">Pan-India</div><p class="text-sm text-paper/60">Fast delivery with live tracking</p></div><div><div class="font-display text-2xl text-clay mb-2">7 Days</div><p class="text-sm text-paper/60">Easy returns &amp; exchange</p></div><div><div class="font-display text-2xl text-clay mb-2">Secure</div><p class="text-sm text-paper/60">UPI · Cards · COD</p></div></div></section>
  ${newest.length ? `<section class="max-w-[1400px] mx-auto px-5 sm:px-8 mt-20 sm:mt-28"><div class="flex items-baseline gap-4 mb-8" data-reveal><span class="eyebrow text-clay">03</span><h2 class="font-display text-3xl sm:text-4xl">Fresh Arrivals</h2></div>${grid(newest)}</section>` : ""}`;
}

export function shopView(ctx, { products, heading, category }) {
  const sidebar = `<aside class="hidden lg:block"><div class="sticky top-28 space-y-2 text-[15px]"><h4 class="eyebrow text-ink/40 mb-3">Category</h4>
    <a href="/shop" class="block ${!category ? "text-clay" : "hover:text-clay"}">All</a>
    ${ctx.categories.map((c) => `<a href="/shop?category=${e(c.slug)}" class="block ${category && category.id === c.id ? "text-clay" : "hover:text-clay"}">${e(c.name)}</a>`).join("")}</div></aside>`;
  const grid = products.length
    ? `<div class="grid grid-cols-2 md:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-10">${products.map((p) => productCard(p, ctx)).join("")}</div>`
    : `<div class="text-center py-28 text-ink/50"><div class="font-display text-5xl mb-3">Nothing here</div><a href="/shop" class="text-[12px] uppercase tracking-[0.2em] border-b border-ink/30 pb-1 hover:text-clay">Clear filters</a></div>`;
  return `<div class="max-w-[1400px] mx-auto px-5 sm:px-8 py-8">
    <nav class="eyebrow text-ink/45 mb-3" data-reveal><a href="/" class="hover:text-clay">Home</a> / <span class="text-ink">${e(heading)}</span></nav>
    <h1 class="font-display text-4xl sm:text-5xl mb-8 pb-6 border-b border-ink/10" data-reveal>${e(heading)}</h1>
    <div class="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10">${sidebar}<div>${grid}</div></div></div>`;
}

export function productView(ctx, { p, related, reviews, stockMap, hasVariants }) {
  const disc = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  const sizes = csv(p.sizes), colors = csv(p.colors);
  const total = hasVariants ? Object.values(stockMap).reduce((a, b) => a + b, 0) : (p.stock || 0);
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : 0;
  const sizeBtns = sizes.map((s) => `<button type="button" @click="size='${e(s)}'" :class="size==='${e(s)}'?'bg-ink text-paper border-ink':((hasVariants&&(stock['${e(s)}|'+color]??0)===0)?'border-ink/15 text-ink/30 line-through':'border-ink/20 hover:border-ink')" class="min-w-[46px] px-3 h-12 border text-sm font-500">${e(s)}</button>`).join("");
  const colorBtns = colors.map((c) => `<button type="button" @click="color='${e(c)}'" :class="color==='${e(c)}'?'border-ink':'border-ink/15 hover:border-ink/50'" class="px-4 h-10 border text-sm">${e(c)}</button>`).join("");
  const galleryThumbs = [p.image, ...(p.gallery || [])].map((u) => `<button type="button" @click="main='${e(u)}'" :class="main==='${e(u)}'?'ring-ink':'ring-ink/15 hover:ring-ink/60'" class="shrink-0 w-16 h-20 overflow-hidden ring-1 transition"><img src="${e(u)}" alt="${e(p.name)}" onerror="imgFallback(this)" class="w-full h-full object-cover"></button>`).join("");
  const cod = ctx.settings.cod_enabled !== "0";
  const reviewList = reviews.length ? reviews.map((r) => `<div class="border-b border-ink/10 py-5"><div class="flex items-center justify-between"><span class="font-500">${e(r.name)}</span><span class="text-clay text-sm">${"★".repeat(r.rating)}<span class="text-ink/20">${"★".repeat(5 - r.rating)}</span></span></div>${r.comment ? `<p class="text-sm text-ink/65 mt-1.5">${e(r.comment)}</p>` : ""}</div>`).join("") : `<p class="text-ink/50 text-sm">No reviews yet. Be the first to review this product.</p>`;
  return `<div class="max-w-[1400px] mx-auto px-5 sm:px-8 py-8">
    <script>window.__pstock=${JSON.stringify(stockMap || {})};</script>
    <nav class="eyebrow text-ink/45 mb-4"><a href="/" class="hover:text-clay">Home</a> / <span class="text-ink">${e(p.name)}</span></nav>
    <div class="grid md:grid-cols-2 gap-8 lg:gap-16" x-data="{size:'${sizes[0] ? e(sizes[0]) : ""}',color:'${colors[0] ? e(colors[0]) : ""}',qty:1,main:'${e(p.image)}',showSize:false,pin:'',pinMsg:'',pinOk:false,stock:window.__pstock,hasVariants:${hasVariants ? "true" : "false"},total:${total},avail(){return this.hasVariants?(this.stock[this.size+'|'+this.color]??0):this.total},checkPin(){if(!/^[0-9]{6}$/.test(this.pin)){this.pinMsg='Enter a valid 6-digit pincode.';this.pinOk=false;return}fetch('/pincode/'+this.pin).then(r=>r.json()).then(d=>{this.pinOk=d.ok;this.pinMsg=d.ok?(d.msg+(d.cod?' · COD available':'')):d.msg})}}">
      <div class="md:sticky md:top-24 self-start"><div class="group aspect-[4/5] overflow-hidden bg-[#e7dccd]"><img :src="main" alt="${e(p.name)}" onerror="imgFallback(this)" class="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"></div><div class="flex gap-3 mt-3 overflow-x-auto pb-1">${galleryThumbs}</div></div>
      <div class="md:py-4">
        <h1 class="font-display text-4xl sm:text-5xl leading-[1.02]">${e(p.name)}</h1>
        <div class="flex items-center gap-3 mt-5 font-display"><span class="text-3xl">${money(p.price)}</span>${p.mrp && p.mrp > p.price ? `<span class="text-ink/40 line-through text-lg">${money(p.mrp)}</span><span class="font-sans bg-clay-soft text-clay-dark text-xs font-600 uppercase tracking-[0.1em] px-2 py-1">${disc}% off</span>` : ""}</div>
        ${avg ? `<p class="text-clay text-sm mt-2">★ ${avg} <span class="text-ink/40">· ${reviews.length} reviews</span></p>` : ""}
        <div class="h-px bg-ink/10 my-7"></div>
        <form id="addform" action="/cart/add" method="post" class="space-y-7">
          <input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="product_id" value="${p.id}">
          <input type="hidden" name="size" :value="size"><input type="hidden" name="color" :value="color"><input type="hidden" name="qty" :value="qty">
          ${sizes.length ? `<div><div class="flex justify-between eyebrow mb-3"><span>Size</span>${p.size_chart ? `<button type="button" @click="showSize=true" class="text-ink/40 hover:text-clay underline">Size guide</button>` : ""}</div><div class="flex flex-wrap gap-2.5">${sizeBtns}</div></div>` : ""}
          ${colors.length ? `<div><div class="eyebrow mb-3">Colour — <span class="text-ink/50 normal-case tracking-normal" x-text="color"></span></div><div class="flex flex-wrap gap-2.5">${colorBtns}</div></div>` : ""}
          <div class="flex items-center gap-5"><div class="flex items-center border border-ink/20"><button type="button" @click="qty=Math.max(1,qty-1)" class="px-4 h-12 text-lg">−</button><span class="w-10 text-center" x-text="qty"></span><button type="button" @click="qty=Math.min(99,qty+1)" class="px-4 h-12 text-lg">+</button></div><span class="eyebrow" :class="avail()===0?'text-clay':'text-green-700'"><span x-show="avail()===0">Sold out</span><span x-show="avail()>0&&avail()<=5" x-cloak>Only <span x-text="avail()"></span> left</span><span x-show="avail()>5" x-cloak>In stock</span></span></div>
          <div class="flex flex-col sm:flex-row gap-3 pt-1"><button type="submit" name="buy_now" value="1" :disabled="avail()===0" class="btn-sheen flex-1 bg-clay text-paper text-[12px] uppercase tracking-[0.2em] h-14 hover:bg-clay-dark disabled:opacity-40"><span x-show="avail()>0">Buy Now</span><span x-show="avail()===0" x-cloak>Sold Out</span></button><button type="submit" :disabled="avail()===0" class="flex-1 border border-ink text-[12px] uppercase tracking-[0.2em] h-14 hover:bg-ink hover:text-paper disabled:opacity-40">Add to Bag</button></div>
          <div class="grid grid-cols-2 gap-2.5 pt-2 text-[12px] text-ink/70">
            <div class="flex items-center gap-2 border border-ink/10 px-3 py-2.5"><span class="text-clay">🚚</span> Free shipping over ${money(ctx.freeAbove)}</div>
            <div class="flex items-center gap-2 border border-ink/10 px-3 py-2.5"><span class="text-clay">↩</span> 7-day easy returns</div>
            <div class="flex items-center gap-2 border border-ink/10 px-3 py-2.5"><span class="text-clay">🔒</span> Secure checkout</div>
            <div class="flex items-center gap-2 border border-ink/10 px-3 py-2.5"><span class="text-clay">${cod ? "💵" : "✓"}</span> ${cod ? "Cash on Delivery" : "Quality checked"}</div>
          </div>
        </form>
        <div class="mt-5 space-y-4">
          <form action="/wishlist/toggle" method="post"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="product_id" value="${p.id}"><button class="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink/70 hover:text-clay">♡ Save to wishlist</button></form>
          <div class="border border-ink/10 p-4"><div class="eyebrow mb-2">Check delivery</div><div class="flex gap-2"><input x-model="pin" maxlength="6" inputmode="numeric" placeholder="Enter pincode" class="input flex-1"><button type="button" @click="checkPin()" class="bg-ink text-paper text-[12px] uppercase tracking-[0.18em] px-5 hover:bg-clay">Check</button></div><p x-show="pinMsg" x-cloak class="mt-2 text-sm" :class="pinOk?'text-green-700':'text-clay'" x-text="pinMsg"></p></div>
        </div>
        ${p.size_chart ? `<div x-show="showSize" x-cloak @click.self="showSize=false" class="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4"><div class="bg-paper max-w-md w-full p-6 relative"><button type="button" @click="showSize=false" class="absolute top-3 right-4 text-2xl">×</button><h3 class="font-display text-2xl mb-4">Size Guide</h3><div class="text-sm text-ink/80 whitespace-pre-line">${e(p.size_chart)}</div></div></div>` : ""}
        <div class="mt-8 border-t border-ink/10" x-data="{open:'desc'}">
          <div class="border-b border-ink/10">
            <button type="button" @click="open=(open==='desc'?'':'desc')" class="w-full flex items-center justify-between py-4 text-left"><span class="eyebrow">Description</span><span class="text-xl leading-none transition-transform duration-300" :class="open==='desc'&&'rotate-45'">+</span></button>
            <div x-show="open==='desc'" x-transition.opacity class="pb-5 text-[15px] text-ink/70 leading-relaxed">${e(p.description) || "An everyday-ready essential, cut clean from premium fabric with a considered, wear-anywhere fit."}</div>
          </div>
          <div class="border-b border-ink/10">
            <button type="button" @click="open=(open==='care'?'':'care')" class="w-full flex items-center justify-between py-4 text-left"><span class="eyebrow">Fabric &amp; Care</span><span class="text-xl leading-none transition-transform duration-300" :class="open==='care'&&'rotate-45'">+</span></button>
            <div x-show="open==='care'" x-transition.opacity x-cloak class="pb-5 text-[15px] text-ink/70 leading-relaxed">Premium, breathable, skin-friendly fabric. Machine wash cold on a gentle cycle, do not bleach, tumble dry low or dry in shade, and warm-iron if needed. Wash dark shades separately for the first few washes.</div>
          </div>
          <div class="border-b border-ink/10">
            <button type="button" @click="open=(open==='ship'?'':'ship')" class="w-full flex items-center justify-between py-4 text-left"><span class="eyebrow">Shipping &amp; Returns</span><span class="text-xl leading-none transition-transform duration-300" :class="open==='ship'&&'rotate-45'">+</span></button>
            <div x-show="open==='ship'" x-transition.opacity x-cloak class="pb-5 text-[15px] text-ink/70 leading-relaxed">Dispatched in 1–2 business days with live tracking. Free shipping over ${money(ctx.freeAbove)} (flat ${money(ctx.shippingFee)} below). Easy 7-day returns &amp; exchange on unworn, unwashed, tagged items.</div>
          </div>
        </div>
      </div>
      <div class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-ink/10 px-4 py-3 flex items-center gap-3">
        <div class="leading-tight"><div class="font-display text-lg">${money(p.price)}</div><div class="text-[11px]" :class="avail()===0?'text-clay':'text-green-700'"><span x-show="avail()>0" x-cloak>In stock</span><span x-show="avail()===0" x-cloak>Sold out</span></div></div>
        <button type="submit" form="addform" :disabled="avail()===0" class="btn-sheen flex-1 bg-clay text-paper text-[12px] uppercase tracking-[0.2em] h-12 hover:bg-clay-dark disabled:opacity-40">Add to Bag</button>
      </div>
    </div>
    <section id="reviews" class="mt-20 max-w-3xl"><div class="flex items-baseline gap-4 mb-6" data-reveal><span class="eyebrow text-clay">04</span><h2 class="font-display text-3xl">Reviews (${reviews.length})</h2></div>${reviewList}
      ${ctx.user ? `<form action="/product/${e(p.slug)}/review" method="post" class="mt-7 bg-white/50 border border-ink/10 p-6" x-data="{rating:5}"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><h3 class="font-display text-xl mb-3">Write a review</h3><div class="flex gap-1 mb-3 text-2xl">${[1, 2, 3, 4, 5].map((i) => `<button type="button" @click="rating=${i}" :class="rating>=${i}?'text-clay':'text-ink/20'">★</button>`).join("")}<input type="hidden" name="rating" :value="rating"></div><textarea name="comment" rows="3" placeholder="Share your thoughts…" class="input"></textarea><button class="mt-3 bg-ink text-paper text-[12px] uppercase tracking-[0.2em] px-6 py-3 hover:bg-clay">Submit Review</button></form>` : `<p class="mt-6 text-sm text-ink/50"><a href="/login" class="text-clay">Log in</a> to write a review.</p>`}
    </section>
    ${related.length ? `<section class="mt-20"><div class="flex items-baseline gap-4 mb-8" data-reveal><span class="eyebrow text-clay">05</span><h2 class="font-display text-3xl">You may also like</h2></div><div class="grid grid-cols-2 md:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-10">${related.map((rp) => productCard(rp, ctx)).join("")}</div></section>` : ""}
  </div>`;
}

function lineRow(it) {
  const opt = [it.size, it.color].filter(Boolean).join(" · ");
  return `<div class="flex gap-3 text-sm"><img src="${e(it.image)}" alt="${e(it.name)}" onerror="imgFallback(this)" class="w-12 h-14 object-cover bg-[#e7dccd]"><div class="flex-1"><p class="line1">${e(it.name)}</p><p class="text-xs text-ink/50">${e(opt)} × ${it.qty}</p></div><span>${money(it.price * it.qty)}</span></div>`;
}

export function cartView(ctx, { rows, totals }) {
  if (!rows.length) return `<div class="max-w-5xl mx-auto px-5 sm:px-8 py-10"><h1 class="font-display text-4xl mb-8">Your Bag</h1><div class="text-center py-24 text-ink/50"><div class="text-6xl mb-4">🛍️</div><p class="text-lg">Your bag is empty.</p><a href="/shop" class="inline-block mt-5 bg-ink text-paper text-[12px] uppercase tracking-[0.2em] px-7 py-3 hover:bg-clay">Start Shopping</a></div></div>`;
  const items = rows.map((r) => `<div class="flex gap-4 border border-ink/10 p-4" data-reveal><img src="${e(r.image)}" alt="${e(r.name)}" onerror="imgFallback(this)" class="w-24 h-28 object-cover bg-[#e7dccd]"><div class="flex-1"><div class="flex justify-between"><a href="/product/${e(r.slug)}" class="font-medium hover:text-clay">${e(r.name)}</a><form action="/cart/remove" method="post"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="index" value="${r.index}"><button class="text-ink/40 hover:text-clay text-sm">Remove</button></form></div><p class="text-xs text-ink/50 mt-1">${[r.size, r.color].filter(Boolean).join(" · ")}</p><div class="flex items-center justify-between mt-3"><form action="/cart/update" method="post" class="flex items-center border border-ink/20"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="index" value="${r.index}"><button name="qty" value="${r.qty - 1}" class="px-2.5 py-1">−</button><span class="w-8 text-center text-sm">${r.qty}</span><button name="qty" value="${r.qty + 1}" class="px-2.5 py-1">+</button></form><span class="font-semibold">${money(r.price * r.qty)}</span></div></div></div>`).join("");
  return `<div class="max-w-5xl mx-auto px-5 sm:px-8 py-10"><h1 class="font-display text-4xl mb-8">Your Bag</h1>
    <div class="grid lg:grid-cols-[1fr_340px] gap-8"><div class="space-y-4">${items}<a href="/shop" class="inline-block text-sm text-clay">← Continue shopping</a></div>
    <aside class="bg-white/50 border border-ink/10 p-6 h-max"><h2 class="font-semibold text-lg mb-4">Order Summary</h2><div class="space-y-2 text-sm"><div class="flex justify-between"><span class="text-ink/50">Subtotal</span><span>${money(totals.subtotal)}</span></div><div class="flex justify-between"><span class="text-ink/50">Shipping</span><span>${totals.shipping === 0 ? "FREE" : money(totals.shipping)}</span></div><div class="border-t border-ink/10 pt-3 flex justify-between font-bold text-base"><span>Total</span><span>${money(totals.total)}</span></div></div><a href="/checkout" class="mt-5 block text-center bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-3.5 hover:bg-clay-dark">Checkout →</a></aside></div></div>`;
}

export function checkoutView(ctx, { rows, totals, addresses, coupon, codEnabled }) {
  const summary = rows.map(lineRow).join("");
  return `<div class="max-w-5xl mx-auto px-5 sm:px-8 py-10"><h1 class="font-display text-4xl mb-8">Checkout</h1>
    <script>window.__addr=${JSON.stringify(addresses || [])};</script>
    <div class="grid lg:grid-cols-[1fr_360px] gap-8">
      <form action="/checkout" method="post" class="space-y-6" x-data="{m:'${codEnabled ? "cod" : "online"}',f:{name:'${e(ctx.user ? ctx.user.name : "")}',phone:'',email:'${e(ctx.user ? ctx.user.email : "")}',line1:'',city:'',state:'',pincode:''},addresses:window.__addr,pick(i){if(i==='')return;Object.assign(this.f,this.addresses[i])}}"><input type="hidden" name="csrf" value="${e(ctx.csrf)}">
        <section class="border border-ink/10 p-6"><div class="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 class="font-semibold text-lg">Shipping Details</h2><select x-show="addresses.length" @change="pick($event.target.value)" class="input !w-auto !py-2 text-sm"><option value="">Saved address…</option><template x-for="(a,i) in addresses" :key="i"><option :value="i" x-text="a.name+' — '+a.city"></option></template></select></div><div class="grid sm:grid-cols-2 gap-4">
          <input name="name" x-model="f.name" placeholder="Full name *" required class="input">
          <input name="phone" x-model="f.phone" placeholder="Phone *" required class="input">
          <input name="email" x-model="f.email" type="email" placeholder="Email" class="input sm:col-span-2">
          <input name="line1" x-model="f.line1" placeholder="Address *" required class="input sm:col-span-2">
          <input name="city" x-model="f.city" placeholder="City *" required class="input"><input name="state" x-model="f.state" placeholder="State *" required class="input">
          <input name="pincode" x-model="f.pincode" placeholder="PIN code *" required class="input"></div></section>
        <section class="border border-ink/10 p-6"><h2 class="font-semibold text-lg mb-4">Payment</h2><div class="space-y-3">
          ${codEnabled ? `<label class="flex items-center gap-3 border p-4 cursor-pointer" :class="m==='cod'?'border-ink bg-white/50':'border-ink/20'"><input type="radio" name="payment_method" value="cod" x-model="m"> 💵 <b>Cash on Delivery</b></label>` : ""}
          <label class="flex items-center gap-3 border p-4 cursor-pointer" :class="m==='online'?'border-ink bg-white/50':'border-ink/20'"><input type="radio" name="payment_method" value="online" x-model="m"> 💳 <b>Pay Online</b> <span class="text-xs text-ink/50">${ctx.razorpay ? "(UPI/Cards · Razorpay)" : "(Demo gateway)"}</span></label>
        </div></section>
        <button class="w-full bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-4 hover:bg-clay-dark">Place Order · ${money(totals.total)}</button>
      </form>
      <aside class="bg-white/50 border border-ink/10 p-6 h-max"><h2 class="font-semibold mb-4">${rows.length} item(s)</h2><div class="space-y-3 max-h-64 overflow-auto">${summary}</div>
        <div class="border-t border-ink/10 mt-4 pt-4 space-y-2 text-sm"><div class="flex justify-between"><span class="text-ink/50">Subtotal</span><span>${money(totals.subtotal)}</span></div>${totals.discount ? `<div class="flex justify-between text-green-700"><span>Discount (${e(coupon.code)})</span><span>−${money(totals.discount)}</span></div>` : ""}<div class="flex justify-between"><span class="text-ink/50">Shipping</span><span>${totals.shipping === 0 ? "FREE" : money(totals.shipping)}</span></div><div class="border-t border-ink/10 pt-2 flex justify-between font-bold text-base"><span>Total</span><span>${money(totals.total)}</span></div></div>
        <form action="/cart/coupon" method="post" class="flex gap-2 mt-4"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input name="code" value="${coupon ? e(coupon.code) : ""}" placeholder="Coupon code" class="input flex-1 uppercase"><button class="bg-ink text-paper px-4 text-sm hover:bg-clay">Apply</button></form>
        <p class="text-xs text-ink/40 text-center mt-2">Try <b>WELCOME10</b> or <b>FLAT200</b> (min ₹1499)</p></aside>
    </div></div>`;
}

export function payDemoView(ctx, { order }) {
  return `<div class="max-w-md mx-auto px-4 py-20 text-center"><h1 class="font-display text-2xl mb-2">Demo Payment</h1><p class="text-ink/50 mb-6">Order <b>${e(order.order_no)}</b></p>
    <div class="bg-white/50 border border-ink/10 p-8"><div class="text-4xl mb-3">💳</div><p class="text-3xl font-bold mb-6 font-display">${money(order.total)}</p>
    <form action="/pay/demo/${e(order.order_no)}" method="post"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><button class="w-full bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-3.5 hover:bg-clay-dark">Pay ${money(order.total)} (Demo)</button></form>
    <p class="text-xs text-amber-700 bg-amber-50 px-3 py-2 mt-4">Test gateway — no real charge. Add Razorpay keys to enable real payments.</p></div></div>`;
}

function timeline(order) {
  if (order.status === "cancelled") return `<p class="text-clay">This order was cancelled.</p>`;
  const keys = STATUS_FLOW.map((s) => s[0]);
  const cur = Math.max(0, keys.indexOf(order.status));
  return `<ol class="relative">${STATUS_FLOW.map(([k, label], i) => {
    const done = i <= cur;
    return `<li class="flex gap-4 pb-6 last:pb-0 relative">${i < STATUS_FLOW.length - 1 ? `<span class="absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? "bg-green-500" : "bg-ink/15"}"></span>` : ""}<span class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm ${done ? "bg-green-500 text-white" : "bg-paper text-ink/40 border border-ink/20"}">${done ? "✓" : i + 1}</span><div class="pt-1"><p class="font-medium ${done ? "" : "text-ink/40"}">${label}${i === cur ? ` <span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>` : ""}</p></div></li>`;
  }).join("")}</ol>${order.awb ? `<div class="mt-4 bg-blue-50 border border-blue-100 p-4 text-sm"><b>📦 ${e(order.courier_name || "Courier")}</b><br>AWB: <b>${e(order.awb)}</b></div>` : ""}`;
}

export function successView(ctx, { order, items }) {
  return `<div class="max-w-2xl mx-auto px-5 sm:px-8 py-16 text-center"><div class="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center text-4xl">✅</div>
    <h1 class="font-display text-4xl mt-6">Thank you!</h1><p class="text-ink/60 mt-2">Your order has been placed.</p>
    <div class="bg-white/50 border border-ink/10 p-6 mt-8 text-left"><div class="flex justify-between items-center mb-4"><div><p class="text-xs text-ink/40">Order Number</p><p class="font-bold text-lg">${e(order.order_no)}</p></div><span class="bg-ink text-paper text-xs px-3 py-1 rounded-full">${STATUS_LABELS[order.status]}</span></div>
    <div class="space-y-3 border-t border-ink/10 pt-4">${items.map(lineRow).join("")}</div>
    <div class="border-t border-ink/10 mt-4 pt-4 flex justify-between font-bold"><span>Total</span><span>${money(order.total)}</span></div></div>
    <div class="flex flex-col sm:flex-row gap-3 justify-center mt-8"><a href="/track?order_no=${e(order.order_no)}" class="bg-clay text-paper text-[12px] uppercase tracking-[0.2em] px-7 py-3.5 hover:bg-clay-dark">Track Your Order</a><a href="/order/${e(order.order_no)}/invoice" target="_blank" class="border border-ink text-[12px] uppercase tracking-[0.2em] px-7 py-3.5 hover:bg-ink hover:text-paper">Invoice</a><a href="/shop" class="border border-ink text-[12px] uppercase tracking-[0.2em] px-7 py-3.5 hover:bg-ink hover:text-paper">Continue Shopping</a></div></div>`;
}

export function trackView(ctx, { order, items, searched, authorized, order_no, canReturn, returns }) {
  let result = "";
  if (searched && authorized && order) {
    const actions = `<div class="flex flex-wrap gap-3 mt-5"><a href="/order/${e(order.order_no)}/invoice" target="_blank" class="text-[12px] uppercase tracking-[0.15em] border border-ink px-4 py-2 hover:bg-ink hover:text-paper">⬇ Invoice</a>${canReturn ? `<details class="inline-block"><summary class="text-[12px] uppercase tracking-[0.15em] border border-ink px-4 py-2 cursor-pointer hover:bg-ink hover:text-paper list-none">↩ Return / Exchange</summary><form action="/orders/${e(order.order_no)}/return" method="post" class="mt-3 bg-white/60 border border-ink/10 p-4 w-full max-w-md space-y-3"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><select name="kind" class="input"><option value="return">Return (refund)</option><option value="exchange">Exchange</option></select><textarea name="reason" rows="2" placeholder="Reason (optional)" class="input"></textarea><button class="bg-clay text-paper text-[12px] uppercase tracking-[0.18em] px-5 py-2.5 hover:bg-clay-dark">Submit Request</button></form></details>` : ""}</div>${(returns || []).map((r) => `<p class="mt-3 text-sm text-clay-dark">↩ ${e(r.kind)} request — <b>${e(r.status)}</b></p>`).join("")}`;
    result = `<div class="mt-8 border border-ink/10 p-6"><div class="flex items-center justify-between mb-5"><div><p class="text-xs text-ink/40">Order</p><p class="font-bold">${e(order.order_no)}</p></div><span class="text-xs px-3 py-1 rounded-full bg-ink text-paper">${STATUS_LABELS[order.status]}</span></div>${timeline(order)}${actions}</div>`;
  } else if (searched && !authorized) {
    // Don't reveal whether the order exists — ask for the email used on it.
    result = `<div class="mt-6 text-center text-ink/60 bg-white/50 border border-ink/10 py-8 px-5"><div class="text-3xl mb-2">🔒</div><p>To protect your privacy, enter the <b>email used on this order</b> along with the order number to view its details.</p></div>`;
  }
  return `<div class="max-w-xl mx-auto px-5 sm:px-8 py-12"><h1 class="font-display text-4xl text-center mb-2">Track Your Order</h1><p class="text-center text-ink/50 mb-8">Enter your order number for live status.</p>
    <form method="get" class="flex flex-col gap-3 bg-white/50 border border-ink/10 p-5"><input name="order_no" value="${e(order_no || "")}" placeholder="Order number (e.g. ASW1A2B3C4D)" required class="input uppercase">${ctx.user ? "" : `<input name="email" type="email" placeholder="Email used on the order" class="input">`}<button class="bg-clay text-paper text-[12px] uppercase tracking-[0.2em] px-6 py-3 hover:bg-clay-dark">Track</button></form>${result}</div>`;
}

function authShell(ctx, title, sub, formInner, footerLink) {
  return `<div class="max-w-md mx-auto px-4 py-16"><h1 class="font-display text-4xl text-center mb-2">${title}</h1><p class="text-center text-ink/50 mb-8">${sub}</p><form method="post" class="space-y-4 bg-white/50 border border-ink/10 p-7"><input type="hidden" name="csrf" value="${e(ctx.csrf)}">${formInner}</form><p class="text-center text-sm text-ink/50 mt-5">${footerLink}</p></div>`;
}
export function loginView(ctx, { next }) {
  return authShell(ctx, "Welcome back", "Log in to your account",
    `${next ? `<input type="hidden" name="next" value="${e(next)}">` : ""}<input name="email" type="email" placeholder="Email" required class="input"><input name="password" type="password" placeholder="Password" required class="input"><button class="w-full bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-3 hover:bg-clay-dark">Log In</button>`,
    `New here? <a href="/register" class="text-clay font-medium">Create an account</a>`);
}
export function registerView(ctx) {
  return authShell(ctx, "Create account", "Join for faster checkout & tracking",
    `<input name="name" placeholder="Full name" required class="input"><input name="email" type="email" placeholder="Email" required class="input"><input name="phone" placeholder="Phone (optional)" class="input"><input name="password" type="password" placeholder="Password (min 6)" required class="input"><button class="w-full bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-3 hover:bg-clay-dark">Create Account</button>`,
    `Already have an account? <a href="/login" class="text-clay font-medium">Log in</a>`);
}
export function wishlistView(ctx, { products }) {
  const body = products.length
    ? `<div class="grid grid-cols-2 md:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-10">${products.map((p) => productCard(p, ctx)).join("")}</div>`
    : `<div class="text-center py-24 text-ink/50"><div class="text-5xl mb-3">🤍</div><p>Your wishlist is empty. Tap the heart on any product to save it.</p><a href="/shop" class="inline-block mt-5 bg-ink text-paper text-[12px] uppercase tracking-[0.2em] px-7 py-3 hover:bg-clay">Browse Products</a></div>`;
  return `<div class="max-w-[1400px] mx-auto px-5 sm:px-8 py-10"><h1 class="font-display text-4xl sm:text-5xl mb-8">Your Wishlist ♡</h1>${body}</div>`;
}
export function pageView(ctx, { page }) {
  return `<div class="max-w-3xl mx-auto px-5 sm:px-8 py-14"><nav class="eyebrow text-ink/45 mb-3"><a href="/" class="hover:text-clay">Home</a> / <span class="text-ink">${e(page.title)}</span></nav><h1 class="font-display text-4xl sm:text-5xl mb-8">${e(page.title)}</h1><div class="text-[16px] leading-relaxed text-ink/80 space-y-4">${page.body}</div></div>`;
}
export function contactView(ctx, { page }) {
  return `<div class="max-w-2xl mx-auto px-5 sm:px-8 py-14"><h1 class="font-display text-4xl sm:text-5xl mb-3">Contact Us</h1>${page ? `<div class="text-ink/70 mb-8">${page.body}</div>` : ""}<form method="post" class="space-y-4 bg-white/50 border border-ink/10 p-6"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><div class="grid sm:grid-cols-2 gap-4"><input name="name" placeholder="Your name *" required class="input"><input name="email" type="email" placeholder="Email" class="input"></div><textarea name="message" rows="5" placeholder="How can we help? *" required class="input"></textarea><button class="bg-clay text-paper text-[12px] uppercase tracking-[0.2em] px-7 py-3 hover:bg-clay-dark">Send Message</button></form><div class="mt-8 text-sm text-ink/60"><p>📧 ${e(ctx.email)}</p><p>📞 ${e(ctx.phone)}</p></div></div>`;
}
export function invoiceView(ctx, { order, items }) {
  const s = ctx.settings;
  const rate = parseInt(s.gst_rate || "5") || 0;
  const gstAmt = s.gst_number ? (order.total - order.total / (1 + rate / 100)).toFixed(2) : null;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${e(order.order_no)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1a1a1a;max-width:800px;margin:0 auto;padding:28px;font-size:13px}.top{display:flex;justify-content:space-between;border-bottom:2px solid #1a1a1a;padding-bottom:14px}.brand{font-size:26px;font-weight:800}.muted{color:#666}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e5e5e5}th{background:#f5f5f5;font-size:11px;text-transform:uppercase}.r{text-align:right}.totals{margin-top:14px;width:280px;margin-left:auto}.totals td{border:0;padding:4px 6px}.grand{font-weight:800;font-size:15px;border-top:2px solid #1a1a1a}.btn{background:#1a1a1a;color:#fff;border:0;padding:10px 22px;border-radius:6px;cursor:pointer}@media print{.noprint{display:none}body{padding:0}}</style></head><body>
    <div class="noprint" style="margin-bottom:18px"><button class="btn" onclick="window.print()">⬇ Download / Print PDF</button></div>
    <div class="top"><div><div class="brand">${e(s.seller_name || "Aswhani")}</div><div class="muted">${e(s.seller_address || "")}</div>${s.gst_number ? `<div class="muted">GSTIN: ${e(s.gst_number)}</div>` : ""}<div class="muted">${e(s.support_email || "")}</div></div><div style="text-align:right"><h1 style="margin:0">TAX INVOICE</h1><div><b>${e(order.order_no)}</b></div><div class="muted">${e((order.created_at || "").slice(0, 16).replace("T", " "))}</div><div class="muted">${e((order.payment_method || "").toUpperCase())} · ${e(order.payment_status)}</div></div></div>
    <div style="margin-top:16px"><b>Billed / Shipped To</b><br>${e(order.customer_name)}<br>${e(order.address_line1)}${order.address_line2 ? ", " + e(order.address_line2) : ""}<br>${e(order.city)}, ${e(order.state)} - ${e(order.pincode)}<br>${e(order.phone)}${order.email ? " · " + e(order.email) : ""}</div>
    <table><thead><tr><th>Item</th><th>Size/Colour</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${items.map((it) => `<tr><td>${e(it.name)}</td><td>${e(it.size || "")}${it.color ? " / " + e(it.color) : ""}</td><td class="r">${it.qty}</td><td class="r">${money(it.price)}</td><td class="r">${money(it.price * it.qty)}</td></tr>`).join("")}</tbody></table>
    <table class="totals"><tr><td>Subtotal</td><td class="r">${money(order.subtotal)}</td></tr>${order.discount ? `<tr><td>Discount${order.coupon_code ? " (" + e(order.coupon_code) + ")" : ""}</td><td class="r">−${money(order.discount)}</td></tr>` : ""}<tr><td>Shipping</td><td class="r">${money(order.shipping_fee)}</td></tr>${gstAmt ? `<tr><td class="muted">Incl. GST @ ${rate}%</td><td class="r muted">₹${gstAmt}</td></tr>` : ""}<tr class="grand"><td>Total</td><td class="r">${money(order.total)}</td></tr></table>
    <p class="muted" style="margin-top:30px">Thank you for shopping with ${e(s.seller_name || "Aswhani")}. Computer-generated invoice.</p></body></html>`;
}
export function payRazorpayView(ctx, { order, keyId }) {
  return `${head(ctx, "Payment")}<body class="font-sans text-ink bg-paper min-h-screen flex items-center justify-center px-4"><div class="max-w-md w-full text-center"><h1 class="font-display text-2xl mb-2">Complete your payment</h1><p class="text-ink/50 mb-6">Order <b>${e(order.order_no)}</b> · ${money(order.total)}</p><div class="bg-white/50 border border-ink/10 p-8"><button id="payBtn" class="w-full bg-clay text-paper text-[12px] uppercase tracking-[0.2em] py-3.5 hover:bg-clay-dark">Pay ${money(order.total)}</button><p class="text-xs text-ink/40 mt-4">Secured by Razorpay</p></div>
    <form id="vf" action="/pay/razorpay/verify" method="post" class="hidden"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input type="hidden" name="order_no" value="${e(order.order_no)}"><input type="hidden" name="razorpay_order_id" id="roid"><input type="hidden" name="razorpay_payment_id" id="rpid"><input type="hidden" name="razorpay_signature" id="rsig"></form></div>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>var rzp=new Razorpay({key:"${e(keyId)}",amount:${order.total * 100},currency:"INR",name:"${e(ctx.storeName)}",order_id:"${e(order.razorpay_order_id)}",prefill:{name:"${e(order.customer_name)}",email:"${e(order.email || "")}",contact:"${e(order.phone)}"},theme:{color:"#bf5836"},handler:function(r){document.getElementById('roid').value=r.razorpay_order_id;document.getElementById('rpid').value=r.razorpay_payment_id;document.getElementById('rsig').value=r.razorpay_signature;document.getElementById('vf').submit()}});document.getElementById('payBtn').onclick=function(){rzp.open()};window.addEventListener('load',function(){rzp.open()});</script></body></html>`;
}
export function accountView(ctx, { orders, addresses }) {
  const list = orders.length ? orders.map((o) => `<a href="/track?order_no=${e(o.order_no)}" class="block border border-ink/10 p-4 hover:border-ink"><div class="flex items-center justify-between"><div><p class="font-medium">${e(o.order_no)}</p><p class="text-xs text-ink/50">${e((o.created_at || "").slice(0, 10))} · ${o.item_count} item(s)</p></div><div class="text-right"><p class="font-semibold">${money(o.total)}</p><span class="text-xs px-2 py-0.5 rounded-full ${o.status === "delivered" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}">${STATUS_LABELS[o.status]}</span></div></div></a>`).join("")
    : `<div class="text-center py-16 bg-white/50 border border-ink/10 text-ink/50"><p>No orders yet.</p><a href="/shop" class="inline-block mt-4 bg-ink text-paper px-6 py-2.5 text-[12px] uppercase tracking-[0.2em] hover:bg-clay">Start Shopping</a></div>`;
  const addrCards = (addresses || []).map((a) => `<div class="border p-4 text-sm ${a.is_default ? "border-ink ring-1 ring-ink" : "border-ink/15"}"><p class="font-medium">${e(a.name)} ${a.is_default ? '<span class="text-xs bg-ink text-paper px-2 py-0.5 ml-1">Default</span>' : ""}</p><p class="text-ink/60 mt-1">${e(a.line1)}${a.line2 ? ", " + e(a.line2) : ""}, ${e(a.city)}, ${e(a.state)} - ${e(a.pincode)}</p><p class="text-ink/50">${e(a.phone || "")}</p><div class="flex gap-4 mt-2 text-xs">${a.is_default ? "" : `<form action="/account/address/${a.id}/default" method="post"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><button class="text-clay">Set default</button></form>`}<form action="/account/address/${a.id}/delete" method="post"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><button class="text-ink/40 hover:text-clay">Delete</button></form></div></div>`).join("") || `<p class="text-ink/40 text-sm">No saved addresses.</p>`;
  return `<div class="max-w-4xl mx-auto px-5 sm:px-8 py-10"><div class="flex items-center justify-between mb-8"><div><h1 class="font-display text-4xl">Hi, ${e(ctx.user.name.split(" ")[0])}</h1><p class="text-ink/50 text-sm">${e(ctx.user.email)}</p></div><a href="/logout" class="text-sm text-ink/50 hover:text-clay">Log out</a></div>
    <h2 class="font-semibold text-lg mb-4">My Orders</h2><div class="space-y-3">${list}</div>
    <h2 class="font-semibold text-lg mt-10 mb-4">My Addresses</h2><div class="grid sm:grid-cols-2 gap-4 mb-4">${addrCards}</div>
    <details class="bg-white/50 border border-ink/10 p-6"><summary class="font-medium cursor-pointer">+ Add a new address</summary><form action="/account/address" method="post" class="grid sm:grid-cols-2 gap-4 mt-4"><input type="hidden" name="csrf" value="${e(ctx.csrf)}"><input name="name" value="${e(ctx.user.name)}" placeholder="Full name" class="input"><input name="phone" placeholder="Phone" class="input"><input name="line1" placeholder="Address line 1" class="input sm:col-span-2"><input name="line2" placeholder="Address line 2" class="input sm:col-span-2"><input name="city" placeholder="City" class="input"><input name="state" placeholder="State" class="input"><input name="pincode" placeholder="PIN code" class="input"><div class="sm:col-span-2"><button class="bg-ink text-paper px-6 py-2.5 text-[12px] uppercase tracking-[0.2em] hover:bg-clay">Save Address</button></div></form></details></div>`;
}
