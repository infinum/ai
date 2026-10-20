# Risk score

Every analysis ends in one tier — LOW, MEDIUM, or HIGH — computed from the points below. Show the derivation in the report, so that the user can check each line and disagree with a specific point instead of with a verdict.

The score measures the risk of taking the update. Reasons to update soon go on a separate **urgency** line: a security fix makes an update more urgent, not less risky, so it never lowers the score.

## Points

**Bump type** (from `list_versions.py`)

| Type | Points |
|---|---|
| patch | 0 |
| minor | +1 |
| major, or a minor bump below 1.0 (`major (0.x)`) | +3 |
| rollback | +2 |
| replacement (successor coordinate) | +4 |

**Age of the target.** Fresh releases get hotfixes and, now and then, withdrawals.

| Released | Points |
|---|---|
| less than 3 days ago | +3 |
| 3–6 days ago | +2 |
| 7–29 days ago | +1 |
| 30 days ago or more | 0 |
| unknown | 0 (say so in the caveats) |

**Clusters with confirmed usage.** Score each cluster once, at its label. `unused` clusters score 0.

| Label | Points |
|---|---|
| `removed` | +3 |
| `signature-changed` | +3 |
| `behavior-changed` | +2 |
| `deprecated` | +1 |
| `bugfix` | 0 |
| `additive`, `noise` | 0 |

A bug fix keeps the documented behavior, so it adds no risk points, and the report asks for no check. If the project depends on the old behavior, the cluster is `behavior-changed` (see "Bug fixes" in `SKILL.md`).

**Usage only in internal builds.** Production users cannot see a runtime change in code that the release build does not contain. That code sits inside `#if DEBUG` or a similar compile condition, in a target or configuration that the release build does not link (for example a debug menu that only internal schemes link), or behind `debugImplementation` in Gradle. If every confirmed site of a cluster is in such code, `behavior-changed` scores +1, and a raised runtime minimum that only that code meets scores 0. `removed` and `signature-changed` keep their full points, because the internal builds still fail to compile.

**Changes that a command reveals.** A build or a named check turns a silent change into a visible failure before release, so what is left is the work to fix it, not a surprise in production. If every confirmed site of a `behavior-changed` cluster is `build` or `check` (see "How the change shows" in `SKILL.md`), the cluster scores +1. `manual` sites keep the full points.

**Ambiguous usage:** +1 per cluster, at most +2 in total, so that a release full of generic names cannot dominate the score.

**Release-note quality**

| Condition | Points |
|---|---|
| Notes for every version in the range | 0 |
| Some versions without notes | +1 |
| No notes: only commit messages or artifact diffs | +2 |

**Constraints.** Count only what the project must act on.

| Condition | Points |
|---|---|
| A raised minimum above the project's current setting: `minSdk`, iOS deployment target, Swift tools version, Kotlin, JDK, Gradle, AGP | +2 each |
| A transitive dependency moves to a new major version (a 0.x minor counts as a major), and the project also declares that library or another direct dependency pins the old major, so the resolution conflicts (`./gradlew dependencies`, `Package.resolved`) | +2 each |

A dependency of a build tool or a plugin is not a project constraint: its effect belongs to the tool's own clusters and scores once there. Any other transitive major scores 0; list it under the constraints.

A raised minimum that the project already meets scores 0; list it as checked.

**Advisories** (`osv_check.py`)

| Condition | Points |
|---|---|
| An advisory affects the target but not the current version | +3 each |

## Urgency

- **Update soon — security:** an advisory affects the current version, and the target fixes it. Put this line at the top of the report, with the advisory IDs and their severity, whatever the tier.
- Otherwise leave the urgency line out.

## Tiers

| Score | Tier |
|---|---|
| 0–1 | LOW |
| 2–4 | MEDIUM |
| 5 or more | HIGH |

## Clusters

Put entries into one cluster when they:

1. reference the same PR or issue (`#904`, `owner/repo#904`, the same URL);
2. sit under one heading of one release and describe the same feature or component;
3. describe one change that the notes split across bullets ("rewrote the renderer", "the renderer now uses X", "renderer: set a minimum height").

Otherwise keep them apart. Example: three Balloon 1.7.6 bullets about the new popup-window rendering (PRs #965–#967) are one `behavior-changed` cluster — +2, not +6.

## Policy

Apply these after the points (fields: `assets/policy.example.yaml`):

- `riskFloor` raises the tier to at least the floor and never lowers it. Show both the computed tier and the floor.
- `minimumReleaseAge` is a hard floor: a younger target makes the report DEFERRED. It does not change the points — the age table always applies.

## Derivation format

```
Minor bump                                                      +1
Age: released 12 days ago                                       +1
deprecated cluster "Balloon() composable", used at 3 sites      +1
= 3 → MEDIUM
```

With a policy floor:

```
= 3 → MEDIUM
Policy floor (packagePattern "^com\.example\.payments") → HIGH
Final: HIGH
```

## Worked examples

The library names in examples 1 and 2 are placeholders; examples 3 and 4 use real release facts.

1. **Routine patch.** `netkit` 4.12.0 → 4.12.1, released 60 days ago, one bug fix in a code path that the project does not reach. 0 + 0 + 0 = **0 → LOW**.
2. **Fresh minor with a deprecation.** `navkit` 2.9.6 → 2.10.0, released 1 day ago, one deprecated API used at two sites. +1 +3 +1 = **5 → HIGH**. The age drives the tier: a week later the same update is MEDIUM. Say so in the verdict.
3. **Major with a removal.** play-services-auth 21.6.0 → 22.0.0, released 30 days ago. 22.0.0 removes the Google Sign-In API, which the project calls at three sites, and raises `minSdk` from 23 to 24, which the project (at 26) already meets. +3 + 0 + 3 + 0 = **6 → HIGH**.
4. **Security fix.** okhttp 4.9.0 → 4.12.0, released 90 days ago, no used API changes; the target fixes GHSA-3cqm-mf7h-prrj (CVE-2021-0341, HIGH). +1 = **1 → LOW**, with "Update soon — security" at the top.
5. **Library for internal builds only.** Pulse 5.1.4 → 5.2.3, released 106 days ago, in a project where only internal schemes link the Pulse console and the logging calls sit inside `#if DEBUG`. The console redesign and the new store format (it deletes the old logs) are behavior changes in internal-only code: +1 each. Five bug fixes score 0, as every bug fix does, and the console's new iOS 18 runtime minimum scores 0. +1 + 0 + 1 + 1 = **3 → MEDIUM**. Without the internal-build rule, the same update scored 12 and topped a scan, above two updates that break the build.
6. **A change that a linter reveals.** A lint plugin 1.4.0 → 1.5.0, released 40 days ago, turns on two new rules by default. The project's lint task fails on any finding, so the new findings are `check` items for the lint command: +1 for the cluster. +1 + 0 + 1 = **2 → MEDIUM**, and the report lists the lint command under "Automated checks" instead of asking for a manual test.
