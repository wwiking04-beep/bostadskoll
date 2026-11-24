// Kalenderfil (.ics) med påminnelser 30, 7 och 1 dag innan fristen.
import { frist } from './koer.js';

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const txt = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
// RFC 5545: rader högst 75 oktetter, fortsättning börjar med mellanslag
function vik(rad) {
  const ut = [];
  let bit = '';
  let langd = 0;
  for (const tecken of rad) {
    const n = new TextEncoder().encode(tecken).length;
    if (langd + n > (ut.length ? 74 : 75)) { ut.push(bit); bit = ''; langd = 0; }
    bit += tecken; langd += n;
  }
  ut.push(bit);
  return ut.join('\r\n ');
}

function upprepning(intervall) {
  if (intervall >= 360) return 'RRULE:FREQ=YEARLY';
  if (intervall >= 175 && intervall <= 190) return 'RRULE:FREQ=MONTHLY;INTERVAL=6';
  return null;
}

export function handelse(ko, senast, sajt, nu = new Date()) {
  const { datum } = frist(senast, ko.intervall_dagar);
  const slut = new Date(datum); slut.setDate(slut.getDate() + 1);
  const stamp = nu.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const rr = upprepning(ko.intervall_dagar);
  const alarm = (dagar, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(text)}`, `TRIGGER:-P${dagar}D`, 'END:VALARM'];
  return [
    'BEGIN:VEVENT',
    `UID:${ko.slug}-${senast}@bostadskoll`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(datum)}`,
    `DTEND;VALUE=DATE:${ymd(slut)}`,
    ...(rr ? [rr] : []),
    `SUMMARY:${txt(`${ko.namn}: ${ko.atgard.toLowerCase()}`)}`,
    `DESCRIPTION:${txt(`Sista dagen för att behålla kötiden. ${ko.krav}\n\nÖppna kön: ${ko.url}\nRegler: ${sajt}/ko/${ko.slug}/`)}`,
    `URL:${ko.url}`,
    'TRANSP:TRANSPARENT',
    ...alarm(30, `${ko.namn}: 30 dagar kvar`),
    ...alarm(7, `${ko.namn}: en vecka kvar`),
    ...alarm(1, `${ko.namn}: i morgon är sista dagen`),
    'END:VEVENT',
  ];
}

export function kalenderfil(poster, sajt) {
  const rader = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bostadskoll//SV', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Bostadskoll'];
  for (const { ko, senast } of poster) rader.push(...handelse(ko, senast, sajt));
  rader.push('END:VCALENDAR');
  return rader.map(vik).join('\r\n') + '\r\n';
}
