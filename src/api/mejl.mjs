// POST /api/mejl  {epost, koer:[{slug, senast}]}: sparar en begäran och skickar bekräftelsemejlet.
import { rpc, hittaKo, epostOk, idagSverige, svDatum, plusDagar, skickaMejl, farMejlas, vantelista, mejlHtml, esc, json, SAJT } from './_lib.mjs';

export async function POST(req) {
  let indata;
  try { indata = await req.json(); } catch { return json({ fel: 'Ogiltig begäran.' }, 400); }
  const epost = String(indata?.epost || '').trim().toLowerCase();
  if (!epostOk(epost)) return json({ fel: 'Kontrollera mejladressen.' }, 400);
  const idag = idagSverige();
  const koer = [];
  for (const x of Array.isArray(indata.koer) ? indata.koer.slice(0, 30) : []) {
    const k = hittaKo(x?.slug);
    if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(x.senast || '') || x.senast > idag || x.senast < '2000-01-01') continue;
    if (!koer.some((y) => y.slug === k.slug)) koer.push({ slug: k.slug, senast: x.senast, intervall: k.intervall_dagar });
  }
  if (!koer.length) return json({ fel: 'Lägg in minst en kö med datum först.' }, 400);

  if (!farMejlas(epost)) {
    await vantelista(epost).catch(() => {});
    return json({ ok: true, vantelista: true });
  }
  let token;
  try { token = await rpc('bk_mejl_begar', { p_epost: epost, p_koer: koer }); }
  catch (e) {
    if (e.kod === 'FOROFTA') return json({ fel: 'Vi har nyss skickat ett mejl dit. Titta i inkorgen, eller försök igen om en stund.' }, 429);
    if (e.kod === 'FULLT') return json({ fel: 'Det är fullt just nu. Försök igen i morgon.' }, 503);
    console.error(e); return json({ fel: 'Något gick fel. Försök igen.' }, 500);
  }
  const lank = `${SAJT}/api/bekrafta/?t=${token}`;
  const rader = koer.map((x) => { const k = hittaKo(x.slug); return `${esc(k.namn)}: ${esc(k.atgard.toLowerCase())} senast ${esc(svDatum(plusDagar(x.senast, x.intervall)))}`; });
  try {
    await skickaMejl({
      till: epost,
      amne: 'Bekräfta dina påminnelser från Bostadskoll',
      html: mejlHtml({
        rubrik: 'Bekräfta din mejladress',
        stycken: ['Tryck på knappen så mejlar vi dig 30, 7 och 1 dag innan det är dags, så att du inte tappar din kötid.', rader.join('<br>')],
        knapp: { text: 'Bekräfta påminnelserna', url: lank },
        fot: 'Bad du inte om det här? Då kan du strunta i mejlet, så händer ingenting. Länken gäller i sju dagar.',
      }),
      text: `Bekräfta dina påminnelser från Bostadskoll:\n${lank}\n\n${rader.join('\n').replace(/&amp;/g, '&')}\n\nBad du inte om det här? Strunta i mejlet, så händer ingenting.`,
    });
  } catch (e) { console.error(e); return json({ fel: 'Mejlet gick inte att skicka. Försök igen om en stund.' }, 502); }
  return json({ ok: true });
}
