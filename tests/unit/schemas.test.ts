import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { editYaml, runBuild } from './helpers';

type Rec = Record<string, unknown>;
const has = (errors: { where: string; message: string }[], where: RegExp, message: RegExp) => errors.some((e) => where.test(e.where) && message.test(e.message));

describe('content build on the fixture pack', () => {
  it('the clean fixture builds with 0 errors', () => {
    const r = runBuild();
    expect(r.errors).toEqual([]);
    expect(r.code).toBe(0);
    expect(r.buildErrorsMd).toBeNull();
  });

  it('a link whose endpoint is not a record fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'links.yaml', (x) => { x[0].to = 'c-nowhere'; }));
    expect(r.code).toBe(1);
    expect(has(r.errors, /^links\/k-001$/, /to -> c-nowhere is not a record/)).toBe(true);
    expect(r.buildErrorsMd).toContain('c-nowhere');
  });

  it('a constraint with a situations tag outside the pathfinder vocabulary fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'constraints.yaml', (x) => { (x[0].situations as string[]).push('needs-a-unicorn'); }));
    expect(has(r.errors, /^constraints\/c-one$/, /situations -> needs-a-unicorn is not a pathfinder pattern or condition tag/)).toBe(true);
  });

  it('a state record missing an overlay fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'states.yaml', (x) => { delete x[0].mini_warn; }));
    expect(has(r.errors, /^states\/us-wa/, /mini_warn|Required/)).toBe(true);
    expect(r.code).toBe(1);
  });

  it('a state overlay missing primary_pending fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'states.yaml', (x) => { delete (x[0].noncompete as Rec).primary_pending; }));
    expect(has(r.errors, /^states\/us-wa\/noncompete\/primary_pending$/, /primary_pending/)).toBe(true);
  });

  it('a lever without what_it_does_not_do fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'levers.yaml', (x) => { delete x[0].what_it_does_not_do; }));
    expect(has(r.errors, /^levers\/l-one\/what_it_does_not_do$/, /limits line/)).toBe(true);
  });

  it('a ledger entry with a bad status fails', () => {
    const r = runBuild((d) => editYaml<Rec>(d, 'hypotheses.yaml', (x) => { (x.entries as Rec[])[0].status = 'probably-true'; }));
    expect(has(r.errors, /^hypotheses\/h-A1\/status$/, /status must be one of/)).toBe(true);
  });

  it('the ledger header counts must agree with the entries', () => {
    const r = runBuild((d) => editYaml<Rec>(d, 'hypotheses.yaml', (x) => { (x.adjudicated_counts as Rec).supported = 5; }));
    expect(has(r.errors, /^hypotheses\/adjudicated_counts$/, /supported: header says 5, the entries give 1/)).toBe(true);
  });

  it('a record prose field with an uncited block of 25 words or more fails, and is not repaired', () => {
    const long = 'This sentence carries no citation at all and runs on long enough to cross the twenty-five word gate that the content build applies to every prose field of a record.';
    const r = runBuild((d) => editYaml<Rec[]>(d, 'constraints.yaml', (x) => { x[0].mechanism = long; }));
    expect(has(r.errors, /^constraints\/c-one\/mechanism$/, /uncited record prose of \d+ words/)).toBe(true);
  });

  it('a [n] with no reference fails, wherever it sits', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'gates.yaml', (x) => { x[0].what = 'A rule [99].'; }));
    expect(has(r.errors, /^gates\/g-one\/what$/, /cites \[99\] with no reference entry/)).toBe(true);
    const r2 = runBuild((d) => fs.appendFileSync(path.join(d, 'review.md'), '\nA claim [42].\n'));
    expect(has(r2.errors, /^review\.md$/, /cites \[42\] with no reference entry/)).toBe(true);
  });

  it('a legacy id not in the ledger fails, and a mapped_to id that is not a record fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'levers.yaml', (x) => { x[0].legacy = ['h-Z9']; }));
    expect(has(r.errors, /^levers\/l-one$/, /legacy -> h-Z9 is not in the hypothesis ledger/)).toBe(true);
    const r2 = runBuild((d) => editYaml<Rec>(d, 'hypotheses.yaml', (x) => { (x.entries as Rec[])[0].mapped_to = ['c-ghost']; }));
    expect(has(r2.errors, /^hypotheses\/h-A1$/, /mapped_to -> c-ghost is not a record/)).toBe(true);
  });

  it('a pathfinder row that disagrees with the constraint and pattern records fails', () => {
    const r = runBuild((d) => editYaml<Rec>(d, 'pathfinder.yaml', (x) => { (x.constraints as Rec[])[0].stage = 'offer'; (x.constraints as Rec[])[2].conditions = ['urgent-start']; }));
    expect(has(r.errors, /^pathfinder\/constraints\/c-one$/, /stage offer but constraints\.yaml says select/)).toBe(true);
    expect(has(r.errors, /^pathfinder\/constraints\/c-three$/, /conditions \[urgent-start\] but the constraint's situations give/)).toBe(true);
  });

  it('a lever id a constraint names that does not exist fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'constraints.yaml', (x) => { x[0].levers = ['l-missing']; }));
    expect(has(r.errors, /^constraints\/c-one$/, /levers\[\] -> l-missing is not a lever record/)).toBe(true);
  });

  it('a figure whose declared field is not in its data fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'figures.yaml', (x) => { (x[0].chart as Rec).y = { field: 'rho', label: 'x' }; }));
    expect(has(r.errors, /^figures\/fig-a$/, /chart field rho not in/)).toBe(true);
  });

  it('a link relation outside the four fails', () => {
    const r = runBuild((d) => editYaml<Rec[]>(d, 'links.yaml', (x) => { x[0].relation = 'causes'; }));
    expect(has(r.errors, /^links\/k-001\/relation$/, /relation must be one of precondition \| amplifies \| trade-off \| enables/)).toBe(true);
  });
});
