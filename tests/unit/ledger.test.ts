import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';

const data = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));

describe('the hypothesis ledger (KICKOFF §1, §5)', () => {
  const ledger = data('hypotheses.json') as { adjudicated_counts: Record<string, number>; counts: Record<string, number>; entries: { id: string; status: string; original: unknown }[] };
  it('counts by status equal adjudicated_counts', () => {
    const counts: Record<string, number> = {};
    for (const e of ledger.entries) counts[e.status] = (counts[e.status] ?? 0) + 1;
    for (const [k, v] of Object.entries(ledger.adjudicated_counts)) expect(counts[k] ?? 0).toBe(v);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(ledger.entries.length);
  });
  it('a hypothesis is never rendered outside /methods and the legacy lines: its guess text appears in no other data file the app loads', () => {
    const texts = ledger.entries.flatMap((e) => (typeof e.original === 'string' ? [e.original] : Object.values(e.original as Record<string, unknown>).filter((v): v is string => typeof v === 'string'))).filter((t) => t.length > 30);
    const others = fs.readdirSync(path.join(ROOT, 'src/data')).filter((f) => f.endsWith('.json') && !['hypotheses.json', 'ledger-index.json', 'provenance.json', 'build-errors.json'].includes(f));
    const hay = others.map((f) => fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8')).join('\n');
    // the pack adopted two pattern names as the pathfinder's own question labels; those labels are pack text, not the guess
    const labels = new Set((data('pathfinder.json') as { questions: { options: { label: string }[] }[] }).questions.flatMap((q) => q.options.map((o) => o.label)));
    const leaked = texts.filter((t) => !labels.has(t) && hay.includes(JSON.stringify(t).slice(1, -1)));
    expect(leaked).toEqual([]);
  });
  it('the legacy-line index holds only ids and statuses', () => {
    const idx = data('ledger-index.json') as Record<string, string>;
    expect(Object.keys(idx)).toHaveLength(ledger.entries.length);
    for (const v of Object.values(idx)) expect(['supported', 'partly-supported', 'contradicted', 'unstudied', 'reframed', 'untested']).toContain(v);
  });
});
