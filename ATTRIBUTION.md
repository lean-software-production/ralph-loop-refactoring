# Source and attribution

The calculator and the doer/validator teaching sequence were extracted from
[software-factory-tutorial](https://github.com/lean-software-production/software-factory-tutorial),
commit `2d0194bf9be3707edc60a987da9fa6b64c0bc1bf`:

- `tutorial/workspaces/refactor-line/calculator/` — copied unchanged into `calculator/`.
- Lessons 001–004 and `tutorial/docs/seeds/part-2/` — adapted into this shorter, standalone tutorial.

This version omits the browser tutor and the later factory-operation lessons. A read-only
navigator plans refactorings and a driver edits the source. The short loop in `factory/run.mjs`
runs tests and ESLint, repeating until both pass or the attempt limit is reached. There is no
validator agent and nothing is automatically committed.

The calculator is an independent TypeScript adaptation of Chelsea Troy's natural-language
calculator exercise. Its original attribution and CC BY-SA 4.0 licence are preserved in
[`calculator/ATTRIBUTION.md`](calculator/ATTRIBUTION.md) and
[`calculator/LICENSE.md`](calculator/LICENSE.md).
