# fab-basic

Plan, build and review one pull request at a time, with a person at each decision.

`fab-basic` is a Metafab factory: a factory packaged for reuse. It files intake, orders the roadmap, plans a pull request, builds it, reviews it, and hands it over as a merge-safe draft. People keep five decisions: what is next, the plan, each wave, "done", and the merge.

The whole process is in [.factory/docs/process.md](.factory/docs/process.md): the words, the pipeline, claims, landing, features, stacking and releases.

## What it assumes

- Node.js 20 or newer, and `gh`, signed in.
- Orca with OpenCode, or Amp, to run workers and sub-agents. The workflows carry both flows.
- A Git repository on GitHub, with `main` as the trunk unless you set `trunk` otherwise.

## Import it

```sh
npx @seasb/metafab import @seasb/fab-basic --agents claude,codex --setup
```

From Git, the same fab:

```sh
npx @seasb/metafab import github:Traction-Team/fab-basic --agents claude,codex --setup
```

`--setup` creates the repository files the factory needs from its templates: `docs/factory.md`, `opencode.json`, `orca.yaml` and `docs/roadmap.md`. Existing files are never changed.

Then open `docs/factory.md` and set every `<set me>` value. `verify` is the one value with no default: it is the command that proves a branch green.

The `orca.yaml` template runs `npx --yes @seasb/metafab build` in each new worktree. That step needs `@seasb/metafab` on npm (1.0.0). Until then, put your own build command in `orca.yaml` instead.

## Updates

A new version of the fab arrives with:

```sh
npx @seasb/metafab update
```

Review the summary, run `verify`, and commit. `docs/factory.md` is yours: the fab ships no copy, so an update never touches it. Other edits you make in `.factory/` are merged, and `metafab diff` lists them.
