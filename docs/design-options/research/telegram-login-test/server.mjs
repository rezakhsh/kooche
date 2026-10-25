// Throwaway test of Telegram's OpenID Connect login with the `phone` scope. Not part of the app.
// Config: TG_CLIENT_ID and TG_CLIENT_SECRET from /secrets/telegram-oidc-test.env (never printed),
// PUBLIC_URL from the environment (the temporary https tunnel). Nothing is stored or logged.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/secrets/telegram-oidc-test.env', 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
);
const CLIENT_ID = env.TG_CLIENT_ID;
const CLIENT_SECRET = env.TG_CLIENT_SECRET;
const PUBLIC_URL = 'http://localhost:18787';
// Telegram only accepts registered https redirects, so it returns to a 404 path on staging and the
// owner pastes that address back here (the code is single-use and short-lived).
const REDIRECT = process.env.REDIRECT_URI;
const ISSUER = 'https://oauth.telegram.org';
const pending = new Map(); // state -> { verifier, nonce, at }

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const page = (body) => `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>آزمایش ورود با تلگرام</title><body style="font:16px/1.9 Tahoma,sans-serif;max-width:34rem;margin:2rem auto;padding:0 16px">${body}</body></html>`;
const send = (res, code, html) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(page(html)); };
const mask = (d) => `+${d.slice(0, 2)}${'•'.repeat(Math.max(0, d.length - 4))}${d.slice(-2)}`;

async function verifyIdToken(idToken, nonce) {
  const [h, p, s] = idToken.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const jwks = await (await fetch(`${ISSUER}/.well-known/jwks.json`)).json();
  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (header.alg !== 'RS256') throw new Error(`unexpected alg ${header.alg}`);
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('bad signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  if (claims.iss !== ISSUER) throw new Error('bad issuer');
  if (String(claims.aud) !== String(CLIENT_ID) && !(Array.isArray(claims.aud) && claims.aud.map(String).includes(String(CLIENT_ID)))) throw new Error('bad audience');
  if (claims.exp * 1000 < Date.now()) throw new Error('expired');
  if (claims.nonce !== undefined && claims.nonce !== nonce) throw new Error('bad nonce');
  return { claims, alg: header.alg, nonceChecked: claims.nonce !== undefined };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  try {
    if (url.pathname === '/') {
      const state = b64url(crypto.randomBytes(16));
      const verifier = b64url(crypto.randomBytes(32));
      const nonce = b64url(crypto.randomBytes(16));
      pending.set(state, { verifier, nonce, at: Date.now() });
      const auth = new URL(`${ISSUER}/auth`);
      auth.search = new URLSearchParams({
        client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'openid phone',
        state, nonce, code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
      });
      return send(res, 200, `<h1>آزمایش ورود با تلگرام</h1><p>این صفحهٔ آزمایشی پیدو است و چیزی ذخیره نمی‌کند.</p><p><a href="${auth}" target="_blank" rel="noopener" style="display:inline-block;background:#2aabee;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold">۱. ورود با تلگرام</a></p><p>۲. بعد از تأیید در تلگرام، به یک صفحهٔ «۴۰۴» در staging می‌رسید. نشانی کامل آن صفحه را از نوار آدرس کپی کنید و اینجا بگذارید (زود، کد چند دقیقه اعتبار دارد):</p><form action="/callback" method="get"><input name="pasted" dir="ltr" style="width:100%;padding:10px;font-size:15px" placeholder="https://staging.peydoo.com/tg-oidc-test?code=…&state=…" required><button style="margin-top:10px;padding:10px 18px;font-size:15px">۳. بررسی</button></form>`);
    }
    if (url.pathname === '/callback') {
      if (url.searchParams.get('pasted')) {
        const back = new URL(url.searchParams.get('pasted').trim());
        for (const k of ['code', 'state', 'error']) if (back.searchParams.get(k)) url.searchParams.set(k, back.searchParams.get(k));
      }
      if (url.searchParams.get('error')) return send(res, 200, `<h1>رد شد</h1><p>تلگرام گفت: <code>${url.searchParams.get('error')}</code> (اگر اجازهٔ شماره را ندادید، این درست است).</p><p><a href="/">دوباره</a></p>`);
      const st = pending.get(url.searchParams.get('state'));
      if (st && Date.now() - st.at > 15 * 60 * 1000) pending.delete(url.searchParams.get('state'));
      if (!st || Date.now() - st.at > 15 * 60 * 1000) return send(res, 400, '<p>state نامعتبر یا منقضی.</p><p><a href="/">دوباره</a></p>');
      const tok = await fetch(`${ISSUER}/token`, {
        method: 'POST',
        headers: { authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT, client_id: CLIENT_ID, code_verifier: st.verifier }),
      });
      const body = await tok.json();
      if (!tok.ok || !body.id_token) return send(res, 200, `<h1>خطای توکن</h1><p>HTTP ${tok.status}: <code>${String(body.error ?? '')} ${String(body.error_description ?? '')}</code></p>`);
      const { claims, alg, nonceChecked } = await verifyIdToken(body.id_token, st.nonce);
      const digits = String(claims.phone_number ?? '').replace(/\D/g, '');
      const refused = digits.startsWith('98') ? 'رد می‌شود (+98)' : digits.startsWith('888') ? 'رد می‌شود (+888)' : digits ? 'پذیرفته می‌شود (کشور را هم باید چک کرد)' : '—';
      // Only the outcome goes to the log, never the number.
      console.log(`login ok: phone=${digits ? 'yes' : 'no'} verified=${claims.phone_number_verified} alg=${alg}`);
      return send(res, 200, `<h1>کار کرد ✓</h1><ul>
        <li>امضای توکن (${alg}) با کلید عمومی تلگرام: درست</li>
        <li>شناسهٔ کاربر (sub): <code>${String(claims.sub).slice(0, 4)}…</code></li>
        <li>شماره: <b dir="ltr">${digits ? mask(digits) : 'برنگشت'}</b></li>
        <li>phone_number_verified: <code>${String(claims.phone_number_verified)}</code></li>
        <li>nonce بررسی شد: ${nonceChecked ? 'بله' : 'تلگرام nonce برنگرداند'}</li>
        <li>قاعدهٔ پیدو برای این شماره: ${refused}</li>
        <li>claimها: <code dir="ltr">${Object.keys(claims).join(', ')}</code></li></ul>
        <p>هیچ‌چیز ذخیره نشد. این صفحه را ببندید.</p>`);
    }
    send(res, 404, '<p>نیست.</p>');
  } catch (e) {
    console.log(`error: ${e.message}`);
    send(res, 500, `<h1>خطا</h1><p><code>${e.message}</code></p>`);
  }
}).listen(18787, () => console.log(`test server on :18787, redirect ${REDIRECT}`));
