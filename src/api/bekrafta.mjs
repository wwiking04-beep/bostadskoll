// GET /api/bekrafta/?t=…: bekräftelselänken i mejlet.
import { rpc, hittaKo, svDatum, plusDagar, sida, esc } from './_lib.mjs';

export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!/^[a-f0-9]{64}$/.test(t)) return sida('Länken fungerar inte', '<p class="ingress">Kontrollera att hela länken kom med, eller lägg in köerna igen.</p><a class="knapp" href="/mina-koer/">Mina köer</a>', 400);
  let r;
  try { r = await rpc('bk_mejl_bekrafta', { p_token: t }); } catch (e) { console.error(e); return sida('Något gick fel', '<p class="ingress">Försök igen om en stund.</p>', 500); }
  if (!r) return sida('Länken har gått ut', '<p class="ingress">Den är redan använd eller äldre än sju dagar. Är du redan bekräftad behöver du inte göra något mer.</p><a class="knapp" href="/mina-koer/">Mina köer</a>', 410);
  const rader = r.koer.map((x) => { const k = hittaKo(x.slug); return `<li>${esc(k ? k.namn : x.slug)}: senast ${esc(svDatum(plusDagar(x.senast, x.intervall)))}</li>`; }).join('');
  return sida('Klart, nu mejlar vi dig', `<p class="ingress">Du får ett mejl till ${esc(r.epost)} 30, 7 och 1 dag innan det är dags.</p><ul class="mjuk" style="text-align:left;display:inline-block">${rader}</ul><div class="knappar"><a class="knapp" href="/mina-koer/">Mina köer</a></div>`);
}
