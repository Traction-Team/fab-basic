# Changelog

A release is a `v<version>` tag on `main`. The tag holds the exact commits; this file says what changed for the people who use the factory.

## 0.2.0 — breaking

This release needs **Metafab 2**. It reads a `format: 2` factory; Metafab 1 refuses this one with exit 4. Run it through the `next` dist-tag until 2.0.0 ships:

```sh
npx --yes @seasb/metafab@next
```

**Breaking: the `agent-harnesses` skill is gone.** Its per-harness notes moved into the `harness` cases of `.factory/partials/sub-agents.md`, which every workflow that starts a sub-agent imports. A repository that named the skill has nothing left to load, and needs no replacement.

What is new:

- **Environments.** The factory declares `harness` (`opencode`, `claude`, `amp`) and `workspace` (`orca`, `orb`, `worktree`). Each procedure lives once, in a `switch` over one of them, so an OpenCode session reads the OpenCode steps and nothing about Orca, and an Amp orb reads the orb steps and nothing about plain worktrees. With nothing selected, every case is installed, labelled.
- **Choosing what your agents read.** `metafab env set harness=opencode`, `metafab env set workspace=orca`, `--global` for every repository, and `metafab env` to see the selection and where it came from. A selection lives in Git config, so every worktree of a clone shares it.
- **Claude Code sub-agents.** `.claude/agents/agent-coding.md`, `agent-review.md` and `agent-planning.md`, shipped as required files with no model pinned, so each runs on the session's model. The `claude` harness case dispatches them by name.
- The `metafab` setting defaults to `npx --yes @seasb/metafab@next` in the setup template, and the `orca.yaml` template runs the same, because both have to read `format: 2`.
- Workflow descriptions name no harness, no workspace and no sub-agent.

To move a repository from 0.1:

```sh
npx --yes @seasb/metafab@next update --to ^0.2.0 --setup
```

Review the summary, select your environment, and run `metafab build`.

## 0.1.1

- The release range, pinned stack merges, and the rule that a claimed pull request changes only through `build-plan` and `finish-plan`.

## 0.1.0

- The first release: the pipeline, its workflows, the settings reader and scripts, the templates, and the `agent-harnesses` and `stacked-prs` skills.
