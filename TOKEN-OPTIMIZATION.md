# Token Usage Optimization

_How to keep your AI coding spend lean — what drains your token budget, and the concrete habits that slash it._

---

## What drains your budget?

- **Long conversations replay everything.** The entire history is resent with every prompt. Endless micro-adjustments ("center that element," "no, vertically," "use flex") 20+ messages deep quietly bleed tokens on every turn.
- **Context pollution.** Duplicated system rules, overlapping local/global skills, raw log and script output, and large files (mocks, translations, generated JSON) all pile into the context window and get re-sent on every prompt.

---

## How to slash spending

### Right-size the brainpower

Picking a model is about quality and speed, not bragging rights. The strongest model is the right call surprisingly rarely.

- **A more powerful model isn't automatically a better one.** Reaching for the strongest model by default often backfires — e.g. Opus tends to over-engineer and overcomplicate straightforward code, so you wait longer for a worse result than a lighter model would have produced. There's no point spinning up Opus with extra-high thinking to "open a PR" when cheaper models would do it correctly and faster.
- **Match the model to the cognitive load.** Reasoning models "think" before they answer, which is slower and easy to waste — a reasoning model can spend thousands of thinking tokens just to produce a one-line fix. Use fast, non-reasoning models for boilerplate, refactoring, and mechanical chores; reserve reasoning models for the genuinely hard parts like debugging architectural flaws or complex algorithms.
- **Prepare with a strong model, execute with a cheaper one.** The hard thinking lives in the planning phase. When you scope work with OpenSpec, Superpowers, a PRD, or a detailed technical spec, use a powerful model to shape that plan — then hand the well-defined steps to a lighter, faster model to implement.
- **The high-effort tiers cost a multiple, so spend them deliberately.** For example, in Cursor, Composer **fast mode is ~6x pricier** and is **on by default**, and **Opus extra-high thinking is ~3x pricier** than its standard mode. None of that is worth paying when a lighter model would have produced the same or better result.

### Manage your context window

- **Track your context usage and start fresh agent sessions often.** A bloated session pays the bloat tax on every subsequent prompt.
- **Export core context into `.md` files** to share between agents, instead of keeping massive chat histories alive just to preserve a few decisions or ideas.
- **Prefer handoff files over auto-compacting** where possible. Not strictly a token win, but writing the state you want to keep into a file gives you explicit control over what survives — auto-compaction decides for you and can silently drop the details that mattered. The [`progress`](plugins/progress/skills/progress/) skill in this repo automates this: it saves a disposable per-feature progress note at session end so the next session recovers full context from one file instead of re-deriving it from commits, chat history, and code.
- **Pin only the specific files needed** for the change to keep the context window tight.
- **Set up ignore files** to stop agents from indexing package bundles, build artifacts, and massive mock files. Each agent reads its own ignore file:
  - **Cursor** — [.cursorignore](https://cursor.com/docs/reference/ignore-file)
  - **GitHub Copilot** — [content exclusion](https://docs.github.com/en/copilot/how-tos/configure-content-exclusion/exclude-content-from-copilot)
  - **Claude Code** — [deny permissions](https://code.claude.com/docs/en/settings#permissions)

### Keep skills and rules lean

- **Review and prune** both local and global skills/rules regularly to keep your base context small.
- **Split massive, catch-all skills into smaller, modular units** so they load only when relevant. Instead of one giant "Code Review" skill, use a lightweight **Code Review Orchestrator** that calls 5–6 smaller, highly specific sub-skills only when needed.
- **Don't install skills blindly.** A curated list of 100 skills won't improve your output. Install a skill only when you have a direct need and understand how it operates.
- **Scope rules to relevant files** with globs/paths. Component rules shouldn't load into context when you're modifying services. See [Cursor rules](https://cursor.com/docs/rules) and [Claude's path-scoped rules](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/).
- **Trim conversation** with tools or skills such as [caveman](https://github.com/JuliusBrussee/caveman), [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk), or similar. Keep in mind that those tools could affect the quality of the output and results.

### Don't burn an agent on chores

Do simple one-liners and quick commit/push manually. Relying on an agent for minor chores can instantly add thousands of tokens to every subsequent prompt — especially in a session that already has a filled-up context.

Be aware of the flip side: if you change things outside the session, the agent isn't aware of it and can get confused, burning tokens investigating what changed since its last work. After manual changes, start a fresh agent and/or update the saved plans and documentation so the next prompt reflects the current state.

### Tests and linting

Avoid running massive test suites in an automated loop (e.g. 2k+ tests); run focused status checks only. For the output that does come back, trim it with a tool like [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) to cut the context pollution from test and lint runs.

---

## Spend less by building it right

### Get the spec right before generating code

Iterate on the PRD and technical specs down to the finest detail before generating code. Refactoring AI-generated code costs significantly more than generating it correctly the first time.

### Learn from corrections

- **Shift the mindset from building features to building the tools that produce features.** Every correction is a signal that one of those tools — a rule, a skill, a spec — is miscalibrated.
- **Treat every correction as a bug in the setup, not just in the output.** When the agent gets something wrong, investigate *why* it went that way instead of just patching the result.
- **Encode the lesson where it belongs** — update the relevant rule, skill, or spec so the agent gets it right unprompted next time.
- **Fewer corrections means fewer tokens.** Each correction is another round-trip on top of an already-growing context. Fixing the root cause once pays off on every future prompt.

### Capture recurring work as a reusable artifact

When the agent keeps regenerating the same thing from scratch, save it once and reuse it instead of paying to recreate it on every prompt. This applies to anything repeatable — a throwaway script, a boilerplate config, a query, a checklist, a prompt template, a snippet of setup code. Beyond the token savings, a stored artifact is deterministic: it produces the same result every time, unlike an LLM, which may subtly rewrite the logic and drift between runs.

For example, if the agent writes and runs essentially the same script over and over, save it to a file and have the agent execute that file instead of regenerating it.