# usage-review

Review how you use Claude Code: how many hours a day Claude actually works versus waits for you, how much work runs in parallel, and which prompting habits help or hurt. Builds on the built-in `/insights` report and adds the timing analysis Claude Code does not report.

## Usage

```
/usage-review:usage-review
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.) It also triggers on phrasing like "review my use of Claude", "how much does Claude work for me", or "am I using Claude Code well".

For the best result, run `/insights` first so the built-in report is on disk; the skill reads it from `~/.claude/usage-data/report.html`. Everything runs locally against `~/.claude/`; nothing is uploaded.

## What it does

1. **Collects the built-in reports** — reads the `/insights` HTML report if present (projects, friction points, feature suggestions) and, where relevant, asks you to run `/usage` for plan limits.
2. **Runs `scripts/usage-stats.py`** (standard-library Python) over your session transcripts and prompt history. It reports per-day Claude active time, time spent waiting for you, parallelism across sessions and subagents, turn length, reply latency, and behaviour counts (interrupts, denied tool calls, questions asked, plan mode, subagents, commit/push chores, queued prompts).
3. **Reads a prompt sample and your corrections** — what you typed after interrupting Claude or rejecting a tool call — and scores habits such as context in prompts, size of delegation, pushback, context hygiene, chores, parallel work, tooling fit, and input quality.
4. **Writes a report** — headline answer, time-budget and turn-shape tables, parallelism, what you do well, numbered improvements with the number behind each, and method caveats.

## Example findings

- "Claude works 1.4 h on an average working day and waits for you 1.2 h inside live sessions."
- "Parallelism is 1.07x: six sessions a day, run one after the other."
- "12% of prompts are commit/push/PR chores; put the end state in the task prompt instead."

## When to use

| Situation | Use this skill? |
|---|---|
| Monthly personal retrospective on Claude Code use | Yes — run it before transcripts age out (30 days by default) |
| "Is Claude only working an hour a day for me?" | Yes |
| Team-wide or billing analytics | No — use the Claude Code Analytics API, OpenTelemetry, or the claude.ai analytics dashboard |
| Security audit of plugins and hooks | No — use `claude-setup-audit` |

## Limits

- Session transcripts are an internal Claude Code format and are deleted after `cleanupPeriodDays` (default 30). The script was developed against Claude Code 2.1.28x–2.1.30x; if a release changes the record layout the counts can be wrong, and the skill says so when they contradict `/insights`.
- Time you spend reading Claude's output outside the terminal is invisible, so "waiting for you" is a lower bound.
- The API-equivalent cost figure is a list-price equivalent, not what a subscription charges.
