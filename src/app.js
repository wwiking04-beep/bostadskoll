import { createClient } from '@supabase/supabase-js';
import { hittaKo, frist } from './koer.js';
import { kalenderfil } from './kalender.js';

const SUPABASE_URL = 'https://ytprkesajeookoojtlqz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_25fah5wUTWPC-yYnMiK-Vw_YU3USv8u'; // publik nyckel, RLS skyddar datan
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = (p) => `<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IK = {
  bock: svg('<path d="m5.5 12.5 4.2 4.2 8.8-9.4"/>'),
  lank: svg('<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V9a1.5 1.5 0 0 1 1.5-1.5H11"/>'),
  sopor: svg('<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7"/>'),
  kalender: svg('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
};
const lokalDag = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const svDatum = (d) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
const visa = (el, html, ok) => { el.innerHTML = html; el.className = 'meddelande ' + (ok ? 'ok' : 'fel'); };

// ---------- Mina köer sparas i webbläsaren ----------
const NYCKEL = 'bk_koer';
const lasa = () => { try { return JSON.parse(localStorage.getItem(NYCKEL)) || []; } catch { return []; } };
const spara = (l) => localStorage.setItem(NYCKEL, JSON.stringify(l));
function laggTill(slug, senast) {
  const l = lasa().filter((x) => x.slug !== slug);
  l.push({ slug, senast });
  spara(l);
}

function laddaNer(poster, namn) {
  const ics = kalenderfil(poster, location.origin);
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: namn });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- Påminnelseformulären (start, köerna, varje kö) ----------
document.querySelectorAll('form[data-paminn]').forEach((form) => {
  const valj = form.querySelector('select[name=ko]');
  const datum = form.querySelector('input[name=datum]');
  const etikett = form.querySelector('[data-etikett]');
  datum.max = lokalDag();
  const ko = () => hittaKo(form.dataset.ko || valj.value);
  const etikettText = () => { if (etikett) etikett.textContent = 'Senast du ' + ko().atgard_kort; };
  if (valj) valj.addEventListener('change', etikettText);
  etikettText();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const k = ko();
    const med = form.parentElement.querySelector('.meddelande');
    if (!datum.value || datum.value > lokalDag()) { visa(med, 'Välj ett datum som inte ligger i framtiden.', false); return; }
    laggTill(k.slug, datum.value);
    laddaNer([{ ko: k, senast: datum.value }], `bostadskoll-${k.slug}.ics`);
    const { datum: d } = frist(datum.value, k.intervall_dagar);
    visa(med, `Klart. Sista dagen är ${esc(svDatum(d))}, och kalendern påminner dig 30, 7 och 1 dag innan. <a href="/mina-koer/">Mina köer</a>`, true);
  });
});

// ---------- Väntelista för mejlpåminnelser och premium ----------
document.querySelectorAll('[data-plan]').forEach((a) => a.addEventListener('click', () => {
  const sel = $('form[data-vantelista] select');
  if (sel) sel.value = a.dataset.plan;
}));
document.querySelectorAll('form[data-vantelista]').forEach((vf) => vf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const med = vf.parentElement.querySelector('.meddelande');
  const knapp = vf.querySelector('button');
  knapp.disabled = true;
  const { error } = await sb.from('bk_vantelista').insert({ epost: vf.epost.value.trim().toLowerCase(), plan: vf.plan ? vf.plan.value : null });
  knapp.disabled = false;
  if (!error || error.code === '23505') { visa(med, 'Tack! Vi hör av oss när det öppnar.', true); vf.reset(); }
  else visa(med, 'Något gick fel. Kontrollera mejladressen och försök igen.', false);
}));

// ---------- Mina köer ----------
if ($('#lista')) {
  const onskad = new URLSearchParams(location.search).get('ko');
  if (onskad && hittaKo(onskad)) $('#ko').value = onskad;
  $('#ko').dispatchEvent(new Event('change'));
  $('#nyform').addEventListener('submit', () => setTimeout(rita, 0));
  $('#allaikalendern').addEventListener('click', () => {
    const poster = lasa().map((x) => ({ ko: hittaKo(x.slug), senast: x.senast })).filter((x) => x.ko);
    if (poster.length) laddaNer(poster, 'bostadskoll-alla.ics');
  });
  rita();
}

function rita() {
  const lista = $('#lista');
  const poster = lasa().map((x) => ({ ...x, ko: hittaKo(x.slug) })).filter((x) => x.ko);
  $('#allaikalendern').hidden = poster.length < 2;
  $('#status').textContent = poster.length
    ? `Du håller koll på ${poster.length === 1 ? 'en kö' : poster.length + ' köer'}. Sparas bara i den här webbläsaren.`
    : 'Lägg in köerna du står i, så ser du när det är dags nästa gång.';
  if (!poster.length) { lista.innerHTML = ''; return; }
  lista.innerHTML = poster.map((p) => {
    const { ko: k } = p;
    const { datum, dagarKvar } = frist(p.senast, k.intervall_dagar);
    const andel = Math.max(0, Math.min(100, (dagarKvar / k.intervall_dagar) * 100));
    const niva = dagarKvar <= 7 ? 'rod' : dagarKvar <= 30 ? 'gul' : '';
    const text = dagarKvar < 0 ? `Fristen gick ut ${svDatum(datum)}. Kolla med kön direkt.` : `${k.atgard} senast ${svDatum(datum)}`;
    return { dagarKvar, html: `<article class="bevakning glas" data-slug="${k.slug}">
      <div><div class="namn"><a href="/ko/${k.slug}/">${esc(k.namn)}</a></div><div class="mjuk">${esc(text)}</div></div>
      <div class="dagar">${Math.max(dagarKvar, 0)}<small>${dagarKvar === 1 ? 'dag kvar' : 'dagar kvar'}</small></div>
      <div class="matare ${niva}"><span style="width:${andel}%"></span></div>
      <div class="atgarder">
        <button class="knapp liten" data-klar>${IK.bock}Klart idag</button>
        <button class="knapp liten sekundar" data-kal>${IK.kalender}Kalendern</button>
        <a class="knapp liten sekundar" href="${esc(k.url)}" target="_blank" rel="noopener">${IK.lank}Öppna kön</a>
        <button class="knapp liten sekundar" data-bort aria-label="Sluta bevaka">${IK.sopor}</button>
      </div>
    </article>` };
  }).sort((a, b) => a.dagarKvar - b.dagarKvar).map((r) => r.html).join('');
  const slugAv = (el) => el.closest('[data-slug]').dataset.slug;
  lista.querySelectorAll('[data-klar]').forEach((b) => b.addEventListener('click', () => {
    const slug = slugAv(b);
    laggTill(slug, lokalDag());
    rita();
    if (confirm('Klart! Vill du lägga in nästa frist i kalendern?')) laddaNer([{ ko: hittaKo(slug), senast: lokalDag() }], `bostadskoll-${slug}.ics`);
  }));
  lista.querySelectorAll('[data-kal]').forEach((b) => b.addEventListener('click', () => {
    const x = lasa().find((y) => y.slug === slugAv(b));
    laddaNer([{ ko: hittaKo(x.slug), senast: x.senast }], `bostadskoll-${x.slug}.ics`);
  }));
  lista.querySelectorAll('[data-bort]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Sluta bevaka den här kön?')) return;
    spara(lasa().filter((y) => y.slug !== slugAv(b)));
    rita();
  }));
}
