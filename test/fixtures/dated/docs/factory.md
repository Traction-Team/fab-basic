# Repository settings

| Setting | Value | Meaning |
| --- | --- | --- |
| `trunk` | `main` | Branch plans start from and merge into. |
| `verify` | `node --test` | Command that proves a branch green. |
| `setup` |  | Empty means no setup step. |
| `specs` |  | Empty skips the spec steps. |
| `plans` | `docs/plans` | Where plans live. |
| `plan-names` | `dated` | `YYYY-MM-DD-[<code>-<n>-]<slug>.md`. |
| `roadmap` | `docs/roadmap.md` | The roadmap `prioritise-roadmap` writes. |
| `roadmap-max-lines` | `6` | At most six open lines. |
| `intake` | `docs/intake` | Intake notes and sightings. |
| `changelog` | `docs/changelog` | Changelog entries. |
| `features` | `docs/features` | Feature docs, and plan codes. |
| `stacking` | `on` | A plan whose need is building stacks on its branch. |
| `docs-changes` | `pull-request` | Docs changes go through a pull request. |
| `release` | `off` | No release branch here. |
