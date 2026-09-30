---
coordinate: <group>:<artifact> | <host>/<owner>/<repo>
aliases: []                   # other coordinates of the same library (plugin marker, implementation artifact)
ecosystem: <gradle | spm>
primary_source: <URL where the release notes live>
migration_guide:              # optional: URL of a major-version migration guide
status: verified              # verified | partial | no-changelog-found
tried: []                     # for no-changelog-found: the places you searched
last_verified: YYYY-MM-DD
last_verified_version: <version>
---

<!-- Library facts only: every project reads this file. Nothing about one
     project's modules, call sites, or settings. -->

# Format quirks

(How the notes are structured, when it is not obvious. Examples:
 - "Version headers are H3, not H2."
 - "Several patch releases share one header; split them by the version line."
 - "Dates read 'April 2, 2026', not ISO.")

# Gotchas

(Facts that change the analysis. Examples:
 - "5.x requires JDK 11."
 - "2.0.0 was withdrawn; skip it."
 - "The notes lag the releases by weeks; diff the artifacts.")

# Fetch hints

(What to try first and what to skip. Examples:
 - "GitHub releases are empty; use the docs site."
 - "Release dates: `curl -sI` on the POM.")
