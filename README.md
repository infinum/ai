# Infinum AI Stack

_A workflow, a spec engine, a set of skills, and an in-house agent — packaged together and installed per repo with one command._

---

## What's in the stack

| # | Component | What it is |
|---|-----------|------------|
| 01 | [**PSDD**](psdd/README.md) | Pragmatic Spec Driven Development — Infinum's 4-step workflow for shipping features with AI. Depth scales with the work. |
| 02 | [**Superpowers**](https://github.com/obra/superpowers) | Open-source spec-driven development plugin by @obra, adopted as our default. Powers spec → plan → code with brainstorming, TDD, and self-review skills. |
| 03 | [**Skills marketplace**](MARKETPLACE.md) | Per-repo installable plugins — PRD authoring, security audits, UI validation, local PR review, and more. Install only what the project needs. |
| 04 | [**Phantom**](https://github.com/infinum/ai-phantom) | Infinum's Slack-native AI agent. Mention `@Phantom` in a thread, it clones the repo, applies the change, runs your validation, and opens a PR. |

---

## Quick start

### 1. Align your AI coding setup

Run [`prompts/ai-engineering-setup.md`](prompts/ai-engineering-setup.md) with your AI coding agent of choice — Claude Code, Codex, Cursor, Gemini CLI, Copilot. The prompt is agent-agnostic. It checks what you already have and walks you through whatever's missing across four capabilities:

- A PRD creation skill
- A spec-driven development plugin (Superpowers, or your own equivalent)
- A local agentic PR-review skill
- A UI validation skill

> **Default to project-level setup.** We prefer each repo to carry its own AI workflows so configuration ships with the code. User-level works too, but your improvements stay on your machine instead of traveling with the repo.

### 2. Use it on a real feature

The stack pays off on work with real complexity — a new screen, a meaningful refactor, business logic with edge cases. It's overkill for small bug fixes, copy tweaks, or anything you'd knock out in under an hour.

The full flow for a meaningful feature:

- Start from a PRD or a well-refined task ticket — capture what "done" means before writing any code
- Brainstorm → design → plan → implement, using Superpowers or your equivalent spec-driven setup
- Iterate on the UI with the UI validation skill where applicable
- Run a local PR review before you push

**Optional:** layer in cloud PR review (CodeRabbit) on top of the local pass for an additional automated check.

### 3. Stay current

The installer enables the [`stack-essentials`](plugins/stack-essentials/) plugin by default. It prints a banner at session start when `infinum/ai` has new commits on `main` since your last installer run — telling you a new version of the workspace installer is available and nudging you to re-run `pnpm dlx --allow-build=infinum-ai github:infinum/ai`. That's all it does; picking up the update is a manual re-run (do it yourself, or have an agent run it non-interactively — `node bin/install.js --help` lists the flags). Re-running is idempotent and reports exactly which rules changed (often "nothing" — see the plugin README for why). Plugin updates flow through the Claude Code marketplace's auto-update toggle separately.

To disable the update banner: set `INFINUM_STACK_SKIP_UPDATE_CHECK=1` in your environment, or run `/plugin disable stack-essentials`.

---

## Glossary

| Term                | Meaning                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Stack**       | The packaged combination of workflow, spec engine, skills, and agent that Infinum engineers install per repo. Described in this document.                                                                                 |
| **PSDD**            | Pragmatic Spec Driven Development — Infinum's 4-step workflow for building with AI. Full guide: [psdd/README.md](psdd/README.md).                                                                                         |
| **Superpowers**     | Open-source spec-driven development plugin by [@obra](https://github.com/obra/superpowers), adopted as our default. Powers spec → plan → code with brainstorming, planning, TDD, and self-review skills.                 |
| **Skill**           | A focused, reusable instruction set installed as a plugin. Defined in a `SKILL.md` file. Each Infinum skill ships as its own plugin so engineers install only what they need.                                             |
| **Phantom**         | Infinum's in-house Slack-native AI agent. Runs jobs in isolated Docker containers; opens PRs assigned to a human owner. Repo: [infinum/ai-phantom](https://github.com/infinum/ai-phantom).                               |

For PSDD-specific terms (PRD/FRD, Technical brief, Ask mode, Plan mode, Build mode, Agent, Fresh agent, Context window) — see the [PSDD glossary](psdd/README.md#glossary).

---

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE) — free for noncommercial use; commercial use requires a separate license from Infinum, which holds the copyright.

Contributions are accepted by default only from the Infinum group (Infinum and its subsidiaries/affiliates); outside contributions are declined by default and require triage. See [Contribution policy and licensing](CONTRIBUTING.md#contribution-policy-and-licensing).
