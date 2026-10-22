---
type: spec
project: manuscript-interrogator
version: 0.10.2
---

# CONTENT-PACK — the structured input Claude Code builds from

**Version 0.8 · 2026-09-20.** The content pack is authored by the Manuscript Interrogator Cowork project (research role) and is the **only** source of scientific content in a generated app (APP-SPEC §6). Claude Code validates it in `scripts/build-content.ts` and fails loudly on any violation below. Everything is UTF-8 YAML/Markdown so Daniel can review it in Obsidian before dispatch.

## Modes

A pack declares `mode:` in its manifest, and that is the only thing the three intakes disagree about:

| | `mode: manuscript` (default) | `mode: topic` | `mode: critique` |
|---|---|---|---|
| Input | One published paper Daniel hands over | A topic + scope of interest, pinned by a scoping interview | **An unpublished draft Daniel is writing, plus its protocols, ledgers, analysis outputs and code** |
| Workflow | [[manuscript-interrogator/docs/BUILDER-WORKFLOW|BUILDER-WORKFLOW]] Phases 0–3 | [[manuscript-interrogator/docs/TOPIC-WORKFLOW|TOPIC-WORKFLOW]] Phases T0–T5 | [[manuscript-interrogator/docs/CRITIQUE-WORKFLOW|CRITIQUE-WORKFLOW]] Phases C0–C6 |
| Reader body | `manuscript.md` — the paper, **verbatim** | `review.md` — a **commissioned review** written by the builder, every claim cited | `manuscript.md` — the draft, **verbatim**. `review.md` must not exist |
| Extra files | — | `scope.yaml` | `scope.yaml`, `claims-audit.yaml`, `annotations.yaml`, `artifacts.yaml`, `subgraphs.yaml` |
| References | The paper's own numbering, its own bibliography | Tiered `seminal` / `classic` / `current` / `background`, the builder's numbering | Tiered as in topic mode, **plus an `area` and a job**: `supports` / `challenges` / `teaches` |
| Figures | The paper's figures, rebuilt or reproduced | **Synthesised** — built from the corpus, every figure carrying `refs:` | `draft` / `analysis` / `synthesis`, each with a runnable `script:` |
| The builder's own prose | 101s and definitions | the review, 101s, definitions | **annotations and a four-level curriculum** — never manuscript prose |
| Provenance risk | Faithfulness of the extraction | Truthfulness of the synthesis — so the citation rules are *stricter*, see below | **Blurring the study's own unpublished results into the literature** — hence `artifacts.yaml` |

Everything else — glossary, concepts, figure schema, term-linking, the app itself — is identical, and a reader cannot tell from the app's machinery which mode produced it (only from `/about` and `/methods`, which say so plainly).

**Critique mode inherits both of the others**: manuscript mode's verbatim-body rule over the draft, and topic mode's provenance rules over everything the builder writes about it. Its one defining rule is **annotate only** — no schema in this document has a field that can hold replacement prose for the manuscript, and that is deliberate ([[manuscript-interrogator/docs/CRITIQUE-WORKFLOW|CRITIQUE-WORKFLOW]]).

## Layout

```
content-pack/
  manifest.yaml        # metadata, slug, palette, permissions, mode, builder version
  manuscript.md        # mode: manuscript — the paper, verbatim, with section markers and figure/citation anchors
  review.md            # mode: topic      — the commissioned review, same markers, every claim cited
  scope.yaml           # mode: topic|critique — interview answers, search strategy, corpus profile, exclusions
  claims-audit.yaml    # mode: critique   — every factual claim in the draft: id, anchor quote, citations, status
  annotations.yaml     # mode: critique   — the critical review, anchored to claim ids. Never replacement prose
  artifacts.yaml       # mode: critique   — the study's own files as a citable provenance class, + known corrections
  subgraphs.yaml       # mode: critique   — curated graph extracts, their export scripts and golden fixtures
  glossary.yaml        # every technical term (science + methods)
  concepts/            # one Markdown file per 101, with frontmatter
    <concept-id>.md
  figures.yaml         # every figure/table: kind, data or image, explanations, hotspots
  figures/data/        # CSV/JSON series referenced by figures.yaml
  figures/images/      # original figure images (only when permitted)
  references.yaml      # every reference with summary + role_here
  todo.yaml            # optional: known gaps the builder could not resolve
```

## manifest.yaml

```yaml
mode: manuscript                          # manuscript | topic — default manuscript
slug: cortisol-inflammation-ptsd          # kebab-case; becomes repo name + localStorage key
title: "…full title…"
short_title: "Cortisol & Inflammation"    # header wordmark, ≤ 3 words
authors: ["A. Author", "B. Author"]
venue: "PLOS Computational Biology"
year: 2026
doi: "10.1371/…"                          # or url:
plain_abstract: >                         # 120–180 words, written by the builder, labelled as such in the app
  …
reading_minutes: 45
audience: "upper-level undergraduate / early graduate, non-specialist"
palette:                                  # 4–6 categorical hues for the paper's own categories
  groups: { control: "#2a5aa6", ptsd: "#7b2c5e" }
permissions:
  text: "author-owned, CC BY 4.0"         # REQUIRED for delivery: pages; may be "unknown" for delivery: local
  figures: "author-owned"                 # or "original images omitted; rebuilt from data only"
delivery: local                           # local | pages — Daniel's Phase 0 answer; default local.
                                          #   local = built and viewed on his machine, git repo but no remote
                                          #   pages = public repo + live GitHub Pages site at the end of the build
builder: { name: "Manuscript Interrogator", version: "0.3", date: "2026-09-14" }
github_account: danieladamek              # only used when delivery: pages
notes_storage: file                       # file | browser — default file: the notepad also autosaves to notes/notepad.md
                                          #   under npm run dev / preview on localhost (APP-SPEC §3.1); browser = localStorage only
concept_self_checks: false                # true | false — default false: the 101s (primers) carry no self-check questions.
                                          #   true adds them: every concepts/*.md then needs `self_check`. Asked at intake.
```

### manifest under `mode: topic`

`authors`, `venue`, `year`, `doi`/`url` describe a paper, so in topic mode they are replaced:

```yaml
mode: topic
slug: vagal-anti-inflammatory-signalling
title: "Vagal anti-inflammatory signalling in humans: what is established and what is contested"
short_title: "Vagal Inflammation"
question: >                               # the question behind the topic, in Daniel's words, from T0
  Where is the evidence actually strong that vagus-nerve activity modulates systemic inflammation
  in humans, and which methods can and cannot show it?
purpose: orientation                      # orientation | direction | teaching | grant-background (T0)
as_of: 2026-09-14                         # the date the sweep closed — stamped in the app, non-negotiable
authors: ["Manuscript Interrogator (commissioned review)"]
venue: "Commissioned review — not peer reviewed"
year: 2026
permissions:
  text: "builder-authored; no third-party text reproduced beyond quotations ≤ 25 words"
  figures: "synthesised by the builder from cited data; no published figure images reproduced"
```

Rules for topic mode: `question`, `purpose` and `as_of` are required; `doi`/`url` are not; `permissions.text` still must be non-empty, and under `delivery: pages` it must state the quotation rule. `venue` must make the non-peer-reviewed status unmissable — it is rendered on `/` and `/about`.

### manifest under `mode: critique`

The draft is not a published paper, so `venue`/`doi` describe where it is *going*, not where it is. Six keys are added and one is load-bearing:

```yaml
mode: critique
slug: ptsd-inflammation-critique
title: "…the draft's full title…"
short_title: "PTSD–Inflammation"
draft:                                  # REQUIRED — what is being critiqued
  authors: ["D. Adamek"]
  version: "FinalReviewDraft, June 2026"
  status: in-revision                   # unpublished | submitted | under-review | in-revision
  target_venue: "PLOS Computational Biology"
  word_count: 7904
confidential: true                      # REQUIRED in critique mode unless Daniel says otherwise
as_of: 2026-09-20                       # the date the sweep closed
phase: v1                               # v1 | v2 | v3 — which phased release this pack ships
areas:                                  # the disciplines the critique covers; every reference carries one
  - { id: ptsd-clinical,  label: "PTSD, clinical and psychiatric" }
  - { id: immunology,     label: "Inflammation and immunology" }
  - { id: neurobiology,   label: "Neurobiology, HPA axis and immune-to-brain signalling" }
  - { id: pharmacology,   label: "Pharmacology and drug targets" }
  - { id: graph-methods,  label: "Graph, network and data-analytics methods" }
tracks:                                 # the curriculum's tracks; every concept names one
  - { id: t-psychiatry, label: "Psychiatry & PTSD" }
  - { id: t-graph,      label: "Graph science", methods: true }
concept_levels: true                    # REQUIRED true in critique mode — every unit is authored L1–L4
delivery: private                       # local | pages | private — critique mode defaults to private
permissions:
  text: "author-owned unpublished draft; not for redistribution"
  figures: "author-owned"
authors: ["Manuscript Interrogator (critical review)"]
venue: "Critical review of an unpublished draft — not peer review"
```

Rules for critique mode:

- `draft`, `confidential`, `as_of`, `phase`, `areas`, `tracks` and `concept_levels: true` are all required; `doi`/`url` are not.
- **`confidential: true` refuses `delivery: pages`** at the validator. It is not a preference the build role can weigh against something else.
- `delivery: private` means a **private** GitHub repo with a push and **no Pages workflow** — distinct from `local` (no remote at all) and `pages` (public).
- `area` ids are referenced by `references.yaml`; `track` ids by `concepts/`. A track with `methods: true` is one whose units carry `method_status`.
- `venue` must make plain that the app is a critical review of unpublished work and not peer review; it is rendered on `/` and `/about`.

## manuscript.md

Verbatim text. Structure markers the build step relies on:

```markdown
<!-- section: abstract -->
# Abstract
…text with citations written as [12] or [3,7] exactly as in the paper…

<!-- section: 2-methods -->
## 2. Methods
…
<!-- figure: fig2 -->          ← placed where the figure appears; rendered as the interactive component
…
<!-- section: 3-results -->
```

Rules: section ids are kebab-case and unique; every `<!-- figure: id -->` matches `figures.yaml`; every `[n]` (or list/range: `[3,7]`, `[3–5]`) matches `references.yaml`; equations in `$…$` / `$$…$$` (KaTeX); tables in GFM. Nothing is paraphrased. Light normalisation only (ligatures, hyphenation, smart quotes).

## scope.yaml — topic mode only

The record of what was asked, what was decided, what was searched and what was left out. It is not decoration: `/methods` renders it, and it is the document the review is accountable to.

```yaml
topic: "vagus nerve and systemic inflammation"        # Daniel's words, verbatim
question: >                                           # T0 — the question behind the topic
  …
purpose: orientation                                  # orientation | direction | teaching | grant-background
boundary:
  in:  ["human studies", "VNS trials", "cholinergic anti-inflammatory pathway mechanism"]
  out: ["rodent-only mechanistic work", "device engineering", "non-inflammatory VNS indications"]
  rationale: "Daniel wants the human evidence base; the rodent literature is a separate review."
level: "organism and clinical"                        # the level/scale answer, in the field's terms
time_window: { current_from: 2021, seminal: "any age if load-bearing" }
stance: primer-with-controversies                     # primer | controversy-map | methods-manual
depth: standard                                       # brief | standard | deep | textbook (textbook requires volumes — see below)
anchors:                                              # T2 — what Daniel already trusts, seeds the snowball
  - { citation: "Tracey KJ. The inflammatory reflex. Nature 2002.", doi: "10.1038/nature01321", why: "Daniel named it" }
excluded:                                             # adjacent literatures deliberately left out
  - { what: "sepsis trials", why: "Daniel: out of scope for this pass" }
assumed: false                                        # true when the interview went unanswered and defaults were taken
interview:                                            # the Q&A as asked and answered — quoted, not paraphrased
  - { q: "…", answer: "…", asked: 2026-09-14 }
search_strategy:
  run_on: 2026-09-14
  sources: ["Europe PMC", "Crossref", "OpenAlex", "Semantic Scholar", "web search"]
  queries:
    - { q: "cholinergic anti-inflammatory pathway human", source: "Europe PMC", hits: 214, kept: 11 }
  snowball: ["backward from anchors", "forward citing works of refs 3, 7, 12"]
  inclusion: ["human subjects", "primary data or systematic review", "English"]
  exclusion: ["conference abstracts without data", "preprints not yet peer reviewed (noted separately)"]
  known_gaps: ["no access to two paywalled trials — abstract only, see todo.yaml"]
corpus_profile:                                       # the honesty check from TOPIC-WORKFLOW T3.5
  by_tier: { seminal: 9, current: 26, background: 5 }
  year_range: [1998, 2026]
  concentration: "7 of 26 current refs share a senior author — noted on /methods"
  dissent_represented: true
```

Rules: `topic`, `question`, `boundary`, `time_window`, `depth`, `search_strategy` and `corpus_profile` are required. `search_strategy.queries` must be the queries actually run, with hit counts — including the ones that found nothing. `interview` quotes Daniel's answers; where an answer was assumed, `assumed: true` and the assumption is spelled out.

### scope.yaml under `mode: critique`

The same file, with the sweep run per area rather than once. Required: `topic`, `question`, `boundary` (in **and** out), `time_window`, `depth`, `search_strategy`, `corpus_profile`, `corpus_target`.

```yaml
topic: "the PTSD–Inflammation knowledge-graph manuscript"
question: >
  What does this draft claim, what carries those claims, where does the literature disagree,
  and what does its author need to know to defend every one of them?
depth: deep                              # sizes the CURRICULUM in critique mode, not a review
corpus_target: { min: 150, max: 250 }    # exceeding max needs Daniel's say-so, never a silent trim
anchors:
  - { citation: "Menche J, et al. Science 2015.", doi: "10.1126/science.1257601", area: graph-methods, why: "cited as [13] in the draft" }
search_strategy:
  run_on: 2026-09-20
  sources: ["Europe PMC", "Crossref", "OpenAlex", "Semantic Scholar", "web search"]
  queries:
    - { q: "degree-preserving null bipartite disease gene", source: "Europe PMC", hits: 143, kept: 9, area: graph-methods }
  snowball: ["backward from every reference of the draft", "forward from refs 13, 19, 20"]
  inclusion: ["…"]
  exclusion: ["…"]
  known_gaps: ["…"]
corpus_profile:
  by_tier: { seminal: 22, classic: 18, current: 96, background: 41 }
  by_area: { ptsd-clinical: 48, immunology: 39, neurobiology: 31, pharmacology: 18, graph-methods: 41 }
  year_range: [1995, 2026]
  concentration: "…"
  dissent_represented: true
```

Rules: `corpus_profile.by_area` must name every declared area; every query should carry its `area`; `corpus_target` is a band, and a corpus outside it is reported (below `min` as a warning, above `max` as a warning that says to ask rather than trim). `depth: textbook` stays volume-only, as in topic mode.

## review.md — topic mode only

Same file shape as `manuscript.md` — `<!-- section: id -->`, `<!-- figure: id -->`, `[n]` citations, KaTeX, GFM tables — so the reader, term-linker and citation fold-outs work unchanged. What differs is what is allowed in it:

```markdown
<!-- section: 2-foundations -->
## 2. Foundations

<!-- framing -->
Three results, none of them recent, do most of the work in this literature. They are worth
reading before anything published in the last five years.

The inflammatory reflex was described as a neural circuit in which efferent vagal activity
suppresses TNF release from macrophages [3]. In the original demonstration, stimulation reduced
serum TNF by 75 % in endotoxaemic rats [3]; the human evidence arrived much later and is weaker [11,14].

<!-- synthesis -->
Taken together, the human studies support a modulatory rather than a controlling role [11,14,19].
```

Rules the validator enforces:

- **Citation coverage.** Every block of ≥ 25 words contains at least one `[n]`, unless the block is immediately preceded by `<!-- framing -->`. Framing blocks carry no claims of fact — transitions, section openers, "the rest of this section…". Overusing `framing` to smuggle uncited claims is the one failure mode that would make this app untrustworthy; the count is reported on `/methods`.
- **`<!-- synthesis -->`** marks a block stating a conclusion the cited works do not individually state. Allowed, expected, and listed on `/methods` so a reader can find every one of them.
- **Quotation ≤ 25 words**, in quotation marks, with its `[n]`. There is no verbatim-reproduction path in this mode.
- Every `[n]` resolves to `references.yaml`; every `verified: false` reference is unusable as support for a claim.
- Section ids kebab-case and unique, as in manuscript mode.

## claims-audit.yaml — critique mode only

Every factual claim the draft makes, with its location, the citations it currently carries, and what the audit found. This is the spine of a critique pack: `/read`, `/review`, `/library` and `/notes` are all keyed to these ids, so an error here propagates into every surface.

```yaml
- id: C0007                              # C + 4 digits, stable, never reused
  section: 3-4-null-model                # must exist in manuscript.md
  quote: "the observed overlap is at or below the null expectation"
  claim: >                               # the claim restated as a proposition, in the builder's words
    Two independent degree-preserving nulls place the observed PTSD–Inflammation overlap at or
    below chance at every confidence tier.
  kind: empirical                        # empirical | methodological | interpretive | background | motivational
  area: graph-methods                    # one of manifest.areas
  cites: []                              # the reference numbers the DRAFT attaches here, as it stands
  numbers: ["z = -135", "z = -6.2"]      # figures asserted, exactly as written
  status: needs-own-data                 # supported | under-cited | uncited | contested | needs-own-data
  artifact_refs: [A-stage1-summary]      # REQUIRED when status is needs-own-data
```

### The anchor is a quote, not a marker

`manuscript.md` is **never modified to carry claim ids.** The build locates each claim by matching `quote` inside its declared section, and the validator requires **exactly one match**. Two consequences, both wanted:

- The draft file in the pack stays byte-identical to what the author wrote. Verbatim means verbatim.
- When the author rewrites the anchored sentence, the anchor **breaks loudly** instead of silently re-pointing at different words. A broken anchor means that claim needs re-auditing — which is true.

Quoting the draft at any length is allowed here and nowhere else: it is the author's own unpublished text, and the app already renders all of it verbatim. The ≤ 25-word quotation limit applies to the **literature**.

### `status`

| Value | Means | Validator requires |
|---|---|---|
| `supported` | the attached citations carry the claim | `cites` non-empty |
| `under-cited` | cited, but more thinly than the claim needs | an annotation anchored to it |
| `uncited` | asserted with no citation | `cites` empty |
| `contested` | the literature contains an opposing result | an annotation of kind `contested` or `counter-evidence` |
| `needs-own-data` | the warrant is the study's own results, not the literature | `artifact_refs` non-empty |

`needs-own-data` is a provenance class, not a defect — it is the honest status of most of a results section. The defect it exposes is a claim *phrased* so a reader takes a study-internal number for a literature fact; that is an annotation of kind `provenance`.

Other rules: ids unique and matching `^C\d{4}$`; `section` exists; `kind`, `status` and `area` from their vocabularies; every `n` in `cites` resolves to `references.yaml`. Every `<!-- section: -->` of the draft that asserts anything should carry at least one claim — a section with none is reported.

## annotations.yaml — critique mode only

The critical review. Each annotation is anchored to a claim id (or, for a whole-section observation, to a section id) and carries the evidence for what it says.

```yaml
- id: N0011                              # N + 4 digits
  claim: C0007                           # exactly one of claim: | section:
  kind: provenance
  severity: major                        # blocking | major | minor
  note: >
    The z-scores in this sentence come from the study's own Stage 1 run and carry no citation;
    a reader arriving from the abstract will read them as literature values. Nulls of this
    construction are described in [14] and the separation statistic in [13], but neither
    reports these numbers.
  refs: [13, 14]                         # literature attached to the annotation
  artifact_refs: [A-stage1-summary]      # study-internal evidence attached to it
  teaches: [u-null-models]               # optional: curriculum units that would close the gap
  synthesis: false                       # true when the note draws a conclusion its sources do not state
  framing: false                         # true for a note carrying no claim of fact (rare)
```

`kind`: `gap` · `under-cited` · `uncited` · `contested` · `counter-evidence` · `provenance` · `internal-consistency` · `reporting` · `scope` · `editorial`.

`editorial` is for defects that are not scientific — a number that disagrees between a table and its text, a reference in the list the body never cites, a find-and-replace scar. They earn their place because they are cheap for the author to fix and expensive for a reviewer to forgive.

### Rules

- **The schema is closed.** Any key not listed above is a **validation error**. There is no `replacement`, no `suggested_text`, no `rewrite` — and there is not going to be one. This is the structural half of the annotate-only rule ([[manuscript-interrogator/docs/CRITIQUE-WORKFLOW|CRITIQUE-WORKFLOW]]); the review gate and the KICKOFF are the other half.
- A `note` of **≥ 25 words** must carry `refs` or `artifact_refs`, or set `framing: true`. This is topic mode's citation-coverage rule applied to the builder's prose in this mode.
- `synthesis: true` marks a conclusion the sources do not individually state; every one is listed on `/methods`.
- No annotation may rest on a `verified: false` reference.
- Quotations from the **literature** inside a note are ≤ 25 words and attributed. Quotations from the draft are unrestricted.
- `claim` and `section` are mutually exclusive and one is required; every `ref`, `artifact_ref`, `teaches` id and anchor must resolve.

## artifacts.yaml — critique mode only

The study's own files, made citable. This is what stops a number from `STAGE1_RESULTS_SUMMARY.txt` acquiring an `[n]` and looking like a published finding.

```yaml
artifacts:
  - id: A-stage1-summary                 # A-<kebab>
    file: "graph/stage1_analysis/STAGE1_RESULTS_SUMMARY.txt"   # path in the SOURCE repo, as read
    copy: "source/stage1/STAGE1_RESULTS_SUMMARY.txt"           # where the pack keeps its copy
    kind: analysis-output                # analysis-output | ledger | protocol | pipeline-code | manuscript-support | database
    version: "build snapshot 2026-07-16"
    as_of: 2026-07-16
    sha256: "…"                          # optional, preferred — it is what makes 'version' checkable
    what: "Stage 1 stratification, null models and Jaccard ranking, as run."
corrections:                             # the known-corrections record, rendered on /methods
  - id: X-cd40-genetic
    what: "CD40 is genetically supported (genetic_association_score 0.59)."
    instead_of: "CD40 treated as literature-only, or 'only CD40' stated at ≥0.10 rather than ≥0.20."
    source: A-stage3-summary
    claims: [C0041]                      # optional
    status: applied                      # applied | open
```

- Every artifact needs `id`, `file`, `kind`, `version` and `what`. `version` is not decoration: a study-internal fact is cited to **a file and the state it was in**, because the live database drifts and the frozen tables do not.
- A **correction** with `status: open` is a defect the draft still carries and must appear on `/review`; `status: applied` is a **regression guard** — the draft is already right, and the record exists so a later edit cannot quietly undo it. Both are surfaced on `/methods` as the known-corrections record.
- The app labels every study-internal fact **"this study, unpublished"**. It never renders one as a citation.

## subgraphs.yaml — critique mode only

Curated, browser-sized extracts of the study's graph, each with the script that produced it and the numbers the browser has to reproduce.

```yaml
- id: sg-fkbp5
  title: "FKBP5 neighbourhood"
  what: "The ≥0.10 overlap subgraph around FKBP5 and its two-hop paths to the ≥0.20 survivors."
  data: graph/fkbp5-neighbourhood.json   # {nodes:[{id,label,type,…}], edges:[{from,to,type,…}]}
  n_nodes: 412
  n_edges: 1180
  artifact_refs: [A-fkbp5-neighbourhood]
  script: tools/export_fkbp5.py          # kept in the app; regenerates `data` from the source
  analytics: [degree, betweenness, closeness, louvain]
  golden: graph/golden/fkbp5-centrality.csv    # REQUIRED whenever `analytics` is non-empty
```

**The analytics guard.** A wrong Louvain assignment, a wrong one-mode projection or a badly shuffled null model produces numbers that look entirely plausible, and no amount of care in the prose catches that. Fixtures catch it. So a subgraph that declares `analytics` **must** ship a `golden` file holding the values the study's own analysis produced, and the app's in-browser implementation must reproduce them as a passing test (APP-SPEC §8, KICKOFF §5). `data`, `script` and `golden` must all exist; `n_nodes` above 5,000 is warned as too big for the browser.

## glossary.yaml

```yaml
- id: hazard-ratio
  term: Hazard ratio
  kind: methods                 # science | methods | statistics | notation
  variants: ["hazard ratios", "HR", "HRs"]   # whole-word, case-insensitive matches in the reader
  short: "The ratio of event rates in two groups at any instant; 1 = no difference."   # ≤ 200 chars → popover
  definition: >                 # 2–5 sentences → glossary page
    …
  concept: survival-analysis    # optional → "Learn the concept" link to concepts/survival-analysis.md
  see: [confidence-interval]
  sources: ["10.1000/…"]        # optional DOIs/URLs the definition was checked against
```

Rules: ids unique; `concept` must exist in `concepts/`; `see` ids must exist; `variants` must not collide across terms (the build fails on ambiguous matches and lists them). Coverage target: **every** technical noun phrase a non-specialist would stumble on, including statistical tests, software, datasets, instruments, units and abbreviations.

## concepts/<id>.md

```markdown
---
id: survival-analysis
title: Survival analysis
one_liner: "Modelling time-until-event when some subjects never have the event."
why_here: "The paper's primary outcome is time to relapse; Fig. 3 is a Kaplan–Meier plot."
prerequisites: [probability-basics]      # other concept ids (may be empty)
terms: [hazard-ratio, censoring, kaplan-meier]
figures: [fig3]
further_reading:
  - { title: "…", url: "…", kind: textbook|review|video }
self_check:
  - { q: "…", options: ["…","…","…","…"], answer: 1, explanation: "…" }
---

## What it is
2–4 paragraphs, intro-textbook level.

## The key idea in one picture
Describe the diagram Claude Code should draw (or supply an SVG in figures/images/). Optional.

## The maths, gently
$$ S(t) = P(T > t) $$
Each symbol explained in a list right after the equation.

## How this paper uses it
…
```

**Self-checks are an addition, not a default (v0.10).** `manifest.concept_self_checks` decides whether the 101s carry questions. Absent or `false`: concept files leave the `self_check` key out and the app renders no self-check; the rest of the 101 is as above. `true`: every concept file has `self_check` with at least one question, in the form shown above, and the app renders them. The validator warns about a `self_check` found in a concept file when the toggle is not `true`, because it will not be shown. The answer comes from intake (BUILDER-WORKFLOW Phase 0, TOPIC-WORKFLOW T0). A pack written before v0.10 that carries self-checks sets `concept_self_checks: true` to keep them on a rebuild.

### concepts under `mode: critique`

A concept **is** a curriculum unit in critique mode, so the term linker, the popovers and the validator all work unchanged. Three additions:

```yaml
---
id: u-null-models
title: Degree-preserving null models
track: t-graph                  # REQUIRED in critique mode — one of manifest.tracks
method_status: used-in-draft    # REQUIRED on a track with methods: true
                                #   used-in-draft | candidate | background
audits: [C0007, C0009]          # optional: the claims this unit exists to let the reader judge
one_liner: "…"
…
---
```

- `manifest.concept_levels` is **required true**, so every unit carries `## L1 — Intuition`, `## L2 — Undergraduate`, `## L3 — Graduate` (the full derivations) and `## L4 — Expert` (assumptions, failure modes, live debates, key papers). Authored per level, never generated from one another.
- **`method_status`** is what an author rewriting a methods paper needs before anything else: did the study run this, could it have, or is it background he needs in order to judge the first two. It is also the honest way to present breadth — a unit on a method the study never ran is teaching, not a reviewer's demand.
- L3 and L4 prose is builder prose, so the citation-coverage rule applies to it: a block of ≥ 25 words with no `[n]` fails unless it is marked `<!-- framing -->`. An uncited "current debates" section is precisely the confident invention this builder exists to prevent.

## figures.yaml

```yaml
- id: fig3
  label: "Figure 3"
  title: "Time to relapse by group"
  kind: chart                   # chart | table | network | pathway | image
  chart: { type: step, x: {field: t, label: "Months", unit: "mo"}, y: {field: S, label: "Survival probability"}, series: group, ci: [lo, hi] }
  data: figures/data/fig3.csv   # columns must match fields above
  caption: >                    # the paper's caption, verbatim
    …
  how_to_read: >                # builder-written, plain, second person
    …
  explain:                      # ⓘ popovers on the figure; each may link a concept/term
    - { on: "shaded band", text: "95 % confidence band…", concept: confidence-interval }
    - { on: "step drops", text: "Each drop is one relapse…", term: kaplan-meier }
  concepts: [survival-analysis]
  discussed_in: [3-results, 4-discussion]
  source: "rebuilt from Supplementary Table S2"   # or "digitised from the published figure (approximate)"

- id: fig1
  kind: image
  image: figures/images/fig1.png
  hotspots:
    - { x: 12, y: 40, w: 20, h: 15, text: "Blood draw at baseline", term: baseline }
  …
```

Rules: `data` files exist and parse; `chart.type` ∈ {line, bar, grouped-bar, stacked-bar, scatter, area, step, box, heatmap, forest}; `network`/`pathway` supply `nodes`/`edges` JSON; every `concept`/`term` reference resolves; `source` is mandatory and honest about approximation.

### figures under `mode: topic`

There is no published figure to rebuild, so every figure is the builder's own and has to declare what it is made of:

```yaml
- id: fig2
  label: "Figure 2"
  title: "Reported effect of vagal stimulation on circulating TNF, by study"
  kind: chart
  synthesis: data                # data | conceptual   (REQUIRED in topic mode)
  refs: [3, 11, 14, 19, 22]      # REQUIRED — what the figure is made of; each must exist
  chart: { type: forest, x: {field: effect, label: "Log ratio of means"}, y: {field: study} }
  data: figures/data/fig2.csv    # every row carries a `ref` column naming its source reference
  caption: "Effect estimates as reported by each study; not a meta-analysis."
  how_to_read: >
    …
  source: "Extracted by the builder from the reported values in refs 3, 11, 14, 19, 22. Values are
    as published, not re-analysed or pooled."
```

- `synthesis: data` — a chart or table assembled from values extracted from the corpus. The data file **must** carry a `ref` column so every point is traceable to a reference. `source` must state that the values are as published and say whether anything was converted.
- `synthesis: conceptual` — a mechanism, pathway or decision diagram drawn from the cited sources. `source` says plainly that the drawing is the builder's.
- `refs:` is required on every figure and every `n` must exist in `references.yaml`. A figure with no references does not ship.
- `kind: image` is allowed only with explicit permission in `manifest.permissions.figures`; the default in topic mode is that no published images are reproduced at all.
- Figures that no single paper contains — a timeline of results, a forest plot across studies, a methods comparison table — are the ones worth building. They are the main reason a topic app beats reading five reviews.

### figures under `mode: critique`

Three provenances, and every figure that has data ships the script that rebuilt it.

```yaml
- id: fig3
  label: "Figure 3"
  title: "Overlap under bilateral stratification"
  kind: chart
  provenance: analysis            # draft | analysis | synthesis   (REQUIRED in critique mode)
  artifact_refs: [A-stage1-summary]   # REQUIRED for draft | analysis
  refs: []                        # REQUIRED non-empty for synthesis (as in topic mode)
  data: figures/data/fig3.csv
  script: figures/scripts/fig3.py # REQUIRED for chart | table | network | pathway
  caption: "…"
  how_to_read: "…"
  source: "Rebuilt from STAGE1_RESULTS_SUMMARY.txt (build snapshot 2026-07-16); this study, unpublished."
```

| `provenance` | Built from | Cites |
|---|---|---|
| `draft` | a figure of the manuscript itself | `artifact_refs` |
| `analysis` | the study's analysis outputs | `artifact_refs` |
| `synthesis` | values extracted across the literature | `refs`, and a `ref` column in the data file |

A figure the author cannot regenerate is a figure he cannot defend in review, so `script:` is required rather than encouraged, and it must exist. The app exports every figure as SVG and PDF, its data as CSV/JSON, graph figures as GraphML and Cypher, and the script itself (APP-SPEC §4.2).

## references.yaml

```yaml
- n: 12                          # the paper's own numbering
  citation: "Author A, Author B. Title. Journal. 2021;12(3):456–78."
  doi: "10.1000/xyz"             # or url:
  summary: >                     # 3–6 sentences: what the cited work did and found
    …
  role_here: support             # support | method | contrast | prior-result | data-source | background
  role_note: "Provides the cortisol-assay protocol used in §2.3."
  cited_in: [2-methods, 4-discussion]
  verified: true                 # DOI resolved and abstract read by the builder
```

Rules: every `[n]` in the manuscript has an entry; `doi` or `url` required; a missing `summary` is allowed only with `verified: false` and an entry in `todo.yaml` — the app shows it amber, never blank, never invented.

### references under `mode: topic`

Two extra keys, because in topic mode the bibliography *is* the evidence base rather than a list inherited from a paper:

```yaml
- n: 3
  tier: seminal                  # seminal | classic | current | background   (REQUIRED in topic mode)
  anchor: true                   # optional — Daniel named this one in the interview
  citation: "Tracey KJ. The inflammatory reflex. Nature. 2002;420(6917):853–9."
  doi: "10.1038/nature01321"
  year: 2002                     # REQUIRED in topic mode — drives tier display and sorting
  summary: >                     # full 3–6 sentences for tier: seminal
    …
  why_it_mattered: >             # seminal only: what changed in the field because of this paper
    …
  role_here: prior-result
  role_note: "The circuit description every later human study is testing."
  cited_in: [2-foundations, 5-mechanism]
  verified: true
```

- `tier: seminal` — full `summary` **and** `why_it_mattered` required. 8–12 at standard depth.
- `tier: current` — `summary` may be one or two lines; full summary when it carries a claim in the review. 20–30 at standard depth.
- `tier: classic` — a pre-window primary study the later literature leans on but which did not found the field: the second rank of the canon. Full `summary` required (3–6 sentences, same bar as `seminal`); `why_it_mattered` optional. No count band. A paper that founds one modality or technique rather than the field is `classic` when it predates the window and `current` when it does not — `seminal` stays reserved for the cross-cutting canon, or a volume covering twenty techniques accumulates twenty founders.
  Added in v0.5 because forcing these into `background` mislabels primary experiments as reference material, while forcing them into `seminal` empties that tier of meaning.
- `tier: background` — textbooks, methods papers, guidelines, definitional sources; `summary` optional, `role_here` required.
- `year` is required in every tier. The references page groups by tier and sorts by year within it.

### references under `mode: critique`

Topic mode's tiers and `year`, plus an **area** and a **job**. In a critique corpus a reference with no job is padding, and padding is what pushes the challenging references out when the count gets trimmed.

```yaml
- n: 31
  tier: seminal                  # seminal | classic | current | background — as in topic mode
  area: graph-methods            # REQUIRED — one of manifest.areas
  citation: "…"
  doi: "…"
  year: 2015
  summary: >                     # full summary for seminal/classic; one or two lines for current
    …
  why_it_mattered: "…"           # seminal only
  supports:   [C0007, C0009]     # claims in the draft this reference carries
  challenges: [C0031]            # claims it argues against
  teaches:    [u-null-models]    # curriculum units it anchors
  role_here: method
  verified: true
```

- `area` is required on every reference; `corpus_profile.by_area` must add up to the declared areas.
- **At least one of `supports` / `challenges` / `teaches` must be non-empty.** Every id must resolve.
- `tier: background` is where methods papers, textbooks and guidelines live — the curriculum's anchors; `current` is roughly the scope's window and gets one-liners unless it carries a claim.
- The `verified` rule is unchanged and unchanged in force: a `verified: false` reference may not support a claim and may not back an annotation.

## Volumes and the textbook tier — topic mode (v0.4)

A topic that is too big for one review is built as **one app in volumes**: one commissioned review per volume, one shared glossary, one shared bibliography, one shared set of 101s, one shared `claims.yaml`. Volumes ship one at a time, each with its own outline gate and its own KICKOFF; the app grows in place.

```
content-pack/
  manifest.yaml        # + volumes: [...]
  scope.yaml           # shared scope + volumes: {<id>: per-volume depth, outline, search strategy, corpus profile}
  volumes/
    v0/review.md       # one review per volume — same markers and rules as review.md
    v1/review.md
  claims.yaml          # the graph seed — every mechanism claim as a typed, cited edge (below)
  glossary.yaml  concepts/  figures.yaml  figures/  references.yaml  todo.yaml   # shared across volumes
```

```yaml
# manifest.yaml
mode: topic
volumes:
  - { id: v0, title: "Foundations", status: ready }      # ready = has volumes/v0/review.md and is validated
  - { id: v1, title: "Vagus and cranial nerve", status: planned }   # planned = listed in the app as coming, no file yet
concept_levels: true           # optional; every 101 carries ## L1 … ## L4 sections (see concepts)
```

```yaml
# scope.yaml — shared keys as before (topic, question, boundary, time_window, stance, excluded, interview), plus:
depth: textbook                # the app-level tier; per-volume depth below
volumes:
  v0:
    depth: textbook
    outline_approved: 2026-09-16       # date Daniel approved the outline; null until then
    search_strategy: { … same shape as the single-review search_strategy … }
    corpus_profile:  { … same shape … }
```

Rules:

- A pack with `volumes:` has **no** top-level `review.md`; each `status: ready` volume has `volumes/<id>/review.md`. `planned` volumes have none. Volume ids are `v0`, `v1`, … and never renumbered.
- **Section ids are prefixed with their volume id** (`v0-3-coupling-physics`) so they stay unique across the app. `cited_in`, `discussed_in` and `claims[].section` use the prefixed ids.
- **One bibliography, one numbering.** `[n]` means the same reference in every volume. New volumes append; numbers are never reused or reassigned.
- Under `volumes:`, `search_strategy` and `corpus_profile` live per volume in `scope.yaml.volumes.<id>` (a top-level pair is still accepted for the app as a whole). A `ready` volume must have both, and `outline_approved` must be a date — or the scrum note says why not.
- All the `review.md` rules (citation coverage, framing, synthesis, quotation length, unverified references) apply to every volume file.

**The textbook tier**, per volume: `depth: textbook` = 18,000–40,000 words scaled to the corpus (200–250 references needs 25,000–40,000), 14–20 sections of which 25–40 `seminal`, written across several sessions with the outline approved first. `deep` stays ~12,000 words / 12+ sections / 60–80 references. Only volume packs may use `textbook`.

**Levelled 101s** (`manifest.concept_levels: true`): each `concepts/<id>.md` carries `## L1 — Intuition`, `## L2 — Undergraduate`, `## L3 — Graduate` and `## L4 — Expert` sections, authored per level (never generated from each other). L3 carries the full derivations; L4 carries assumptions, failure modes, live debates and the key papers, cited `[n]` from the shared bibliography. The app offers an L1–L4 switch. A levelled concept still needs `## What it is` for the popover summary.

## claims.yaml — the graph seed (topic mode, optional; required under `volumes:`)

> Not to be confused with `claims-audit.yaml`, which is critique mode's ledger of the *draft's* claims. `claims.yaml` is a topic-mode file and is **not allowed in a critique pack**; a critique app's `/graph` renders `subgraphs.yaml` instead.

The review is prose for readers; `claims.yaml` is the same science as **typed, cited edges** a graph database can load. Every mechanism statement in a review that a schema designer would want as an edge appears here once, linked to the section that argues it. Nothing may appear here that the review does not state or synthesise.

```yaml
vocabulary:                    # declared once; the validator checks every claim against it
  node_types: [ExogenousDrive, StimulationProtocol, CouplingMechanism, AnatomicalStructure, NeuronPopulation,
               CellType, SubcellularComponent, Molecule, GeneProduct, Pathway, Circuit, PhysiologicalSystem,
               Outcome, Confound, Measurement]
  predicates: [delivered_by, couples_via, polarizes, activates, inhibits, gates, binds, releases, increases,
               decreases, projects_to, part_of, located_in, modulates, required_for, correlates_with,
               confounds, measured_by]
  levels: [biophysical, cellular, subcellular, molecular, circuit, systemic, behavioural, clinical]
  evidence: [human-interventional, human-observational, animal-interventional, animal-observational,
             in-vitro, computational, consensus, inferred]
hypotheses:                    # competing-hypothesis groups: one question, ≥ 2 rival answers
  - id: H-tes-entrainment
    question: "Do weak transcranial alternating fields entrain cortical neurons directly?"
    rivals:
      - { id: H-tes-entrainment-direct, label: "direct neuronal entrainment", refs: [41] }
      - { id: H-tes-entrainment-peripheral, label: "transcutaneous peripheral-nerve co-stimulation", refs: [42] }
    section: v0-9-open-questions
claims:
  - id: C0001                  # stable, never reused
    subject: { label: "Transcranial alternating current stimulation", type: ExogenousDrive, term: tacs }
    predicate: modulates
    object:  { label: "Spike timing of cortical neurons", type: Measurement, xref: "NIFSTD:…" }
    level: cellular
    evidence: animal-interventional
    species: [macaque]         # as studied; "human" only when humans were studied
    parameters: { frequency: "10 Hz", field_in_tissue: "≈1 V/m" }   # as published, units kept, never converted silently
    status: contested          # supported | contested | inferred
    hypothesis: H-tes-entrainment-direct    # required when status is contested
    refs: [41]
    section: v0-9-open-questions
    synthesis: false           # true when the edge is the review's own inference (then status: inferred)
```

Optional on a claim: `finding: null-result` plus `finding_note`, for an edge whose asserted result is a null or a failed replication. Without it a reader of the predicate alone misreads a negative result as a positive one, since the vocabulary has no negation. `finding` defaults to `positive` when absent. The value is spelled `null-result`, not `null`, because bare `null` is YAML for nothing.

Rules the validator enforces: ids unique; `type`, `predicate`, `level` and `evidence` come from `vocabulary`; `refs` non-empty, every `n` exists and is `verified: true`; `section` exists; `term` (when given) resolves to the glossary; `status: contested` names a `hypothesis` rival id that exists; every hypothesis group has ≥ 2 rivals and every rival is used by at least one claim (warning); `status: inferred` requires `synthesis: true` or `evidence: inferred`, and vice versa; `xref` is a CURIE (`PREFIX:local`) when given. Ontology prefixes the builder should prefer: `UBERON`, `CL`, `GO`, `CHEBI`, `PR`, `NCBITaxon`, `ECO`, `ILX`/`NIFSTD`, `NPO`, SCKAN population ids.

The app turns `claims.yaml` into the `/graph` lab and into downloadable Cypher, CSV and GraphML (APP-SPEC §4.1). The vocabulary is a starting schema, not a final one — the point of publishing it is that Daniel can redesign it.

## todo.yaml

```yaml
- where: references/27
  what: "Could not access full text; summary from abstract only."
- where: figures/fig5
  what: "No underlying data; digitised approximately from the PDF."
```

## Definition of done for a content pack (Cowork side)

- [ ] `manifest.permissions.text` filled in — no pack ships without it.
- [ ] Glossary coverage: a non-specialist read-through finds no unlinked jargon; methods/statistics terms are as complete as science terms.
- [ ] Each 101 has why_here and ≥ 2 further-reading links that resolve; with `manifest.concept_self_checks: true`, also ≥ 1 self-check.
- [ ] Every figure has `how_to_read` and `source`; charts have data files; images have ≥ 1 hotspot.
- [ ] Every reference `verified: true` or listed in `todo.yaml`.
- [ ] Pack validated with `tools/validate_pack.py <pack-dir>` (0 errors) — the same rules Claude Code's `build-content.ts` must enforce.

### Additional, under `mode: topic`

- [ ] `scope.yaml` complete: boundary (in **and** out), time window, depth, the interview as asked and answered, the search strategy with real hit counts, the corpus profile.
- [ ] `manifest.as_of`, `question` and `purpose` set; `venue` makes the non-peer-reviewed status unmissable.
- [ ] Citation coverage: no uncited block of ≥ 25 words; `framing` blocks genuinely carry no claims; every `synthesis` block is one.
- [ ] Every reference has a `tier` and a `year`; every `seminal` has a full summary and `why_it_mattered`; no claim rests on a `verified: false` reference.
- [ ] Every figure has `synthesis` and `refs`; `synthesis: data` files carry a `ref` column.
- [ ] The outline was shown to Daniel before the prose was written (or the scrum note says it was not, and why).

### Additional, under `volumes:`

- [ ] Every `ready` volume has its review file, a per-volume search strategy and corpus profile, and an `outline_approved` date.
- [ ] Section ids carry the volume prefix; references keep one numbering across volumes.
- [ ] `claims.yaml` covers every mechanism statement in the ready volumes, validates against its vocabulary, and every contested claim sits in a hypothesis group.
- [ ] With `concept_levels: true`, every 101 has all four level sections.

### Additional, under `mode: critique`

- [ ] `manifest.confidential`, `draft`, `as_of`, `phase`, `areas`, `tracks` and `concept_levels: true` are set; `delivery` is `private` or `local`, never `pages`.
- [ ] `manuscript.md` is byte-identical to the draft as the author wrote it; no `review.md`, no `claims.yaml`.
- [ ] Every claim in `claims-audit.yaml` anchors to exactly one occurrence of its `quote` in its section; every section that asserts anything carries at least one claim.
- [ ] Every `needs-own-data` claim names its artifacts; every `contested` claim has an annotation naming the other side with references.
- [ ] Every annotation is anchored, evidenced, and within the closed schema — **no annotation contains replacement prose for the manuscript**.
- [ ] Every reference has an `area` and at least one of `supports` / `challenges` / `teaches`; `corpus_profile.by_area` covers every declared area; the corpus is inside `corpus_target` or Daniel said otherwise.
- [ ] Every concept has a `track`, all four levels, and `method_status` where its track is a methods track; L3/L4 prose is cited.
- [ ] Every figure has a `provenance`, its `artifact_refs` or `refs`, and a `script:` that exists.
- [ ] Every subgraph that declares `analytics` ships a `golden` file, and `data`, `script` and `golden` all exist.
- [ ] `artifacts.yaml` records the version of every study-internal source, and the known-corrections record is complete.

## History

- v0.1 (2026-09-14) — first draft: manifest, manuscript, glossary, concepts, figures, references, todo.
- v0.2 (2026-09-14) — `manifest.delivery` (`local` | `pages`); popover `short` ≤ 200 chars; citation lists and ranges.
- v0.3 (2026-09-14) — **topic mode.** `manifest.mode`, `scope.yaml`, `review.md` with enforced citation coverage and `framing`/`synthesis` markers, reference `tier`/`year`/`why_it_mattered`/`anchor`, figure `synthesis`/`refs`. Manuscript mode is unchanged: a v0.2 pack is a valid v0.3 pack.
- v0.4 (2026-09-15) — **volumes and the textbook tier** (topic mode): `manifest.volumes`, `volumes/<id>/review.md`, volume-prefixed section ids, one shared bibliography, per-volume `search_strategy`/`corpus_profile`/`outline_approved` in `scope.yaml`, `depth: textbook`, levelled 101s (`concept_levels`), and `claims.yaml` — the typed, cited graph seed with a declared vocabulary and competing-hypothesis groups. A v0.3 pack is a valid v0.4 pack.
- v0.5 (2026-09-15) — **`tier: classic`** for pre-window primaries the field leans on without being founded on them, and the textbook band raised to 200–250 references (25–40 seminal). Daniel's ruling on the V0 sweep (223 refs, 74 candidate seminals): the missing thing was an honest label, not a smaller corpus.
- v0.6 (2026-09-15) — textbook word band scaled to the corpus (18,000–40,000; 200–250 references needs 25,000–40,000). Set after V0 came in at 29,577 words with 220 references cited: the old 25,000 ceiling predated the corpus and would have meant cutting cited material.
- v0.7 (2026-09-15) — optional `finding: null-result` + `finding_note` on a claim, after V0 extraction produced nine edges whose asserted result was a null that the predicate alone would have read as positive. Spelled `null-result` because bare `null` is YAML for nothing.
- v0.8 (2026-09-20) — **critique mode.** A third intake for an unpublished draft the author is still writing: `manifest.draft`/`confidential`/`phase`/`areas`/`tracks`, `delivery: private`, the verbatim body from manuscript mode, and four new files — `claims-audit.yaml` (every claim of the draft, anchored by a verbatim quote rather than a marker, classified `supported` | `under-cited` | `uncited` | `contested` | `needs-own-data`), `annotations.yaml` (a **closed** schema with no field that could hold replacement prose), `artifacts.yaml` (**study-internal facts** as a third provenance class, cited to file and version, plus the known-corrections record) and `subgraphs.yaml` (curated extracts with export scripts and **required golden fixtures** for the in-browser analytics). References gain `area` and a required job (`supports` / `challenges` / `teaches`); concepts gain `track`, `method_status` and required four-level authoring; figures gain `provenance` and a required `script`. Topic and manuscript packs are untouched: a v0.7 pack is a valid v0.8 pack.
- v0.9 (2026-09-21) — `manifest.notes_storage` (`file` | `browser`, default `file`) documented for every mode, now that APP-SPEC §3.1 makes the file-backed notepad standard. Optional; a v0.8 pack is a valid v0.9 pack.
- v0.10 (2026-10-05) — **self-checks on the 101s become something to add.** `manifest.concept_self_checks` (`true` | `false`, default `false`): by default concept files omit `self_check` and the app renders no questions; `true` adds them and makes them required. Daniel, on the Token for Granted build: keep the primers, leave the questions out, and make the questions an addition on every future build. A v0.9 pack is still valid; one that carries self-checks sets the key to `true` to keep them shown.
- v0.10.1 (2026-10-05) — **validator only, no schema change.** Under `manifest.extensions.record_files` (the extension-file pattern of FAR Out and Token for Granted), a reference cited from a record file (`sources`, `cite`, `refs` lists and `[n]` in prose) or from a glossary definition counts as cited: `validate_pack.py` no longer warns about it, reports the count as `cited_in_records_or_glossary_only`, and raises an error for a record or glossary citation with no reference entry. The concept heading "## How this guide uses it" is accepted beside "paper" and "volume". FAR Out's pack goes from 1,126 warnings to 95 with no error.
- v0.10.2 (2026-10-05) — **validator only, no schema change.** Two checks that Token for Granted's own content build made and the validator did not, so that the two agree. Under `manifest.extensions.record_files`: a glossary definition of 25 words or more needs a `[n]` or a `<!-- framing -->` marker, like any other prose; and each entry of `queries.yaml` must have a text, a `date` in the form YYYY-MM-DD, no date under `hits` and no hit count under `engine`. In `scope.yaml`, a query whose `hits` was read out of a date is an error. FAR Out's pack and the three fixtures are unaffected.
