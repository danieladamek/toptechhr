import { describe, expect, it } from 'vitest';
import { buildMatcher } from '../../scripts/lib/linker';
import { parseReview, sentenceStart, wrapSynthesis } from '../../scripts/lib/parse';

const m = buildMatcher([{ id: 'structured-interview', term: 'structured interview', variants: ['structured interviews'] }]);
const md = `<!-- section: abstract -->
## Abstract

A structured interview predicts performance [1].

<!-- section: s1 -->
## 1. The rules

The first fact [1]. The second fact [2]. Both bear on every opening, so they come first. <!-- synthesis --> The rule, an exception, listed four tests [3].
This sentence frames what follows and states no fact of its own, written long enough to cross the twenty-five word gate on its own line.
<!-- framing -->

<!-- figure: fig-a -->

A last paragraph [4].
`;

describe('section and citation parser', () => {
  const p = parseReview(md, m);
  it('splits sections with ids, titles, numbers and depth', () => {
    expect(p.sections.map((s) => [s.id, s.title, s.number, s.depth])).toEqual([['abstract', 'Abstract', null, 2], ['s1', '1. The rules', '1', 2]]);
  });
  it('turns [n] into citation tokens and records every number', () => {
    expect(p.citations).toEqual([1, 2, 3, 4]);
    expect(p.sections[1].chunks.some((c) => c.kind === 'md' && c.md.includes('[2](#cite:2)'))).toBe(true);
  });
  it('an inline <!-- synthesis --> marks only the sentence before it, with a stable id', () => {
    expect(p.synthesis).toHaveLength(1);
    expect(p.synthesis[0].id).toBe('syn-s1-1');
    expect(p.synthesis[0].excerpt).toBe('Both bear on every opening, so they come first.');
    const chunk = p.sections[1].chunks.find((c) => c.kind === 'md' && c.md.includes('data-syn')) as { md: string; synthesis: string[] };
    expect(chunk.synthesis).toEqual(['syn-s1-1']);
    expect(chunk.md).toContain('<mark data-syn="syn-s1-1">Both bear on every opening, so they come first.</mark> The rule');
    expect(chunk.md).not.toContain('<!--');
  });
  it('a <!-- framing --> on the line beneath its block counts the block as framing for the gate', () => {
    expect(p.blocks.framing).toBe(1);
    expect(p.uncited).toEqual([]);
  });
  it('figure markers become figure slots', () => {
    expect(p.figureMarkers).toEqual(['fig-a']);
    expect(p.sections[1].chunks.some((c) => c.kind === 'figure' && c.id === 'fig-a')).toBe(true);
  });
  it('a block of 25 words or more with no citation and no framing is reported, not repaired', () => {
    const bad = parseReview(`<!-- section: x -->\n## X\n\n${'word '.repeat(30)}\n`, m);
    expect(bad.uncited).toHaveLength(1);
    expect(bad.sections[0].chunks.some((c) => c.kind === 'md' && /\[\d/.test(c.md))).toBe(false);
  });
});

describe('currency in the reader body', () => {
  it('escapes dollar amounts in review blocks before linking (KICKOFF §3.4a)', () => {
    const p2 = parseReview('<!-- section: x -->\n## X\n\nA hire cost $1,200 for one and $10,625 for the other [1].\n', m);
    const c = p2.sections[0].chunks[0] as { md: string; hasMath: boolean };
    expect(c.md).toContain('\\$1,200 for one and \\$10,625');
    expect(c.hasMath).toBe(false);
  });
});

describe('sentence boundaries for synthesis', () => {
  it('does not end a sentence at an abbreviation or an initial', () => {
    const t = 'The U.S. Department of Education acted [1]. In Massachusetts v. NIH the court ruled [2]';
    expect(t.slice(sentenceStart(t, t.length))).toBe('In Massachusetts v. NIH the court ruled [2]');
  });
  it('wraps each marked sentence and leaves the rest of the paragraph as written', () => {
    let k = 0;
    const r = wrapSynthesis('One [1]. Two follows. <!-- synthesis --> Three [2].', false, () => `id-${++k}`);
    expect(r.text).toBe('One [1]. <mark data-syn="id-1">Two follows.</mark> Three [2].');
    expect(r.passages).toEqual([{ id: 'id-1', text: 'Two follows.' }]);
  });
});
