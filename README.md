# TopTechHR

**The HR edition of Key Personnel.** Four questions about an opening — the goal, what is being seen, what is true of the role, where the work is — return one page: the constraints that match, ranked by how many answers each matches; the actions on them with their evidence grade, the effect as the studies reported it and what each does not do; the rules to check with their dates and text; and the numbers that frame it, every Alabama or Huntsville figure beside its national counterpart. A notebook turns highlighted passages into quotes that keep their sources and exports an action plan as `.docx`, PDF, HTML, Markdown or JSON.

Live: <https://danieladamek.github.io/toptechhr/> · The evidence edition: <https://danieladamek.github.io/key-personnel/>

Not legal, HR, compliance or financial advice. No firm is named anywhere and none had a part in it. No account, no server, no analytics: Start answers and notebooks stay in the browser's `localStorage`.

## The evidence: one pack, two apps

TopTechHR carries **no evidence of its own**. Every fact, figure, rule and citation is the **Key Personnel content pack**, pinned as a git submodule at `pack/key-personnel` and checked out at the tag recorded in `package.json` (`"toptechhr": {"packTag": "pack-2026-10-22"}`), which the top band of every page shows. The content build reads `pack/key-personnel/content-pack/` and nothing else (`PACK_DIR` overrides it for local work against a sibling checkout).

The pack's quotation rule, from its `manifest.yaml` `permissions.text`: *builder-authored; no third-party text reproduced beyond quotations of 25 words or fewer, each attributed and cited; US government works are public domain and are summarised, not reproduced; journal articles are summarised with their reported statistics and never reproduced.*

TopTechHR adds only a thin **HR layer** (`hr-layer/`): plain names for the actions and rules, the four Start steps, the moments HR meets each rule, the action-plan template and glossary aliases. It renames and arranges; it never adds a fact. A plain name renders **above** the pack's own name, never instead of it. `tools/validate_hr_layer.py` fails the build if any HR-layer line points at a record that does not exist or carries a `[n]`, a percentage or a dollar figure.

## Quick start

Double-click **`App Shortcuts/▶ Open TopTechHR.command`** (in the team folder). It runs `npm ci` when `node_modules` is missing, `npm run build` when `src`, `public` or `index.html` is newer than `dist/index.html`, then `npm run preview -- --port 4193 --strictPort` and opens **<http://localhost:4193/>**.

By hand:

```bash
git clone --recurse-submodules https://github.com/danieladamek/toptechhr.git && cd toptechhr
npm ci
npm run build:content   # validate the pack and the HR layer, emit src/data/*.json (committed)
npm run build           # tsc + vite → dist/
npm run preview -- --port 4193 --strictPort
```

`src/data/` is committed, so `npm run build` works without the submodule; `build:content` needs it (`git submodule update --init`).

| Script | What it does |
|---|---|
| `npm run build:content` | Runs the Key Personnel zod schemas over the pack, `tools/validate_hr_layer.py`, the citation-coverage gate, the term linker (with `hr-layer/glossary-aliases.yaml` folded into the variants), and emits `src/data/*.json`, `hr.json`, `numbers.json`, `plan-order.json`, `pack.json` and `public/provenance.json`. Exit **2**: the pack is missing or the HR layer fails — nothing is emitted. Exit **1**: the pack carries content errors, written to `BUILD-ERRORS.md` and listed on `/library/methods`. |
| `npm run validate:hr` | `python3 tools/validate_hr_layer.py hr-layer pack/key-personnel/content-pack` |
| `npm run refresh:bls` | Requests the latest value of every indicator's BLS series from the BLS Public Data API v1 (`GET https://api.bls.gov/publicAPI/v1/timeseries/data/{seriesID}`, no key) and writes `public/data/benchmarks/latest.json` — never committed. Run by the deploy workflow only. |
| `npm run update:pack` | Moves the submodule to the newest `pack-*` tag, rewrites `packTag`, reruns `build:content` and the validator; non-zero if either fails. |
| `npm test` | Vitest: the ported Key Personnel content-build and ranker suites, the HR validator, plan order, numbers, the quote resolver, the Notebook reducer and the exporters. |
| `npm run test:e2e` | Playwright on `dist/` (:4173), built with `tests/fixtures/benchmarks/latest.json` copied into `public/data/benchmarks/`. |

## Updating the pack

Weekly (Tuesday 09:41 UTC) and on demand, `.github/workflows/update-pack.yml` runs `npm run update:pack`; when the pack has a newer tag it opens a pull request titled **“Pack: <tag>”** with the pack README's sweep paragraph in the body. A red check means the new pack fails the content build or the HR-layer validator. Merging redeploys. By hand: `npm run update:pack`, review, commit `package.json`, `pack/key-personnel` and `src/data/`.

## Deploy

`.github/workflows/deploy.yml` (push to `main`, manual, and weekly Monday 10:23 UTC for the BLS refresh): checkout with submodules → `npm ci` → the HR validator → `npm test` → `build:content` → `refresh:bls` → `npm run build` with `BASE_PATH=/toptechhr/` → `404.html` fallback → GitHub Pages. Pushes and manual runs also run the Playwright suite first.

## Surfaces

`/` Start · `/plan` (and the record pages `/plan/constraints/:id`, `/plan/actions/:id`, `/plan/programs/:id`) · `/rules`, `/rules/:gateId`, `/rules/state/:stateId` · `/numbers` · `/library/{guide,primers,glossary,sources,methods}` · `/notebook`, `/notebook/:id`, `/notebook/:id/print` · `/about`. Product strings live in `src/strings.ts`. The dependency map is not ported; the Plan's “See how these connect” opens it in the evidence edition.

## Provenance

The content build fails loudly and never repairs the pack: uncited prose is listed, never given a citation; an unknown id is listed, never re-pointed. `/library/methods` shows the provenance counts, every `TODO(author)`, every build error, every synthesis passage, the scope, every query and the hypothesis ledger — everything the evidence edition's Methods page shows.
