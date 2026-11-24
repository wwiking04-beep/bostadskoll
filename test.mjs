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
console.log('Alla tester gick igenom');
