# Scan mode

Goal: for every outdated dependency, tell the user what they have to do — not only that an update exists. A row that says HIGH and nothing else sends the user back to do the analysis themselves.

## 1. Inventory (main agent)

1. List the direct dependencies with the ecosystem reference (`spm_deps.py` for SPM).
2. Run `list_versions.py` for each one; parallel calls are fine. Keep those with a newer stable version.
3. Apply the policy: a `disabled: true` match goes to "Blocked by policy" with its `reason`; note each `group`.
4. Put what has no version to compare under "Not checked", with the reason: branch or revision pins, local packages, binaries outside a package manager (with their bundled version, if known), and lookups that failed.

## 2. Analysis

With five or fewer outdated dependencies, analyze them yourself, one after another, the way the "Subagent task" below describes (triage included).

With more, fan out with the Agent tool so that each dependency's release notes stay in their own context — forty release-note pages in one context crowd out the analysis:

- one subagent per dependency that is a major bump, a replacement, or matches `alwaysEscalate: true`;
- the rest in batches of up to five per subagent;
- up to eight subagents per message; send the next wave when a wave returns.

Brief each subagent with `<skill-dir>`, the project root, the ecosystem, and, per dependency, the coordinate, current and target version, bump type, release date, and declared-in lines. Tell it to read `<skill-dir>/SKILL.md`, the ecosystem reference, `references/scoring.md`, and the "Subagent task" section of this file, and to return only the result blocks. Give facts about the project and the dependency, not method: do not add instructions such as "check usage for every bug fix" to a brief, because the triage decides the path and `SKILL.md` decides which clusters get a usage check.

### Subagent task

For each dependency in the batch:

1. Run steps 5–8 of `SKILL.md`: replacement check, release notes, hard evidence where needed, advisories.
2. **Triage** (below). On the quick path, skip the usage check, and score only bump type, age, release-note quality, constraints, and advisories.
3. On the full path, run step 9: labels, clusters, usage check, score.
4. Update the guide cache (step 11). Do not propose or make edits.
5. Return one block per dependency, and nothing else:

```
coord: <coordinate>
from: <current>  to: <target>  type: <bump type>  released: <YYYY-MM-DD | unknown>
tier: <LOW | MEDIUM | HIGH>  score: <n>  path: <quick | full: reason>
urgency: <security: advisory IDs>
derivation: <one line, e.g. "minor +1, age 12d +1, deprecated cluster used +1 = 3">
required: [<label>] <symbol> at <file:line, ...> -> <change> (<version>, <URL>)
behavior: <summary> -> <how to verify> (<version>, <URL>)
automated: <command> [(CI runs it)] -> <items it covers> (<version>, <URL>)
additive: <symbol> can replace <file:line> -> <note> (<version>, <URL>)
constraints: <raised minimums and transitive majors, with the project impact>
question: <a fact outside the repository that decides an ambiguous cluster> -> <what follows from each answer> (<version>, <URL>)
dropped: <behavior-changed cluster> at <sites> -> <the project fact> ; <what would make the path run>
caveats: <gaps and checks that failed>
```

Repeat a `required`, `behavior`, `automated`, `question`, `dropped`, or `additive` line once per item. A `behavior` line holds only a `manual` item; `build` and `check` items go on `automated` lines, one line per command (see "How the change shows" in `SKILL.md`). Leave out lines that have nothing to say.

### Triage

The quick path is for releases that cannot require a code change. Take it only if every entry in the range is a bug fix that keeps behavior, an additive API, docs, tests, CI, or an internal change.

Take the full path if anything else appears, and always when:

- the bump is major (including `major (0.x)`) or a replacement;
- a policy rule sets `alwaysEscalate: true`;
- no release notes were found — without them you cannot see what changed;
- an advisory affects the current or the target version;
- an entry mentions a removal, deprecation, rename or move, a breaking or incompatible change, a changed default, a rewrite, a migration guide, or a raised minimum (SDK, OS, language, toolchain).

If unsure, take the full path: a missed breaking change costs far more than one extra usage check.

## 3. Report (main agent)

Render in the shape of `assets/scan-report.example.md`:

- Sort rows by tier (HIGH first). Inside a tier, rows with a required change come first, then rows with a manual behavior check, then rows with only automated checks, then the rest; then sort by score (highest first) and by release date (newest first). The user reads the table from the top, so a build break must not sit below a change in a debug tool.
- Rows that share a policy `group` sit together under the group name; the group shows its highest tier.
- Each row with a `required`, `behavior`, `automated`, `question`, or `additive` item gets a block below the table, in row order. In the block, "Automated checks" is one line after "Behavior to verify", and "Manual review" (the `question` lines) follows it.
- `dropped` lines go into the "Caveats" section, one line each.
- Then "Blocked by policy", "Not checked", and "Caveats".

One failure never stops the scan: record a caveat for that dependency and continue.
