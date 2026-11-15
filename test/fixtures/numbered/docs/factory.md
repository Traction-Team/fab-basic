# Repository settings

| Setting | Value | Meaning |
| --- | --- | --- |
| `trunk` | `main` | Branch plans start from and merge into. |
| `verify` | `node --test` | Command that proves a branch green. |
| `setup` | `npm install` | Command a new worktree runs before its first check. |
| `specs` | `docs/specs` | Specs directory. |
| `plans` | `docs/plans` | Where plans live. |
| `plan-names` | `numbered` | `<round>.<NNN>-<slug>.md`. |
| `roadmap` | `docs/roadmap.md` | The roadmap `prioritise-roadmap` writes. |
| `roadmap-max-lines` |  | Empty means no limit. |
| `intake` | `docs/intake` | Intake notes. |
| `changelog` | `docs/changelog` | Changelog entries. |
| `stacking` | `off` | A plan waits for its unmerged need. |
| `docs-changes` | `pull-request` | Docs changes go through a pull request. |
| `release` | `off` | No release branch here. |
| `release-branch` | `production` | Branch a release merges into. |
| `release-guide` | `docs/releasing.md` | The guide the release workflow follows. |
