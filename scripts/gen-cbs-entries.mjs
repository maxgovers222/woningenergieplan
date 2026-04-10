import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('./scripts/cbs-wijken-data.json', 'utf8'));

function toSlug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const ROOD = new Set(['amsterdam', 'rotterdam', 'den-haag', 'utrecht', 'eindhoven', 'tilburg']);

const seedContent = readFileSync('./scripts/seed-wijken.ts', 'utf8');
const existingSlugs = new Set();
for (const m of seedContent.matchAll(/wijk: '([^']+)',\s*stad: '([^']+)',\s*provincie: '([^']+)'/g)) {
  existingSlugs.add(m[3] + '/' + toSlug(m[2]) + '/' + toSlug(m[1]));
}
console.log('Bestaand in script:', existingSlugs.size);

const seen = new Set();
const clean = data
  .filter(w => !/^Wijk \d+/.test(w.wijknaam) && w.woningen >= 500)
  .map(w => ({ ...w, wijknaam: w.wijknaam.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, ' ') }))
  .filter(w => w.wijknaam.length >= 3)
  .filter(w => {
    const slug = w.provincie + '/' + toSlug(w.gemeentenaam) + '/' + toSlug(w.wijknaam);
    if (existingSlugs.has(slug) || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  })
  .sort((a, b) => b.woningen - a.woningen);

console.log('Nieuwe unieke wijken:', clean.length);
console.log('Top 5:', clean.slice(0, 5).map(w => `${w.wijknaam} (${w.gemeentenaam}): ${w.woningen}`));

const entries = clean.map(w => {
  const net = ROOD.has(toSlug(w.gemeentenaam)) ? 'ROOD' : w.woningen > 5000 ? 'ORANJE' : 'GROEN';
  const bj = w.woningen > 10000 ? 1985 : w.woningen > 5000 ? 1975 : 1978;
  return `  { wijk: ${JSON.stringify(w.wijknaam)}, stad: ${JSON.stringify(w.gemeentenaam)}, provincie: ${JSON.stringify(w.provincie)}, bouwjaar: ${bj}, netcongestie: ${JSON.stringify(net)}, aantalWoningen: ${w.woningen} },`;
});

writeFileSync('./scripts/cbs-entries.txt', entries.join('\n'));
console.log('Opgeslagen:', entries.length, 'entries in scripts/cbs-entries.txt');
