<!--
Example single-dependency report. Follow this shape and order, and leave out
every section that has no items. The release facts are real
(play-services-auth 22.0.0); the project paths and settings are invented.

Full section order:
  urgency line · verdict · CI, replacement, and timing lines ·
  Required changes · Behavior changes to verify · Automated checks ·
  Suggestions · Constraints · Manual review · Release notes ·
  advisories and caveats · Apply

"Behavior changes to verify" holds only what a person must try by hand. A
change that breaks the build is a required change. Items that a command
reveals go into the one "Automated checks" line.

Formats for the lines that this example does not need:
  Title for a branch: # play-services-auth 21.6.0 → 22.0.0 (`renovate/play-services-auth-22` against `main`, merge base `3f2a1c4`)
  Last line when the branch already holds the edit: **No edit to propose:** the branch already changes `playServicesAuth` to 22.0.0. It still lacks the two required changes.
  > **Update soon — security:** GHSA-3cqm-mf7h-prrj (CVE-2021-0341, HIGH) affects 4.9.0; 4.12.0 fixes it.
  > **CI:** Bitrise passed on `9c4e2b7`, so the build compiles; this report covers what a build does not show.
  > **CI:** Bitrise failed on `9c4e2b7`; the `[minimum]` compileSdk change below is the likely cause. [check](URL)
  **Risk: MEDIUM** (low confidence: notes missing for 2 of 5 versions) — 1 behavior change to verify by hand: …
  > **Replacement:** 0.36.0 is the last `accompanist-pager` release; the successor is `androidx.compose.foundation.pager`. [docs](URL) · [removal](URL)
  > **Timing:** 2.10.2 was released 2 days ago; fresh releases get hotfixes, so consider a week's wait.
  - **[minimum]** Gradle 9.6.0 or newer: `gradle/wrapper/gradle-wrapper.properties:3` has 9.5.0 → change it to `gradle-9.6.0-bin.zip`.  _9.4.0 · [compatibility table](URL)_
  Advisories: GHSA-xxxx-xxxx-xxxx (HIGH) affects 3.2.0 but not 3.1.4 (OSV). Wait for the fix, or stay on 3.1.4.
  - Default animation duration drops from 0.35 s to 0.2 s (used in `DashboardView.swift:40`) → check the charts visually.  _3.6.0 · [release](URL)_
  **Automated checks:** `./gradlew detekt` shows the findings of the two new default rules. `./gradlew testDebugUnitTest` (CI runs it) covers the changed parser through `ParserTest.kt`.
  **Manual review:** Is session replay on in the Amplitude project settings? If yes, check the replay masking on the login screen; if no, nothing to do.
  Caveat line for a drop: `dropped:` behavior-changed "offline cache default" at `Api.kt:40` — the project sets `cacheEnabled = false`; it applies again if the project turns the cache on.
-->

# play-services-auth 21.6.0 → 22.0.0

**Risk: HIGH** — 2 required changes: 22.0.0 removes the Google Sign-In API that the login flow calls. Move sign-in to Credential Manager first; after that, the bump is a one-line change.

## Required changes (2)

- **[removed]** `GoogleSignIn.getClient` and `GoogleSignInClient` at `app/src/main/java/com/example/login/LoginActivity.kt:48` and `:112` → move sign-in to Credential Manager (`androidx.credentials`), per the [migration guide](https://developer.android.com/identity/sign-in/legacy-gsi-migration).
  _22.0.0 · [release notes](https://developers.google.com/android/guides/releases) · confirmed by a class-list diff of both AARs_
- **[removed]** `Auth.GOOGLE_SIGN_IN_API` at `app/src/main/java/com/example/login/GoogleApiHelper.kt:30` → delete it as part of the same migration.
  _22.0.0 · class-list diff_

## Suggestions

- One Tap (`SignInClient` from `com.google.android.gms.auth.api.identity`) at `app/src/main/java/com/example/login/LoginViewModel.kt:77` still works in 22.0.0, but Google deprecates it in favor of Credential Manager. Move it in the same change, so that sign-in has one implementation.
  _[migration guide](https://developer.android.com/identity/sign-in/legacy-gsi-migration)_

## Constraints

- `minSdkVersion` rises from 23 to 24 (AAR manifest). The project's `minSdk` is 26: no action.
- Transitive dependencies: the 21.6.0 and 22.0.0 POMs declare the same versions.

## Release notes

- **22.0.0** (2026-08-25) — Removes the Google Sign-In APIs and points to Credential Manager. [Notes](https://developers.google.com/android/guides/releases)

Advisories: none for 21.6.0 or 22.0.0 (OSV).

---

**Apply this update?** Change `playServicesAuth = "21.6.0"` to `"22.0.0"` at `gradle/libs.versions.toml:31`. On its own, this edit breaks the build until the two required changes are done. I change this line only after you say yes.
