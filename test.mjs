import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { KOER, frist } from './src/koer.js';
import { kalenderfil } from './src/kalender.js';

// Regeldata komplett
const slugs = new Set();
for (const k of KOER) {
  for (const f of ['slug', 'namn', 'stad', 'atgard', 'atgard_kort', 'krav', 'konsekvens', 'url']) assert.ok(k[f], `${k.slug}: ${f}`);
  assert.ok(k.intervall_dagar > 30 && k.intervall_dagar <= 400, k.slug);
  assert.ok(k.kalla.length && k.kalla.every((u) => u.startsWith('https://')), k.slug);
  assert.ok(!slugs.has(k.slug)); slugs.add(k.slug);
}
// Frist
assert.equal(frist('2026-01-01', 365, new Date(2026, 0, 1)).dagarKvar, 365);
assert.equal(frist('2025-11-25', 365, new Date(2026, 10, 24)).dagarKvar, 1);
assert.equal(frist('2025-01-01', 365, new Date(2026, 10, 24)).dagarKvar < 0, true);
// Kalenderfil
const ics = kalenderfil([{ ko: KOER[0], senast: '2026-01-15' }, { ko: KOER.find((k) => k.slug === 'boplats-syd'), senast: '2026-11-01' }], 'https://x.se');
assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 6);
assert.match(ics, /DTSTART;VALUE=DATE:20270115/);
assert.match(ics, /RRULE:FREQ=YEARLY/);
assert.match(ics, /RRULE:FREQ=MONTHLY;INTERVAL=6/);
for (const rad of ics.split('\r\n')) assert.ok(new TextEncoder().encode(rad).length <= 75, 'radlängd: ' + rad);
// Bygget
for (const f of ['index.html', 'koer/index.html', 'premium/index.html', 'mina-koer/index.html', 'sitemap.xml', 'robots.txt', 'app.js', 'stil.css', 'ikon.svg', 'vercel.json', ...KOER.map((k) => `ko/${k.slug}/index.html`)]) assert.ok(existsSync('dist/' + f), f);
const kosida = readFileSync('dist/ko/boplats-syd/index.html', 'utf8');
assert.match(kosida, /data-paminn data-ko="boplats-syd"/);
assert.match(kosida, /application\/ld\+json/);
// Mejlpåminnelser: serverfunktionerna finns i bygget och fungerar utan nätverk där det går
for (const f of ['api/mejl.mjs', 'api/bekrafta.mjs', 'api/avregistrera.mjs', 'api/klar.mjs', 'api/paminnelser.mjs', 'api/_lib.mjs', 'api/_koer.mjs']) assert.ok(existsSync('dist/' + f), f);
assert.match(kosida, /data-mejl/);
assert.match(readFileSync('dist/mina-koer/index.html', 'utf8'), /data-mejl data-alla/);
assert.ok(JSON.parse(readFileSync('dist/vercel.json', 'utf8')).crons[0].path.startsWith('/api/paminnelser'));
{
  const lib = await import('./dist/api/_lib.mjs');
  assert.equal(lib.plusDagar('2025-11-24', 365), '2026-11-24');
  assert.equal(lib.idagSverige(new Date('2026-11-23T23:30:00Z')), '2026-11-24');
  assert.ok(lib.epostOk('a@b.se') && !lib.epostOk('a b@c.se') && !lib.epostOk('x'));
  process.env.MEJL_TILLATNA = 'min@mejl.se';
  assert.ok(lib.farMejlas('Min@Mejl.se') && !lib.farMejlas('annan@mejl.se'));
  await assert.rejects(lib.skickaMejl({ till: 'annan@mejl.se', amne: 'x', html: 'x', text: 'x' }));
  assert.ok(!lib.esc('<a href="x">').includes('<'));
  const mejl = await import('./dist/api/mejl.mjs');
  const anrop = (b) => mejl.POST(new Request('https://x/api/mejl/', { method: 'POST', body: JSON.stringify(b) }));
  assert.equal((await anrop({ epost: 'fel', koer: [] })).status, 400);
  assert.equal((await anrop({ epost: 'min@mejl.se', koer: [{ slug: 'finns-inte', senast: '2026-01-01' }] })).status, 400);
  assert.equal((await anrop({ epost: 'min@mejl.se', koer: [{ slug: 'boplats-syd', senast: '2999-01-01' }] })).status, 400);
  const p = await import('./dist/api/paminnelser.mjs');
  assert.equal((await p.GET(new Request('https://x/api/paminnelser/'))).status, 401);
  const m = p.paminnelse({ ko_slug: 'boplats-syd', avreg: 'a'.repeat(64), deadline: '2026-12-01', dagar_kvar: 7 });
  assert.match(m.amne, /om 7 dagar/);
  assert.match(m.html, /api\/avregistrera\/\?t=a{64}/);
  assert.match(m.html, /api\/klar\/\?t=a{64}&amp;ko=boplats-syd/);
  assert.match(p.paminnelse({ ko_slug: 'boplats-syd', avreg: 'a'.repeat(64), deadline: '2026-12-01', dagar_kvar: 0 }).amne, /Sista dagen/);
  const av = await import('./dist/api/avregistrera.mjs');
  assert.equal((await av.GET(new Request('https://x/api/avregistrera/?t=kort'))).status, 400);
  assert.match(await (await av.GET(new Request('https://x/api/avregistrera/?t=' + 'b'.repeat(64)))).text(), /method="post"/);
}
console.log('Alla tester gick igenom');
