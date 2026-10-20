<!--
Example report for a branch that changes several dependencies. Follow this
shape, and leave out empty sections. Package names, versions, branch names,
and paths are invented.
-->

# Dependency changes — ExampleApp (SPM), `update-dependencies` against `main` (merge base `3f2a1c4`), 2026-09-24

**1 package needs code changes, 1 needs a manual test, and 4 need nothing more; rerun the advisory check for ImageKit first.** Start with NetKit: 6.0 removes the request API that 41 files use.

Policy: `.claude/dependency-update-policy.yaml` (1 group, 1 blocked package).

| Package | From → To | Type | Released | Risk | Details |
|---|---|---|---|---|---|
| `github.com/example/NetKit` | 5.10.2 → 6.0.1 | major | 2026-09-10 | HIGH | ↓ NetKit |
| `github.com/example/ChartKit` | 3.4.0 → 3.6.0 | minor | 2026-09-19 (5 days) | MEDIUM | ↓ ChartKit |
| `github.com/example/ImageKit` | 5.21.5 → 5.22.0 | minor | 2026-07-30 | LOW (low confidence) | — |
| `github.com/example/Keychain` | 4.2.1 → 4.2.2 | patch | 2026-06-01 | LOW | — |
| **group `rx`** | | | | **LOW** | |
| `github.com/example/RxCore` | 6.9.1 → 6.10.2 | minor | 2026-03-02 | LOW | ↓ RxCore |
| `github.com/example/RxKeys` | 2.0.1 → 2.1.0 | minor | 2026-02-11 | LOW | — |

`—` means that the release notes hold no change that can need code work.

### ↓ NetKit — HIGH (2 required changes)

Required:
- **[removed]** `Session.request(_:method:)` in 41 files, for example `Services/UserService.swift:22` → use `Session.send(_:)`, which is `async`. _6.0.0 · [release](https://github.com/example/NetKit/releases/tag/6.0.0)_
- **[signature-changed]** `ResponseSerializer.serialize(_:)` now `throws`, at `Networking/JSONSerializer.swift:14` → add `try` at the call sites. _6.0.0 · [release](https://github.com/example/NetKit/releases/tag/6.0.0)_

Constraints: iOS 16 minimum (project: 16.4), no action. Swift tools version 6.0 needs Xcode 16 or later on CI.

### ↓ ChartKit — MEDIUM (1 behavior change to verify, 1 automated check)

Timing: 3.6.0 was released 5 days ago; fresh releases get hotfixes, so consider a week's wait.

Behavior to verify:
- The default animation duration drops from 0.35 s to 0.2 s (used in `Dashboard/ChartView.swift:40`) → check the dashboard charts visually. _3.6.0 · [release](https://github.com/example/ChartKit/releases/tag/3.6.0)_

Automated checks: `xcodebuild test` (CI runs it) covers the new axis-label rounding through `ChartFormatterTests.swift`.

### ↓ RxCore — LOW (1 suggestion)

Suggestions:
- **[deprecated]** `catchErrorJustReturn(_:)` at `Modules/Home/HomeInteractor.swift:88` → `catchAndReturn(_:)`. _6.10.0 · [release](https://github.com/example/RxCore/releases/tag/6.10.0)_

## Blocked by policy

| Package | From → To | Reason |
|---|---|---|
| `github.com/example/vendor-sdk` | 4.2.0 → 5.1.0 | The branch moves a package that the policy pins: "Pinned until the vendor certifies 5.x" |

## Not checked

| Item | Why |
|---|---|
| `github.com/example/EmptyState` | The branch moves its pin to a newer commit of branch `master`: no version to compare |
| `Vendors/ScanSDK` (ScanSDK.xcframework 9.1.2 → 9.2.0) | Local binary package: no registry and no release notes; ask the vendor what changed |

## Caveats

- `github.com/example/ImageKit`: the advisory check timed out; advisories were not checked.

---

For the release notes and the full reasons of one package, name it in a new run.
