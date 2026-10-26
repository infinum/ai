# **AI Engineering Setup — Run This With Your Agent**

Copy everything below the line and paste it as a single message into your AI coding agent (Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, etc.).

---

You're helping me complete my AI engineering setup. We're checking four capabilities I want available in this project: PRD generation, spec-driven development, local PR review, and UI validation. If anything's missing, you'll offer to install it.

## **Defaults — set these once, don't re-ask**

* **Install scope:** ask me once at the very start of the run — project-level (this repo, default) or user/global (my home config). Lock in my answer and don't ask again at any later step.  
* **GitHub access:** use SSH (`git@github.com:...`) for clones and fetches. Don't fall back to HTTPS, and don't web-search for install instructions — repos linked here have READMEs.  
* **Agent \+ shell:** detect from your runtime. If you can run shell commands, run them after I confirm. If you can't, give me the exact command and I'll run it.

## **How to walk me through this**

One step at a time, in order. For each step:

1. One sentence on **why this matters** (the benefit, not a definition — assume I know what a PRD is).  
2. **Detect first, ask second.** Check whether the capability is already available to you (skill loaded, plugin installed, command exists). If yes, mark it ✓ and move on without a question.  
3. If something's missing, propose the install in one short message and wait for my yes/no. On yes, install. On no, share the link and move on.  
4. Print the checklist twice: once at the very start (after I pick scope) and once at the very end as a final summary. Don't print it on every reply in between — just tell me what happened in the current step and move on.

Each Infinum skill installs as its own plugin. On Claude Code, the recommended path is the one-shot installer — `pnpm dlx github:infinum/ai`, offered in Step 1 — which registers the `infinum-ai` marketplace, lays down team rules + a personalization stub, and runs an interactive picker so I can select the Infinum skills for Steps 1, 3, and 4 in a single pass. On other agents, or if I decline the installer, install one skill per step.

---

## **Start**

Your first message to me does two things:

1. Ask which scope to use for installs in this run — **project-level (default)** or **user/global** — and wait for my answer. Present as options a and b.  
2. Once I answer, print the checklist:  
   * \[ \] 1\. PRD generation  
   * \[ \] 2\. Spec-driven development  
   * \[ \] 3\. Local PR review  
   * \[ \] 4\. UI validation

Then begin Step 1\.

---

## **Step 1 — PRD generation**

A PRD skill turns a half-baked task description into a structured doc (goals, user stories, acceptance criteria, edge cases) before any code gets written. Cuts rework on real features.

If I already have a `create-prd` skill or equivalent available, mark it ✓ and move on.

If not, propose:

* **Claude Code (preferred):** the one-shot installer `pnpm dlx github:infinum/ai`. It registers the `infinum-ai` marketplace, lays down team rules, and runs an interactive picker so I can install `create-prd` plus the Infinum skills for Steps 3 and 4 in one go. When it finishes, ask me to confirm which skills I picked — mark Step 1 ✓ if `create-prd` was selected. Steps 3 and 4 will detect their respective skills naturally when we reach them. If I'd rather install one at a time, fall back to `/plugin marketplace add infinum/ai` then `/plugin install create-prd@infinum-ai`.
* **Other agents:** share `git@github.com:infinum/ai.git`. Ask once, link on no.

Ask once, run/install on yes.

---

## **Step 2 — Spec-driven development**

This forces the agent through understand → design → plan → build, with a reviewed spec (PRD, brief, tech spec, plan) in place before any code gets written. Big quality lift on anything non-trivial.

If I already have Caliber (`/caliber:*` commands, or the `plugin:caliber:caliber` MCP server) or an equivalent spec-driven workflow available (e.g. Superpowers), mark it ✓ and move on.

If not, propose Caliber — Infinum's AI delivery platform, https://caliber.infinum.com/. It needs a Caliber account (Infinum people, and partners who have been granted access); if I don't have one, share the link and move on. Use the install path for the agent you're running in:

* **Claude Code:** `/plugin marketplace add infinum/caliber-plugin` then `/plugin install caliber@caliber`. Sign in once via `/mcp` (choose `plugin:caliber:caliber`) or `claude mcp login plugin:caliber:caliber`, then run `/caliber:setup` once per repository.  
* **Other agents:** Caliber is a remote MCP server at `https://app.caliberhq.io/mcp` with OAuth sign-in — add it the way your agent adds a remote MCP server. If that isn't supported, share the link.

---

## **Step 3 — Local PR review**

Catches code smells, complexity, and quality issues before push. Much cheaper than catching them after the PR is open.

If I already have `pr-review-code-simplicity` or equivalent available, mark it ✓ and move on.

If not, propose `pr-review-code-simplicity` from the `infinum/ai` marketplace. For Claude Code: `/plugin install pr-review-code-simplicity@infinum-ai` (the marketplace was added in Step 1; if I skipped it, run `/plugin marketplace add infinum/ai` first). For other agents, share the repo link. Ask once, install on yes, link on no.

After this skill is in place, **optionally** offer to add a one-liner to `AGENTS.md` / `CLAUDE.md`: "Before opening a PR, run `pr-review-code-simplicity`." Opt-in. Ask once, skip on no.

---

## **Step 4 — UI validation**

Closes the gap between "the agent says it's done" and "the UI actually renders correctly" — catches layout regressions, broken states, and accessibility issues before the PR.

If I already have `ui-validation` or equivalent available, mark it ✓ and move on.

If not, propose `ui-validation` from the `infinum/ai` marketplace. For Claude Code: `/plugin install ui-validation@infinum-ai`. For other agents, share the repo link. Ask once, install on yes, link on no.

After this skill is in place, **optionally** offer to add a one-liner to `AGENTS.md` / `CLAUDE.md`: "Before opening a PR with UI changes, run `ui-validation`." Opt-in. Ask once, skip on no.

---

## **Wrap-up**

Once all four are handled, print the final checklist with each item marked `✓` (installed or already had it) or `—` (skipped). Then give me:

* One line summarizing what got installed vs what I already had vs what I skipped.  
* One concrete next thing to try — e.g. "pick a small feature and let's run it end-to-end through the new skills."

