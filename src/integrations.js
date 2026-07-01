// External integrations — all optional & gated. When a key is missing they log
// and no-op (never crash). Network calls use waitUntil so they never block the response.
import { money, e } from "./lib.js";

// Collapse newlines/controls and cap length — for plain-text channels (Telegram)
// so attacker-supplied fields can't forge extra structural lines.
const oneLine = (v, n = 120) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").slice(0, n);

// ---- Razorpay (real online payments) ----
export async function razorpayCreateOrder(env, amountRupees, receipt) {
  if (!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)) return null;
  try {
    const auth = btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountRupees * 100, currency: "INR", receipt, payment_capture: 1 }),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ---- Customer email via Resend ----
export function sendEmail(env, exec, to, subject, html) {
  if (!to) return;
  if (!env.RESEND_API_KEY) { console.log("EMAIL (set RESEND_API_KEY to send):", to, "|", subject); return; }
  const p = fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "Aswhani <onboarding@resend.dev>", to: [to], subject, html }),
  }).catch(() => {});
  if (exec && exec.waitUntil) exec.waitUntil(p);
}

// ---- Owner alert via Telegram ----
export function notifyOwner(env, exec, text) {
  if (!(env.STORE_TG_TOKEN && env.STORE_TG_CHAT)) { console.log("OWNER ALERT:", text.replace(/\n/g, " | ")); return; }
  const p = fetch(`https://api.telegram.org/bot${env.STORE_TG_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.STORE_TG_CHAT, text }),
  }).catch(() => {});
  if (exec && exec.waitUntil) exec.waitUntil(p);
}

// ---- Shiprocket auto-shipment ----
export async function shiprocketPush(env, order, items) {
  if (!(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD))
    return { ok: false, msg: "Shiprocket not connected. Add SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD, or paste the AWB manually." };
  try {
    const a = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    });
    const tok = (await a.json()).token;
    if (!tok) return { ok: false, msg: "Shiprocket login failed — check credentials." };
    const payload = {
      order_id: order.order_no, order_date: (order.created_at || "").slice(0, 16).replace("T", " "),
      pickup_location: "Primary", billing_customer_name: order.customer_name, billing_last_name: "",
      billing_address: order.address_line1, billing_city: order.city, billing_pincode: order.pincode,
      billing_state: order.state, billing_country: "India", billing_email: order.email || "noreply@aswhani.com",
      billing_phone: order.phone, shipping_is_billing: true,
      order_items: items.map((it) => ({ name: it.name, sku: order.order_no + "-" + it.id, units: it.qty, selling_price: it.price })),
      payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
      sub_total: order.total, length: 25, breadth: 20, height: 4, weight: 0.5,
    };
    const r = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.order_id || d.shipment_id) return { ok: true, msg: `Pushed to Shiprocket (id ${d.order_id}).`, awb: String(d.awb_code || "") };
    return { ok: false, msg: "Shiprocket: " + (d.message || "could not create order") };
  } catch (e) { return { ok: false, msg: "Shiprocket error: " + e }; }
}

// ---- Email + alert content ----
export function orderEmailHtml(order, items, trackUrl, heading, intro) {
  const rows = items.map((it) => `<tr><td style="padding:6px 0">${e(it.name)}${[it.size, it.color].filter(Boolean).length ? " (" + e([it.size, it.color].filter(Boolean).join("/")) + ")" : ""} × ${it.qty}</td><td style="padding:6px 0;text-align:right">${money(it.price * it.qty)}</td></tr>`).join("");
  const btn = trackUrl ? `<p><a href="${e(trackUrl)}" style="background:#bf5836;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">Track your order</a></p>` : "";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#23190f"><h2>Aswhani</h2><h3>${e(heading)}</h3><p>${e(intro)}</p><p><b>Order ${e(order.order_no)}</b></p><table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding-top:10px;border-top:1px solid #eee"><b>Total</b></td><td style="padding-top:10px;border-top:1px solid #eee;text-align:right"><b>${money(order.total)}</b></td></tr></table><p>Ship to: ${e(order.customer_name)}, ${e(order.address_line1)}, ${e(order.city)}, ${e(order.state)} - ${e(order.pincode)}</p>${btn}</div>`;
}

export function ownerAlertText(order, items, kind) {
  const head = kind === "paid" ? "✅ PAYMENT RECEIVED" : "🛒 NEW ORDER";
  const its = items.map((it) => `${oneLine(it.name, 60)}${[it.size, it.color].filter(Boolean).length ? " (" + [it.size, it.color].filter(Boolean).join("/") + ")" : ""} ×${it.qty}`).join("; ");
  return `${head} — ${oneLine(order.order_no, 40)}\nAmount: ${money(order.total)} (${(order.payment_method || "").toUpperCase()} · ${order.payment_status})\nCustomer: ${oneLine(order.customer_name)} · ${oneLine(order.phone, 20)}\nItems: ${oneLine(its, 400)}\nShip to: ${oneLine(order.address_line1)}, ${oneLine(order.city, 60)}, ${oneLine(order.state, 60)} - ${oneLine(order.pincode, 12)}`;
}
