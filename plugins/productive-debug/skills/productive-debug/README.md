# productive-debug

Investigate a bug task from Productive end-to-end. Use when you have a Productive task URL for a bug and want a thorough, codebase-grounded analysis before writing any code.

## Usage

```
/productive-debug
```

Provide a Productive task URL and, if the project has a separate companion app (e.g., a standalone frontend repo), its path on disk. The skill does the rest.

The skill walks you through a structured flow:

1. **Fetch the task** — pulls the title, description, comments, attachments, and changelog from Productive via MCP.
2. **Analyze the report** — identifies the affected feature, user role, environment, reproduction steps, and maps any localized UI labels (e.g., Slovenian tab names) to their code identifiers.
3. **Explore codebases** — searches the workspace and any companion apps in parallel, covering controllers, models, API filters, frontend components, caching config, and recent git history in the affected area.
4. **Generate hypotheses** — produces 3–5 ranked root cause hypotheses, each with a mechanism, specific code evidence, and what would confirm or reject it.
5. **Act based on mode** — stops at the report in Ask/Plan mode; instruments code and collects runtime evidence in Debug mode; implements a targeted fix in Agent mode.

## What is this for?

Production bugs often span multiple layers — a backend filter, a frontend cache setting, a recent commit that changed behavior. Reading the Productive task alone rarely gives enough context to understand *why* something broke or *where* to look.

This skill automates the investigation phase: it fetches everything from the task (including screenshots embedded in comments), traces the affected code paths across all relevant repos, and gives you a ranked list of hypotheses with evidence before you write a single line of code.

## When to use

| Situation | Use this skill? |
|---|---|
| Bug task in Productive with a URL | Yes — full investigation |
| Bug spans a Rails API + a JS frontend | Yes — provide both repo paths |
| Bug is immediately obvious from the task description | Optional — can skip to Agent mode directly |
| Feature or improvement task (not a bug) | No — use `/create-prd` or Plan mode instead |
| No Productive task URL available | Paste the task details manually when prompted |
