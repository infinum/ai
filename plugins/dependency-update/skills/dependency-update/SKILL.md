---
name: dependency-update
description: Analyze a dependency update for risk and relevance in Gradle (Android, JVM) and Swift Package Manager (iOS, Xcode) projects. Use it whenever the user wants to update, upgrade, or bump a library, SDK, package, or Gradle plugin; asks whether an update is safe or what it breaks; asks what changed or what is new between versions of a dependency; or asks which dependencies are outdated — even when they only name the library ("can we move to Alamofire 5.12?", "bump AGP", "is Firebase 12.19 ok for us?"). Produces a risk-scored report (LOW / MEDIUM / HIGH) built from the fetched release notes and the project's real usage — required code changes, behavior changes, raised minimums, security advisories — then proposes the exact version edit and applies it only after the user says yes. Not Cowork-ready — needs `gh`/`curl` egress to Maven, GitHub, and OSV registries, plus the project's Gradle or Xcode toolchain.
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
| `references/scoring.md` | Before you score (step 9) |
| `references/scan-mode.md` | The user asks what is outdated |
| `references/replacements.yaml` | Step 5: known successor coordinates |
| `assets/report.example.md`, `assets/scan-report.example.md` | Before you write the report: the shape to follow |
| `assets/policy.example.yaml` | The project has a policy file: what each field does |
| `references/adding-an-ecosystem.md` | Only for an ecosystem that this skill does not cover yet |

The scripts give exact data, so do not redo their work by hand. They need only Python 3.9+ and the standard library: `python3 <skill-dir>/scripts/<name>.py`.

- `list_versions.py` — newer versions, release dates, and bump types (its GitHub mode also calls `git`, and `gh` when present).
- `spm_deps.py` — SPM packages: rules, pins, products, local and binary packages.
- `osv_check.py` — security advisories for the current and the target version.
- `html_to_text.py` — the text of an HTML release-notes page.

## Modes

- **Single dependency** — the user names a library, maybe with a target version. Follow the workflow below.
- **Scan** — the user asks what is outdated. Follow `references/scan-mode.md`; it reuses this workflow per dependency and, for long lists, fans the work out to subagents.

## Workflow

1. **Detect the ecosystem.** Gradle: `settings.gradle(.kts)`, `build.gradle(.kts)`, or `gradle/libs.versions.toml`. SPM: a `project.pbxproj` with package references, a `Package.resolved`, or a root `Package.swift` (Xcode app projects usually have no root `Package.swift`). Read the matching reference. If both match, ask which one, unless the library exists in only one. If none matches, stop: name the files you checked and point to `references/adding-an-ecosystem.md`.

2. **Find the current version** and every place that declares it (file:line). The ecosystem reference says how. The version that ships is the resolved one — the SPM pin, the catalog value behind a `version.ref` — not a rule's minimum.

3. **Load the policy** from `dependency-update-policy.yaml` at the repo root or in `.claude/`, if present (fields: `assets/policy.example.yaml`). Warn about fields you do not recognize and continue; if the file does not parse, name the line and use the defaults. If a rule sets `disabled: true` for this dependency, say so and ask whether to analyze it anyway.

4. **Pick the target.** Take the version the user named, else the newest stable version from `list_versions.py`. If the newest is a major bump, also report the newest version inside the current major: it is often the safe first step. Skip pre-releases unless the user asks for one or already uses one.

5. **Check for a replacement.** If `references/replacements.yaml` lists the current coordinate, the update is a `replacement`: name the successor and link the migration guide.

6. **Get the release notes** for every version in (current, target]:
   1. the guide cache entry, if fresh (see "Guide cache");
   2. the sources in the ecosystem reference;
   3. GitHub (see "GitHub sources").

   Fetch raw text with `curl`, `gh api`, and `html_to_text.py`. Use WebFetch only when these fail, and ask it for verbatim text: it returns a model-written summary, and exact API names get lost in summaries. Note each version whose notes you could not find — the score counts gaps.

7. **Collect hard evidence** when the notes are terse, the bump is major, or an entry claims a removal or a signature change: diff the public API, the minimum platform or SDK, and the transitive dependencies of the two versions. The ecosystem reference shows how. When the artifact and the release notes disagree, trust the artifact.

8. **Check advisories** with `osv_check.py`. It reports what the target fixes, what it introduces, and what stays open. If OSV is unreachable, write "advisory check unavailable" in the caveats and continue.

9. **Label, cluster, and check usage** (sections below), then **score** with `references/scoring.md`.

10. **Write the report** in the shape of `assets/report.example.md`.

11. **Update the guide cache.**

12. **Propose the edit** if the user asked to update: the exact change (file:line, old → new, plus the pin or lockfile entry that follows). If required code changes exist, say that the version edit alone breaks the build until they are done. Ask, and wait. Edit only after an explicit yes, and only the listed lines; then offer the verification step from the ecosystem reference. The user decides because a version bump can break the build or change runtime behavior in ways that the report can only predict.

## Labels

Give each release-note entry that can touch the project exactly one label, by what the change means for a caller — not by the words the note happens to use.

| Label | Meaning |
|---|---|
| `removed` | A public API, module, or product that projects can use is gone. |
| `signature-changed` | The API still exists, but callers must change: parameters, return type, nullability, `async` or `throws`, generic constraints, or a new package or module path. |
| `behavior-changed` | Same signature, different runtime result: defaults, threading, errors, timing, rendering, persistence, network behavior. |
| `deprecated` | Still works, but is marked for removal. Note the replacement. |
| `bugfix` | A defect fix that keeps the documented behavior. |
| `additive` | A new API. It matters only if the project does the same thing by hand today. |
| `noise` | Docs, tests, CI, internal refactors, build changes with no visible effect. |

If an entry fits more than one label, use the most severe: removed > signature-changed > behavior-changed > deprecated > bugfix > additive > noise.

Cases that keyword matching gets wrong:

- "Fix: `parse()` no longer throws on empty input" → `behavior-changed`: callers that catch the error now take a different path.
- "Removed the workaround for the Android 7 crash" → `bugfix` or `noise`: no public API is gone.
- "Revert the default of X to fix a regression" → `behavior-changed`: a changed default changes the runtime result, also when the release calls it a fix or when it restores the behavior of an older version.
- "Renamed `Foo.bar` to `Foo.baz`; `bar` is deprecated" → `deprecated`: old code still compiles.
- "`Session.request(_:)` is now `async`" → `signature-changed`.
- "Raised minSdk to 24" or "requires iOS 15" → no label: it is a constraint (see `references/scoring.md`).

**Clusters.** Entries that describe one change — the same PR or issue, or one feature within one release — form one cluster. Label and score the cluster once, at its most severe label: ten bullets about one rewrite are still one change.

## Usage check

For each cluster above `noise`, find out whether the project uses the affected API:

1. List the source files that import the library. The ecosystem reference gives the import forms and file globs. Skip build output, vendored code, and generated code.
2. Search those files for the symbol: the type, member, function, or resource name.
3. Read each hit and confirm that it is a real use of this library's API — not a comment, a string, or a same-named symbol from somewhere else. Also note whether the site ships in production or only in internal builds (`#if DEBUG`, a target or scheme that the release build does not link, `debugImplementation`): the score weighs internal-only usage lower. For a `behavior-changed` cluster, also confirm the use on a path that this project can run. A project fact decides: a setting that the project overrides, a mode that it never turns on, an SDK or OS level that it is past. A trace through the library's internals does not decide; if the judgment needs one, the site stays confirmed. The project fact must decide on its own: if it needs an assumption about how a library or a tool treats that fact, the site stays confirmed. Before you drop a site, search the project for code that contradicts the fact. When this removes every site of a `behavior-changed` cluster, write a `dropped:` line: the cluster, the sites, the project fact, and what would make the path run. The report lists these lines under the caveats.

Classify each cluster as `used` (at least one confirmed site), `ambiguous` (hits you cannot confirm, typically generic names such as `Result`, `Session`, or `Configuration`), or `unused`. An import alone proves nothing: Swift imports whole modules, and Kotlin calls members without naming them in an import.

**Bug fixes.** A `bugfix` gets no check: it keeps the documented behavior. If the project depends on the old behavior — a workaround, a comment or an issue link about the bug, a test that asserts the old output, code that parses or stores the old format — relabel the cluster `behavior-changed` and cite that site.

**How the change shows.** For each `used` or `ambiguous` cluster that is `behavior-changed`, decide what reveals the change:

- `build` — any build fails: a compiler, annotation-processor, resource, or shrinker error.
- `check` — a named command fails: a linter or static-analysis task, or a test that runs the site. A test counts only if it runs the library's real code at the site, not a fake, and the task fails on a finding (for example detekt `maxIssues: 0`, lint `abortOnError`). Name the test file.
- `manual` — only a person who runs the app sees it: runtime behavior, UI, timing, network behavior, device-specific behavior, the behavior of a minified release build.

Take `manual` if you cannot name the command, or, for a test, the test file. The ecosystem reference lists the usual commands and where CI config lives. When you already know the exact sites and the fix, the item is a required change, not a check: list it under the required changes with its sites.

For an `additive` cluster, search instead for code that does by hand what the new API offers (a custom retry loop, a hand-written date parser). Report it only when the match is clear; a vague "you could use X" is noise.

## Report rules

- Verdict first: the tier and one sentence that says what the user must do.
- Leave out sections that have no items.
- Each required change names its usage sites (file:line), says what to change, and links its source (release note, changelog file, or diff).
- Summarize release notes in your own words and link them. Do not paste them: pasted notes bury the findings, and Claude limits verbatim quotes from fetched pages.
- Keep `unused` clusters out of the main sections. The changelog summary lists them only if they are `removed` or `signature-changed`, because those show how disruptive the release is.
- "Behavior changes to verify" lists only `manual` items: the checks that a person must do. Each item names the trigger in the project's normal use and the symptom that a person sees. Without both, the item is a precaution: leave it out.
- `build` and `check` items go into one "Automated checks" line: each command once, with the items that it covers. Add "(CI runs it)" when the policy `ci` field or a CI config file in the repository runs that task. If you found neither, add one caveat line instead: "CI coverage unknown: run the automated checks once if CI does not."
- **Manual review** holds `ambiguous` clusters whose use depends on a fact outside the repository — a dashboard, server, or CI setting: one question each, with what follows from each answer.
- If the target is younger than a policy `minimumReleaseAge`, mark the report **DEFERRED** at the top and say when the version clears the floor. The user can override it.
- End with the caveats: versions without notes, failed fetches, checks you could not run.

## GitHub sources

Most libraries publish on GitHub, and GitHub is the fallback for every ecosystem source. For `<owner>/<repo>`:

- **Releases**: one tag with `gh api repos/<owner>/<repo>/releases/tags/<tag> --jq '.published_at, .body'`, or the list with `gh api 'repos/<owner>/<repo>/releases?per_page=100' --jq '.[] | [.tag_name, .published_at] | @tsv'`. Tag forms vary — `1.2.3`, `v1.2.3`, `<artifact>-v1.2.3`, `<artifact>/1.2.3` — so record the form that worked in the guide cache.
- **Changelog files**: `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, `RELEASE_NOTES.md`, `docs/CHANGELOG.md`, with `gh api 'repos/<owner>/<repo>/contents/<path>?ref=<tag>' -H 'Accept: application/vnd.github.raw'`. Read the file at the target tag: the top of the default branch can describe unreleased work.
- **Last resort**: `gh api repos/<owner>/<repo>/compare/<old-tag>...<new-tag> --jq '.commits[].commit.message'`. Commit messages are not release notes: score the notes as not found.

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
