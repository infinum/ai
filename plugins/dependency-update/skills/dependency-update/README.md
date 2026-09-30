# dependency-update

Analyze a dependency update for risk and relevance in Gradle (Android, JVM) and Swift Package Manager (iOS, Xcode) projects. The skill fetches the release notes for every version between the current and the target, checks security advisories, reads the project's real call sites, and writes a risk-scored report (LOW / MEDIUM / HIGH) that names the required code changes. It proposes the exact version edit and applies it only after you say yes.

## Usage

```
/dependency-update:dependency-update
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill also triggers on plain requests. Examples:

- "Can we move to Alamofire 5.12?"
- "Bump AGP."
- "Is Firebase 12.19 ok for us?"
- "What changed in Room between 2.6 and 2.7?"
- "Which dependencies are outdated?" — scan mode: one report for the whole project.

## What it does

1. **Detects the ecosystem** — Gradle (`build.gradle(.kts)`, `gradle/libs.versions.toml`) or SPM (`project.pbxproj`, `Package.resolved`, `Package.swift`).
2. **Finds the current version** and every place that declares it, then picks the target: the version you named, or the newest stable one. For a major bump it also reports the newest version inside the current major.
3. **Fetches the release notes** for every version in between, from the ecosystem's sources and GitHub, and diffs the public API or the artifact when the notes are terse.
4. **Checks advisories** with OSV: what the target fixes, what it introduces, what stays open.
5. **Labels each change** (`removed`, `signature-changed`, `behavior-changed`, `deprecated`, `bugfix`, `additive`, `noise`) and checks whether the project uses the affected API. A change counts only if a real call site uses it.
6. **Scores the risk** and writes the report: verdict first, required changes with `file:line`, behavior changes to verify by hand, automated checks that reveal the rest, constraints such as a raised minimum SDK, and caveats.
7. **Proposes the edit** — old → new at `file:line`, plus the lockfile or pin entry — and waits for an explicit yes before it edits anything. It never commits or opens a pull request.

### Scan mode

Ask what is outdated and the skill inventories the direct dependencies, lists the newer stable versions, and runs the analysis per dependency. Long lists fan out to subagents so that release notes do not crowd out the analysis.

### Policy file

An optional `dependency-update-policy.yaml` at the repo root or in `.claude/` sets per-dependency rules: a minimum release age, disabled dependencies with a reason, groups, and dependencies that always escalate. See `assets/policy.example.yaml` for each field.

### Guide cache

The skill keeps library facts that earlier runs learned — where the notes live, tag formats, gotchas, fetch hints — in `~/.claude/dependency-update/dependency-guides/`, one file per coordinate in the shape of `assets/guide.template.md`. The directory sits outside the plugin, so the cache survives plugin updates, and every install on the machine shares it. Runs create and update the entries. You can add or correct one by hand; keep `status` and the dates accurate. Library facts only: nothing in an entry can depend on one project. Delete an entry to make the next run discover the library again.

## Requirements

- Python 3.9 or newer (standard library only) for the four helper scripts.
- `curl`, and `gh` for GitHub sources (without `gh` the skill falls back to the unauthenticated GitHub API, 60 requests per hour).
- Network access to Maven Central, Google Maven, the Gradle plugin portal, GitHub, and `api.osv.dev`.
- The project's Gradle or Xcode toolchain for the optional verification step after an edit.

## When to use

| Situation | Use this skill? |
|---|---|
| Update, upgrade, or bump a library, SDK, or Gradle plugin | Yes |
| Decide whether an update is safe or what it breaks | Yes |
| Find out what changed between two versions of a dependency | Yes |
| List the outdated dependencies of a project | Yes — scan mode |
| npm, PyPI, CocoaPods, or another ecosystem | Not yet — see `references/adding-an-ecosystem.md` |
| Vet a brand-new dependency before adopting it | No — use `security-check:dependency-adoption-review` |

## Environment compatibility

Works in the Claude Code terminal and any agent with shell access, `python3`, and network egress to the registries above. Not viable in Cowork: the sandbox blocks outbound `curl` and `gh` to Maven, GitHub, and OSV, and it has no Gradle or Xcode toolchain. With a target version that you name, the skill can fall back to `WebFetch` for the release notes, but version discovery, release dates, and the advisory check still need shell egress, and the guide cache needs a writable `~/.claude/`, so the report comes out with caveats.
