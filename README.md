# fab-basic

Plan, build and review one pull request at a time, with a person at each decision.

`fab-basic` is a Metafab factory: a factory packaged for reuse. It files intake, orders the roadmap, plans a pull request, builds it, reviews it, and hands it over as a merge-safe draft. People keep five decisions: what is next, the plan, each wave, "done", and the merge.

The whole process is in [.factory/docs/process.md](.factory/docs/process.md): the words, the pipeline, claims, landing, features, stacking and releases.

## Version 0.2.0 is breaking

0.2.0 needs **Metafab 2**, which reads `format: 2` factories. Metafab 1 refuses this factory with exit 4. Every 0.2.x release needs Metafab 2.0.0 or later, which `npx --yes @seasb/metafab` installs:

```sh
npx --yes @seasb/metafab
```

It also **removes the `agent-harnesses` skill**. Each harness's notes now live in the harness case of `.factory/partials/sub-agents.md`, which the workflows import, so nothing that named the skill has anything to load.

To move a repository from 0.1:

```sh
npx --yes @seasb/metafab update --to ^0.2.0 --setup
```

The update lists the new required files, the three `.claude/agents/` sub-agents, and `--setup` creates them. Then select what your agents read (below) and run `metafab build`.

## What it assumes

- Node.js 20 or newer, and `gh`, signed in.
- A harness that runs the sessions: OpenCode, Claude Code or Amp.
- A workspace that gives each worker a checkout: Orca worktrees, Amp orbs, or plain `git worktree`.
- A Git repository on GitHub, with `main` as the trunk unless you set `trunk` otherwise.

The harness and the workspace are independent, and the factory ships one procedure per case. Select yours in Git config, which is never committed:

```sh
npx --yes @seasb/metafab env set harness=opencode    # or harness=claude, harness=amp
npx --yes @seasb/metafab env set workspace=orca      # or workspace=orb, workspace=worktree
```

Add `--global` for every repository on the machine, or comma-separate values (`harness=opencode,claude`) when you use more than one. `metafab env` shows the selection and where each value came from. With nothing selected, every case is installed, labelled, so an agent reads only the one that matches where it is.

## Import it

```sh
npx --yes @seasb/metafab import github:Traction-Team/fab-basic --agents claude,codex --setup
```

The fab is shared only as this Git repository. It is not on npm.

`--setup` creates the repository files the factory needs from its templates: `docs/factory.md`, `opencode.json`, `.claude/agents/agent-coding.md`, `agent-review.md`, `agent-planning.md`, `orca.yaml` and `docs/roadmap.md`. Existing files are never changed.

Then open `docs/factory.md` and set every `<set me>` value. `verify` is the one value with no default: it is the command that proves a branch green.

The `orca.yaml` template runs `npx --yes @seasb/metafab build` in each new worktree.

## Updates

A new version of the fab arrives with:

```sh
npx --yes @seasb/metafab update
```

Review the summary, run `verify`, and commit. `docs/factory.md` is yours: the fab ships no copy, so an update never touches it. Other edits you make in `.factory/` are merged, and `metafab diff` lists them.

## Releases

A release is a `v<version>` tag on `main`. Tag the commit and push the tag:

```sh
git tag v0.2.1
git push origin v0.2.1
```

Nothing is published to npm. The changes in each release are in [CHANGELOG.md](CHANGELOG.md).
