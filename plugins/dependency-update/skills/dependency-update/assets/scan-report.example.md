<!--
Example scan report. Follow this shape, and leave out empty sections.
Package names, versions, and paths are invented.
-->

# Dependency scan — ExampleApp (SPM), 2026-09-24

**2 packages need code changes, 1 needs a visual check, and 3 can update as they are.** Start with NetKit: 6.0 removes the request API that 41 files use.

Policy: `.claude/dependency-update-policy.yaml` (1 group, 1 blocked package).

| Package | From → To | Type | Released | Risk | Details |
|---|---|---|---|---|---|
| `github.com/example/NetKit` | 5.10.2 → 6.0.1 | major | 2026-09-10 | HIGH | ↓ NetKit |
| `github.com/example/ChartKit` | 3.4.0 → 3.6.0 | minor | 2026-09-19 | HIGH | ↓ ChartKit |
| **group `rx`** | | | | **MEDIUM** | |
| `github.com/example/RxCore` | 6.9.1 → 6.10.2 | minor | 2026-03-02 | MEDIUM | ↓ RxCore |
| `github.com/example/RxKeys` | 2.0.1 → 2.1.0 | minor | 2026-02-11 | LOW | — |
| `github.com/example/ImageKit` | 5.21.5 → 5.22.0 | minor | 2026-07-30 | LOW | — |
| `github.com/example/Keychain` | 4.2.1 → 4.2.2 | patch | 2026-06-01 | LOW | — |

`—` means that the release notes hold no change that can need code work.

### ↓ NetKit — HIGH (score 10)

Required:
- **[removed]** `Session.request(_:method:)` in 41 files, for example `Services/UserService.swift:22` → use `Session.send(_:)`, which is `async`. _6.0.0 · [release](https://github.com/example/NetKit/releases/tag/6.0.0)_
- **[signature-changed]** `ResponseSerializer.serialize(_:)` now `throws`, at `Networking/JSONSerializer.swift:14` → add `try` at the call sites. _6.0.0 · [release](https://github.com/example/NetKit/releases/tag/6.0.0)_

Constraints: iOS 16 minimum (project: 16.4), no action. Swift tools version 6.0 needs Xcode 16 or later on CI.

### ↓ ChartKit — HIGH (score 5)

Behavior to verify:
- The default animation duration drops from 0.35 s to 0.2 s (used in `Dashboard/ChartView.swift:40`) → check the dashboard charts visually. _3.6.0 · [release](https://github.com/example/ChartKit/releases/tag/3.6.0)_

Automated checks: `xcodebuild test` (CI runs it) covers the new axis-label rounding through `ChartFormatterTests.swift`.

3.6.0 is 5 days old (+2). From 2026-09-26 the age adds only +1, and the tier drops to MEDIUM.

### ↓ RxCore — MEDIUM (score 2)

Required:
- **[deprecated]** `catchErrorJustReturn(_:)` at `Modules/Home/HomeInteractor.swift:88` → `catchAndReturn(_:)`. _6.10.0 · [release](https://github.com/example/RxCore/releases/tag/6.10.0)_

## Blocked by policy

| Package | Current → Latest | Reason |
|---|---|---|
| `github.com/example/vendor-sdk` | 4.2.0 → 5.1.0 | Pinned until the vendor certifies 5.x |

## Not checked

| Item | Why |
|---|---|
| `github.com/example/EmptyState` | Pinned to branch `master`: no version to compare |
| `Vendors/ScanSDK` (ScanSDK.xcframework 9.1.2) | Local binary package: ask the vendor for updates |

## Caveats

- `github.com/example/ImageKit`: the advisory check timed out; advisories were not checked.

---

For the full derivation and the release notes of one package, ask for a single-package analysis.
