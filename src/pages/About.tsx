import { Link } from 'react-router-dom';
import { AS_OF, asOfLong, EDITION_URL, manifest, PACK, REPO_URL } from '@/lib/data';
import { useBls, periodText } from '@/lib/bls';
import { S } from '@/strings';

/**
 * `/about` (KICKOFF §4d): what TopTechHR is and is not; the disclaimer in full; the pack tag and the sweep summary;
 * the refresh status; the privacy statement; who built it; the link to Key Personnel; the repo.
 */
export default function About() {
  const bls = useBls();
  const failed = PACK.bls_series.filter((s) => { const r = bls.bySeries.get(s.series); return !r || r.status !== 'ok'; });
  const ok = PACK.bls_series.filter((s) => bls.bySeries.get(s.series)?.status === 'ok');
  const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => <h2 id={id} className="text-[24px] mt-12 scroll-mt-28">{children}</h2>;
  return (
    <div className="mx-auto max-w-[52rem] px-4 lg:px-8 py-10 text-[17px]">
      <h1 className="text-[34px] sm:text-[42px]">{S.aboutH1}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2"><span className="bx-status">NOT PEER REVIEWED · NOT ADVICE · NO FIRM</span><span className="bx-asof" data-testid="about-asof">Evidence as of {AS_OF}</span></p>

      <section className="bx-card p-5 mt-6 border-l-4" style={{ borderLeftColor: 'var(--bx-accent)' }} aria-labelledby="disc-h" data-testid="disclaimer-full">
        <h2 id="disc-h" className="text-[20px]">Disclaimer</h2>
        <p className="mt-1 font-semibold">{manifest.disclaimer}</p>
        <p className="mt-2">{manifest.venue}</p>
      </section>

      <H2>What TopTechHR is</H2>
      <p className="mt-2">The HR edition of Key Personnel. Four questions about an opening — the goal, what is being seen, what is true of the role, and where the work is — return one page: the constraints that match, ranked by how many answers each matches; the actions on them with their evidence grade, the effect as the studies reported it and what each does not do; the rules to check with their dates and text; and the numbers that frame it, each Alabama or Huntsville figure beside its national counterpart. A notebook turns highlighted passages into quotes that keep their sources and exports an action plan.</p>
      <p className="mt-2">One pack, two apps: TopTechHR carries no evidence of its own. Every fact, figure, rule and citation comes from the Key Personnel content pack, pinned at a tag. The evidence edition — the guide in full, the dependency map, every record — is <a href={EDITION_URL} target="_blank" rel="noreferrer">Key Personnel ↗</a>.</p>

      <H2>What it is not</H2>
      <ul className="list-disc pl-5 mt-2 grid gap-1.5">
        <li>Not advice: not legal, HR, compliance or financial advice, and not official. No agency, court, customer or professional body has reviewed or endorsed it.</li>
        <li>Not a recommendation. The Plan ranks by match count and says so; actions are listed with their evidence and their limits, never ordered by merit.</li>
        <li>Not current beyond its date. The pack’s sweep closed on {asOfLong()}; every rule shows its own as-of date.</li>
        <li>Not connected to any firm. No firm is named anywhere, including in examples.</li>
      </ul>

      <H2>The evidence: the pinned pack</H2>
      <dl className="mt-3 grid gap-1 sm:grid-cols-[10rem_1fr]" data-testid="pack-info">
        <dt className="font-semibold">Pack tag</dt><dd><code data-testid="pack-tag">{PACK.tag}</code></dd>
        <dt className="font-semibold">As of</dt><dd>{PACK.as_of}</dd>
        <dt className="font-semibold">Sources</dt><dd>{PACK.references.toLocaleString()}</dd>
        <dt className="font-semibold">Pack repository</dt><dd><a href={PACK.repo} target="_blank" rel="noreferrer">{PACK.repo} ↗</a></dd>
      </dl>
      {PACK.sweep.text && (
        <div className="bx-card p-5 mt-4" data-testid="sweep-summary">
          <p className="tt-eyebrow">{PACK.sweep.heading}</p>
          <p className="mt-2 text-[16px]">{PACK.sweep.text.replace(/\*\*/g, '')}</p>
        </div>
      )}

      <H2 id="refresh">Refresh</H2>
      <p className="mt-2">For the {PACK.bls_series.length} indicators that name a Bureau of Labor Statistics series, the deploy workflow requests the latest value from the BLS public API when the site is built and writes it into the site; the Numbers page shows it beside the pack’s figure and never in place of it. That build-time request is the only thing that reaches outside; no page requests anything while it is read.</p>
      {!bls.loaded ? <p className="bx-muted mt-2" role="status">{S.loading}</p> : !bls.data ? (
        <p className="mt-2" data-testid="refresh-missing">This build carries no refreshed values (the refresh did not run — a local build), so every series stands on the pack’s value alone:</p>
      ) : (
        <p className="mt-2" data-testid="refresh-status">Refreshed {new Date(bls.data.fetchedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC: {ok.length} of {PACK.bls_series.length} series returned a value{failed.length ? '; these did not, and the pack value stands:' : '.'}</p>
      )}
      {bls.loaded && failed.length > 0 && (
        <ul className="mt-2 grid gap-1 text-[15px]" data-testid="refresh-failed">
          {failed.map((s) => { const r = bls.bySeries.get(s.series); return <li key={s.id}><code>{s.series}</code> ({s.id}){r?.error ? ` — ${r.error}` : bls.data ? ' — not in the refresh output' : ''}</li>; })}
        </ul>
      )}
      {bls.loaded && ok.length > 0 && (
        <details className="mt-2 text-[15px]"><summary className="cursor-pointer">Series that returned a value ({ok.length})</summary>
          <ul className="mt-1 grid gap-0.5">{ok.map((s) => { const r = bls.bySeries.get(s.series)!; return <li key={s.id}><code>{s.series}</code> — {r.value} · {periodText(r)} ({S.apiConfirmed})</li>; })}</ul>
        </details>
      )}

      <H2>Privacy</H2>
      <p className="mt-2" data-testid="privacy">Nothing leaves your browser. There is no account, no server and no analytics, and so no cookies and no cookie banner. Start answers, notebooks and the chosen state are kept in this browser’s storage only and never sent anywhere; exporting a notebook makes a file on this device. The fonts are loaded from Google Fonts; nothing else is requested from another site.</p>

      <H2>Who built it</H2>
      <p className="mt-2">The evidence was written by an AI research builder, the {manifest.builder.name} (version {manifest.builder.version}, {manifest.builder.date}), as the Key Personnel content pack. The HR layer — plain names, the Start steps, the moments, the action-plan template, glossary aliases — and this app were built by Claude Code for the Manuscript Interrogator project. Text and figures: {manifest.permissions.text}</p>

      <H2>Source and errors</H2>
      <p className="mt-2">The app’s source: <a href={REPO_URL} target="_blank" rel="noreferrer">{REPO_URL} ↗</a>. An error in the evidence is an error in the pack; it can be reported on the pack’s repository (<a href={`${PACK.repo}/issues`} target="_blank" rel="noreferrer">{PACK.repo}/issues ↗</a>). How the evidence was gathered and what it does not cover is on <Link to="/library/methods">Methods</Link>.</p>
    </div>
  );
}
