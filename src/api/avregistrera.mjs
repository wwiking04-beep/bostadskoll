// /api/avregistrera/?t=…  GET visar en knapp (så att länkskannrar inte avregistrerar), POST avregistrerar.
// POST fungerar också som ettklicksavregistrering (List-Unsubscribe-Post) direkt från mejlprogrammet.
import { rpc, sida, esc } from './_lib.mjs';
const giltig = (t) => /^[a-f0-9]{64}$/.test(t);

export async function GET(req) {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!giltig(t)) return sida('Länken fungerar inte', '<p class="ingress">Kontrollera att hela länken kom med.</p>', 400);
  return sida('Sluta få påminnelser?', `<p class="ingress">Vi tar bort din mejladress och alla dina köer hos oss. Köerna i din egen webbläsare och kalender ligger kvar.</p>
<form method="post" action="/api/avregistrera/?t=${esc(t)}"><button class="knapp" type="submit">Avregistrera mig</button></form>`);
}

export async function POST(req) {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!giltig(t)) return sida('Länken fungerar inte', '<p class="ingress">Kontrollera att hela länken kom med.</p>', 400);
  try { await rpc('bk_mejl_avregistrera', { p_avreg: t }); } catch (e) { console.error(e); return sida('Något gick fel', '<p class="ingress">Försök igen om en stund.</p>', 500); }
  return sida('Du är avregistrerad', '<p class="ingress">Vi har tagit bort din mejladress och dina köer. Du får inga fler mejl från oss.</p><a class="knapp sekundar" href="/">Till startsidan</a>');
}
