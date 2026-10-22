---
type: spec
project: manuscript-interrogator
version: 0.4
---

# TOPIC-WORKFLOW — from a topic to a commissioned review, pack and KICKOFF.md

**Version 0.3 · 2026-10-02.** The second intake mode of the builder. Where [[manuscript-interrogator/docs/BUILDER-WORKFLOW|BUILDER-WORKFLOW]] starts from a paper Daniel hands over, this starts from a **topic and a scope of interest**: the Cowork project interviews him to pin the scope, sweeps the literature, and then *writes the paper the app is built around* — a commissioned review — before handing the same content pack and kickoff to Claude Code.

Everything downstream is unchanged. The pack schema, the app spec, the design system, the validator and the single-shot kickoff are the same artefacts with a `mode: topic` branch ([[manuscript-interrogator/docs/CONTENT-PACK|CONTENT-PACK]] v0.3, [[manuscript-interrogator/docs/APP-SPEC|APP-SPEC]] v0.2, [[manuscript-interrogator/docs/DESIGN-SYSTEM|DESIGN-SYSTEM]] v0.2, [[manuscript-interrogator/docs/KICKOFF-TEMPLATE|KICKOFF-TEMPLATE]] v0.3). Phases T0–T5 here replace Phases 0–3 there; Phases 4–6 there (review pack, kickoff, review app) are shared.

**Wall clock:** one long Cowork session for the standard depth (~7,000-word review, 25–40 references), plus Daniel's ten minutes in the interview and his pack review.

## The shape of it

```
topic + scope of interest (Daniel, free text)
  → T0  first questions          → delivery, purpose, naming
  → T1  orienting pre-sweep      → field sketch (posted in chat)
  → T2  scoping interview        → scope.yaml  ← the Q&A he asked for
  → T3  corpus build + tiering   → references.yaml (seminal / current / background)
  → T4  outline, then the review → review.md, every claim cited
  → T5  terms, 101s, figures     → glossary.yaml, concepts/, figures.yaml
  → Phase 4–6 (shared)           → Daniel reviews pack → KICKOFF.md → Claude Code builds
```

## T0 — First questions (2 min, before any searching)

Four things are asked the moment Daniel states a topic, because none needs research and each changes what happens next.

1. **Delivery — local only, or GitHub Pages?** Same rule and same default (`local`) as BUILDER-WORKFLOW Phase 0. Topic mode changes the permissions picture rather than removing it: no manuscript is reproduced, so there is no third-party text gate — but the review itself is a publishable document with Daniel's name on the project, so `pages` still gets an explicit yes.
2. **What the review is *for*.** Orientation in a field that is new to him · choosing a research direction or a method · teaching material · background for a grant or paper. This sets emphasis, depth and how much methods detail the 101s carry. Default: orientation.
3. **Zotero — add this pack's references to his Zotero library?** Yes or no, recorded in the app hub's frontmatter as `zotero: yes` or `zotero: no` (Daniel, 2026-10-02). It is asked at the front of every build, in every mode, because the answer is about his library and has nothing to do with the paper. **Default `no`** when he doesn't answer or the session is unattended: nothing is written to his library without a yes. Same rule as BUILDER-WORKFLOW Phase 0; a yes is acted on in the shared Phase 5.
4. **Self-check questions on the 101s — add them?** Each 101 (called a primer in some apps) can end with a short multiple-choice self-check. Asked at the front of every build, in every mode, and written into `manifest.yaml` as `concept_self_checks: true` or `false` (Daniel, 2026-10-05). **Default `false`** when he doesn't answer or the session is unattended: the builder writes no questions and the app shows none. The primers themselves are the same either way. A yes makes the questions part of the pack, at least one per 101. Same rule as BUILDER-WORKFLOW Phase 0.

Repo slug and short title can wait until T2 — the scope usually renames the app.

## T1 — Orienting pre-sweep (20–40 min, no questions asked)

**The point of this phase is to make the interview specific.** A scoping interview written from the topic string alone produces generic questions ("how technical should it be?") that Daniel has to do the thinking for. One pass over the literature first turns them into real choices between real subfields.

Do 15–25 searches. Look for, and write down:

- The **named subfields** the topic splits into, and which ones a specialist would say are different literatures.
- The **landmark works** everyone cites — the papers that keep appearing in introductions, typically 5–15 years old or older.
- The **recent reviews** (last 3 years). Where a good one exists, say so: it changes what this app is *for* (complement, don't duplicate).
- The **live disagreements** — competing models, failed replications, a method under fire, a contested effect size.
- The **vocabulary**: what the field calls things, including terms Daniel's phrasing may not match.
- The **shape of the evidence**: mostly animal or human, mostly observational or trial, one dominant lab or many, any consensus statement or guideline.

Output: a **field sketch** — 200–300 words posted in the chat, naming subfields, 5–8 candidate landmark works with years, the open questions, and the 2–4 plausible ways to cut the scope. No pack files yet. Daniel reads this before he answers anything.

## T2 — Scoping interview (10 min, ≤ 2 rounds)

The interview is asked with the chat's question tool, at most four questions per round, at most two rounds, every question carrying a recommended default so it can be answered in two clicks. Free text is always available for an answer that isn't offered.

**Quality bar: every question names things from the field sketch.** "Which of these three cuts do you want?" with the cuts spelled out in the field's own vocabulary is the job. A question that could have been asked before T1 is a defect in the interview — rewrite it. If the pre-sweep left a genuine either/or that Daniel alone can settle, that is the question worth spending a slot on.

### Round A — the cut

1. **Boundary.** 3–4 concrete scopings drawn from the sketch, each stating *what is in and what is deliberately out*. Not "how broad?" — actual alternatives, e.g. "vagal anti-inflammatory signalling in humans, excluding rodent-only mechanistic work and excluding device engineering" versus "the full mechanistic chain including rodent work, excluding clinical trials".
2. **Level or scale of analysis**, framed in the field's terms (molecule ↔ circuit ↔ organism ↔ population; or by model system; or by clinical phase). Options from the sketch.
3. **Time window.** What counts as *current* — last 3 / 5 / 10 years — and how far back the *seminal* tier reaches. Default: current = 5 years, seminal = whatever is load-bearing regardless of age.
4. **Stance.** Settled-consensus primer · live-controversy map (competing positions given equal weight and named) · methods manual (how the work is actually done). Default: primer with a controversies section.

### Round B — the build

5. **Anchors.** Papers, authors, labs or reviews Daniel already trusts, or knows must be in. Free text; "none, you choose" is a real answer. Anchors seed the snowball in T3 and are marked `anchor: true` in the pack.
6. **Depth.** Brief (~3,500 words · 6 sections · ~20 refs) · **standard** (~7,000 · 9 · 25–40, default) · deep (~12,000 · 12+ · 60–80, multi-session) · textbook (18,000–40,000 · 14–20 · 200–250, volume apps only — see TV).
7. **What must not be in it.** Adjacent literatures that keep surfacing but he does not want (e.g. "no drug-development pipeline", "nothing about the clinical guidelines"). These are recorded as `excluded` with a reason and shown on `/methods` — an honest scope statement is worth as much as the inclusions.
8. **Slug and short title**, now that the scope is settled.

Round B may be skipped when Round A settles everything and the session is unattended; then defaults apply and are stated in the pack.

**Unattended rule.** If Daniel does not answer, take the sketch's most cited cut, `current = 5 years`, standard depth, primer stance, `delivery: local`, `zotero: no`, and write every assumption into `scope.yaml` under `assumed: true` and onto `/methods`. Never stall a topic build waiting for an answer.

Output: `content-pack/scope.yaml`, ratified — the document the rest of the build is accountable to.

## T3 — Corpus build and tiering (the long phase)

**Search strategy is part of the deliverable.** Every query run, every database, the date run, and the inclusion/exclusion rules go into `scope.yaml` verbatim and are rendered on `/methods`. A reader has to be able to see what the sweep would have missed.

1. **Query pass.** Run the strategy across the sources available to the Cowork project — web search plus Europe PMC, Crossref, OpenAlex, Semantic Scholar and any literature MCP connected to the project. Record hit counts per query, not just the keepers.
2. **Snowball.** Backward from the anchors and the best recent review (their reference lists), forward through citing works (OpenAlex/Semantic Scholar). This is what catches the seminal tier; keyword search alone systematically misses it.
3. **Tier** every survivor:
   - `seminal` — the work the field is built on. 8–12 at standard depth. Full `summary` (3–6 sentences) + `role_here` + why it mattered *then*.
   - `current` — the last N years per the scope. 20–30 at standard depth. One-to-two-line summary; full summary when it is load-bearing for a claim in the review.
   - `classic` — pre-window primaries the field leans on without being founded on them (v0.5). Full summary, as for seminal; `why_it_mattered` optional. No count band.
   - `background` — textbooks, methods papers, guidelines, definitional sources. Summary optional, `role_here` required. Not for primary studies.
4. **Verify.** Resolve every DOI; read the abstract, and the full text whenever it is accessible; `verified: true` only when a human-readable record was actually read. A reference that could not be verified is `verified: false` **and** appears in `todo.yaml` — it never silently becomes a citation.
5. **Balance check.** Count what the corpus looks like: years, venues, whether one lab dominates, whether contrary findings are represented. Record the counts in `scope.yaml.corpus_profile`. If the sweep found near-unanimity, say so and say why it might be an artefact of the queries.

Target at standard depth: **25–40 references**, dominated by `current`, anchored by `seminal`.

## T4 — Outline, then the review

**Outline first, and show it.** Post the section outline (9 sections at standard depth, each with a one-line claim and the references it will rest on) in the chat before writing a word of prose. This is the cheapest moment to fix a scope error, and it takes Daniel two minutes. Unattended: proceed, and flag the outline in the scrum note as unreviewed.

The standard shape, adapted to the topic — not a template to fill mechanically:

| Section | What it does |
|---|---|
| `abstract` | 150–250 words. The whole review in one paragraph. |
| `1-why-this-matters` | The question the field is trying to answer and why anyone cares. |
| `2-foundations` | What has to be true before the rest makes sense — where the seminal tier lives. |
| `3-…` to `6-…` | The substance, cut the way the scope says. One claim per section, argued from the corpus. |
| `7-methods-of-the-field` | How this work is actually done, and what the methods can and cannot show. The section that most reviews skip and students most need. |
| `8-open-questions` | Live disagreements, named, with both sides cited. Where the field is going. |
| `9-how-to-read-this-literature` | Practical: which journals, which search terms, which review to read next, which results to be sceptical of. |

### The rules that hold the review up

Topic mode is the one place where the builder writes the science, so the provenance rules get *stricter*, not looser:

1. **Every claim carries a citation.** Every paragraph of substance ends up with at least one `[n]`. The validator enforces it: a block of ≥ 25 words with no citation fails the pack unless it is explicitly marked `<!-- framing -->` (transitions, section openers, "the rest of this section…").
2. **Cite only what was read.** A reference with `verified: false` may not support a claim. No citation is ever produced from memory of a paper's contents.
3. **Numbers keep their source and their units.** Effect sizes, sample sizes, percentages, dates — each traceable to the reference it came from, quoted as that paper reported it. No rounding into a nicer number, no combining across studies into an average the literature never computed.
4. **Synthesis is labelled.** Where the review draws a conclusion the cited papers do not individually state, it says so in the text ("taken together, these suggest…") and the sentence is tagged `<!-- synthesis -->`; `/methods` lists every one of them. This is the honest version of the thing reviews usually do silently.
5. **Quotation is short and attributed.** ≤ 25 words, in quotation marks, with `[n]`. Nothing longer is reproduced from a copyrighted source — there is no verbatim-manuscript exception in this mode.
6. **Disagreement is not smoothed.** Where the corpus disagrees, both positions are stated and cited. The review never manufactures a consensus.
7. **The review is a snapshot.** `as_of` is stamped in the manifest, shown in the app header area per APP-SPEC, and stated in the abstract's last line.

Write `review.md` with the same section markers, figure markers, `[n]` citations and KaTeX as a manuscript, so the reader, the term-linker and the citation fold-outs work unchanged.

## T5 — Terms, 101s, figures

Identical in kind to BUILDER-WORKFLOW Phases 2–3, run over `review.md`:

- **Glossary** — every term a non-specialist would trip over, science and methods alike. A commissioned review tends to generate *more* method terms than a paper does, because it spans several literatures' methods.
- **101s** — 6–15 concepts. In topic mode a 101 may cover something the review only gestures at; `why_here` still has to name the section that needs it.
- **Figures** — this is the real difference. There is no published figure to rebuild, so every figure is **synthesised** and must declare what it is made of:
  - `synthesis: data` — a chart built from values extracted from the corpus. Every row of the CSV carries a `ref` column naming the reference it came from. A forest plot of effect sizes across studies, a timeline of when key results landed, a table comparing methods across papers — these are the ones that earn their place, because no single paper contains them.
  - `synthesis: conceptual` — a diagram of a mechanism, pathway or decision tree drawn from the cited sources. `refs:` lists what it is drawn from; `source:` says plainly that it is the builder's drawing.
  - Every figure lists `refs: [n, …]`. A figure with no references does not ship.
  - Republishing a published figure image is out unless permission is explicit in `manifest.permissions.figures` — the default in topic mode is that there are no original images at all.

## TV — Volume builds and the textbook tier (v0.2)

Use this when the scope is bigger than one `deep` review. Daniel chose it for the Neuromodulation Atlas (2026-09-15); the pack schema is CONTENT-PACK v0.4 §Volumes, the app behaviour APP-SPEC v0.3 §1.2 and §4.1.

**When.** More than ~80 load-bearing references, or several literatures that each deserve their own review (the neuromodulation modalities are the model case). Decide at T2 Round A: *one app in volumes* versus *one app per sub-topic*.

**How the phases change.**

| Phase | Single review | Volume app |
|---|---|---|
| T0–T2 | once | **once for the whole app**; Round A also fixes the volume list and order; V0 is normally *Foundations* (shared framework, vocabulary, methods, modality map) |
| T3 corpus | one sweep | **one sweep per volume**, appending to the one bibliography; queries logged under `scope.yaml.volumes.<id>` |
| T4 outline | shown once | **shown per volume and approved** — `outline_approved` is a required date for a textbook volume, not a courtesy |
| T4 prose | one session | a textbook volume is written in **section batches** across sessions; each batch is validated before the next is started |
| T5 | once | glossary, 101s and figures **grow**; ids are never renamed once a volume has shipped |
| T6 claims | — | **new:** extract `claims.yaml` for the volume (below) |
| Phases 4–6 | one KICKOFF | **one KICKOFF per volume**, `Kn` item per volume; the first builds the app, later ones extend it |

**Textbook tier bands (per volume).** ~18,000–25,000 words · 14–20 sections · 120–200 references (25–40 seminal, full summaries) · levelled 101s where `concept_levels` is on. The snowball carries more of the load than at standard depth; expect the seminal tier to come almost entirely from backward citation chasing.

**T6 — claims extraction.** After the volume's prose validates, walk it section by section and write every mechanism statement a schema designer would want as an edge into `claims.yaml`:

1. One claim per edge, subject → predicate → object, typed from the declared `vocabulary`; extend the vocabulary deliberately (and note the change in the scrum note) rather than forcing a bad fit.
2. `refs` are exactly the citations that support *that* edge in the prose — never a different paper, never a reference the prose does not cite.
3. Parameters, species and evidence are copied as the cited work reports them. A rodent result is not a human edge.
4. A disagreement named in the prose becomes a `hypotheses` group with each rival's claims marked `contested`. A conclusion the prose tags `synthesis` becomes `status: inferred`, `synthesis: true`.
5. Prefer ontology xrefs (UBERON, CL, GO, CHEBI, PR, NCBITaxon, NPO, SCKAN ids) where the identifier was actually looked up; leave `xref` out rather than guess one.
6. Re-run the validator. Coverage check by hand: every `## ` section of the volume that argues a mechanism has at least one claim.

**Session rhythm for a textbook volume.** Session 1: T3 sweep and tiering, outline posted. Daniel approves. Sessions 2–n: prose in batches of 3–5 sections, validated each time. Final session: T5 additions, T6 claims, pack review, KICKOFF. Every session ends by updating the project doc so the next one can pick up cold.

## Shared phases

**Phase 4 (review pack)** — Daniel reads the pack in Obsidian, or clicks the built app if he prefers (his stated preference on the pilot). In topic mode he is reviewing *the builder's science writing*, which is a different job from checking an extraction: the outline in T4 exists so this review has no surprises in it.

**Phase 5 (kickoff)** — `python3 tools/validate_pack.py apps/<slug>/content-pack` must return 0 errors, freeze the docs into `apps/<slug>/docs/`, instantiate `KICKOFF-TEMPLATE.md` with `{{mode}}: topic`, create the K0 item, hand over the launch line.

**Phase 6 (review app)** — unchanged. Lessons that generalise become a version bump of this file or the specs.

## What topic mode is not

- It is **not a systematic review**. It does not claim exhaustiveness, it is not PRISMA, and `/methods` says so in those words. It is a well-sourced, scope-bounded, honestly-documented commissioned review.
- It is **not a substitute for reading the seminal papers** — the app's job is to get a reader to them faster, which is why the reference tiering and `role_here` matter more here than in manuscript mode.
- It does **not** get published anywhere without Daniel's explicit `delivery: pages` answer, and even then it carries the builder's name and the `as_of` date on `/about`.

## History

- v0.1 (2026-09-14) — first draft. Spine chosen by Daniel: a **commissioned review** at `/read` rather than a literature-landscape surface, sweep tiered at 25–40 references, module carried as a `mode:` key inside the existing specs rather than a parallel doc set.
- v0.4 (2026-10-05) — **the self-check question** joins T0: whether to add self-check questions to the 101s, default `false`, recorded as `manifest.concept_self_checks` (BUILDER-WORKFLOW v0.5.3).
- v0.3 (2026-10-02) — **the Zotero question** joins T0: asked at the front of every build, default `no`, recorded as `zotero:` in the app hub, acted on in the shared Phase 5 (BUILDER-WORKFLOW v0.5.2).
- v0.2 (2026-09-15) — **TV: volume builds and the textbook tier** — one interview for the app, one sweep, approved outline and KICKOFF per volume, section-batch writing, and the new T6 claims extraction into `claims.yaml`. Raised by the Neuromodulation Atlas intake (backlog B3.1).
