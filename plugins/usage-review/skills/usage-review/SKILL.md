---
name: usage-review
description: Use when the user asks how well they use Claude Code, how much of the day Claude actually works versus waits for them, how much they run in parallel, what their prompting habits look like, or wants a personal retrospective of their Claude Code sessions ("review my use of Claude", "am I using Claude well", "how many hours does Claude work for me"). Not Cowork-ready — reads `~/.claude/` outside the workspace mount.
---

# Claude usage review

Answer three questions from the data on the user's own machine: how much Claude works versus waits, how much work overlaps, and what the user does well or could change. Build on Claude Code's built-in analysis first; the bundled script adds what the built-ins do not report.

The whole review stays local. Prompts, projects and client names appear in the data; never paste the raw sample files, or more than a few short prompt fragments, into the report or into anything that leaves the machine.

## Step 1: Collect the built-in reports

1. `/insights` is Claude Code's own usage report. Check for `~/.claude/usage-data/report.html` (the documented location as of Claude Code 2.1.30x). If it exists, strip the HTML and read it (for example `python3 -c 'import re,sys;print(re.sub(r"<[^>]+>"," ",open(sys.argv[1]).read()))' ~/.claude/usage-data/report.html`). Take from it: projects worked in, feature suggestions, friction points, and the "auto mode could have handled" estimate. If the file is missing or older than the window you review, tell the user to run `/insights` in their terminal (a slash command only the user can run; it takes a few minutes and spends tokens), continue with the rest, and say in the report's caveats that no `/insights` data was used. Do not block on it.
2. `/usage` (alias `/stats`, `/cost`) shows live plan limits and the per-model cost of the current session. Ask the user to run it if plan usage matters to the question.
3. `~/.claude/stats-cache.json` holds aggregated daily message, session and tool-call counts. Its schema is not documented and it is often stale; if its last date is before the review window, ignore it. Otherwise use it only as a cross-check for the script's per-day table.

Only one of the built-ins (`/insights`) analyses behaviour, and none reports active time, waiting time, or parallelism. That gap is why Step 2 exists.

## Step 2: Run the statistics script

```bash
python3 -I "${CLAUDE_SKILL_DIR}/scripts/usage-stats.py" --out <scratchpad dir> [--tz Europe/Zagreb] [--days 30]
```

Standard library only, runs in a few seconds, needs no permissions beyond reading the user's home directory; nothing leaves the machine. It reads `~/.claude/projects/*/*.jsonl` (sessions plus their `subagents/` transcripts), `~/.claude/history.jsonl` and the `enabledPlugins` list in `~/.claude/settings.json`, prints a markdown report, and writes `prompts_sample.txt`, `corrections.txt` and `report.json` into `--out` (created if missing). `--days` defaults to everything on disk. `--tz` defaults to the system timezone; pass the user's IANA timezone if they work in another one, so days split correctly.

Definitions the script uses (state them in the report):

- **Claude active**: time between consecutive Claude events (assistant messages, tool results) that are at most 10 minutes apart. A longer silent gap is a stall, not work. Time spent waiting for the user to answer `AskUserQuestion` or a permission prompt is waiting, not work. Subagent transcripts count as Claude work and overlap with the main thread.
- **Waiting for the user**: the gap from the end of a turn to the next human prompt, when it is 30 minutes or less. Longer gaps are a parked session, counted separately.
- **Parallelism**: summed per-session active time divided by the wall-clock union. 1.0x means strictly serial. The per-day table shows two overlap shares: ">=2 sessions" is overlap between the user's own sessions; ">=2 streams incl. subagents" adds subagents. The gap between them is overlap that subagents created, not a second session.
- **Turns ended with an away recap**: Claude Code writes a recap when the terminal was not in focus at turn end. The denominator counts every harness turn, including turns started by background-task notifications, so it is larger than the human-initiated turn count.
- **Best day** and **median day** use the union column (all sessions and subagents).

Known limits:

- Transcripts are internal format and change between Claude Code versions. If the script reports zero human turns, or counts that contradict `/insights`, check the record fields before trusting it. Developed against Claude Code 2.1.28x to 2.1.30x.
- Transcripts are deleted after `cleanupPeriodDays` (default 30). The review window is at most that long, and it shrinks during the day as cleanup runs at session start. Run the review monthly, or tell the user to raise the setting if they want a longer window. `history.jsonl` is not cleaned, so the long-term prompt counts go back further.
- Time the user spends reading Claude's output in an editor, or thinking, is invisible. Treat "waiting for the user" as a lower bound on the user's attention.

## Step 3: Read the qualitative files

Read `prompts_sample.txt` and `corrections.txt` in chunks of at most 250 lines, with the Read tool (`offset`/`limit`) or with `sed -n 'A,Bp' file | cut -c1-300` when the session prefers Bash. The sample is tens of kilobytes; one `cat` overflows the tool output. Read every chunk; do not skim the tail. If that is too much, re-run the script with `--sample 150` instead of reading half. Corrections are what the user typed after interrupting Claude or rejecting a tool call. They are the richest signal of what goes wrong, so read all of them.

The script also counts prompts that look like they carry a credential (password, API key, token). It never prints them. If the count is above zero, report it as a finding ("N prompts in the window contain what looks like a password or token; transcripts are stored in plain text") without quoting the prompt.

For the sample, score these habits with examples, both strengths and gaps:

| Habit | Strong signal | Weak signal |
|---|---|---|
| Context in the prompt | links to tickets, threads, docs, file paths; constraints stated; preferences ordered | bare verbs ("fix it"), missing target |
| Size of delegation | whole workflow or feature per prompt | one mechanical step per prompt, many steps in a row |
| Pushback and review | user challenges Claude's numbers or reasoning with domain facts | accepts everything; or interrupts without saying why |
| Context hygiene | asks for progress notes before `/clear`; warns at high context | repeated compactions; "are you stuck?" |
| Chores | end state given in the task prompt ("when done commit, push, open a draft PR") | separate prompts for commit, push, PR, title |
| Isolation and parallel work | worktree per task; second session while the first runs; queued prompts | serial sessions; replies within a minute while Claude works |
| Tooling fit | skills and plugins used match the work; the script's "enabled but never used" list is short | many enabled plugins with zero attributed uses; hundreds of deferred MCP tools |
| Repetition | a recurring instruction became a skill, hook or CLAUDE.md rule | the same multi-line instruction typed several times (the script counts repeats) |
| Input quality | prompt sent once | re-sent prompts after dictation or typo errors |

## Step 4: Write the report

The report has these parts, in this order:

1. **Headline**: the answer to the user's question in one or two sentences, with the one number that matters (for "how much does Claude work": active hours per active day).
2. **Time budget table**: Claude active per day, waiting for the user per day, days over one hour, best day. Then a turn-shape table: median turn, long turns, median reply latency, replies within 60 s, turns finished while the user was away.
3. **Parallelism**: sessions per day, parallelism factor, share of time with two or more streams, and whether the overlap comes from a second session or from subagents. Note queued prompts as a positive sign.
4. **What you do well**: bullets, each with a concrete pattern seen in the sample. Lead with the strongest ones.
5. **What to improve**: numbered, each with the number that motivates it and one specific change (what to type, what to configure). Order by expected gain.
6. **Method and caveats**: definitions above, the window covered, the retention limit, and anything the built-in reports and the script disagree on.

Numbers go in tables or on their own line, not inside prose. Round to what changes a decision (hours to one decimal, percentages to whole numbers). Where `/insights` was available, cite which findings came from it and which from the script, so the user knows which will survive a Claude Code upgrade. The structure above is fixed; the wording follows whatever style rules the user's own setup imposes.

## Common mistakes

An ad-hoc analysis without this skill reported 3.3 h of Claude work per day for a user whose true figure was 1.4 h. Every error below was in it.

- Counting the whole span from prompt to last event as work, with a 4-hour cap. Silent gaps, permission waits and `AskUserQuestion` waits are the user's time.
- Summing per-turn spans without subtracting silent gaps. A background agent's notification can arrive days later and makes one turn look like 90 hours of work.
- Ignoring subagent transcripts, or counting them as inside the main turn. On days with workflows or review agents they are a third of Claude's active time and they overlap the main thread.
- Counting `/clear` from transcripts. Transcripts only hold the last 30 days; `history.jsonl` has the long-term slash-command counts.
- Reading `prompts_sample.txt` with one shell command. The output is too large and gets truncated or persisted; use chunked reads.
- Reporting parallelism from "overlapping sessions per day" in `history.jsonl`. Sessions can be open all day and still run strictly one after the other; use the transcript-based factor.
- Quoting client names, credentials or whole prompts from the sample in a shareable artifact. Summarise the pattern instead.
- Presenting the API-equivalent cost as money spent. On a subscription it is a list-price equivalent, useful only for comparing models and days.
