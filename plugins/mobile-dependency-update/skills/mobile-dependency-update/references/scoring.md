# Risk tier

Every analysis ends in one tier: LOW, MEDIUM, or HIGH. The tier says what kind of attention the update needs; the report's sections say what exactly. Apply the rules in order; the first that matches decides:

1. **HIGH**: code or configuration must change before or with the bump, or the target introduces a security advisory.
2. **MEDIUM**: nothing must change, but something must be verified.
3. **LOW**: everything else.

A run that stops in step 4, because no newer version exists, has no tier.

The tier measures the risk of taking the update, nothing else. Urgency, a replacement, the age of the release, and gaps in the notes go beside the tier (see "Beside the tier"): a security fix makes an update more urgent, not less risky.

## What counts

**HIGH: a required change.** Each item needs confirmed usage, unless noted:

- a `removed` or `signature-changed` cluster;
- a `behavior-changed` cluster that shows as `build` (see "How the change shows" in `SKILL.md`): the build fails until the sites are fixed;
- a `behavior-changed` cluster whose code at a confirmed site fails for certain: an error, a crash, or a call that never completes, as the library's source or artifacts at both versions show. If the effect depends on a race between threads, on data, or on device state, it is an item to verify (MEDIUM), even when you know a likely fix. Decide per site: one cluster can give a required change at one site and an item to verify at another;
- a raised minimum above the value in a project file: `minSdk`, `compileSdk`, iOS deployment target, Swift tools version, Kotlin, JDK, Gradle, AGP. It needs no usage check, because it applies to the whole project. List it under Required changes with the tag `[minimum]`. A minimum that the project already meets, and a tool that no project file pins, such as Android Studio, go under Constraints;
- a transitive dependency that moves to a new major (a 0.x minor counts as a major) while the project or another direct dependency pins the old major, so the resolution conflicts (`./gradlew dependencies`, `Package.resolved`). List it under Required changes with the tag `[conflict]`. A dependency of a build tool or a plugin does not count: its effect belongs to the tool's own clusters;
- a used `deprecated` cluster in a project that treats warnings as errors (for example `allWarningsAsErrors`, `-Werror`, or `SWIFT_TREAT_WARNINGS_AS_ERRORS`): the build fails.

**HIGH: a new advisory.** An OSV advisory affects the target but not the current version. Name it in the verdict and in the advisories line.

**MEDIUM: something to verify.**

- an item to verify that the report lists: a `manual` item under "Behavior changes to verify", with its trigger and symptom, or a `check` item under "Automated checks", with its command;
- an `ambiguous` cluster above `deprecated`, listed under Manual review: hits that you could not confirm, or a use that depends on a fact outside the repository.

**Not a tier driver:** `deprecated` clusters, unless the project treats warnings as errors (they compile; list them under Suggestions with the replacement), `bugfix`, `additive`, `noise`, every `unused` cluster, the bump type, the age of the release, the quality of the release notes, and a replacement. They shape the report, not the tier.

**Internal builds only.** A `behavior-changed` cluster whose every site sits in code that the release build does not contain (`#if DEBUG`, `debugImplementation`, a target that only internal schemes link) still gives MEDIUM when the report lists it as a `manual` item: someone must still look. Mark the item "internal builds only", so that the reader can rank it. `removed` and `signature-changed` keep HIGH: the internal builds still fail to compile. A certain failure (see above) also stays a required change in internal-only code. A raised runtime minimum (an API that needs a newer OS) that only internal code uses goes under Constraints; a raised package or SDK minimum still breaks the internal build and stays a required change.

**Bug fixes.** A `bugfix` keeps the documented behavior and drives nothing. If the project depends on the old behavior, the cluster is `behavior-changed` (see "Bug fixes" in `SKILL.md`) and counts like one.

## Beside the tier

These facts are not risk, so they do not move the tier. Urgency goes at the top, above the verdict; Confidence goes on the verdict line; Replacement and Timing get their own lines under the verdict:

- **Urgency**: "Update soon — security:" when an advisory affects the current version and the target fixes it, with the advisory IDs and their severity. It goes at the top, whatever the tier.
- **Replacement**: when step 5 finds a successor, name it and link the source. The move to the successor is a separate decision; the tier covers only the bump.
- **Timing**: when the target is younger than 7 days: "Released N days ago; fresh releases get hotfixes, so consider a week's wait." If the policy sets `minimumReleaseAge` and the target is younger, the report is DEFERRED instead.
- **Confidence**: when notes are missing for some versions, only commit messages or artifact diffs were available, or a check could not run (for example the advisory check), add "(low confidence: …)" after the tier on the verdict line, for example "(low confidence: notes missing for 2 of 5 versions)", and the details in the caveats.

## Policy

- `riskFloor` raises the tier to at least the floor and never lowers it. Show both: "LOW; policy floor → MEDIUM".
- `minimumReleaseAge`: see Timing.

## Verdict line

The verdict names the tier, what set it with counts, and in one sentence what the user must do. Count the items that the report lists in each section; the verdict and the section headings use the same counts, so that the reader can check each item. There is no score, so do not invent points.

```
**Risk: HIGH** — 2 required changes: 22.0.0 removes the Google Sign-In API that the login flow calls. Move sign-in to Credential Manager first; after that, the bump is a one-line change.

**Risk: MEDIUM** — 1 behavior change to verify by hand: the new default animation duration. Nothing to change in code; check the dashboard charts once after the bump.

**Risk: LOW** — no used API changes. One deprecation is listed under Suggestions.
```

## Clusters

Put entries into one cluster when they:

1. reference the same PR or issue (`#904`, `owner/repo#904`, the same URL);
2. sit under one heading of one release and describe the same feature or component;
3. describe one change that the notes split across bullets ("rewrote the renderer", "the renderer now uses X", "renderer: set a minimum height").

Otherwise keep them apart. Example: three Balloon 1.7.6 bullets about the new popup-window rendering (PRs #965–#967) are one `behavior-changed` cluster: one item to verify, not three.

## Worked examples

The library names in examples 1, 2, and 7 are placeholders; the others use real release facts.

1. **Routine patch.** `netkit` 4.12.0 → 4.12.1, released 60 days ago, one bug fix in a code path that the project does not reach. Nothing to change and nothing to verify: **LOW**.
2. **Fresh minor with a deprecation.** `navkit` 2.9.6 → 2.10.0, released 1 day ago, one deprecated API used at two sites. Deprecations compile: **LOW**, with the two sites under Suggestions and a timing line.
3. **Major with a removal.** play-services-auth 21.6.0 → 22.0.0, released 30 days ago. 22.0.0 removes the Google Sign-In API, which the project calls at three sites, and raises `minSdk` from 23 to 24, which the project (at 26) already meets. Required changes: **HIGH**. The `minSdk` line goes under Constraints as met.
4. **Security fix.** okhttp 4.9.0 → 4.12.0, released 90 days ago, no used API changes; the target fixes GHSA-3cqm-mf7h-prrj (CVE-2021-0341, HIGH). Nothing to change or verify: **LOW**, with "Update soon — security" at the top.
5. **Internal builds only.** Pulse 5.1.4 → 5.2.3 in a project where only internal schemes link the Pulse console and the logging calls sit inside `#if DEBUG`. The console redesign and the new store format (it deletes the old logs) are `manual` behavior changes in internal-only code: **MEDIUM**, with both items marked "internal builds only". Five bug fixes drive nothing, and the console's iOS 18 minimum applies to internal code only, so it goes under Constraints.
6. **A change that a linter reveals.** A lint plugin 1.4.0 → 1.5.0 turns on two new rules by default, and the project's lint task fails on any finding. Whether the new rules flag existing code is unknown until the task runs, so they are `check` items: the task must run, and its findings must be read: **MEDIUM**, with the lint command under "Automated checks".
7. **A change that fails for certain.** `queuekit` 4.2 → 4.3: from 4.3, the session keeps a reference to a request only after `resume()`, as the session source at both versions shows. The project's request queue keeps each new request only in a `weak` property and resumes it later, so the property is `nil` and the queued calls never start. A certain failure at a confirmed site: **HIGH**, as a required change with the fix.
