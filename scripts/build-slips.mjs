// Turns reviewed Gemini output (out/*.json) into src/domain/slips.ts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [outDir, target] = process.argv.slice(2);
const ORDER = ['senang', 'semangat', 'tenang', 'rindu', 'lelah', 'cemas', 'sedih', 'marah'];
const KINDS = ['afirmasi', 'pertanyaan', 'penyemangat', 'langkah'];
const PREFIX = { afirmasi: 'af', pertanyaan: 'tn', penyemangat: 'ps', langkah: 'lk' };
const drop = existsSync(`${outDir}/drop.json`) ? JSON.parse(readFileSync(`${outDir}/drop.json`, 'utf8')) : [];

const clean = (t) =>
  t
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^["“]|["”]$/g, '')
    .trim();

const lines = [];
const report = [];
for (const emotion of ORDER) {
  if (!existsSync(`${outDir}/${emotion}.json`)) { report.push(`${emotion}: MISSING`); continue; }
  const items = JSON.parse(readFileSync(`${outDir}/${emotion}.json`, "utf8"));
  const seen = new Set();
  const counters = {};
  let kept = 0;
  for (const it of items) {
    if (!KINDS.includes(it.kind)) continue;
    const text = clean(it.text);
    const key = text.toLowerCase().replace(/[^a-z]/g, '');
    if (!text || text.length > 130 || seen.has(key) || drop.includes(text)) continue;
    seen.add(key);
    counters[it.kind] = (counters[it.kind] ?? 0) + 1;
    const id = `${emotion}-${PREFIX[it.kind]}${String(counters[it.kind]).padStart(2, '0')}`;
    lines.push(`  { id: ${JSON.stringify(id)}, emotion: '${emotion}', kind: '${it.kind}', text: ${JSON.stringify(text)} },`);
    kept++;
  }
  report.push(`${emotion}: ${kept}/${items.length}`);
}

writeFileSync(
  target,
  `import type { Slip } from './types';

/**
 * Isi gulungan kertas di botol perasaan. Dibuat dengan Gemini, lalu dikurasi.
 * Disimpan sebagai data tetap: aplikasi tidak memanggil AI dan tidak mengirim data apa pun.
 * Regenerasi: lihat scripts/README-slips.md.
 */
export const SLIPS: Slip[] = [
${lines.join('\n')}
];
`
);
console.log(report.join('\n'));
