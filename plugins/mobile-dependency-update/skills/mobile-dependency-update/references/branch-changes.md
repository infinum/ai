# Branch changes

Section 1 applies to every branch comparison from "What to analyze" in `SKILL.md`. The rest applies when more than one dependency changed, for example on a grouped Renovate branch.

Goal: for every dependency that the branch changes, tell the user what they have to do — not only that the version moved. A row that says HIGH and nothing else sends the user back to do the analysis themselves.

## 1. Inventory (main agent)

1. Diff the dependency declarations between the base and the head ("What to analyze" in `SKILL.md` says how), over every place that the ecosystem reference lists under "Extract": for Gradle the version catalogs, the build files, `buildSrc/`, and `build-logic/`; for SPM `Package.resolved`, `project.pbxproj`, and `Package.swift`.
2. Turn each changed line into dependencies, as the ecosystem reference counts them: libraries that share a version key are one dependency, a BoM is one dependency, and a transitive pin counts with its parent package. Keys of one library family that move to the same release, such as the JUnit modules, can share one row. Record the coordinate, the base and the head version, and the declaring lines on the head.
3. Run `list_versions.py` with the base version as the current one, to get the bump type and the release date of the head version; pass `--pre` for a pre-release head. For a head below the base (a rollback), pass the head as the current version instead. Parallel calls are fine.
4. Read the CI result of the head once (step 3 of `SKILL.md`). A pass applies to every dependency that the head commit contains.
5. Put what has no version to compare under "Not checked" (in a report on one dependency: in its caveats), with the reason: branch or revision pins, local packages, binaries outside a package manager (with their bundled version, if known), changes that no ecosystem reference covers (for example the Gradle wrapper, GitHub Actions, or CI images), and lookups that failed.
6. If more than five dependencies changed, show the inventory as a table (coordinate, from → to, type, released, declared in), sorted by bump type (major first) and then by release date (newest first), and ask before the analysis: each dependency costs a full run of the workflow. The user can also name a subset.

## 2. Analysis

With five or fewer changed dependencies, analyze them yourself, one after another, the way the "Subagent task" below describes (triage included).

With more, fan out with the Agent tool so that each dependency's release notes stay in their own context — forty release-note pages in one context crowd out the analysis:

- one subagent per dependency that is a major bump;
- the rest in batches of up to five per subagent;
- up to eight subagents per message; send the next wave when a wave returns.

Brief each subagent with `<skill-dir>`, the project root, the ecosystem, and, per dependency, the coordinate, the base and the head version, bump type, release date, and declared-in lines; add the base and head references and the CI result once. Tell it to read `<skill-dir>/SKILL.md`, the ecosystem reference, `references/scoring.md`, and the "Subagent task" section of this file, and to return only the result blocks. Give facts about the project and the dependency, not method: do not add instructions such as "check usage for every bug fix" to a brief, because the triage decides the path and `SKILL.md` decides which clusters get a usage check.

### Subagent task

For each dependency in the batch:

1. Run steps 5–8 of `SKILL.md` over the range from the base to the head (for a rollback, from the head up to the base, as step 4 says): replacement check, release notes, hard evidence where needed, advisories. Apply the CI result from the brief (step 3 of `SKILL.md`), but do not report a CI failure: the main agent does.
2. **Triage** (below). On the quick path, skip the usage check: the tier is LOW unless an unmet minimum or a conflict makes it HIGH.
3. On the full path, run step 9: labels, clusters, usage check, tier.
4. Update the guide cache (step 11). Do not propose or make edits.
5. Return one block per dependency, and nothing else:

```
coord: <coordinate>
from: <base version>  to: <head version>  type: <bump type>  released: <YYYY-MM-DD | unknown>
tier: <LOW | MEDIUM | HIGH> [(low confidence)]  path: <quick | full: reason>
urgency: <advisory IDs and severity: they affect the current version, and the target fixes them>
advisory: <ID> (<severity>) affects the target, not the current version -> <what to do> (<URL>)
replacement: <successor coordinate> (<URL of the source that says so>)
drivers: <what set the tier, with counts, e.g. "2 required changes: removed API at 3 sites, minSdk 24" | none>
required: [<label> | minimum | conflict] <symbol or setting> at <file:line, ...> [(internal builds only)] -> <change> (<version>, <URL>)
behavior: <summary> [(internal builds only)] -> <how to verify> (<version>, <URL>)
automated: <command> [(CI runs it) | (passed in CI)] -> <items it covers> [(internal builds only)] (<version>, <URL>)
deprecated: <symbol> at <file:line, ...> -> <replacement> (<version>, <URL>)
additive: <symbol> can replace <file:line> -> <note> (<version>, <URL>)
constraints: <minimums that the project meets, tools that no project file pins, runtime minimums that only internal code uses, and transitive moves without a conflict, with the project impact>
question: <an unconfirmed hit, or a fact outside the repository, that decides an ambiguous cluster> -> <what follows from each answer> (<version>, <URL>)
dropped: <behavior-changed cluster> at <sites> -> <the project fact> ; <what would make the path run>
caveats: <gaps and checks that failed>
```

Repeat an `advisory`, `required`, `behavior`, `automated`, `deprecated`, `additive`, `question`, or `dropped` line once per item. A `behavior` line holds only a `manual` item; a `build` item goes on a `required` line, and `check` items go on `automated` lines, one line per command (see "How the change shows" in `SKILL.md`). Leave out lines that have nothing to say.

### Triage

The quick path is for releases that cannot require a code change. Take it only if every entry in the range is a bug fix that keeps behavior, an additive API, docs, tests, CI, or an internal change.

Take the full path if anything else appears, and always when:

- the bump is major (including `major (0.x)`) or a replacement;
- no release notes were found — without them you cannot see what changed;
- an advisory affects the current or the target version;
- an entry mentions a removal, deprecation, rename or move, a breaking or incompatible change, a changed default, a rewrite, a migration guide, or a raised minimum (SDK, OS, language, toolchain).

If unsure, take the full path: a missed breaking change costs far more than one extra usage check.

## 3. Report (main agent)

Render in the shape of `assets/branch-report.example.md`, with the base and the head in the title and the CI result under the summary. If CI failed and no row explains it, say so on the CI line and link the failed check; it sets no row's tier. Propose no edit: the branch already holds the version changes.

- Sort rows by tier (HIGH first). Inside a tier, rows with a required change come first, then rows with a manual behavior item, then rows with only automated checks, then the rest; in each of these groups, a row whose items all concern internal builds only comes last. Then sort by the number of required changes (most first), by release date (newest first), and by coordinate. The user reads the table from the top, so a build break must not sit below a change in a debug tool.
- In the Released column, add the age in days when the target is younger than 7 days, for example `2026-09-19 (5 days)`.
- In the Risk column, add `· security` when the row has an `urgency` line, and `(low confidence)` when its tier line has it.
- Each row with an `urgency`, `advisory`, `replacement`, `required`, `behavior`, `automated`, `deprecated`, `additive`, or `question` item gets a block below the table, in row order. The block heading carries the tier and what set it, as the verdict line does; a LOW heading names the items of the block instead. Inside the block, follow the section order of a single report ("Report rules" in `SKILL.md`): the urgency first, then the replacement (one line that names the successor and links its sources) and the timing, then Required, Behavior to verify, Automated checks, Suggestions (the `deprecated` and `additive` lines), Constraints, Manual review (the `question` lines), and last the new advisories.
- `dropped` lines go into the "Caveats" section, one line each.
- Then "Not checked" and "Caveats".

One failure never stops the analysis: record a caveat for that dependency and continue.
