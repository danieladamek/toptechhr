# TopTechHR — the HR edition of Key Personnel

Pre-build state (2026-10-22). This folder holds what the build-and-delivery role needs: `KICKOFF.md` (the work queue), `hr-layer/` (the thin HR layer: plain names, the Start flow, the rule moments, the action-plan template, glossary aliases), `tools/validate_hr_layer.py` (fails if any HR-layer line points at a record that does not exist or carries a figure or a citation of its own), `brand/` (the logo: original, transparent, mark only), and `docs/` (the builder docs frozen at build time). The evidence is the **Key Personnel content pack**, pinned as a git submodule at a tag (KICKOFF §2); nothing in this folder states a fact.

```
python3 tools/validate_hr_layer.py hr-layer ../key-personnel/content-pack   # 0 errors at this state
```
