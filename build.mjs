// Bygger Bostadskoll till dist/: statiska, sökbara sidor + en liten app för Mina köer.
import { mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { KOER, KONTROLLERAD } from './src/koer.js';

export const SAJT = process.env.SAJT_URL || 'https://bostadskoll.vercel.app';
const UT = 'dist';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const varde = (s) => (/^uppgift saknas/i.test(s) ? `<span class="saknas">${esc(s)}</span>` : esc(s));
const manader = (d) => (d >= 360 ? 'en gång om året' : d >= 175 ? 'var sjätte månad' : 'varje termin');

const P = {
  hus: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v10.2c0 .4.3.8.8.8h3.9v-6h3.6v6h3.9c.5 0 .8-.4.8-.8V9"/>',
  klocka: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.2 2"/>',
  klocka2: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.8H5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  bock: '<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  pil: '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>',
  sköld: '<path d="M12 3.5 19 6v5.6c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/><path d="m8.8 12.2 2.3 2.3 4.2-4.5"/>',
  kalender: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  kuvert: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>',
  gnista: '<path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z"/><path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z"/>',
  lank: '<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H11"/>',
  person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.8-3.6 3.6-5.5 7.2-5.5s6.4 1.9 7.2 5.5"/>',
};
export const ikon = (n) => `<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

function sida({ sokvag, titel, beskrivning, innehall, jsonld = [], skript = '' }) {
  const kanon = SAJT + sokvag;
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beskrivning)}">
<link rel="canonical" href="${kanon}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="Bostadskoll">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beskrivning)}">
<meta property="og:url" content="${kanon}">
<meta name="theme-color" content="#f2f2f7">
<link rel="icon" href="/ikon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/ikon.svg">
<link rel="stylesheet" href="/stil.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<header class="topp glas">
  <a class="logga" href="/">${ikon('hus')}Bostadskoll</a>
  <nav class="meny">
    <a class="lank dold-mobil" href="/koer/">Köerna</a>
    <a class="lank dold-mobil" href="/premium/">Premium</a>
    <a class="knapp liten" href="/mina-koer/">Mina köer</a>
  </nav>
</header>
<main>
${innehall}
</main>
<footer>
  <span>Bostadskoll är en fristående påminnelsetjänst och har ingen koppling till bostadsköerna.</span>
  <span><a href="/koer/">Alla köer</a> · <a href="/premium/">Premium</a> · <a href="/integritet/">Integritet</a></span>
</footer>
${skript}
</body>
</html>`;
}

const kokort = (k) => `<a class="kokort glas kort" href="/ko/${k.slug}/">
  <div class="rad"><h3>${esc(k.namn)}</h3><span class="kapsel ${k.intervall_dagar < 360 ? 'gul' : ''}">${ikon('klocka')}${manader(k.intervall_dagar)}</span></div>
  <p>${esc(k.stad)} · ${esc(k.atgard)}</p>
</a>`;

const faqLd = (fragor) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: fragor.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});
const faqHtml = (fragor) => fragor.map(([q, a]) => `<details class="faq glas"><summary>${esc(q)}${ikon('plus')}</summary><p>${esc(a)}</p></details>`).join('\n');

const koVal = (id) => `<select name="ko" ${id ? `id="${id}"` : ''} aria-label="Kö" required>${KOER.map((k) => `<option value="${k.slug}">${esc(k.namn)} (${esc(k.stad)})</option>`).join('')}</select>`;
const paminnForm = (ko, id = '') => `<form class="paminn" data-paminn ${ko ? `data-ko="${ko.slug}"` : ''} ${id ? `id="${id}"` : ''}>
    ${ko ? '' : `<div><label class="liten">Kö</label>${koVal(id ? 'ko' : '')}</div>`}
    <div><label class="liten" data-etikett>Senast du loggade in</label><input type="date" name="datum" required aria-label="Datum"></div>
    <div class="skicka"><button class="knapp" type="submit">${ikon('kalender')}Lägg i kalendern</button></div>
  </form>`;
const mejlForm = (alla = false) => `<form class="rad mejlform" data-mejl ${alla ? 'data-alla' : ''}>
    <input type="email" name="epost" placeholder="din@mejl.se" autocomplete="email" required aria-label="Mejladress">
    <button class="knapp sekundar" type="submit">${ikon('kuvert')}${alla ? 'Mejla mig om alla' : 'Mejla mig i stället'}</button>
  </form>
  <div class="meddelande" role="status" data-mejlsvar></div>`;
const anmalan = (ko) => `<section class="cta glas">
  <h2>Få en påminnelse innan det är för sent</h2>
  <p class="mjuk">Ange när du senast ${ko ? esc(ko.atgard_kort) : 'loggade in eller betalade'}. Vi räknar ut sista dagen och lägger den i din kalender med påminnelser 30, 7 och 1 dag innan. Gratis, inget konto.</p>
  ${paminnForm(ko)}
  <div class="meddelande" role="status"></div>
  <p class="liten mjuk eller">Hellre mejl? Fyll i datumet ovan och din mejladress, så mejlar vi dig 30, 7 och 1 dag innan.</p>
  ${mejlForm()}
</section>`;

// ---------- Startsidan ----------
const startFragor = [
  ['Hur tappar man sin plats i bostadskön?', 'De flesta köer kräver något återkommande: Boplats Göteborg, Bostadsförmedlingen i Stockholm, Boplats Syd och Uppsala Bostadsförmedling tar ut en årsavgift, medan hyresvärdar som Willhem, SGS, Stångåstaden och Bostäder i Borås kräver att du loggar in minst en gång om året. Missar du det kan flera års kötid försvinna.'],
  ['Vad kostar Bostadskoll?', 'Det är gratis att hålla koll på alla dina köer och få påminnelser i kalendern eller i mejlen. Premium med bevakning av regeländringar och dina köer på alla enheter kommer att kosta 29 kr i månaden eller 199 kr om året.'],
  ['Loggar Bostadskoll in eller betalar åt mig?', 'Nej. Bostadskoll påminner dig i god tid, och du loggar in eller betalar själv hos kön. Vi ber aldrig om ditt BankID eller dina inloggningsuppgifter.'],
  ['Hur ofta måste jag logga in i bostadskön?', 'Det skiljer sig. Boplats Syd kräver att du uppdaterar dina uppgifter var sjätte månad, de flesta hyresvärdar kräver inloggning en gång per år och förmedlingarna kräver en årsavgift. Se reglerna för varje kö på sidan Köerna.'],
  ['Hur aktuella är reglerna?', `Reglerna är hämtade från köernas egna webbplatser och senast kontrollerade ${KONTROLLERAD}. Där en kö inte skriver något anger vi "uppgift saknas" i stället för att gissa.`],
];

const start = sida({
  sokvag: '/',
  titel: 'Bostadskoll – påminnelse innan du tappar din plats i bostadskön',
  beskrivning: 'Gratis påminnelse innan din köplats förfaller. Bostadskoll håller koll på årsavgifter och inloggningskrav för Boplats, Bostadsförmedlingen, Boplats Syd, SGS, Willhem med flera.',
  jsonld: [faqLd(startFragor), { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Bostadskoll', url: SAJT, applicationCategory: 'LifestyleApplication', inLanguage: 'sv', offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' } }],
  innehall: `
<section class="hjalte">
  <span class="kapsel bla">${ikon('gnista')}Gratis, inget konto</span>
  <h1>Tappa aldrig din <span class="markerat">plats i bostadskön</span></h1>
  <p class="ingress">År av kötid kan försvinna för att du glömde en inloggning eller en årsavgift. Bostadskoll håller koll på alla dina köer och påminner dig i tid.</p>
  <div class="knappar">
    <a class="knapp" href="/mina-koer/">${ikon('klocka2')}Kom igång gratis</a>
    <a class="knapp sekundar" href="/koer/">Se reglerna för din kö</a>
  </div>
</section>

<section class="rutnat">
  <div class="glas kort steg">${ikon('plus')}<h3>Lägg in dina köer</h3><p>Välj köerna du står i och när du senast loggade in eller betalade.</p></div>
  <div class="glas kort steg">${ikon('kalender')}<h3>Vi räknar ut fristen</h3><p>Varje kö har egna regler. Vi vet vilka och räknar ut när det är dags nästa gång.</p></div>
  <div class="glas kort steg">${ikon('klocka2')}<h3>Påminnelse i kalendern eller mejlen</h3><p>30, 7 och 1 dag innan, i telefonens kalender eller i inkorgen. Du loggar in eller betalar, trycker Klart, och nästa frist räknas fram.</p></div>
</section>

<h2>Köerna vi håller koll på</h2>
<section class="rutnat">${KOER.map(kokort).join('\n')}</section>

${anmalan(null)}

<h2>Vanliga frågor</h2>
${faqHtml(startFragor)}
`,
  skript: '<script type="module" src="/app.js"></script>',
});

// ---------- En sida per kö ----------
function kosida(k) {
  const fragor = [
    [`Hur behåller jag min plats i ${k.namn}?`, `${k.atgard} ${manader(k.intervall_dagar)}. ${k.krav}`],
    [`Vad händer om jag missar det?`, /^uppgift saknas/i.test(k.konsekvens) ? `${k.namn} skriver inte vad som händer.` : k.konsekvens],
    [`Kostar det att stå i kö hos ${k.namn}?`, /^uppgift saknas/i.test(k.avgift) ? `${k.namn} anger ingen avgift på sin webbplats.` : k.avgift],
  ];
  const f = (namn, v) => `<div class="f"><dt>${namn}</dt><dd>${varde(v)}</dd></div>`;
  const titel = `${k.namn}: så behåller du din köplats (${KONTROLLERAD.slice(0, 4)})`;
  return sida({
    sokvag: `/ko/${k.slug}/`,
    titel,
    beskrivning: `${k.atgard} ${manader(k.intervall_dagar)} för att inte tappa din kötid i ${k.namn}. Avgift, regler och vad som händer om du missar. Få en gratis påminnelse.`,
    jsonld: [faqLd(fragor), {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bostadskoll', item: SAJT + '/' },
        { '@type': 'ListItem', position: 2, name: 'Köerna', item: SAJT + '/koer/' },
        { '@type': 'ListItem', position: 3, name: k.namn, item: `${SAJT}/ko/${k.slug}/` },
      ],
    }],
    innehall: `
<nav class="brodsmulor"><a href="/">Bostadskoll</a> › <a href="/koer/">Köerna</a> › ${esc(k.namn)}</nav>
<section class="sidhuvud">
  <span class="kapsel">${esc(k.typ)} · ${esc(k.stad)}</span>
  <h1>${esc(k.namn)}: så behåller du din köplats</h1>
</section>
<div class="sammanfattning glas">${ikon('klocka')}<div><strong>${esc(k.atgard)} ${manader(k.intervall_dagar)}.</strong> <span class="mjuk">Annars riskerar du kötiden du samlat.</span></div></div>

<h2>Reglerna</h2>
<section class="fakta glas"><dl>
${f('Det här krävs', k.krav)}
${f('Avgift', k.avgift)}
${f('Om du missar', k.konsekvens)}
${f('Frist efteråt', k.karens)}
${f('Ålder', k.alder)}
</dl></section>
<p class="kallor">Källa: ${k.kalla.map((u) => `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(u.replace(/^https?:\/\//, ''))}</a>`).join(', ')}. Kontrollerad ${KONTROLLERAD}. Reglerna kan ändras, så dubbelkolla hos <a href="${esc(k.url)}" rel="nofollow noopener" target="_blank">${esc(k.namn)}</a>.</p>

${anmalan(k)}

<h2>Frågor om ${esc(k.namn)}</h2>
${faqHtml(fragor)}

<h2>Andra köer</h2>
<section class="rutnat">${KOER.filter((x) => x.slug !== k.slug).slice(0, 6).map(kokort).join('\n')}</section>
`,
    skript: '<script type="module" src="/app.js"></script>',
  });
}

// ---------- Alla köer ----------
const koerSida = sida({
  sokvag: '/koer/',
  titel: 'Bostadsköer i Sverige: avgifter och krav för att behålla köplatsen',
  beskrivning: 'Regler för att behålla platsen i bostadskön: årsavgifter, inloggningskrav och vad som händer om du missar, för Boplats, Bostadsförmedlingen, Boplats Syd, SGS, Willhem, HFAB med flera.',
  innehall: `
<section class="sidhuvud">
  <h1>Så behåller du platsen i bostadskön</h1>
  <p class="mjuk">Varje kö har egna regler. Här är vad som krävs och hur ofta, hämtat från köernas egna sidor ${KONTROLLERAD}.</p>
</section>
<section class="fakta glas"><dl>
${KOER.map((k) => `<div class="f"><dt><a href="/ko/${k.slug}/">${esc(k.namn)}</a></dt><dd>${esc(k.atgard)} ${manader(k.intervall_dagar)}. <span class="mjuk">Avgift: ${esc(/^uppgift saknas/i.test(k.avgift) ? 'uppgift saknas' : k.avgift)}</span></dd></div>`).join('\n')}
</dl></section>
${anmalan(null)}
`,
  skript: '<script type="module" src="/app.js"></script>',
});

// ---------- Premium ----------
const pris = (namn, belopp, enhet, punkter, utvald, plan) => `<div class="pris glas${utvald ? ' utvald' : ''}">
  ${utvald ? '<span class="kapsel">Mest prisvärt</span>' : ''}
  <h3>${namn}</h3>
  <div class="belopp">${belopp} <small>${enhet}</small></div>
  <ul>${punkter.map((p) => `<li>${ikon('bock')}<span>${p}</span></li>`).join('')}</ul>
  ${plan ? `<a class="knapp${utvald ? '' : ' sekundar'}" href="#vantelista" data-plan="${plan}">Ställ dig i kö</a>` : '<a class="knapp sekundar" href="/mina-koer/">Kom igång</a>'}
</div>`;
const premium = sida({
  sokvag: '/premium/',
  titel: 'Bostadskoll Premium – bevaka alla dina bostadsköer',
  beskrivning: 'Besked när en kö ändrar sina regler och dina köer på alla enheter. 29 kr i månaden eller 199 kr om året.',
  innehall: `
<section class="hjalte">
  <h1>Alla dina köer, <span class="markerat">en koll</span></h1>
  <p class="ingress">Står du i flera köer? Premium säger till när en kö ändrar sina regler och har dina köer på alla enheter, så att du aldrig missar något.</p>
</section>
<section class="priser">
  ${pris('Gratis', '0 kr', '', ['Alla dina köer', 'Påminnelse i kalendern eller mejlen 30, 7 och 1 dag innan', 'Regler för alla köer'], false, null)}
  ${pris('Premium månad', '29 kr', '/ månad', ['Allt i Gratis', 'Besked när en kö ändrar sina regler', 'Dina köer på alla enheter'], false, 'manad')}
  ${pris('Premium år', '199 kr', '/ år', ['Allt i Premium', 'Motsvarar 17 kr i månaden', 'En betalning om året'], true, 'ar')}
</section>
<section class="cta glas" id="vantelista">
  <h2>Premium öppnar snart</h2>
  <p class="mjuk">Skriv upp dig så hör vi av oss när det går att teckna. Inga betalningar tas ut nu.</p>
  <form class="rad" data-vantelista>
    <input type="email" name="epost" placeholder="din@mejl.se" autocomplete="email" required aria-label="Mejladress">
    <select name="plan" aria-label="Plan"><option value="ar">199 kr / år</option><option value="manad">29 kr / månad</option></select>
    <button class="knapp" type="submit">Skriv upp mig</button>
  </form>
  <div class="meddelande" role="status"></div>
</section>
`,
  skript: '<script type="module" src="/app.js"></script>',
});

// ---------- Mina köer (appen) ----------
const mina = sida({
  sokvag: '/mina-koer/',
  titel: 'Mina köer – Bostadskoll',
  beskrivning: 'Dina bevakade bostadsköer och när det är dags att logga in eller betala.',
  innehall: `
<section class="sidhuvud">
  <h1>Mina köer</h1>
  <p class="mjuk" id="status">&nbsp;</p>
</section>
<div class="lista" id="lista"></div>
<p><button class="knapp sekundar liten" id="allaikalendern" hidden>${ikon('kalender')}Alla i kalendern</button></p>
<div class="lagg-till glas">
  <h3>${ikon('plus')} Lägg till en kö</h3>
  ${paminnForm(null, 'nyform')}
  <div class="meddelande" role="status"></div>
</div>
<div class="lagg-till glas mejlkort">
  <h3>${ikon('kuvert')} Påminnelser i mejlen</h3>
  <p class="mjuk">Vi mejlar dig 30, 7 och 1 dag innan för alla köerna ovan. Du bekräftar din adress först, och varje mejl har en länk för att sluta.</p>
  ${mejlForm(true)}
</div>
`,
  skript: '<script type="module" src="/app.js"></script>',
});

const integritet = sida({
  sokvag: '/integritet/',
  titel: 'Integritet – Bostadskoll',
  beskrivning: 'Så hanterar Bostadskoll dina uppgifter.',
  innehall: `
<section class="sidhuvud"><h1>Integritet</h1></section>
<section class="glas kort" style="padding:28px">
<p>Köerna du lägger in och datumen sparas i din egen webbläsare. Väljer du påminnelser i kalendern stannar allt hos dig.</p>
<p>Väljer du påminnelser i mejlen sparar vi din mejladress, vilka köer du står i och datumen, bara för att kunna mejla dig. Inget sparas förrän du bekräftat adressen via mejlet vi skickar. Varje påminnelse har en länk för att avregistrera dig, och då raderar vi adressen och köerna direkt.</p>
<p>Skriver du upp dig för Premium sparar vi bara mejladressen, och bara för att höra av oss när det öppnar.</p>
<p>Vi ber aldrig om BankID, personnummer eller inloggningsuppgifter till bostadsköerna, och vi loggar inte in åt dig.</p>
<p>Uppgifterna lagras hos Supabase inom EU. Mejlen skickas via Resend.</p>
</section>`,
});

const fyra = sida({ sokvag: '/404', titel: 'Sidan finns inte – Bostadskoll', beskrivning: 'Sidan finns inte.', innehall: `<section class="hjalte"><h1>Sidan finns inte</h1><p class="ingress">Den kan ha flyttat.</p><a class="knapp" href="/">Till startsidan</a></section>` });

// ---------- Skriv ut ----------
rmSync(UT, { recursive: true, force: true });
const skriv = (fil, txt) => { mkdirSync(fil.split('/').slice(0, -1).join('/'), { recursive: true }); writeFileSync(fil, txt); };
skriv(`${UT}/index.html`, start);
skriv(`${UT}/koer/index.html`, koerSida);
skriv(`${UT}/premium/index.html`, premium);
skriv(`${UT}/mina-koer/index.html`, mina);
skriv(`${UT}/integritet/index.html`, integritet);
skriv(`${UT}/404.html`, fyra);
for (const k of KOER) skriv(`${UT}/ko/${k.slug}/index.html`, kosida(k));
copyFileSync('src/stil.css', `${UT}/stil.css`);
copyFileSync('src/ikon.svg', `${UT}/ikon.svg`);

const urls = ['/', '/koer/', '/premium/', ...KOER.map((k) => `/ko/${k.slug}/`)];
skriv(`${UT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SAJT}${u}</loc><lastmod>${KONTROLLERAD}</lastmod></url>`).join('\n')}\n</urlset>\n`);
skriv(`${UT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SAJT}/sitemap.xml\n`);
mkdirSync(`${UT}/api`, { recursive: true });
for (const f of readdirSync('src/api')) copyFileSync(`src/api/${f}`, `${UT}/api/${f}`);
copyFileSync('src/koer.js', `${UT}/api/_koer.mjs`);
skriv(`${UT}/vercel.json`, readFileSync('vercel.json', 'utf8'));

await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${UT}/app.js`, logLevel: 'warning' });
console.log(`Byggt ${urls.length + 3} sidor till ${UT}/ för ${SAJT}`);
