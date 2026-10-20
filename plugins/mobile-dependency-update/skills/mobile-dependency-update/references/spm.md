# Swift Package Manager (iOS, Xcode)

Xcode projects with package references, and SwiftPM packages. The coordinate is the repository URL without the scheme and `.git`, for example `github.com/Alamofire/Alamofire` — the form that OSV uses.

## Detect

Any of:

- a `project.pbxproj` with `XCRemoteSwiftPackageReference` entries;
- a `Package.resolved` in `<name>.xcworkspace/xcshareddata/swiftpm/`, in `<name>.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/`, or at the root;
- a `Package.swift` at the root.

## Extract

```
python3 <skill-dir>/scripts/spm_deps.py <project-root>
```

It reads every `.xcodeproj` in the tree (a workspace often has several: the app plus framework projects), every `Package.resolved`, and the manifests of the root and local packages. For each direct package it prints the resolved pin, every rule with its file:line, and the products that the targets use.

- **The current version is the pin in `Package.resolved`**, not the rule's minimum: `upToNextMinorVersion from 12.12.0` can resolve to 12.12.1.
- **SPM resolves one version that satisfies every rule** in every project and manifest, so the strictest rule decides. An `exactVersion 5.10.2` in the app project pins the package even when the framework projects allow `upToNextMajorVersion`.
- **Products are the module names** to look for in imports (`firebase-ios-sdk` → `FirebaseMessaging`, `FirebaseCrashlytics`, …).
- **Branch and revision pins** have no version to compare. In scan mode they go under "Not checked". If the user asks, compare the pinned commit with the branch head: `gh api repos/<owner>/<repo>/compare/<sha>...<branch>`.
- **Local packages and binaries** (`.binaryTarget`, `.xcframework` folders) have no registry. The script shows the bundled version (`CFBundleShortVersionString`) where it can read one; updates come from the vendor.
- **Transitive pins** move with their parent package. Count their changes as constraints of the parent's update.

## Versions and dates

```
python3 <skill-dir>/scripts/list_versions.py github <owner>/<repo> --current <pin>
python3 <skill-dir>/scripts/list_versions.py git <clone-url> --current <pin>
```

The `git` form is for hosts other than GitHub; it gives no dates. SPM resolves git tags that are semantic versions, with or without a `v` prefix. The script ignores other tags (for example `CocoaPods-12.0.0`), and takes dates from GitHub releases, else from the tag's commit.

Whether an update needs a rule change:

- `upToNextMajorVersion`, `upToNextMinorVersion`, `versionRange`: a target inside every range needs only a new pin; a target outside a range also needs a rule change.
- `exactVersion`: always a rule change.

In a `Package.swift`, the same rules read: `from: "X"` and `.upToNextMajor(from: "X")` (up to the next major), `.upToNextMinor(from: "X")`, `"X"..<"Y"` (a range), `exact: "X"`, `branch:`, and `revision:`.

## Release-note sources

Check the guide cache first, then GitHub releases and changelog files ("GitHub sources" in `SKILL.md`). Special cases:

| Package | Source | Notes |
|---|---|---|
| `github.com/firebase/firebase-ios-sdk` | The per-product `CHANGELOG.md` at the target tag (for example `FirebaseMessaging/CHANGELOG.md`, `Crashlytics/CHANGELOG.md`, `FirebaseCore/CHANGELOG.md`), and `https://firebase.google.com/support/release-notes/ios` | Read only the products that the project uses. Analytics is closed source: its notes are only on the release-notes page. On `main`, the top section of a changelog can describe an unreleased version. |
| Google binary packages (`GoogleAppMeasurement`, `abseil-cpp-binary`, `grpc-binary`, …) | The parent package's notes, usually Firebase | They move with their parent. |

## Evidence

Use it when the notes are terse, the bump is major, or a removal needs proof.

- **Public API of a source package**: `gh api repos/<owner>/<repo>/compare/<old-tag>...<new-tag> --jq '.files[] | [.status, .filename] | @tsv'` lists the changed files. Read the `public` and `open` declarations that changed in the files that define the APIs the project uses. For an exact list, run `swift package diagnose-api-breaking-changes <old-tag>` in a scratch clone at the new tag; it builds the package, so ask first.
- **Binary targets and XCFrameworks**: diff the `.swiftinterface` files (Swift) or the public headers (Objective-C) of the two versions.
- **Minimum OS**: `platforms:` in the package's `Package.swift` at each tag: `gh api 'repos/<owner>/<repo>/contents/Package.swift?ref=<tag>' -H 'Accept: application/vnd.github.raw'`. Compare it with the project's `IPHONEOS_DEPLOYMENT_TARGET` (in the pbxproj or the xcconfig files).
- **Toolchain**: the first line of the manifest, `// swift-tools-version:X.Y`. A raise can require a newer Xcode on CI.
- **Transitive dependencies**: the `dependencies:` of `Package.swift` at both tags.

## Usage check

- Files: `**/*.swift`, plus `**/*.m`, `**/*.mm`, and `**/*.h` for Objective-C. Skip `.build/`, `DerivedData/`, `SourcePackages/`, `Pods/`, and vendored code.
- Imports: `import <Module>`, `@testable import <Module>`, `@_exported import <Module>`, `@import <Module>;`, `#import <Module/…>`. Module names can contain digits (`SwiftI18n`): use `[A-Za-z_][A-Za-z0-9_]*` in search patterns.
- Swift imports a whole module, so an import only says that the file can use the library. Search the importing files for the symbol, then read each hit. A module that re-exports a library (`@_exported import`) lets its importers use that library without importing it.

## How changes show

| What reveals it | Outcome | Command |
|---|---|---|
| Swift or Objective-C compile error, a missing module or product, a package resolution error | `build` | any build, for example `xcodebuild build` |
| SwiftLint or another lint build phase — only if it fails on a finding (`--strict`, or warnings treated as errors) | `check` | `swiftlint`, or the build phase that runs it |
| A unit or UI test that runs the library's real code at the site (not a mock) | `check` | `xcodebuild test`, with the test file named |
| A snapshot test (for example swift-snapshot-testing) that renders the view with the site | `check` | `xcodebuild test`, with the test file named |
| Runtime defaults, threading, timing, UI, network behavior | `manual` | – |

CI config, when the repository holds it: `.github/workflows/*.yml`, `bitrise.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `fastlane/Fastfile`, `ci_scripts/` (Xcode Cloud). Without it and without the policy `ci` field, you cannot say which commands CI runs. Match by action and scheme, not by the whole command line.

## Advisories

```
python3 <skill-dir>/scripts/osv_check.py SwiftURL <coordinate or URL> <current> <target>
```

## Apply (only after the user says yes)

- **New pin only** (the target is inside every rule): in `Package.resolved`, set the package's `version` to the target and its `revision` to the tag's commit, from `git ls-remote <url> 'refs/tags/<tag>' 'refs/tags/<tag>^{}'`. Use the `^{}` line if there is one: it is the commit of an annotated tag.
- **Rule change** (the target is outside a rule, or the rule is `exactVersion`): edit `minimumVersion` or `version` at each listed pbxproj line, then update the pin as above.
- Then offer to run `xcodebuild -resolvePackageDependencies -workspace <name>.xcworkspace -scheme <scheme>`, and ask first: it downloads packages. Afterwards, review the diff of `Package.resolved`: moves of the package's own transitive dependencies are expected; any other move needs a reason.
