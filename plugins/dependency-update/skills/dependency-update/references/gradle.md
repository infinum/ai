# Gradle (Android, JVM)

Projects built with Gradle (Kotlin DSL or Groovy) whose artifacts come from Maven repositories. The coordinate is `group:artifact`.

## Detect

`settings.gradle(.kts)`, `build.gradle(.kts)`, or `gradle/libs.versions.toml` at the project root.

## Extract

Read the build files themselves; declaration styles vary too much for one search pattern. Sources, from the most to the least authoritative:

1. **Version catalogs**: `gradle/libs.versions.toml`, plus any catalog that `settings.gradle(.kts)` registers under `versionCatalogs {}`. Resolve `version.ref`. For rich versions, take `strictly`, then `require`, then `prefer`; a `strictly` value is a deliberate pin, so say so. `[bundles]` only group libraries: count each library once. `[plugins]` holds plugin ids.
2. **`plugins {}` blocks** in settings and build files: `id("…") version "…"`.
3. **Hard-coded coordinates** in any dependency configuration — `implementation`, `api`, `ksp`, `kapt`, `testImplementation`, `coreLibraryDesugaring`, `lintChecks`, custom configurations — in both DSLs.
4. **`buildSrc/` and `build-logic/`**: older projects keep every version there (for example in an `object Versions`). Convention-plugin code is not a dependency, but the coordinates it declares are.
5. **`buildscript { dependencies { classpath(…) } }`**: build plugins in older projects, often the Android Gradle Plugin.

For each dependency, record the coordinate, the resolved version, and every `declaredIn` line (file:line of the version: the line that an update edits). If one coordinate has different versions in different places, report the conflict.

- A BoM (`platform(…)`) is one dependency; its members follow it.
- A plugin id maps to the marker coordinate `<id>:<id>.gradle.plugin` (for example `com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin`). Keep the plugin id in the report.
- Libraries that share one `version.ref` (for example all `androidx.navigation` artifacts) update together: analyze them as one.

## Versions and dates

```
python3 <skill-dir>/scripts/list_versions.py maven <group>:<artifact> --current <version>
```

The script reads `maven-metadata.xml` from Google Maven (`dl.google.com/dl/android/maven2`), Maven Central (`repo1.maven.org/maven2`), and the Gradle Plugin Portal (`plugins.gradle.org/m2`), and takes each release date from the POM's `Last-Modified` header. Pass `--repo <url>` for a private repository. Do not use the `search.maven.org` API: it lags by months (in September 2026 it still gave 4.4.0 as the newest `android-maps-utils`, after 5.2.0 had shipped).

The script applies these version rules; keep them in mind when you read other sources:

- Pre-release qualifiers: `alpha`, `beta`, `rc`, `cr`, `M1`, `snapshot`, `dev`, `preview`, `eap`.
- `.RELEASE`, `.Final`, and `.GA` equal a plain release.
- A numeric suffix such as `1.9.0-1.0.13` (older KSP) is a release, not a pre-release.
- Qualifiers such as `-android` and `-jre` (Guava) are flavors: it compares only within the current flavor.
- In a four-part version such as `7.5.0.8588`, the fourth part is a build number.

## Release-note sources

Check the guide cache first. Then:

| Coordinate | Source | Notes |
|---|---|---|
| `androidx.*` | `https://developer.android.com/jetpack/androidx/releases/<library>` | `<library>` is the group segment after `androidx.` (`androidx.lifecycle` → `lifecycle`); `androidx.compose.<area>` → `compose-<area>`. Index of all pages: `https://developer.android.com/jetpack/androidx/versions`. One page covers every artifact of the group: `### Version X.Y.Z` headings, the date on the next line, then "API Changes", "Behavior Changes", "New Features", "Bug Fixes", "Dependency Updates". A stable `X.Y.0` also covers its alpha, beta, and rc notes. Fallback: GitHub `androidx/androidx`. |
| `com.google.firebase:*` | `https://firebase.google.com/support/release-notes/android` | Date-headed; each "Firebase Android BoM version X" section lists the member SDKs. |
| `com.google.android.gms:*` | `https://developers.google.com/android/guides/releases` | Date-headed; artifacts appear as `group:artifact:version` with short notes. Sub-artifacts have their own version numbers. |
| `com.google.android.libraries.places:*` | `https://developers.google.com/maps/documentation/places/android-sdk/release-notes` | |
| `com.google.android.material:material` | GitHub `material-components/material-components-android` | |
| `com.google.android.play:*` | `https://developer.android.com/google/play/billing/release-notes` (billing), `https://developer.android.com/google/play/integrity/release-notes` (integrity) | |
| `com.android.tools.build:gradle` (AGP) | `https://developer.android.com/build/releases/agp-<major>-<minor>-0-release-notes` | One page per minor. The compatibility table at the top (Gradle, JDK, SDK Build Tools, NDK) is the main constraint source. |
| `com.squareup.okhttp3:*` | `https://square.github.io/okhttp/changelogs/changelog/` | One page for all OkHttp artifacts; inline `New:`, `Fix:`, `Upgrade:` prefixes. Patch releases can share one heading: split them at the "Version X.Y.Z" lines. |
| `com.squareup.leakcanary:*` | `https://square.github.io/leakcanary/changelog/` | |
| `com.squareup.retrofit2:*`, `com.squareup.moshi:*`, `com.squareup.wire:*` | `CHANGELOG.md` in GitHub `square/<name>` | Retrofit's file can lag; take missing versions from its releases. |
| `org.jetbrains.kotlin:*` | GitHub `JetBrains/kotlin` releases | |
| `org.jetbrains.kotlinx:kotlinx-coroutines-*`, `kotlinx-serialization-*` | GitHub `Kotlin/kotlinx.coroutines`, `Kotlin/kotlinx.serialization` | |
| `com.google.devtools.ksp:*` | GitHub `google/ksp` releases | |
| `com.google.dagger:*` (Dagger, Hilt) | GitHub `google/dagger` releases | |
| anything else | the POM's `<scm><url>` (or `<url>`), then "GitHub sources" in `SKILL.md` | Many Google POMs have neither; search GitHub for the artifact name. |

Convert HTML pages with `html_to_text.py`, find the version headings with `grep -n`, and print the range with `sed -n '<from>,<to>p'`.

For a **BoM**, diff the BoM POM's `<dependencyManagement>` between the two versions to see which members moved, and analyze only the members that the project declares, plus shared internals such as `firebase-common`.

## Evidence

Use it when the notes are terse, the bump is major, or a removal needs proof. Work in a scratch directory, never in the project.

- **Public API**: download both artifacts (`<repo>/<group-path>/<artifact>/<v>/<artifact>-<v>.aar` or `.jar`). For an AAR, `unzip -p <file>.aar classes.jar > classes.jar`. List the classes with `unzip -Z1 classes.jar | grep '\.class$' | sort` and `comm -3` the two lists; skip obfuscated names such as `zz*`. For each class that the project uses, compare `javap -public -cp classes.jar <class>` between the versions.
- **Minimum SDK**: `minSdkVersion` in the AAR's `AndroidManifest.xml`. Compare it with the project's `minSdk`, which can come from a constant (for example `ApplicationSpec.Sdk.min`).
- **Transitive dependencies**: diff the POM `<dependencies>` between the versions. A transitive library that moves to a new major version is a constraint.
- **Umbrella artifacts**: some artifacts are thin and depend on sub-modules (for example `android-maps-utils` 5.x); diff the sub-module artifacts.

## Usage check

- Files: `**/*.kt`, `**/*.kts`, `**/*.java`, and `**/*.xml` for views, attributes, and manifest entries. Skip `build/`, `.gradle/`, and generated sources.
- Imports: `import <package>.<Class>`, `import <package>.*`, and aliases (`import … as X`). Kotlin calls members and extension functions without an import that names them: search for member names inside the files that import the package.

## How changes show

| What reveals it | Outcome | Command |
|---|---|---|
| Kotlin or Java compile error, KSP or kapt error, AAPT resource error, R8 missing-class error | `build` | any build, for example `./gradlew assembleDebug` |
| detekt, ktlint (through detekt-formatting), Android lint — only if the task fails on a finding (`maxIssues: 0`, `abortOnError`) | `check` | `./gradlew detekt`, `./gradlew lint<Variant>` |
| A unit test in `src/test` that runs the library's real code at the site (not a fake) | `check` | `./gradlew test<Variant>UnitTest`, with the test file named |
| A screenshot test (Paparazzi, Roborazzi, Compose Preview Screenshot Testing) that renders the screen with the site | `check` | the project's record or verify task, with the test file named |
| An instrumented test in `src/androidTest` that runs the site | `check` | `./gradlew connected<Variant>AndroidTest`, with the test file named |
| Changed dex or R8 output, runtime defaults, threading, timing, UI, network behavior | `manual` | – |

CI config, when the repository holds it: `.github/workflows/*.yml`, `bitrise.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `fastlane/Fastfile`. Many Android projects keep the CI workflow outside the repository (for example in the Bitrise web UI), so without the policy `ci` field you cannot say which commands CI runs. Match by task name, not by the whole command line: `./gradlew detekt lintDebug` runs both `detekt` and `lintDebug`.

## Advisories

```
python3 <skill-dir>/scripts/osv_check.py Maven <group>:<artifact> <current> <target>
```

A BoM has no advisories of its own: check the members that moved.

## Apply (only after the user says yes)

Change the version at the listed `declaredIn` line — usually one value in `gradle/libs.versions.toml` — and nothing else. Then name the check to run (for example `./gradlew :app:dependencies`, or a full build). Run it only if the user asks: Gradle builds take long and change local build state.
