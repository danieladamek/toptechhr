import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';
import { buildMatcher, escapeCurrency, expandCitation, findAmbiguousVariants, isAllCaps, linkCitations, linkTerms, segment, unlink } from '../../scripts/lib/linker';
import MathMarkdown from '../../src/components/reader/MathMarkdown';

const TERMS = [
  { id: 'interview', term: 'interview', variants: ['interviews'] },
  { id: 'structured-interview', term: 'structured interview', variants: ['structured interviews'] },
  { id: 'far', term: 'FAR', variants: ['Federal Acquisition Regulation'] },
  { id: 'labor-category', term: 'labor category', variants: ['labor categories', 'LCAT'] },
];
const m = buildMatcher(TERMS);

describe('term matcher', () => {
  it('links whole words, case-insensitively, first occurrence per section only', () => {
    const r = linkTerms('An interview and another Interview; interviews too.', m);
    expect(r.text).toBe('An [interview](#term:interview) and another Interview; interviews too.');
    expect(r.linked).toEqual(['interview']);
    expect(r.occurrences.interview).toBe(3);
  });
  it('links every occurrence when asked', () => {
    expect(linkTerms('FAR and FAR.', m, { everyOccurrence: true }).text).toBe('[FAR](#term:far) and [FAR](#term:far).');
  });
  it('respects word boundaries — no match inside a word or across a hyphen', () => {
    expect(linkTerms('FAR-based and FARs and AFAR.', m).text).toBe('FAR-based and FARs and AFAR.');
  });
  it('longest match wins, and the shorter term is not linked inside the longer one', () => {
    expect(linkTerms('A structured interview is an interview.', m).text).toBe('A [structured interview](#term:structured-interview) is an [interview](#term:interview).');
  });
  it('skips headings, code, maths, links and HTML comments', () => {
    const md = '# FAR heading\n\nText FAR here. `FAR` code. $FAR$ maths. [FAR link](http://x) <!-- FAR --> and\n\n```\nFAR\n```\n';
    const r = linkTerms(md, m);
    expect(r.text).toContain('# FAR heading');
    expect(r.text).toContain('Text [FAR](#term:far) here.');
    expect(r.text).toContain('`FAR` code. $FAR$ maths. [FAR link](http://x) <!-- FAR -->');
    expect(r.linked).toEqual(['far']);
  });
  it('all-caps variants are case-sensitive, so "far" the adverb is not linked', () => {
    expect(isAllCaps('FAR')).toBe(true);
    expect(linkTerms('So far the FAR is silent.', m).text).toBe('So far the [FAR](#term:far) is silent.');
  });
  it('reports ambiguous variants across terms', () => {
    expect(findAmbiguousVariants(TERMS)).toEqual([]);
    expect(findAmbiguousVariants([...TERMS, { id: 'other', term: 'Other', variants: ['lcat'] }])).toEqual([{ variant: 'lcat', ids: ['labor-category', 'other'] }]);
  });
  it('segment keeps sup/sub inside text but skips other tags', () => {
    expect(segment('a<sup>b</sup> <em>c</em>').filter((s) => s.skip).map((s) => s.text)).toEqual(['<em>', '</em>']);
  });
});

describe('this pack’s vocabulary on the real glossary (KICKOFF §5: longest match)', () => {
  const glossary = yaml.load(fs.readFileSync(path.join(ROOT, 'pack/key-personnel/content-pack/glossary.yaml'), 'utf8')) as { id: string; term: string; variants: string[] }[];
  const real = buildMatcher(glossary);
  it('"key-personnel substitution" does not link as "key personnel clause"', () => {
    const r = linkTerms('The key-personnel substitution follows the key personnel clause.', real, { everyOccurrence: true });
    expect(r.text).toContain('[key-personnel substitution](#term:key-personnel-substitution)');
    expect(r.text).not.toMatch(/\[key-personnel[^\]]*\]\(#term:key-personnel-clause\) substitution/);
    expect(r.text).toContain('[key personnel clause](#term:key-personnel-clause)');
  });
  it('no variant is claimed by two terms', () => {
    expect(findAmbiguousVariants(glossary)).toEqual([]);
  });
});

describe('citations', () => {
  it('expands lists and ranges', () => {
    expect(expandCitation('1')).toEqual([1]);
    expect(expandCitation('91,81,95')).toEqual([91, 81, 95]);
    expect(expandCitation('3–5')).toEqual([3, 4, 5]);
  });
  it('links tokens outside skip zones', () => {
    const r = linkCitations('Claim [1,2] and [3–5]. Not `[9]`.');
    expect(r.text).toBe('Claim [1,2](#cite:1,2) and [3–5](#cite:3,4,5). Not `[9]`.');
    expect(r.cites).toEqual([1, 2, 3, 4, 5]);
  });
  it('unlink restores the original text', () => {
    const src = 'A structured interview predicts [1,2].';
    expect(unlink(linkCitations(linkTerms(src, m).text).text)).toBe(src);
  });
});

describe('dollar signs are currency, not maths (KICKOFF §3.4a)', () => {
  const block = '$1,200 for one and $10,625 for the other [196]';
  it('escapes every $ followed by a digit, idempotently, and leaves maths alone', () => {
    expect(escapeCurrency(block)).toBe('\\$1,200 for one and \\$10,625 for the other [196]');
    expect(escapeCurrency(escapeCurrency(block))).toBe(escapeCurrency(block));
    expect(escapeCurrency('the correlation $r$ and $\\bar{x}_1$')).toBe('the correlation $r$ and $\\bar{x}_1$');
  });
  it('the term linker does not treat escaped amounts as a maths skip zone', () => {
    const r = linkTerms(escapeCurrency('$1,200 per interview and $10,625 for another interview'), m, { everyOccurrence: true });
    expect(r.text).toContain('[interview](#term:interview)');
  });
  it('a block reading "$1,200 for one and $10,625 for the other [196]" renders both amounts and no maths span', () => {
    const html = renderToStaticMarkup(createElement(MathMarkdown, { md: linkCitations(escapeCurrency(block)).text }));
    expect(html).toContain('$1,200');
    expect(html).toContain('$10,625');
    expect(html).not.toContain('katex');
  });
  it('a primer’s $r$ still renders as maths', () => {
    const html = renderToStaticMarkup(createElement(MathMarkdown, { md: escapeCurrency('The correlation $r$ cost $1,200.') }));
    expect(html).toContain('katex');
    expect(html).toContain('$1,200');
  });
});
