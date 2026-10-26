# Infinum AI Stack

_A workflow, a set of skills, and a delivery platform — packaged together and installed per repo with one command — so specs, quality gates, and measurement live alongside the code._

---

## What's in the stack

| # | Component | What it is |
|---|-----------|------------|
| 01 | [**PSDD**](psdd/README.md) | Pragmatic Spec Driven Development — Infinum's 4-step workflow for shipping features with AI. Depth scales with the work. |
| 02 | [**Skills marketplace**](MARKETPLACE.md) | Per-repo installable plugins — PRD authoring, security audits, UI validation, local PR review, and more. Install only what the project needs. |
| 03 | [**Caliber**](https://caliber.infinum.com/) | Infinum's AI delivery platform. **Define** specs (PRD, brief, tech spec, plan) following PSDD, reviewed and approved in the portal; **Assure** every PR with code, security, and spec-conformance audits plus a human sign-off; **Measure** AI cost and delivery per project, team, and person. Agents connect through one MCP server — Claude Code via [infinum/caliber-plugin](https://github.com/infinum/caliber-plugin). [Talk to us](https://caliber.infinum.com/talk-to-us/) to learn more. |
| 04 | [**Sandbox kits**](sandbox-kits/README.md) | Docker Sandboxes kits for a `claude` sandbox — reusable mixins that configure sandbox setup (e.g. `infinum-full`: disables commit/PR attribution, installs Infinum plugins, registers the Context7 MCP server). |

---

## Quick start

### 1. Align your AI coding setup

Run [`prompts/ai-engineering-setup.md`](prompts/ai-engineering-setup.md) with your AI coding agent of choice — Claude Code, Codex, Cursor, Gemini CLI, Copilot. The prompt is agent-agnostic. It checks what you already have and walks you through whatever's missing across four capabilities:

- A PRD creation skill
- A spec-driven development setup (Caliber, or your own equivalent)
- A local agentic PR-review skill
- A UI validation skill

> **Default to project-level setup.** We prefer each repo to carry its own AI workflows so configuration ships with the code. User-level works too, but your improvements stay on your machine instead of traveling with the repo.

### 2. Use it on a real feature

The stack pays off on work with real complexity — a new screen, a meaningful refactor, business logic with edge cases. It's overkill for small bug fixes, copy tweaks, or anything you'd knock out in under an hour.

The full flow for a meaningful feature:

- Start from a PRD or a well-refined task ticket — capture what "done" means before writing any code
- Understand → design → plan → build, using Caliber's `prd`, `brief`, `tech-spec`, and `plan` commands or your equivalent spec-driven setup
- Iterate on the UI with the UI validation skill where applicable
- Run a local PR review before you push; with Caliber set up in the repository, the check runs on push and the PR gets its Caliber status

**Optional:** layer in cloud PR review (CodeRabbit) on top of the local pass for an additional automated check.

### 3. Stay current

The installer enables the [`stack-essentials`](plugins/stack-essentials/) plugin by default. It prints a banner at session start when `infinum/ai` has new commits on `main` since your last installer run — telling you a new version of the workspace installer is available and nudging you to re-run `pnpm dlx github:infinum/ai`. That's all it does; picking up the update is a manual re-run (do it yourself, or have an agent run it non-interactively — `node bin/install.js --help` lists the flags). Re-running is idempotent and reports exactly which rules changed (often "nothing" — see the plugin README for why). Plugin updates flow through the Claude Code marketplace's auto-update toggle separately.

To disable the update banner: set `INFINUM_STACK_SKIP_UPDATE_CHECK=1` in your environment, or run `/plugin disable stack-essentials`.

---

## Glossary

| Term                | Meaning                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Stack**       | The packaged combination of workflow, skills, and delivery platform that Infinum engineers install per repo. Described in this document.                                                                                  |
| **PSDD**            | Pragmatic Spec Driven Development — Infinum's 4-step workflow for building with AI. Full guide: [psdd/README.md](psdd/README.md).                                                                                         |
| **Skill**           | A focused, reusable instruction set installed as a plugin. Defined in a `SKILL.md` file. Each Infinum skill ships as its own plugin so engineers install only what they need.                                             |
| **Caliber**         | Infinum's AI delivery platform. Defines specs (Define), gates every pull request with audits and a human sign-off (Assure), and measures AI cost and delivery (Measure). Agents connect through one MCP server; Claude Code via [infinum/caliber-plugin](https://github.com/infinum/caliber-plugin). More at [caliber.infinum.com](https://caliber.infinum.com/); [talk to us](https://caliber.infinum.com/talk-to-us/) to learn more. |

For PSDD-specific terms (PRD/FRD, Technical brief, Ask mode, Plan mode, Build mode, Agent, Fresh agent, Context window) — see the [PSDD glossary](psdd/README.md#glossary).

---

## License

This project is **source-available, not open source.** It is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](LICENSE) — full text in [LICENSE](LICENSE) and at <https://creativecommons.org/licenses/by-nc/4.0/>. The license permits **noncommercial use only** and covers the entire repository, both its source code and its documentation.

### What this means in practice

You are free to:

- read, use, copy, modify, and share this project;
- use it for personal, educational, research, and other **noncommercial** purposes;
- use it within charitable, educational, public-research, public-safety or health, environmental-protection, and government organizations,

as long as you give **appropriate credit** (attribution) and indicate any changes you made.

You may **not** use this project, or anything based on it, for any **commercial** purpose. A commercial purpose is, broadly, use primarily intended for or directed toward commercial advantage — including using this tooling or documentation to deliver services to your own clients or customers.

### Commercial use

Infinum offers AI transformation as a service. If you want to use this tooling or documentation commercially — in your own products, in client work, or in your internal business operations — you need a separate commercial license from Infinum, which holds the copyright. To discuss commercial licensing, contact **[hello@infinum.com](mailto:hello@infinum.com)**.

### What's included, what's not

This repository contains the parts of our AI tooling and way-of-working documentation that we are comfortable sharing publicly. Client-specific material, credentials, internal-only processes, and other sensitive content have been removed and are kept in a separate private repository.

### Trademarks

The name "Infinum", the Infinum logo, and other Infinum brand elements are trademarks of Infinum d.o.o. They are **not** licensed under CC BY-NC 4.0 or any other license in this repository, and nothing here grants you any right to use them.

### No warranty

As stated in the license, this project is provided "as is", without warranties or conditions of any kind, to the fullest extent the law allows; Infinum will not be liable for any damages arising out of the license or the use of the project.

### Contributions

Contributions are accepted by default only from the Infinum group (Infinum and its subsidiaries/affiliates); outside contributions are declined by default and require triage. See [Contribution policy and licensing](CONTRIBUTING.md#contribution-policy-and-licensing).
