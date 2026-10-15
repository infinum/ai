<!--
Example single-dependency report. Follow this shape and order, and leave out
every section that has no items. The release facts are real
(play-services-auth 22.0.0); the project paths and settings are invented.

Full section order:
  urgency or DEFERRED line · Required changes · Behavior changes to verify ·
  Automated checks · Suggestions · Constraints · Manual review · Score ·
  Release notes · advisories and caveats · Apply

"Behavior changes to verify" holds only checks that a person must do. Checks
that a build or a command reveals go into the one "Automated checks" line.

Formats for the lines that this example does not need:
  > **Update soon — security:** GHSA-3cqm-mf7h-prrj (CVE-2021-0341, HIGH) affects 4.9.0; 4.12.0 fixes it.
  > **DEFERRED:** 2.10.2 is 1 day old; the policy asks for 7 days (clears on 2026-09-30). Say "go ahead" to override.
  - Default animation duration drops from 0.35 s to 0.2 s (used in `DashboardView.swift:40`) → check the charts visually.  _3.6.0 · [release](URL)_
  **Automated checks:** `./gradlew detekt` shows the findings of the two new default rules. `./gradlew testDebugUnitTest` (CI runs it) covers the changed parser through `ParserTest.kt`.
  **Manual review:** Is session replay on in the Amplitude project settings? If yes, check the replay masking on the login screen; if no, nothing to do.
  Caveat line for a drop: `dropped:` behavior-changed "offline cache default" at `Api.kt:40` — the project sets `cacheEnabled = false`; it applies again if the project turns the cache on.
-->

# play-services-auth 21.6.0 → 22.0.0

**Risk: HIGH** — 22.0.0 removes the Google Sign-In API that the login flow calls. Move sign-in to Credential Manager first; after that, the bump is a one-line change.

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

## Score

```
Major bump                                               +3
Age: released 30 days ago                                 0
removed cluster "Google Sign-In API", used at 3 sites    +3
minSdk 23 → 24; the project has 26                        0
= 6 → HIGH
```

## Release notes

- **22.0.0** (2026-08-25) — Removes the Google Sign-In APIs and points to Credential Manager. [Notes](https://developers.google.com/android/guides/releases)

Advisories: none for 21.6.0 or 22.0.0 (OSV).

---

**Apply this update?** Change `playServicesAuth = "21.6.0"` to `"22.0.0"` at `gradle/libs.versions.toml:31`. On its own, this edit breaks the build until the two required changes are done. I change this line only after you say yes.
