// Delad kod för Bostadskolls serverfunktioner (Vercel). Filer som börjar med _ blir inga egna vägar.
import { KOER, hittaKo } from './_koer.mjs';
export { KOER, hittaKo };

export const SAJT = process.env.SAJT_URL || 'https://bostadskoll.vercel.app';
const SB_URL = process.env.SUPABASE_URL || 'https://ytprkesajeookoojtlqz.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_25fah5wUTWPC-yYnMiK-Vw_YU3USv8u';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const epostOk = (e) => typeof e === 'string' && e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export const svDatum = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const idagSverige = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(d);
export const plusDagar = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Anropar en databasfunktion. Hemligheten gör att bara de här funktionerna kan använda dem.
export async function rpc(namn, arg) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${namn}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ p_h: process.env.BK_HEMLIGHET, ...arg }),
  });
  const txt = await r.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!r.ok) { const e = new Error(data?.message || `rpc ${namn} ${r.status}`); e.kod = data?.message; throw e; }
  return data;
}

export async function vantelista(epost) {
  await fetch(`${SB_URL}/rest/v1/bk_vantelista`, {
    method: 'POST', headers: { apikey: SB_KEY, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ epost }),
  });
}

// Medan avsändaren är Resends testdomän får bara adresserna i MEJL_TILLATNA mejl.
export function farMejlas(epost) {
  const lista = (process.env.MEJL_TILLATNA || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !lista.length || lista.includes(epost.toLowerCase());
}

export async function skickaMejl({ till, amne, html, text, avreg }) {
  if (!farMejlas(till)) throw new Error('adressen är inte tillåten än');
  const headers = avreg ? { 'List-Unsubscribe': `<${avreg}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MEJL_FRAN || 'Bostadskoll <onboarding@resend.dev>', to: [till], subject: amne, html, text, headers }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${data.message || ''}`);
  return data.id;
}

// ---------- Mejlens utseende (enkel, ljus, fungerar i alla mejlprogram) ----------
export function mejlHtml({ rubrik, stycken, knapp, fot }) {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:22px;padding:32px 28px;border:1px solid rgba(0,0,0,.06)">
<tr><td style="font-size:15px;font-weight:600;color:#0a7c6c;padding-bottom:18px">Bostadskoll</td></tr>
<tr><td style="font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-.02em;padding-bottom:14px">${esc(rubrik)}</td></tr>
${stycken.map((s) => `<tr><td style="font-size:16px;line-height:1.5;color:#3a3a3c;padding-bottom:12px">${s}</td></tr>`).join('')}
${knapp ? `<tr><td style="padding:12px 0 8px"><a href="${esc(knapp.url)}" style="display:inline-block;background:#0a7c6c;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:13px 24px;border-radius:999px">${esc(knapp.text)}</a></td></tr>` : ''}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px"><tr><td style="font-size:12px;line-height:1.5;color:#8e8e93;padding:16px 8px">${fot}</td></tr></table>
</td></tr></table></body></html>`;
}

// ---------- Små sidor som funktionerna svarar med ----------
export function sida(rubrik, innehall, status = 200) {
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(rubrik)} – Bostadskoll</title><meta name="robots" content="noindex"><link rel="icon" href="/ikon.svg" type="image/svg+xml"><link rel="stylesheet" href="/stil.css"></head>
<body><header class="topp glas"><a class="logga" href="/"><svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v10.2c0 .4.3.8.8.8h3.9v-6h3.6v6h3.9c.5 0 .8-.4.8-.8V9"/></svg>Bostadskoll</a>
<nav class="meny"><a class="knapp liten" href="/mina-koer/">Mina köer</a></nav></header>
<main><section class="hjalte"><h1>${esc(rubrik)}</h1>${innehall}</section></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
export const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
