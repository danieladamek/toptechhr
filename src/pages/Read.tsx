import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import sectionsJson from '@/data/sections.json';
import type { Section } from '@/types';
import { AS_OF, asOfLong, EDITION_URL, manifest } from '@/lib/data';
import Markdown from '@/components/reader/Markdown';
import SectionRail from '@/components/reader/SectionRail';
import ReaderFigure from '@/components/reader/ReaderFigure';
import { QA } from '@/components/notebook/QuoteControl';

const sections = sectionsJson as unknown as Section[];
const HEADINGS = { 1: 'h2', 2: 'h2', 3: 'h3', 4: 'h4' } as const;
const BANNER_KEY = 'toptechhr-banner-dismissed';

function SectionHeading({ depth, number, title, id }: { depth: number; number: string | null; title: string; id: string }) {
  const Tag = HEADINGS[(Math.min(Math.max(depth, 1), 4)) as 1 | 2 | 3 | 4];
  const cls = depth <= 2 ? 'text-2xl sm:text-3xl mt-12' : depth === 3 ? 'text-xl sm:text-2xl mt-8' : 'text-lg sm:text-xl mt-6';
  return (
    <Tag id={`h-${id}`} className={`${cls} scroll-mt-28 group`}>
      {title}{' '}
      <Link to={`/library/guide/${id}`} className="bx-muted text-sm font-body no-underline opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Link to section ${number ?? title}`}>#</Link>
    </Tag>
  );
}

/** The commissioned-guide notice (DESIGN-SYSTEM §3.1). Dismissal is per browser; the as_of chip never hides. */
function Banner() {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; } });
  if (dismissed) return null;
  return (
    <div className="bx-banner no-print" data-testid="review-banner">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-[16px]">
          Written by the {manifest.builder.name} from {manifest.references.toLocaleString()} sources, current as of {asOfLong()}.
          Every claim is cited; passages marked <em>synthesis</em> draw conclusions the cited works do not individually state.
          This is the Key Personnel guide, shown here as written: <strong>not peer reviewed, not official, not advice</strong>.
        </p>
        <button type="button" className="bx-btn !py-0.5 !px-2" onClick={() => { setDismissed(true); try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ } }} aria-label="Dismiss the commissioned-guide notice">×</button>
      </div>
    </div>
  );
}

/**
 * Library → Guide: the Key Personnel reader, ported (KICKOFF §4d) — the contents rail, review.md rendered as written,
 * <Term> popovers, citation fold-outs, figure slots, synthesis marks. Each section is a quote anchor for the Notebook.
 */
export default function Read({ sectionId }: { sectionId?: string }) {
  const [active, setActive] = useState<string | null>(sectionId ?? null);

  useEffect(() => {
    if (!sectionId) return;
    const go = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    requestAnimationFrame(go);
    const t = setTimeout(go, 300);
    return () => clearTimeout(t);
  }, [sectionId]);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="xl:grid xl:gap-10 xl:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="hidden xl:block" aria-label="Contents"><div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2"><SectionRail active={active} variant="rail" /></div></aside>
      <div className="min-w-0">
        <div className="xl:hidden mb-4"><SectionRail active={active} variant="select" /></div>
        <article className="bx-reader" aria-label="The Key Personnel guide">
          <header>
            <p className="flex flex-wrap items-center gap-2 no-print">
              <span className="bx-status">COMMISSIONED GUIDE — NOT PEER REVIEWED · NOT ADVICE</span>
              <span className="bx-asof" data-testid="read-asof">Current as of {AS_OF}</span>
            </p>
            <h1 className="text-[30px] sm:text-[38px] leading-tight mt-3">{manifest.title}</h1>
            <p className="mt-3 text-[15px] bx-muted no-print">
              {manifest.authors.join(', ')} · about {manifest.reading_minutes} minutes. Dotted terms open the glossary; bracketed numbers open the reference
              behind the claim; a dashed underline marked <span className="bx-syn-label !ml-0">synthesis</span> is a conclusion the cited works do not individually state.
              Selecting a passage offers <strong>Quote</strong>, which carries it and its sources into the Notebook.
            </p>
            <Banner />
          </header>
          {sections.map((s) => (
            <QA as="section" key={s.id} route={`/library/guide/${s.id}`} type="sections" id={s.id} section={s.id} title={`Guide: ${s.title}`} asOf={AS_OF} cites={s.cites}>
              <div id={s.id} data-section={s.id} className="scroll-mt-28">
                <SectionHeading depth={s.depth} number={s.number} title={s.title} id={s.id} />
                {s.chunks.map((c, i) => (c.kind === 'figure' ? <ReaderFigure key={i} id={c.id} /> : <Fragment key={i}><Markdown md={c.md} math={c.hasMath} /></Fragment>))}
              </div>
            </QA>
          ))}
          <p className="mt-12 text-[15px] bx-muted no-print">
            End of the guide. <Link to="/plan">Your plan →</Link> · <Link to="/library/sources">All {manifest.references.toLocaleString()} sources →</Link> · <Link to="/library/methods">How this was built and what it does not cover →</Link> · <a href={EDITION_URL} target="_blank" rel="noreferrer">The full evidence edition ↗</a>
          </p>
        </article>
      </div>
    </div>
  );
}
