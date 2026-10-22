/**
 * npm run refresh:bls (TopTechHR KICKOFF §3, ported unchanged from Key Personnel §4c): for every indicator in the pinned
 * pack's indicators.yaml (pack/key-personnel/content-pack, or PACK_DIR) with a non-empty `series`,
 * request the latest value from the BLS Public Data API v1 and write public/data/benchmarks/latest.json
 * ({ fetchedAt, endpoint, series: [{ series, period, year, periodName, value, status, error? }] }).
 * The pack's own figures are never touched. One request per series, no retry loop (a failure is reported, not retried). Exits non-zero if any request failed, but
 * writes every series' result first, so the others' output stays in place. Not part of `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { BLS_V1, parseBls } from './lib/bls.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/data/benchmarks/latest.json');
const PACK = path.resolve(process.env.PACK_DIR ?? path.join(ROOT, 'pack/key-personnel/content-pack'));
const indicators = yaml.load(fs.readFileSync(path.join(PACK, 'indicators.yaml'), 'utf8'));
const series = [...new Set(indicators.map((i) => String(i.series ?? '').trim()).filter(Boolean))];

const rows = [];
for (const s of series) {
  try {
    const res = await fetch(BLS_V1 + encodeURIComponent(s), { headers: { 'User-Agent': 'toptechhr-refresh (github.com/danieladamek/toptechhr)' } });
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    rows.push(parseBls(s, json, res.status));
  } catch (e) {
    rows.push({ series: s, period: null, year: null, periodName: null, value: null, status: 'error', error: String(e?.message ?? e) });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), endpoint: BLS_V1, series: rows }, null, 2) + '\n');
for (const r of rows) console.log(`${r.status === 'ok' ? 'ok   ' : 'FAIL '} ${r.series} ${r.status === 'ok' ? `${r.periodName} ${r.year} = ${r.value}` : r.error}`);
if (rows.some((r) => r.status !== 'ok')) { console.error(`${rows.filter((r) => r.status !== 'ok').length} of ${rows.length} series failed; the rest are written to ${path.relative(ROOT, OUT)}`); process.exit(1); }
