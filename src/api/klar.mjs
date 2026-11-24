// /api/klar/?t=…&ko=…  "Klart idag" från ett påminnelsemejl. GET visar en knapp, POST sparar.
import { rpc, hittaKo, idagSverige, plusDagar, svDatum, sida, esc } from './_lib.mjs';

function las(req) {
  const p = new URL(req.url).searchParams;
  const t = p.get('t') || '';
  const k = hittaKo(p.get('ko') || '');
  return /^[a-f0-9]{64}$/.test(t) && k ? { t, k } : null;
}
const felaktig = () => sida('Länken fungerar inte', '<p class="ingress">Kontrollera att hela länken kom med.</p>', 400);

export async function GET(req) {
  const x = las(req); if (!x) return felaktig();
  return sida(`${x.k.atgard} klart?`, `<p class="ingress">Tryck när du har gjort det hos ${esc(x.k.namn)}, så räknar vi nästa frist från i dag.</p>
<div class="knappar"><form method="post" action="/api/klar/?t=${esc(x.t)}&amp;ko=${esc(x.k.slug)}"><button class="knapp" type="submit">Klart idag</button></form>
<a class="knapp sekundar" href="${esc(x.k.url)}" target="_blank" rel="noopener">Öppna ${esc(x.k.namn)}</a></div>`);
}

export async function POST(req) {
  const x = las(req); if (!x) return felaktig();
  const idag = idagSverige();
  let ok;
  try { ok = await rpc('bk_mejl_klar', { p_avreg: x.t, p_slug: x.k.slug, p_datum: idag }); } catch (e) { console.error(e); return sida('Något gick fel', '<p class="ingress">Försök igen om en stund.</p>', 500); }
  if (!ok) return sida('Hittade inte kön', '<p class="ingress">Du kanske har avregistrerat dig. Lägg in kön igen under Mina köer.</p><a class="knapp" href="/mina-koer/">Mina köer</a>', 404);
  return sida('Snyggt, klart', `<p class="ingress">Nästa gång är senast ${esc(svDatum(plusDagar(idag, x.k.intervall_dagar)))}. Vi mejlar dig i god tid.</p><a class="knapp sekundar" href="/mina-koer/">Mina köer</a>`);
}
