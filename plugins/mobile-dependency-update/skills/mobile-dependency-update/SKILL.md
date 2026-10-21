---
name: mobile-dependency-update
description: Analyze dependency updates for risk in Gradle (Android) and Swift Package Manager (iOS) projects. Run `/mobile-dependency-update:mobile-dependency-update` on a branch to analyze every dependency that it changes against its base branch, or name a library to look at that one only. The report gives a LOW / MEDIUM / HIGH tier with the required code changes, from the release notes and the project's call sites; when you ask to update and the branch does not contain the version edit yet, the skill proposes it and applies it only after a yes. Not Cowork-ready — needs `gh`/`curl` egress to Maven, GitHub, and OSV registries, plus the project's Gradle or Xcode toolchain.
argument-hint: "[library] [version] [branch or pull request]"
disable-model-invocation: true
---

# Dependency update analysis

This skill answers one question: what happens to this project if it takes this update, and what must change in the code? A tier alone is not an answer — Dependabot already says that an update exists. The value is in the specifics: which call sites break, which behavior shifts, which minimum rises, and what to do about each.

Two things make the answer trustworthy, and the workflow protects both:

- **Evidence.** Every version, date, and release-note claim comes from a source fetched in this run, with a link in the report. What you remember about a library tells you where to look; it is never the evidence.
- **Relevance.** A change matters only if the project uses the affected API. The usage check reads the real call sites.

## Files in this skill

`<skill-dir>` is this skill's base directory, shown when the skill loads.

| File | When to read it |
|---|---|
| `references/gradle.md` | Gradle projects (Android, JVM) |
| `references/spm.md` | Swift Package Manager projects (Xcode or `Package.swift`) |
| `references/scoring.md` | Before you set the tier (step 9) |
| `references/branch-changes.md` | Every branch comparison: section 1 lists the changes; the rest applies when more than one dependency changed |
| `assets/report.example.md`, `assets/branch-report.example.md` | Before you write the report: the shape to follow |

The scripts give exact data, so do not redo their work by hand. They need only Python 3.9+ and the standard library: `python3 <skill-dir>/scripts/<name>.py`.

- `list_versions.py` — newer versions, release dates, and bump types (its GitHub mode also calls `git`, and `gh` when present).
- `spm_deps.py` — SPM packages: rules, pins, products, local and binary packages.
- `osv_check.py` — security advisories for the current and the target version.
- `html_to_text.py` — the text of an HTML release-notes page.

## What to analyze

Pick the narrowest reading of the request:

- By default, analyze every dependency that the current branch changes. Compare it with the base of its open pull request (`gh pr view --json baseRefName`) or, without one, with the remote default branch. Fetch the base, then diff from the merge base: `git diff --merge-base origin/<base>`, which also shows edits that are not committed yet. Name the base and the head in the report, so that the user can correct them.
- If the user names a base branch, another branch, or a pull request, compare that instead, and fetch what they name. A pull request brings its own base: `gh pr diff <number>`.
- If the user names a library, look only at that library: an update to the version that the user names, else its change on the branch, else an update to the newest stable version.
- If the comparison changes no dependency and the user named no library, say so, name the other changes (for example the Gradle wrapper or a GitHub Action), and stop.

List the changed dependencies with section 1 of `references/branch-changes.md`. When more than one dependency changed, follow the rest of that file: it runs this workflow per dependency and, for long lists, fans the work out to subagents.

Read the code at the head of the comparison. When the head is not the current checkout, fetch it, export it to a temporary directory (`git archive <ref> | tar -x -C <dir>`), and read it there. Propose edits only for the current checkout.

## Workflow

1. **Detect the ecosystem.** Gradle: `settings.gradle(.kts)`, `build.gradle(.kts)`, or `gradle/libs.versions.toml`. SPM: a `project.pbxproj` with package references, a `Package.resolved`, or a root `Package.swift` (Xcode app projects usually have no root `Package.swift`). Read the matching reference. If both match, ask which one, unless the library exists in only one. If none matches, stop: name the files that you checked, and say that the skill covers only Gradle and SPM.

2. **Find the current version** and every place that declares it (file:line). The ecosystem reference says how. The version that ships is the resolved one — the SPM pin, the catalog value behind a `version.ref` — not a rule's minimum. When the branch changes the dependency, the current version is the one at the base, and the declarations are the lines on the head.

3. **Read the CI result** of the head, if CI built it: `gh pr checks <number>` for a pull request, else the checks of the commit (`gh api repos/<owner>/<repo>/commits/<sha>/check-runs`, and `/commits/<sha>/status` for older CI integrations). The result applies only to a target that this commit contains. For edits that are uncommitted or unpushed, a library that the branch does not change, or a version other than the one on the branch, there is no result.
   - **Passed** (every check that builds or tests the project passed): the compiler already checked the code that CI builds, so do not repeat that work. Skip `build` outcomes, deprecations under warnings as errors, and the search of that code for removed APIs and changed signatures. What a pass does not prove stays: references by name (manifest and layout XML, keep rules, reflection, storyboards), code that CI does not build (release-only sources, other flavors or schemes), changes that only a release build shows (new R8 or ProGuard rules), behavior changes (also inside a cluster that removes an API), minimums, and conflicts. If the CI config in the repository shows that CI also builds a release or another flavor, that code counts as checked.
   - **Failed** (a check that builds or tests the project failed): analyze as usual, and name the findings that are the likely cause. If none is, a single report adds a Manual review question that links the failed check; a branch report says so on its CI line.
   - **Pending** (such a check has not finished), or no result: analyze as usual.

   Other checks, such as a title linter or a code-quality gate, do not count. Name the result in the report: the checks, the result, and the commit.

4. **Pick the target.** Take the version that the user named; else, when the branch changes the dependency, the version on the head; else the newest stable version from `list_versions.py`. If you pick the newest version and it is a major bump, also report the newest version inside the current major: it is often the safe first step. Skip pre-releases unless the user asks for one or already uses one. Whatever the source of the target, `list_versions.py` gives the versions and dates in the range; pass `--pre` when the target is a pre-release. If the target is lower than the current version (a rollback), pass the target as the current version, so that the script lists the range up to the current version, and report what the project loses. If you look for the newest version and none exists, run only steps 5, 8, and 11, then stop. If step 5 found a successor, call the current version the final release and ask whether to analyze the migration; otherwise, say that the project is on the newest version. Report any open advisory.

5. **Check for a replacement.** If a source fetched in this run says that the library is superseded, the update is a `replacement`: name the successor and link the source. Signs: an archived repository; an end-of-life, deprecation, or successor notice in the README, the release notes, or the docs; a moved coordinate.

6. **Get the release notes** for every version in (current, target]:
   1. the guide cache entry, if fresh (see "Guide cache");
   2. the sources in the ecosystem reference;
   3. GitHub (see "GitHub sources").

   Fetch raw text with `curl`, `gh api`, and `html_to_text.py`. Use WebFetch only when these fail, and ask it for verbatim text: it returns a model-written summary, and exact API names get lost in summaries. Note each version whose notes you could not find — the verdict marks gaps as low confidence.

7. **Collect hard evidence** when the notes are terse, the bump is major, or an entry claims a removal or a signature change: diff the public API, the minimum platform or SDK, and the transitive dependencies of the two versions. After a passed CI run (step 3), diff the public API only if the notes are terse. The ecosystem reference shows how. When the artifact and the release notes disagree, trust the artifact.

8. **Check advisories** with `osv_check.py`. It reports what the target fixes, what it introduces, and what stays open. If OSV is unreachable, write "advisory check unavailable" in the caveats and continue.

9. **Label, cluster, and check usage** (sections below), then **set the tier** with `references/scoring.md`.

10. **Write the report** in the shape of `assets/report.example.md`.

11. **Update the guide cache.**

12. **Propose the edit** if the user asked to update, the head is the current checkout, and the branch does not contain the edit yet: the exact change (file:line, old → new, plus the pin or lockfile entry that follows). If required changes exist, say what the version edit alone breaks until they are done: the build, or the behavior at the listed sites. Ask, and wait. Edit only after an explicit yes, and only the listed lines; then offer the verification step from the ecosystem reference. The user decides because a version bump can break the build or change runtime behavior in ways that the report can only predict. When the branch already contains the version change, propose nothing: the required changes list what the branch still lacks, and a fix that the branch already makes counts as done.

## Labels

Give each release-note entry that can touch the project exactly one label, by what the change means for a caller — not by the words the note happens to use.

| Label | Meaning |
|---|---|
| `removed` | A public API, module, or product that projects can use is gone. |
| `signature-changed` | The API still exists, but callers must change: parameters, return type, nullability, `async` or `throws`, generic constraints, or a new package or module path. |
| `behavior-changed` | Same signature, different runtime result: defaults, threading, errors, timing, rendering, persistence, network behavior. |
| `deprecated` | Still works, but is marked for removal. Note the replacement. |
| `bugfix` | A defect fix that keeps the documented behavior. |
| `additive` | A new API. It matters only if it can improve the project's code (see "Improvements"). |
| `noise` | Docs, tests, CI, internal refactors, build changes with no visible effect. |

If an entry fits more than one label, use the most severe: removed > signature-changed > behavior-changed > deprecated > bugfix > additive > noise.

Cases that keyword matching gets wrong:

- "Fix: `parse()` no longer throws on empty input" → `behavior-changed`: callers that catch the error now take a different path.
- "Removed the workaround for the Android 7 crash" → `bugfix` or `noise`: no public API is gone.
- "Revert the default of X to fix a regression" → `behavior-changed`: a changed default changes the runtime result, also when the release calls it a fix or when it restores the behavior of an older version.
- "Renamed `Foo.bar` to `Foo.baz`; `bar` is deprecated" → `deprecated`: old code still compiles.
- "`Session.request(_:)` is now `async`" → `signature-changed`.
- "Raised minSdk to 24" or "requires iOS 15" → no label: it is a constraint. If the project does not meet it, it is also a required change with the tag `[minimum]` (see `references/scoring.md`).

**Clusters.** Entries that describe one change — the same PR or issue, or one feature within one release — form one cluster. Label the cluster once, at its most severe label: ten bullets about one rewrite are still one change. After the usage check, a cluster that the project uses only in part takes the most severe label among the members that it uses.

## Usage check

For each cluster above `noise`, find out whether the project uses the affected API:

1. List the source files that import the library. The ecosystem reference gives the import forms and file globs. Skip build output, vendored code, and generated code.
2. Search those files for the symbol: the type, member, function, or resource name. Also search the files that name classes without an import — XML, keep rules, storyboards, XIBs, and plists — for the class names.
3. Read each hit and confirm that it is a real use of this library's API — not a comment, a string, or a same-named symbol from somewhere else. Also note whether the site ships in production or only in internal builds (`#if DEBUG`, a target or scheme that the release build does not link, `debugImplementation`): the report marks internal-only items. For a `behavior-changed` cluster, also confirm the use on a path that this project can run. A project fact decides: a setting that the project overrides, a mode that it never turns on, an SDK or OS level that it is past. A trace through the library's internals does not decide; if the judgment needs one, the site stays confirmed. The project fact must decide on its own: if it needs an assumption about how a library or a tool treats that fact, the site stays confirmed. Before you drop a site, search the project for code that contradicts the fact. When this removes every site of a `behavior-changed` cluster, write a `dropped:` line: the cluster, the sites, the project fact, and what would make the path run. The report lists these lines under the caveats.

Classify each cluster as `used` (at least one confirmed site), `ambiguous` (hits you cannot confirm, typically generic names such as `Result`, `Session`, or `Configuration`), or `unused`. An import alone proves nothing: Swift imports whole modules, and Kotlin calls members without naming them in an import.

**What the change does at each site.** For each confirmed site of a `behavior-changed` cluster, state what the new behavior does there: what fails, which value changes, or which code no longer runs. When the notes do not say, read the library's source at both versions.

**Bug fixes.** A `bugfix` gets no item to verify: it keeps the documented behavior. Look for project code that the fix touches: a workaround, a comment or an issue link about the bug, a test that asserts the old output, code that parses or stores the old format. If that code gives a different result after the fix, relabel the cluster `behavior-changed` and cite that site. If the code only becomes unnecessary, it is an improvement (see "Improvements").

**How the change shows.** For each `used` cluster that is `behavior-changed`, decide what reveals the change (an `ambiguous` cluster goes under Manual review instead):

- `build` — any build fails: a compiler, annotation-processor, resource, or shrinker error.
- `check` — a named command fails: a linter or static-analysis task, or a test that runs the site. A test counts only if it runs the library's real code at the site, not a fake, and the task fails on a finding (for example detekt `maxIssues: 0`, lint `abortOnError`). Name the test file.
- `manual` — only a person who runs the app sees it: runtime behavior, UI, timing, network behavior, device-specific behavior, the behavior of a minified release build.

Take `manual` if you cannot name the command, or, for a test, the test file. The ecosystem reference lists the usual commands and where CI config lives. After a passed CI run (step 3), only a build that CI does not run, such as a release build with R8, can give a `build` outcome. If the code at a confirmed site fails for certain with the new behavior (an error, a crash, or a call that never completes), and the library's source or artifacts at both versions show it, the item is a required change: list it under the required changes with its sites and the fix. If the effect depends on a race between threads, on data, or on device state, it stays an item to verify, even when you know a likely fix. Decide per site: one cluster can give a required change at one site and an item to verify at another.

**Improvements.** An update can also let the project simplify or improve its code. Look for three cases in the notes of the range:

- a new API that replaces code that the project wrote by hand: a custom retry loop, a hand-written date parser, a custom coverage task;
- an API that the release notes recommend in place of one that the project uses, before any deprecation;
- a fix or a new default that makes project code unnecessary: a workaround that still works after the fix, or a setting that now repeats the default.

For an `additive` cluster, this search replaces the usage check. Report an improvement only for a clear match at a confirmed site: name the site, what to change, what the project gains, and the source. "You could use X" without a site is noise. Improvements go under Suggestions and never set the tier.

## Report rules

- Verdict first, below only an urgency line: the tier, what set it with counts, and one sentence that says what the user must do (see "Verdict line" in `references/scoring.md`).
- Section order: the urgency line, the verdict, the CI, replacement, and timing lines, then Required changes, Behavior changes to verify, Automated checks, Suggestions, Constraints, Manual review, Release notes, advisories and caveats, and the Apply question.
- Leave out sections that have no items.
- Each required change names its usage sites (file:line), says what to change, and links its source (release note, changelog file, or diff).
- Summarize release notes in your own words and link them. Do not paste them: pasted notes bury the findings, and Claude limits verbatim quotes from fetched pages.
- Keep `unused` clusters out of the main sections. The changelog summary lists them only if they are `removed` or `signature-changed`, because those show how disruptive the release is.
- "Behavior changes to verify" lists only `manual` items: what a person must try by hand. Each item names the trigger in the project's normal use and the symptom that a person sees. Without both, the item is a precaution: leave it out.
- **Suggestions** holds the `deprecated` clusters that are used or unconfirmed, each with its replacement, and the improvements. Each item names its sites and links its source.
- `build` items are required changes: list them under Required changes with their sites and the build command that shows them. `check` items go into one "Automated checks" line: each command once, with the items that it covers. Add "(CI runs it)" when a CI config file in the repository runs that task. If the check that runs it also passed on the head (step 3), write "(passed in CI)" instead: that item is done. If the report has `check` items and no CI config file runs them, add one caveat line instead: "CI coverage unknown: run the automated checks once if CI does not."
- **Manual review** holds `ambiguous` clusters above `deprecated`: hits that you could not confirm (name each hit and what would confirm it), and uses that depend on a fact outside the repository, such as a dashboard, server, or CI setting (one question each, with what follows from each answer). In a single report, it also holds a CI failure that no finding explains (step 3). An unconfirmed `deprecated` cluster goes under Suggestions, marked "unconfirmed".
- End with the caveats: versions without notes, failed fetches, checks you could not run.

## GitHub sources

Most libraries publish on GitHub, and GitHub is the fallback for every ecosystem source. For `<owner>/<repo>`:

- **Releases**: one tag with `gh api repos/<owner>/<repo>/releases/tags/<tag> --jq '.published_at, .body'`, or the list with `gh api 'repos/<owner>/<repo>/releases?per_page=100' --jq '.[] | [.tag_name, .published_at] | @tsv'`. Tag forms vary — `1.2.3`, `v1.2.3`, `<artifact>-v1.2.3`, `<artifact>/1.2.3` — so record the form that worked in the guide cache.
- **Changelog files**: `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, `RELEASE_NOTES.md`, `docs/CHANGELOG.md`, with `gh api 'repos/<owner>/<repo>/contents/<path>?ref=<tag>' -H 'Accept: application/vnd.github.raw'`. Read the file at the target tag: the top of the default branch can describe unreleased work.
- **Last resort**: `gh api repos/<owner>/<repo>/compare/<old-tag>...<new-tag> --jq '.commits[].commit.message'`. Commit messages are not release notes: count the notes as not found.

Monorepos publish several artifacts per release: keep only the entries for this artifact. Without `gh`, call the same `https://api.github.com/...` URLs with `curl` (60 requests per hour without a token).

## Guide cache

`~/.claude/dependency-update/dependency-guides/` keeps what earlier runs learned about each library — where its notes live, format quirks, gotchas, fetch hints — so that the next run is faster and avoids the same traps. It lives outside `<skill-dir>` because Claude Code replaces the skill directory on every plugin update; every install on the machine shares one cache.

- File name: the coordinate with `:` and `/` replaced by `_` (`com.google.firebase_firebase-bom.md`, `github.com_Alamofire_Alamofire.md`). If no file name matches, `grep -l '<coordinate>' ~/.claude/dependency-update/dependency-guides/*.md`: guides list other coordinates of the same library under `aliases`.
- Always use that absolute path. Never create `dependency-guides/` in the project or under `<skill-dir>`. Create the directory with `mkdir -p` before the first write.
- Read the entry before step 6. Trust its `primary_source` if `last_verified` is less than 180 days old; otherwise verify it again.
- After the run, create the entry from `<skill-dir>/assets/guide.template.md` or update it: `last_verified`, `last_verified_version`, and whatever would make the next run cheaper or safer.
- Record library facts only. Facts about this project — which modules it uses, where it calls an API — belong in the report, because every project reads the cache.
- If you found no release notes anywhere, write `status: no-changelog-found` with the places you tried under `tried`; later runs skip those places for 30 days.
- If the directory cannot be created or written, skip the write and say so in the caveats.

## Boundaries

- One project per run.
- Never commit, push, or open a pull request. Build files change only through step 12.
