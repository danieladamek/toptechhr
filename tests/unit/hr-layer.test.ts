/**
 * tools/validate_hr_layer.py as a test (KICKOFF §5): the real HR layer passes against the pinned pack, and a fixture
 * HR layer fails on each rule — a lever with no entry, a bad gate id, a figure in a plain name, a [n].
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT } from './helpers';

const PACK = path.join(ROOT, 'pack/key-personnel/content-pack');
const HR = path.join(ROOT, 'hr-layer');
const VALIDATOR = path.join(ROOT, 'tools/validate_hr_layer.py');

function run(mutate: (dir: string) => void = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-hr-'));
  fs.cpSync(HR, dir, { recursive: true });
  mutate(dir);
  const r = spawnSync('python3', [VALIDATOR, dir, PACK], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout };
}
const edit = (dir: string, file: string, f: (d: Record<string, unknown>) => void) => {
  const p = path.join(dir, file);
  const d = yaml.load(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
  f(d);
  fs.writeFileSync(p, yaml.dump(d, { lineWidth: -1 }));
};
type Actions = { actions: { lever: string; plain_name: string }[] };
type Rules = { rules: { gate: string; plain_name: string }[] };

describe('validate_hr_layer.py', () => {
  it('passes the HR layer as shipped against the pinned pack', () => {
    const r = run();
    expect(r.out).toContain('0 errors');
    expect(r.code).toBe(0);
  });

  it('fails when a lever has no entry', () => {
    const r = run((d) => edit(d, 'actions.yaml', (x) => { (x as unknown as Actions).actions.shift(); }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/lever l-structured-interview has no entry/);
  });

  it('fails on a gate id that is not in gates.yaml', () => {
    const r = run((d) => edit(d, 'rules.yaml', (x) => { (x as unknown as Rules).rules[0].gate = 'no-such-gate'; }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/gate 'no-such-gate' not in gates\.yaml/);
  });

  it('fails on a figure in a plain name (a percentage or a dollar amount)', () => {
    const pct = run((d) => edit(d, 'actions.yaml', (x) => { (x as unknown as Actions).actions[0].plain_name = 'A structured interview (validity 42%)'; }));
    expect(pct.code).toBe(1);
    expect(pct.out).toMatch(/actions\.yaml: carries a figure/);
    const usd = run((d) => edit(d, 'rules.yaml', (x) => { (x as unknown as Rules).rules[0].plain_name = 'Contracts over $150,000'; }));
    expect(usd.code).toBe(1);
    expect(usd.out).toMatch(/rules\.yaml: carries a figure/);
  });

  it('fails on a [n] citation anywhere in the layer', () => {
    const r = run((d) => edit(d, 'actions.yaml', (x) => { (x as unknown as Actions).actions[0].plain_name = 'A structured interview [1]'; }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/carries a \[n\] citation/);
  });
});
