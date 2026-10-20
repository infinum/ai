# mobile-dependency-update

Analyze dependency updates for risk and relevance in Gradle (Android) and Swift Package Manager (iOS, Xcode) projects. Run it on a branch, for example a Renovate pull request, and it analyzes every dependency that the branch changes against its base branch. Name a library, and it analyzes that one update. The skill fetches the release notes for every version between the current and the target, checks security advisories, reads the project's real call sites, and writes a report with a risk tier (LOW / MEDIUM / HIGH) that names the required code changes. When the branch does not contain the version edit yet, it proposes the exact edit and applies it only after you say yes.

## Usage

```
/mobile-dependency-update:mobile-dependency-update [library] [version] [branch or pull request]
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`.)

The skill runs only when you invoke it; a run is expensive, so it never triggers on plain requests. Examples:

- `/mobile-dependency-update:mobile-dependency-update` — on a branch: every dependency that the branch changes against its base branch.
- `/mobile-dependency-update:mobile-dependency-update PR 4357` — the changes of a pull request, without a checkout.
- `/mobile-dependency-update:mobile-dependency-update against develop` — another base branch.
- `/mobile-dependency-update:mobile-dependency-update Alamofire 5.12` — one library, also when the branch does not change it.
- `/mobile-dependency-update:mobile-dependency-update is Firebase 12.19 ok for us?`
- `/mobile-dependency-update:mobile-dependency-update what changed in Room between 2.6 and 2.7?`

## What it does

1. **Detects the ecosystem** — Gradle (`build.gradle(.kts)`, `gradle/libs.versions.toml`) or SPM (`project.pbxproj`, `Package.resolved`, `Package.swift`).
2. **Finds what to analyze** — by default the dependencies that the branch changes against its base, which is the target of its open pull request or the default branch, compared where the branch left it; or the library you name. The current version comes from the base. The target is the version you name, else the one on the branch, else the newest stable one; for a major bump to the newest version, the skill also reports the newest version inside the current major.
3. **Fetches the release notes** for every version in between, from the ecosystem's sources and GitHub, and diffs the public API or the artifact when the notes are terse.
4. **Checks advisories** with OSV: what the target fixes, what it introduces, what stays open.
5. **Labels each change** (`removed`, `signature-changed`, `behavior-changed`, `deprecated`, `bugfix`, `additive`, `noise`) and checks whether the project uses the affected API. A change counts only if a real call site uses it.
6. **Sets the risk tier** (HIGH if code or configuration must change or the target brings a new advisory, MEDIUM if something must be verified, LOW otherwise) and writes the report: verdict first, required changes with `file:line`, behavior changes to verify by hand, automated checks that reveal the rest, constraints such as a raised minimum SDK, and caveats.
7. **Proposes the edit** when the branch does not contain it yet — old → new at `file:line`, plus the lockfile or pin entry — and waits for an explicit yes before it edits anything. It never commits or opens a pull request.

### Several changes on one branch

When a branch changes several dependencies, such as a grouped Renovate pull request, the skill lists them first. With more than five, it shows that list and asks before the analysis, because each dependency costs a full run. Long lists fan out to subagents so that release notes do not crowd out the analysis. The report is one table, plus a block for each dependency that needs work.

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
| Review a dependency-update branch or pull request, for example from Renovate | Yes |
| Find outdated dependencies | No — Renovate or Dependabot do that; run this skill on their pull requests |
| npm, PyPI, CocoaPods, or another ecosystem | Not yet — see `references/adding-an-ecosystem.md` |
| Vet a brand-new dependency before adopting it | No — use `security-check:dependency-adoption-review` |

## Environment compatibility

Works in the Claude Code terminal and any agent with shell access, `python3`, and network egress to the registries above. Not viable in Cowork: the sandbox blocks outbound `curl` and `gh` to Maven, GitHub, and OSV, and it has no Gradle or Xcode toolchain. With a target version that you name, the skill can fall back to `WebFetch` for the release notes, but version discovery, release dates, and the advisory check still need shell egress, and the guide cache needs a writable `~/.claude/`, so the report comes out with caveats.
