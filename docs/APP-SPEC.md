---
type: spec
project: manuscript-interrogator
version: 0.6
---

# APP-SPEC — what every generated app must be

**Version 0.4 · 2026-09-20 · normative.** Every Manuscript Interrogator kickoff prompt inherits this spec by reference; a generated app is accepted only against the checklist at the bottom. Change this file, not the prompts.

## 1. Purpose

One manuscript → one static web app that works as an **interactive textbook and journal** for that paper: a reader can read it, annotate it, look up every term, learn the concepts it assumes, play with its figures, and see what each cited work actually contributed. Audience: an upper-level undergraduate or early graduate student who is *not* a specialist in the paper's field.

### 1.1 Modes

The pack's `manifest.mode` says where the reader's body text came from. **Everything in this spec applies to both modes unless a row or rule says otherwise.**

- **`mode: manuscript`** (default) — the body is one published paper, reproduced verbatim from `manuscript.md`. The app's promise is *faithfulness*: nothing added, nothing paraphrased.
- **`mode: critique`** — the body is **one unpublished draft the author is still writing**, reproduced verbatim from `manuscript.md`, wrapped in a critical review of itself ([[manuscript-interrogator/docs/CRITIQUE-WORKFLOW|CRITIQUE-WORKFLOW]]). The app's promise is *faithfulness to the draft and traceability of the critique*, and its defining prohibition is that **nothing in it is replacement prose for the manuscript**. See §1.3.
- **`mode: topic`** — the body is a **commissioned review** written by the builder from a scoped literature sweep ([[manuscript-interrogator/docs/TOPIC-WORKFLOW|TOPIC-WORKFLOW]]). The app's promise is *traceability*: every claim carries a citation to a verified reference, every synthesis is marked as one, and the scope and search strategy are published alongside the text. A topic app is never presented as peer-reviewed literature, and it always shows the date its sweep closed.

The machinery — reader, notepad, term linking, popovers, citation fold-outs, 101s, figures, search — is identical in both modes. A topic app differs only in what `/read` contains and in what `/methods` and `/about` must disclose.

### 1.2 Volume apps (topic mode with `manifest.volumes`)

A volume app is one topic app whose review arrives in parts. The reader, glossary, 101s, references and graph are shared; only `/read` is split. It is built once and extended per volume: each later KICKOFF adds a volume's content and re-runs the whole content build, never forks the app.

- `/read` becomes a **volume index** (title, status, word count, `as_of` per volume, "coming" cards for `planned` volumes); `/read/:volume` is the reader for one volume, with the section rail scoped to it and previous/next-volume links at the end.
- Citation fold-outs, term popovers and the notepad behave identically in every volume. Notes are keyed by the prefixed section id, so they survive volumes being added.
- `/references` gains a "cited in volume" filter. `/methods` renders the shared scope once, and each volume's search strategy, corpus profile and outline-approval date in its own panel.
- `/concepts/:id` offers an L1–L4 level switch when `manifest.concept_levels` is true (default L1; the choice persists per reader).
- `as_of` is per volume; `/` shows the most recent and `/read` shows each.

### 1.3 Critique apps (`mode: critique`)

A critique app is a **critical-review textbook built around one unpublished draft**. It exists to help its one reader rewrite that draft himself, and every design decision follows from that.

**The rule that binds the whole app: annotate only.** The app flags, classifies, evidences and teaches. Nowhere — not in an annotation, not in a popover, not in a tooltip, not behind a control — does it offer text to put into the manuscript. `/review` therefore has **no copy-to-manuscript affordance**, annotations are rendered in the margin and on their own surface rather than inline in the body, and the pack schema that feeds them has no field that could hold replacement prose (CONTENT-PACK §annotations.yaml). A build that adds one has failed acceptance.

**Three provenance classes, never blurred.** Literature facts carry `[n]`. **Study-internal facts** — numbers from the study's own ledgers, analysis outputs and code — carry an artifact id and its version, and the app labels them **"this study, unpublished"** wherever they appear. Builder inferences carry the synthesis marker. An app that renders a study-internal number as a citation has told its reader his own unpublished result is externally corroborated, which is the worst thing this app could do.

**Route names.** Critique mode renames two surfaces and adds two. The canonical unit and reference URLs are unchanged, so term popovers and citation fold-outs work as they do everywhere else:

| Critique route | Is | Note |
|---|---|---|
| `/review` | new | the critical review, by claim and by section |
| `/library` | `/references`, renamed | `/references` redirects; `#ref-n` anchors unchanged |
| `/learn` | `/concepts`, renamed | `/concepts` redirects; `/concepts/:id` stays canonical for one unit |
| `/notes` | the notepad, given a page of its own | the docked sidebar stays; the page is where the rewrite is organised |

**Confidentiality is mechanical.** Under `manifest.confidential: true` the app is built and served locally, the repo is private, and there is no Pages workflow and no public remote. The validator refuses `delivery: pages` rather than leaving it to judgement at ship time.

**Phases.** `manifest.phase` (`v1` | `v2` | `v3`) says which release a pack ships. v1 is the core — read, review, library, notes, methods, the draft's own figures, the curated subgraphs with basic analytics, and the curriculum for the methods the draft actually used. v2 adds breadth: the `candidate` and `background` methods, the wider domain tracks, the advanced analytics and the live database panel. v3 is cross-linking and polish. A later phase **extends the app in place** and never rescaffolds it; no existing claim id, annotation id, section id, concept id, figure id or reference number may change (KICKOFF §4a).

## 2. Surfaces (routes)

| Route | Surface | Must have |
|---|---|---|
| `/` | Home | Title, authors, venue/year, one-paragraph plain-language abstract, "Start reading", "Concepts to know first" (the 101s), reading-time estimate. **Topic mode:** instead of authors/venue, show the scope question (`manifest.question`), a "Commissioned review — not peer reviewed" badge, and "Current as of `as_of`". |
| `/read` | **Reader** | (Topic mode: the commissioned review from `review.md`, with a dismissible banner at the top of the first section — "Written by the Manuscript Interrogator from N sources, current as of `as_of`. Every claim is cited; passages marked *synthesis* draw conclusions the cited works do not individually state.") The full manuscript as structured sections (abstract → conclusions, plus supplement if supplied). Every glossary term is a clickable, visually quiet link (dotted underline) that opens a **popover** with the short definition and a "Full entry →" link. Figures and tables are embedded inline as interactive components (§4). Citations `[n]` are clickable and expand a **fold-out** under the paragraph (§5). Section nav rail on wide screens; progress indicator. |
| `/read` sidebar | **Notepad** | The standard notepad, §3.1: docked beside the reader on wide screens, a drawer elsewhere. No account, no backend. |
| `/glossary` | Glossary | Every technical term — scientific **and** methodological/statistical. Alphabetical with letter jump-bar, search, `#term-id` anchors, "see also", and "appears in" links back to reader sections. |
| `/concepts` and `/concepts/:id` | 101s | One page per *major concept* the paper presumes (from the content pack). Each 101: what it is (2–4 paragraphs at intro-textbook level), why this paper needs it, key equation(s) if any (rendered with KaTeX, each symbol explained), one illustrative interactive or static diagram, 2–4 further-reading links, and, **only when `manifest.concept_self_checks` is `true`**, a 3-question self-check. By default (key absent or `false`) the 101 ends after the further reading, with no questions, no heading for them and no empty state, and nothing on `/` or `/about` counts or mentions self-checks. |
| `/figures` and `/figures/:id` | Figures | Every figure/table of the paper rebuilt interactively where the content pack supplies data (§4); otherwise the original image with hotspot annotations. Caption, "How to read this figure", the maths/concepts behind it as popovers or links to 101s. |
| `/references` | References | Numbered list matching the paper; each entry expandable to the same summary card used in the reader fold-outs (§5). DOI links. **Topic mode:** grouped by `tier` (Seminal · Classic · Current · Background) with the tier explained, sorted by year within each group, filterable by tier/year/role, `why_it_mattered` shown on seminal cards, and anchors (Daniel's own picks) marked. |
| `/graph` | **Graph lab** (packs with `claims.yaml`) | See §4.1. |
| `/methods` | Methods & provenance | How the app was built: which content came verbatim from the manuscript, which was written by the builder, what was verified how, known gaps (`TODO(author)` markers surfaced here in amber). **Topic mode — this route carries the app's honesty and is not optional:** the scope (in *and* out, with reasons), the interview as asked and answered, the full search strategy (every query, source, hit count, date, inclusion/exclusion rules, known gaps), the corpus profile (tier/year counts, author concentration, whether dissent is represented), the citation-coverage counts, a link to **every** `synthesis` passage in the review, and the sentence "This is a scope-bounded commissioned review, not a systematic review." |
| `/notes` | **Notes** | The notepad as a page of its own (§3.1): every note, what it hangs on, export and import. In the header nav. |
| `/about` | About | Licence/permission statement for the manuscript text and figures; links to the original paper; version of the builder that generated the app. **Topic mode:** who wrote the review (the builder, named, with its version), that it is not peer reviewed, the `as_of` date, that figures are synthesised rather than reproduced, and how to report an error in it. |

### 2.1 Routes under `mode: critique`

Every duty in §2 still applies. These are the additions and the substitutions.

| Route | Must have |
|---|---|
| `/` | The draft's title and authors, its `draft.status` and `target_venue`, a "Critical review of an unpublished draft — not peer review" badge, the `as_of` date, the phase, and counts: claims audited, by status; annotations, by severity; references; curriculum units. |
| `/read` | The draft **verbatim**. Every audited claim is a quiet anchor on its sentence (a marginal marker, never a change to the text) that opens the claim card: status, the citations the draft carries, and its annotations. Annotations appear **in the margin**, collapsed to a count on narrow screens. Terms, figures, equations and citations behave exactly as in the other modes. A filter shows only the sentences carrying claims of a chosen status. |
| `/review` | The critical review. Grouped by manuscript section **and** by claim, switchable. Filter by `status`, `kind`, `severity` and `area`. Each entry shows the anchored quote, the claim as restated, the annotation, the references and artifacts attached to it, and links to the curriculum units that would close the gap. Every entry deep-links into `/read` at its sentence. **No control anywhere on this route produces text intended for the manuscript.** |
| `/library` | The corpus. Grouped by `tier`, filterable by `area`, `tier`, `year` and job. Every entry shows which claims it `supports`, which it `challenges` and which units it `teaches`, each a link. `why_it_mattered` on seminal cards. **BibTeX and RIS export** of the whole corpus and of any filtered view. |
| `/learn` | The curriculum, by track. Each unit has an **L1–L4 switch** (default L1, persisted per reader), term-by-term equation walkthroughs, and — on a methods track — its `method_status` shown as *used in this draft* / *candidate for this study* / *background*. Small interactive demos wherever a demo teaches: a resolution slider, a damping-factor control, a null-model shuffle. Each unit lists the claims it lets the reader judge. |
| `/graph` | The graph lab over `subgraphs.yaml` — see §4.1a. |
| `/figures` | Every figure, with the full export set and its reproducible script — see §4.2. |
| `/notes` | The §3.1 notepad, with two extra anchor types: **claim ids** and **curriculum units**. Its section-ordered export is the raw material for the author's rewrite, in the order he will rewrite it. |
| `/methods` | Everything from §2, plus: the **artifact inventory** with each file's version and what was deliberately left out; every study-internal fact the app renders, labelled; the **known-corrections record** from `artifacts.yaml`, `open` ones first; the per-area corpus profile and every query with its hit count; the audit's coverage (sections with no claims, claims with no annotation, contested claims with no counter-reference); every synthesis-marked annotation; and the `as_of` date. |

## 3. Cross-cutting behaviour

- **Term linking is automatic and total.** At build time, a script walks the reader text and wraps the first occurrence of each glossary term *per section* (configurable: every occurrence) in a `<Term id>` component. Matching is case-insensitive, whole-word, and respects a `variants:` list in the glossary (plurals, abbreviations, symbols). Terms inside headings, code, equations and existing links are skipped.
- **Popovers, not page jumps**, for the first look at anything (term, symbol, citation); the full page is one more click. Popovers are keyboard-reachable (Enter/Space open, Esc closes, focus returns).
- **Concept links inside popovers**: a term whose glossary entry has `concept:` shows "Learn the concept → 101".
- **URL-addressable state**: reader section, open figure, glossary anchor and figure controls live in the URL so any view can be shared.
- **Dark mode** (class strategy, respects system, persisted), **reduced-motion** respected, **375 px** layout works, **Lighthouse Accessibility 100** on the reader and one figure page.
- **No runtime fetches** of scientific content. Everything is in the built bundle or `public/`. External links open in new tabs.
- **Print stylesheet** for the reader (notes optionally appended).

### 3.1 The notepad — the same in every app

Daniel asked on 2026-09-21 for the PTSD critique app's notepad to be the notepad in every app, in every mode. `apps/ptsd-inflammation-critique/` is its reference implementation: **port it, don't rebuild it** — `src/lib/notepad.ts`, `src/lib/notepad-context.tsx`, `src/lib/notes-index.ts`, `src/components/notepad/`, `src/pages/Notes.tsx`, `src/components/ui/Drawer.tsx` and `scripts/local-endpoints.ts`, at or after commit `afb9dab` (the drawer focus fix). Adapt the anchor index to the objects the app actually has; change nothing else without a reason written in the scrum note.

- **Where it lives.** Docked beside the reader on screens ≥ 1280 px; a slide-over drawer below that and on every other page; a header toggle everywhere; and `/notes`, a page of its own.
- **Anchors.** A note hangs on a section or on anything the app renders: a term, a concept/101, a figure, a reference (and, under `mode: critique`, a claim or a curriculum unit). Selecting text in the reader offers *Add note*, which captures the quote with its anchor. Each note shows what it hangs on and links back to it. An anchor that no longer resolves after a rebuild is shown as such, never silently dropped.
- **Views.** On `/read`, "This section" and "All"; `/notes` shows everything.
- **Export and import.** Export is Markdown **organised by section in reading order**, each note with its anchor and quote. Import reads that file back and merges it.
- **Persistence.** Always `localStorage` keyed by `manifest.slug`. With `manifest.notes_storage: file` (the default), every change is also autosaved to `notes/notepad.md` and `notes/notepad.json` in the app folder, through an endpoint that exists **only** under `npm run dev` / `npm run preview` on localhost; anywhere else the app falls back to `localStorage` silently. The panel says where notes are being saved. **When the file save is unavailable — the app is online, on GitHub Pages or any other host — the panel and `/notes` both say plainly: *"Saved in this browser only — export to keep a copy."*** (The reference app runs only locally and predates this line; add it when porting.) `notes/` is in `.git/info/exclude`, so notes never reach a remote.
- **Typing never loses focus.** A drawer moves focus to its Close button once, when it opens, and back to the opener once, when it closes — never on a re-render. (The pilot shipped with the drawer's effect depending on an inline `onClose`, which re-fired on every keystroke and left the reader one character per attempt.)

## 4. Figures

For each figure in the content pack:

- `kind: chart` with `data:` → rebuilt as an interactive chart (Recharts or D3 — see DESIGN-SYSTEM): hover tooltips with exact values, legend toggles, axis units, optional log/linear switch, download PNG/CSV. Any derived quantity shown (error bar meaning, normalisation, statistical test) has a ⓘ popover written from the content pack's `explain:` block; each maths concept links to its 101.
- `kind: network` / `kind: pathway` → force-directed or fixed-layout SVG with node/edge hover cards and highlight-on-select.
- `kind: image` → the original figure image with **hotspots** (`hotspots:` in the pack: x/y/w/h % + text) and a caption; used when no data is available.
- `kind: table` → sortable, filterable table with column header popovers.
- Every figure page also lists "Concepts in this figure" (links to 101s/glossary) and "Where it is discussed" (links to reader sections).

### 4.1 The graph lab — `/graph` (packs with `claims.yaml`)

The lab makes the review's mechanism claims explorable as a graph and hands them to the reader's own database. It renders **only** `claims.yaml`; it never adds nodes or edges.

- **Explore.** Clickable, Neo4j-Browser-style canvas. Filters: volume, level, node type, predicate, evidence, species, status. Presets: "drive → outcome" (every path from a chosen `ExogenousDrive` to a chosen `Outcome`), "one level", "contested only". Node and edge cards show label, type, xref (linked), the claim's references as fold-out cards, the section that argues it (link into `/read/:volume`) and parameters as published. Contested edges are dashed and open their hypothesis group with the rivals side by side; inferred edges carry the synthesis marker.
- **Analyse in the browser.** Degree, PageRank, betweenness, connected components, Louvain communities with a resolution control, shortest and bounded all-simple paths between two nodes, and "what else rests on these references". Results appear as a sortable table and can highlight the canvas. The library (graphology + sigma.js, cytoscape.js or similar) is the build's call, recorded in the README, and must run client-side on the full claim set.
- **Export.** Generated at build time into `public/graph/`: `claims.cypher` (uniqueness constraints plus idempotent `MERGE`; every relationship carries `claim_id`, `refs`, `status`, `evidence`, `level`, `species`, `section`), `nodes.csv` + `edges.csv` with `neo4j-admin import` headers, `claims.graphml`, `claims.json`. The current filtered view exports the same ways.
- **Connect to my Neo4j — optional, closed by default.** A panel the reader opens deliberately. It connects *from the reader's browser* to an endpoint the reader types (default `neo4j://localhost:7687`) with the official JavaScript driver. Credentials live in memory for that tab only — never stored, logged or sent elsewhere; nothing is committed. Three actions only: *Test connection*; *Load this atlas* (shows node/edge counts, asks for confirmation, runs `claims.cypher` in one transaction); *Run a read query* (read-access session; results as a table and on the canvas). There is no write-query box. The panel says plainly that some browsers block a public HTTPS page from reaching a local database and always offers the Cypher download as the fallback. A `pages` build contacts no database on its own.

### 4.1a The graph lab under `mode: critique`

A critique app's `/graph` renders `subgraphs.yaml` — curated extracts of the **study's own** graph — rather than topic mode's `claims.yaml`. Everything in §4.1 about the canvas, the node and edge cards, the export formats and the reader-opened database panel applies, with four differences:

- **The subgraph picker** is the first control: each extract shows its title, what it is, its node and edge counts, and the artifact it came from. Node cards show the study's own identifiers (Open Targets / EFO / MONDO ids, evidence-type scores, tier) and link to the claims and references that concern them.
- **In-browser analytics**: degree, PageRank with a damping control, betweenness and closeness, connected components, Louvain and Leiden with a **resolution control**, Jaccard similarity, one-mode projection, shortest and bounded paths, and degree-preserving null comparison. Results as a sortable table, highlightable on the canvas, exportable as CSV.
- **The golden-fixture gate.** Every analytic the app implements that the study also ran **must reproduce the study's own numbers** on the subgraph's `golden` file, as a passing unit test. Wrong community assignments and badly shuffled nulls produce entirely plausible numbers; this test is the only thing that catches them. A drifting number fails the suite.
- **The live database panel** is available **only when the app is served from localhost** and is hidden otherwise. Credentials come from a local `.env` or are typed into the panel, live in memory for that tab, and are never stored, logged or committed. It offers *test connection*, *run a read query* and nothing that writes.

### 4.2 Figure exports (`mode: critique`)

Every figure page offers, for that figure: **SVG**, **PDF**, the underlying **CSV/JSON**, and — for graph figures — **GraphML** and **Cypher**. Every figure with data also offers its **reproducible script**, the file named in `figures[].script`, exactly as it ships in the pack. The figure states its `provenance` (*from the draft* / *from this study's analysis* / *synthesised across the literature*) and, for the first two, names the artifact and version it was built from with the "this study, unpublished" label.

## 5. References

Each reference in the pack carries: full citation, DOI/URL, `summary:` (3–6 sentences of what the cited work found), `role_here:` (why *this* paper cites it — support, method source, contrast, prior result), and `cited_in:` (section ids). In the reader, clicking `[n]` folds out a card directly under the paragraph with summary + role; the card links to `/references#ref-n`. Missing summaries render as an amber "summary pending" — never invented.

## 6. Provenance rules (bind Claude Code)

1. The **content pack is the only source of scientific content**. Claude Code may restructure, link and render it; it may not add facts, definitions, or reference summaries. Gaps become `TODO(author)` markers surfaced on `/methods`.
2. Manuscript text is reproduced **verbatim** from `manuscript.md` (light typographic normalisation allowed). No paraphrase in the reader. In `mode: topic` the same rule applies to `review.md`: the builder's text is rendered as written, never rephrased at build time.
3. Every figure states whether it is *rebuilt from data* or the *original image* — and in `mode: topic`, whether it is *synthesised from data across cited works* or a *conceptual diagram*, with the contributing reference numbers shown on the figure page.
4. A `provenance.json` is written at build time listing counts: terms linked, terms unmatched, references with/without summaries, figures by kind, `TODO(author)` count.

### 6.1 Additional rules under `mode: topic`

5. **The content build fails on uncited prose.** Any block of ≥ 25 words in `review.md` with no `[n]` and no preceding `<!-- framing -->` marker is a build error, listed in `BUILD-ERRORS.md` and surfaced on `/methods`. Claude Code does not repair it by adding a citation — that would be inventing provenance.
6. **`<!-- synthesis -->` blocks are rendered with a visible, quiet marker** in the reader (a left rule and a "synthesis" label, not an alarm), each linked from `/methods`. A reader must always be able to tell the builder's inference from a cited result.
7. **No claim may rest on a `verified: false` reference.** If a citation resolves to an unverified entry, the build flags it on `/methods` in amber and the reference card says "not verified — summary from abstract/metadata only".
8. `provenance.json` gains, in topic mode: total blocks, cited blocks, framing blocks, synthesis blocks, references by tier, unverified-but-cited count, figures by `synthesis` kind, and the `as_of` date.
9. **The `as_of` date is shown on `/`, `/read` and `/about`.** An app that does not say how old its sweep is may not ship.

### 6.2 Additional rules under `mode: critique`

10. **Annotate only.** The app renders no text intended to become manuscript prose, and offers no affordance for moving its text into the draft. Annotations render in the margin and on `/review`, never inline in the body.
11. **The body is the draft, verbatim.** Rule 2 applies unchanged. Claim anchors are marginal markers keyed to a quote match; the build never inserts a marker into `manuscript.md` and never alters its text.
12. **Study-internal facts are labelled, not cited.** Any value whose source is an entry in `artifacts.yaml` renders with the artifact's name and version and the label **"this study, unpublished"**. It never renders as `[n]`, and never in a way a reader could mistake for a literature citation.
13. **The builder's own prose obeys topic mode's rules.** §6.1 rules 5–7 apply to `annotations[].note` and to concept bodies: a block of ≥ 25 words with no citation and no framing marker is a build error; `<!-- synthesis -->` and `synthesis: true` stay visible and are listed on `/methods`; nothing rests on a `verified: false` reference.
14. **A broken claim anchor is a build error, not a repair job.** If a `quote` no longer matches exactly once in its section, list it in `BUILD-ERRORS.md` and surface it on `/methods`. Do not re-point it at a similar sentence — the claim needs re-auditing by the builder, and quietly re-anchoring it would hide that.
15. **Confidential means confidential.** Under `manifest.confidential: true`: no Pages workflow, no public remote, no draft text in any commit message, issue, README or artifact that leaves the machine.
16. `provenance.json` gains, in critique mode: claims by status, claims with broken anchors, annotations by kind and severity, sections with no claims, contested claims with no counter-reference, references by area and by job, concepts by track and `method_status`, figures by `provenance`, subgraphs with their node/edge counts and golden-fixture pass state, and open vs applied corrections.

## 7. Engineering bar (inherited from Bioactive Explorer)

Vite + React 18 + TypeScript strict + Tailwind; static `dist/`; `BASE_PATH` for GitHub Pages; Vitest unit tests for the term-linker, pack schema and figure data; Playwright smoke over every route + dark mode + 375 px; GitHub Actions deploy workflow; README with quick start and "editing the content pack". Details in [[manuscript-interrogator/docs/DESIGN-SYSTEM|DESIGN-SYSTEM]].

## 8. Acceptance checklist

- [ ] Every route in §2 exists and is linked from the header nav.
- [ ] Reader reproduces the manuscript verbatim; sections match the pack's `sections[]`.
- [ ] ≥ 95 % of glossary terms that occur in the text are linked (`provenance.json`); the rest are listed on `/methods`.
- [ ] Every glossary entry is reachable from the reader; every 101 is reachable from at least one term or figure.
- [ ] With `manifest.concept_self_checks` absent or `false`, no 101 shows a self-check or a placeholder for one; with `true`, every 101 shows its questions.
- [ ] Every citation `[n]` opens a fold-out; every reference with a summary shows it; none are invented.
- [ ] Every figure in the pack has a page; `chart`/`table` kinds are interactive with value tooltips; maths popovers present where `explain:` was supplied.
- [ ] Notepad per §3.1: `/notes` exists and is in the nav; write → reload → persists; a full sentence typed into a note in the **drawer** arrives whole and the textarea keeps focus; export is section-ordered Markdown that import reads back; under `npm run preview` the note lands in `notes/notepad.md`; served anywhere else, the panel and `/notes` show "Saved in this browser only — export to keep a copy."
- [ ] Dark mode, reduced motion, 375 px, keyboard-only navigation of a popover and the notepad.
- [ ] Lighthouse Accessibility 100 on `/read` and one `/figures/:id`; Performance ≥ 90.
- [ ] `npm test` and `npm run test:e2e` green in CI; site live on GitHub Pages under `danieladamek`.
- [ ] `/methods` shows the provenance counts and all `TODO(author)` markers.
- [ ] Scrum note written per the vault `CLAUDE.md` contract.

### Additional, under `mode: topic`

- [ ] `/read` carries the commissioned-review banner; `as_of` appears on `/`, `/read` and `/about`.
- [ ] Zero uncited blocks in the build output; framing and synthesis counts reported on `/methods`.
- [ ] Every `synthesis` passage is visibly marked in the reader and linked from `/methods`.
- [ ] `/references` groups by tier (including Classic), sorts by year, shows `why_it_mattered` on seminal entries, marks anchors.
- [ ] `/methods` publishes the scope (in and out), the interview, every query with its hit count, and the corpus profile.
- [ ] Every figure page names the references it was synthesised from and whether it is data or conceptual.
- [ ] Nowhere does the app imply peer review.

### Additional, under `mode: critique`

- [ ] `/read` reproduces the draft verbatim; no claim marker was written into `manuscript.md`; every claim anchor resolves to exactly one sentence.
- [ ] **No surface offers replacement prose for the manuscript, and `/review` has no copy-to-manuscript control.** Checked by hand on `/read`, `/review` and `/learn`.
- [ ] Every claim card shows its status, the draft's own citations and its annotations; the status filter on `/read` works.
- [ ] `/review` groups by section and by claim, filters by status, kind, severity and area, and every entry deep-links into `/read` at its sentence.
- [ ] `/library` groups by tier, filters by area, shows each reference's `supports` / `challenges` / `teaches` as links, and exports valid BibTeX and RIS (a parser test, not an eyeball).
- [ ] `/learn` groups by track, every unit switches L1–L4 and the choice persists, and methods units show `method_status`.
- [ ] Every study-internal value on any surface carries its artifact, its version and the "this study, unpublished" label; none renders as `[n]` (asserted by a test over `provenance.json`).
- [ ] `/figures` exports SVG, PDF, data, GraphML/Cypher where applicable, and the script — and each downloaded file opens: the SVG in a browser, the GraphML in Gephi or Cytoscape, the Cypher parses, the script runs from a clean environment.
- [ ] `/graph` renders every subgraph; **the in-browser analytics reproduce every `golden` fixture as a passing test**; the resolution and damping controls work; exports match §4.1.
- [ ] The live database panel is hidden when the app is not on localhost, stores no credentials (test inspects storage), and offers no write query.
- [ ] `/notes` anchors notes to claims, references, units and sections; export is Markdown organised by manuscript section with anchors and quotes intact; notes survive a content rebuild that adds a phase.
- [ ] `/methods` shows the artifact inventory with versions, the known-corrections record with `open` first, the audit coverage counts, the per-area corpus profile and every query.
- [ ] `confidential: true` held: private repo, no `deploy.yml`, no Pages, no public remote, no draft text anywhere public.

### Additional, for volume apps and packs with `claims.yaml`

- [ ] `/read` lists every volume with status and `as_of`; `/read/:volume` works for every `ready` volume; planned volumes show as coming.
- [ ] Notes keyed to prefixed section ids survive a rebuild that adds a volume (Playwright).
- [ ] With `concept_levels`, every 101 switches L1–L4 and the choice persists.
- [ ] `/graph` renders every claim; filters, the drive → outcome preset, contested and inferred styling work; the analytics are unit-tested on a fixture graph with known PageRank and path answers.
- [ ] `public/graph/` holds `claims.cypher`, `nodes.csv`, `edges.csv`, `claims.graphml`, `claims.json`; a test loads `claims.cypher` into a throwaway Neo4j when one is available, and otherwise parses it.
- [ ] The Neo4j panel is closed by default, stores no credentials (test inspects storage), offers no write query, and shows the download fallback.

## History

- v0.1 (2026-09-14) — first draft: routes, cross-cutting behaviour, figures, references, provenance, engineering bar, acceptance checklist. Pilot (Thyroid Markers Explorer) accepted against it.
- v0.2 (2026-09-14) — **topic mode** (§1.1): `/read` may be a commissioned review; `/`, `/references`, `/methods` and `/about` gain mode-conditional duties; §6.1 adds the citation-coverage build failure, synthesis marking, unverified-reference handling and the `as_of` requirement; §8 gains seven topic-mode acceptance items. Manuscript-mode behaviour is untouched.
- v0.3 (2026-09-15) — **volume apps and the graph lab.** §1.2 volume apps (`/read` index, `/read/:volume`, per-volume `as_of`, L1–L4 concept switch); `/graph` route and §4.1 (claims-only graph, in-browser analytics, Cypher/CSV/GraphML/JSON exports, reader-opened Neo4j panel that stores nothing and cannot write except the confirmed atlas load); acceptance items. Single-review apps are untouched.
- v0.4 (2026-09-20) — **critique mode.** §1.3 critique apps (annotate-only as an app-level prohibition, the three provenance classes, the `/review` · `/library` · `/learn` · `/notes` route set, mechanical confidentiality, phased releases that extend in place); §2.1 the critique route table; §4.1a the graph lab over `subgraphs.yaml` with the **golden-fixture gate** on the in-browser analytics and the localhost-only database panel; §4.2 the figure export set and reproducible scripts; §6.2 seven provenance rules including study-internal labelling and the broken-anchor build error; thirteen acceptance items. Manuscript and topic apps are untouched.
- v0.5 (2026-09-21) — **one notepad everywhere.** New §3.1: the PTSD critique app's notepad becomes the notepad of every app in every mode — docked panel, drawer, `/notes` page, anchors to anything the app renders, section-ordered export and import, file autosave under local preview by default, and the rule that typing never loses focus. `/notes` joins the §2 route table for all modes; §2.1's `/notes` row now only adds claim and unit anchors; the §8 notepad item gains the drawer-typing and file-autosave checks. Existing apps are unchanged until retrofitted.
- v0.5.1 (2026-09-21) — §3.1 and §8: when the notepad's file save is unavailable (any online host), the panel and `/notes` must say "Saved in this browser only — export to keep a copy." At Daniel's request, so the risk is visible before it costs notes.
- v0.6 (2026-10-05) — **self-checks on the 101s become something to add.** `/concepts/:id` reads `manifest.concept_self_checks` (CONTENT-PACK v0.10): absent or `false` (the default) means no questions and no mention of them; `true` adds the self-check every earlier app has. Daniel, on the Token for Granted build.
