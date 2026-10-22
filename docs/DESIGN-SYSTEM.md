---
type: spec
project: manuscript-interrogator
version: 0.3
---

# DESIGN-SYSTEM — the Bioactive Explorer look, made reusable

**Version 0.3 · 2026-09-20.** Extracted from `CountChocula/` (Bioactive Explorer, commit `f275d5b`, live at barryelderwine.github.io/bioactive-explorer). Every generated app follows this unless the kickoff prompt overrides a named section. The prefix `bx-` is kept so components can be copied straight across.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Build | **Vite 5**, `tsc -b && vite build` | `BASE_PATH` env → `base:` in `vite.config.ts` for GitHub Pages project sites; `404.html` = copy of `index.html` for SPA deep links. |
| UI | **React 18 + TypeScript strict** | `@/` path alias → `src/`. Function components, no class components, no state library — React context for theme/notepad/tray. |
| Routing | `react-router-dom` v6 | `BrowserRouter` with `basename`. All view state that a reader might share goes in the URL (`?section=…`, `?fig=…`, `#term`). |
| Styling | **Tailwind 3**, `darkMode: 'class'` | Semantic CSS variables in `index.css` (below) + a small set of `@layer components` classes. No component library. |
| Maths | **KaTeX** (bundled CSS) | Only where the pack has equations. |
| Charts | **Recharts** for standard charts (line/bar/scatter/area, error bars); **D3** (`d3-force`, `d3-scale`, `d3-shape`) for networks, pathways and anything custom, rendered to inline SVG. | Bioactive Explorer used hand-rolled SVG + 3Dmol.js; the spirit is *data-driven SVG, native to the page*. |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-katex` | For the reader body and the notepad preview. |
| Content pipeline | `scripts/build-content.ts` (Node, run by `npm run build:content`) | Validates the content pack (zod or JSON Schema), links terms, emits `src/data/*.json` + `public/provenance.json`. **Fails loudly** on schema errors, unknown term references, duplicate ids, references without DOI *and* without `url`. Idempotent; cached. Mirrors `scripts/build-data.py` in Bioactive Explorer. |
| Tests | **Vitest** (jsdom) + **Playwright** | Playwright serves `dist/` on :4173; smoke every route, dark mode, 375 px, one popover keyboard path, notepad persistence. |
| CI/CD | GitHub Actions: `npm ci → vitest → build (BASE_PATH) → 404.html → deploy-pages` | `build_type: workflow`. |

## 2. Tokens

```js
// tailwind.config.js → theme.extend
fontFamily: {
  display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
  body:    ['"Avenir Next"', 'Avenir', '"Segoe UI"', '"Gill Sans"', 'system-ui', 'sans-serif'],
  mono:    ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
},
colors: {
  ink:   { DEFAULT: '#1f1b16', muted: '#5d5750' },
  paper: { DEFAULT: '#faf8f4', 2: '#f1ede6' },
  night: { DEFAULT: '#15130f', 2: '#211d18', ink: '#efeae2', muted: '#b3aca1' },
  // Per-app categorical palette: 4–6 hues chosen by the kickoff prompt for the paper's
  // own categories (conditions, groups, pathways…). Bioactive Explorer's were:
  // coffee #7a4a1f · greenTea #2f7a3e · yerbaMate #2a5aa6 · cacao #7b2c5e
  cat: { a: '#7a4a1f', b: '#2f7a3e', c: '#2a5aa6', d: '#7b2c5e', e: '#b8860b', f: '#4b6b7a' },
}
```

```css
/* index.css — semantic variables; components use these, not raw hex */
:root  { color-scheme: light; --bx-bg:#faf8f4; --bx-bg-2:#f1ede6; --bx-ink:#1f1b16; --bx-muted:#5d5750; --bx-line:#d9d2c7; --bx-accent:#2f5d9a; }
.dark  { color-scheme: dark;  --bx-bg:#15130f; --bx-bg-2:#211d18; --bx-ink:#efeae2; --bx-muted:#b3aca1; --bx-line:#3a342c; --bx-accent:#8fb4ea; }
/* plus: --bx-amber for TODO(author)/pending markers: #b45309 light / #fbbf24 dark */
```

Feel: **warm paper, ink text, serif display headings, sans body, one cool accent.** Cards are `bg-white/70` on paper and `night-2/80` in dark. Borders use `--bx-line`. Nothing is pure white or pure black.

## 3. Component classes (copy verbatim)

```css
@layer base {
  body { background: var(--bx-bg); color: var(--bx-ink); }
  h1,h2,h3,h4 { @apply font-display tracking-tight; }
  :focus-visible { outline: 3px solid var(--bx-accent); outline-offset: 2px; border-radius: 2px; }
  a { text-underline-offset: 2px; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *,*::before,*::after { animation-duration:.001ms!important; transition-duration:.001ms!important; } }
}
@layer components {
  .bx-card        { @apply rounded-xl border border-[color:var(--bx-line)] bg-white/70 dark:bg-night-2/80 shadow-sm; }
  .bx-btn         { @apply inline-flex items-center gap-1.5 rounded-md border border-[color:var(--bx-line)] bg-white/80 dark:bg-night-2 px-2.5 py-1.5 text-sm font-medium hover:bg-paper-2 dark:hover:bg-[#2b261f] disabled:opacity-40 disabled:cursor-not-allowed; }
  .bx-btn-primary { @apply inline-flex items-center gap-1.5 rounded-md bg-ink text-paper dark:bg-night-ink dark:text-night px-3 py-1.5 text-sm font-semibold hover:opacity-90; }
  .bx-btn-on      { @apply !bg-ink !text-paper dark:!bg-night-ink dark:!text-night; }
  .bx-input       { @apply w-full rounded-md border border-[color:var(--bx-line)] bg-white dark:bg-night-2 px-2.5 py-1.5 text-sm; }
  .bx-chip        { @apply inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5; }
  .bx-prose       { @apply text-[15px] leading-7 text-ink-muted dark:text-night-muted; }
  .bx-kbd         { @apply rounded border border-[color:var(--bx-line)] px-1 font-mono text-[11px]; }
  .bx-muted       { @apply text-ink-muted dark:text-night-muted; }
  /* new for Manuscript Interrogator apps */
  .bx-term        { @apply underline decoration-dotted decoration-[color:var(--bx-accent)] underline-offset-[3px] cursor-help rounded-sm hover:bg-paper-2 dark:hover:bg-night-2; }
  .bx-cite        { @apply align-super text-[11px] font-semibold text-[color:var(--bx-accent)] hover:underline cursor-pointer; }
  .bx-foldout     { @apply bx-card mt-2 mb-4 p-3 text-sm border-l-4 border-l-[color:var(--bx-accent)]; }
  .bx-todo        { @apply bx-chip bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200; }
  .bx-reader      { @apply max-w-[68ch] text-[17px] leading-8 font-body; }
  /* topic mode (APP-SPEC §6.1) — provenance you can see without being shouted at */
  .bx-synthesis   { @apply border-l-2 border-[color:var(--bx-line)] pl-4 my-4; }
  .bx-synthesis-label { @apply block mb-1 text-[11px] uppercase tracking-wider bx-muted font-semibold; }
  .bx-asof        { @apply bx-chip bg-paper-2 dark:bg-night-2 bx-muted; }
  .bx-tier        { @apply bx-chip border border-[color:var(--bx-line)] bx-muted; }
  .bx-banner      { @apply bx-card p-3 mb-6 text-sm border-l-4 border-l-[color:var(--bx-accent)]; }
  /* critique mode (APP-SPEC §1.3, §6.2) — criticism you can read without being shouted at */
  .bx-claim       { @apply cursor-pointer rounded-sm bg-[color:var(--bx-claim)] hover:bg-paper-2 dark:hover:bg-night-2; }
  .bx-claim-mark  { @apply absolute -left-6 select-none text-[11px] font-mono bx-muted hover:text-[color:var(--bx-ink)]; }
  .bx-status      { @apply bx-chip border border-[color:var(--bx-line)] bx-muted; }
  .bx-sev-blocking{ @apply bx-chip bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200; }
  .bx-sev-major   { @apply bx-chip border border-[color:var(--bx-line)] font-semibold; }
  .bx-sev-minor   { @apply bx-chip bx-muted; }
  .bx-margin      { @apply text-[13px] leading-6 bx-muted border-l-2 border-[color:var(--bx-line)] pl-3; }
  .bx-internal    { @apply bx-chip border border-dashed border-[color:var(--bx-line)] bx-muted font-mono text-[11px]; }
  .bx-track       { @apply bx-chip border border-[color:var(--bx-line)] bx-muted; }
}
```

### 3.1 Topic-mode components

Only used when `manifest.mode` is `topic`. The principle: a reader must be able to *see* provenance without the page nagging. Amber stays reserved for things that are missing or unverified — a synthesis passage is not a defect and is never amber.

| Class | Where | Rule |
|---|---|---|
| `.bx-banner` | Top of `/read`, once | "Written by the Manuscript Interrogator from N sources, current as of `as_of`." Dismissible; the dismissal is per-slug `localStorage`, and it never hides the `as_of` chip. |
| `.bx-synthesis` + `.bx-synthesis-label` | Blocks marked `<!-- synthesis -->` | A quiet left rule and the word *synthesis* above the block. Each gets a stable `id` so `/methods` can deep-link every one. Not a colour, not an icon, not a callout box. |
| `.bx-asof` | Header area of `/`, `/read`, `/about` | The sweep date. Always visible on those three surfaces. |
| `.bx-tier` | `/references` group headers and cards | Seminal · Current · Background. Text, not colour — tier is information, not status. |

### 3.2 Critique-mode components

Only used when `manifest.mode` is `critique`. The principle: this app's reader is the author of the thing being criticised, and he has to read all of it. Criticism that shouts is criticism he stops reading.

| Class | Where | Rule |
|---|---|---|
| `.bx-claim` | An audited sentence in `/read` | The faintest possible tint (`--bx-claim`), not a highlighter. It marks *that a claim was audited here*, not that something is wrong. |
| `.bx-claim-mark` | The margin beside that sentence | A small monospace claim id in the gutter, the click target for the claim card. It is placed by character offset and **never written into the body text**. |
| `.bx-status` | Claim cards, `/review` | `supported` · `under-cited` · `uncited` · `contested` · `needs-own-data`. Text, not colour — status is information, not alarm. `needs-own-data` is not a defect and must not look like one. |
| `.bx-sev-*` | Annotations | Severity is the *only* thing in a critique app that earns a colour, and only at `blocking`. `major` is weight, `minor` is muted. |
| `.bx-margin` | Annotations beside the body | A quiet left rule in the reader's margin. Never inline in the body, never a callout box over the text. |
| `.bx-internal` | Any study-internal value, anywhere | A dashed-border monospace chip reading the artifact and version, with the words **"this study, unpublished"**. It must never resemble `.bx-cite`. |
| `.bx-track` | `/learn`, concept cards | The curriculum track, and `method_status` as a second chip: *used in this draft* · *candidate* · *background*. |

```css
:root { --bx-claim: #f3efe7; }   /* light: barely there */
.dark { --bx-claim: #1d1a15; }
```

**Amber stays reserved** for missing, pending and unverified content, as in every mode. An annotation is not a defect in the *app*; a `TODO(author)` is. Do not reach for amber to make criticism feel more urgent.

`/references` in topic mode is three labelled groups in tier order, each sorted by year (newest first within Current, oldest first within Seminal so the field's history reads forward), with a one-sentence explanation of what the tier means at the head of each group.

## 4. Layout patterns

- **Header**: sticky, `border-b`, `bg-paper/90 dark:bg-night/90 backdrop-blur`, `max-w-7xl` container. Wordmark = `font-display text-xl font-semibold` with the second word `bx-muted font-normal` (e.g. **Paper** *Explorer*, or the paper's short title). NavLinks: `rounded-md px-2.5 py-1.5`, active = `font-semibold underline underline-offset-4`. Right side: search (⌘K), theme toggle, notepad toggle. Mobile: nav collapses into a disclosure.
- **Page containers**: reading pages `max-w-3xl px-4 py-8`; dashboards/figures `max-w-7xl`; headings `text-3xl sm:text-4xl` (h1), `text-2xl mt-8` (h2).
- **Reader**: three-column on ≥ 1280 px — section rail (left, sticky, 220 px), body (`bx-reader`, centred), notepad (right, 360 px, resizable, collapsible). Below 1280 px the rail becomes a top dropdown and the notepad a right drawer with a floating toggle.
- **Popover**: `bx-card p-3 max-w-sm text-sm`, anchored to the trigger (use `@floating-ui/react`), arrow optional, closes on Esc/outside click, focus trapped while open, `aria-describedby` on the trigger.
- **Fold-out** (citation cards): inserted directly after the paragraph containing the citation, animated height (respect reduced motion), one open per paragraph.
- **Figure frame** (`InfographicFrame` pattern): title, controls row (`bx-btn` group), the figure, caption, then a "How to read this" `bx-prose` block and a chip row of linked concepts.
- **Detail drawer** (`CompoundDrawer` pattern): slide-over from right for glossary entries opened from figures, so the figure stays visible.
- **Footer**: `max-w-7xl px-4 py-6 text-sm bx-muted`, one sentence about the app + links to Methods and About.

## 5. Interaction & accessibility rules

- Everything a mouse can do, a keyboard can do; `:focus-visible` ring everywhere; skip-link to main.
- Tooltips/popovers on hover **and** focus; never hover-only.
- Charts: tooltips with exact values and units; legends toggle series; colours from `cat.*`; never encode meaning by colour alone (add shape/label); axis labels with units; empty/missing data drawn as gaps, not zeros.
- `prefers-reduced-motion` honoured; `prefers-color-scheme` honoured on first load; theme persisted in `localStorage`.
- Lighthouse Accessibility 100 is a release gate, as in Bioactive Explorer.

## 6. Voice

Captions and "How to read this" blocks are plain, concrete, second person ("Click the nitrogen…" / "Hover a bar to see…"). Popovers are one or two sentences. 101 pages are written at intro-textbook level and end with a self-check. Pending facts are shown in **amber**, labelled, never hidden.

## 7. Repo conventions

```
scripts/build-content.ts     validate + link + emit (idempotent, cached, loud failures)
content-pack/                the input (see CONTENT-PACK.md) — committed
src/data/*.json              generated — committed
public/figures/              original figure images (if any) — committed
public/provenance.json       generated — committed
src/components/{reader,glossary,figures,notepad,ui}/
src/pages/{Home,Read,Glossary,Concepts,Concept,Figures,Figure,References,Methods,About,NotFound}.tsx
tests/  (Playwright) · src/**/*.test.ts (Vitest)
.github/workflows/deploy.yml
README.md                    quick start · content pack editing · provenance
```

## 8. History

- v0.1 (2026-09-14) — extracted from Bioactive Explorer: stack, tokens, component classes, layout patterns, interaction rules, repo conventions.
- v0.2 (2026-09-14) — §3.1 topic-mode components (`.bx-banner`, `.bx-synthesis`, `.bx-asof`, `.bx-tier`) and the tiered `/references` layout. Amber stays reserved for missing or unverified content; synthesis is marked quietly, never as a defect.
- v0.3 (2026-09-20) — §3.2 critique-mode components (`.bx-claim`, `.bx-claim-mark`, `.bx-status`, `.bx-sev-*`, `.bx-margin`, `.bx-internal`, `.bx-track`) and the `--bx-claim` tint. Severity is the only thing that earns colour and only at `blocking`; `needs-own-data` must not look like a defect; study-internal chips must never resemble citations; amber stays reserved for missing and unverified content.
