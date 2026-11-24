// GET /api/paminnelser: körs av Vercel Cron varje morgon. Mejlar dem som har 30, 7, 1 eller 0 dagar kvar.
import { rpc, hittaKo, idagSverige, svDatum, skickaMejl, mejlHtml, esc, json, SAJT } from './_lib.mjs';

export function paminnelse(rad) {
  const k = hittaKo(rad.ko_slug);
  const d = rad.dagar_kvar;
  const nar = d === 0 ? 'i dag' : d === 1 ? 'i morgon' : `om ${d} dagar`;
  const rubrik = d === 0 ? `Sista dagen för ${k.namn}` : `${k.atgard} ${nar}`;
  const klar = `${SAJT}/api/klar/?t=${rad.avreg}&ko=${k.slug}`;
  const avreg = `${SAJT}/api/avregistrera/?t=${rad.avreg}`;
  const stycken = [
    `Senast ${esc(svDatum(rad.deadline))} behöver du ${esc(k.atgard.toLowerCase())} hos ${esc(k.namn)}, annars riskerar du kötiden du samlat.`,
    esc(k.krav),
    `<a href="${esc(klar)}" style="color:#0a7c6c">Har du gjort det? Tryck här</a>, så räknar vi nästa frist från i dag.`,
  ];
  return {
    amne: d === 0 ? `Sista dagen i dag: ${k.namn}` : `${k.namn}: ${k.atgard.toLowerCase()} ${nar}`,
    html: mejlHtml({ rubrik, stycken, knapp: { text: `Öppna ${k.namn}`, url: k.url },
      fot: `Du får det här för att du bad Bostadskoll påminna dig. <a href="${esc(avreg)}" style="color:#8e8e93">Avregistrera</a>. Bostadskoll har ingen koppling till bostadsköerna.` }),
    text: `${rubrik}\n\nSenast ${svDatum(rad.deadline)} behöver du ${k.atgard.toLowerCase()} hos ${k.namn}: ${k.url}\n\nKlart? ${klar}\n\nAvregistrera: ${avreg}`,
    avreg,
  };
}

export async function GET(req) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return json({ fel: 'nekad' }, 401);
  const idag = new URL(req.url).searchParams.get('idag') || idagSverige();
  const rader = await rpc('bk_mejl_att_skicka', { p_idag: idag });
  let skickade = 0, fel = 0;
  for (const rad of rader) {
    if (!hittaKo(rad.ko_slug)) continue;
    const m = paminnelse(rad);
    let status = 'skickad';
    try { await skickaMejl({ till: rad.epost, amne: m.amne, html: m.html, text: m.text, avreg: m.avreg }); skickade++; }
    catch (e) { console.error(rad.ko_id, e.message); status = 'fel'; fel++; }
    await rpc('bk_mejl_skickad', { p_ko_id: rad.ko_id, p_deadline: rad.deadline, p_dagar: rad.dagar_kvar, p_status: status });
    await new Promise((r) => setTimeout(r, 550)); // Resend gratis: högst 2 mejl i sekunden
  }
  return json({ idag, att_skicka: rader.length, skickade, fel });
}
