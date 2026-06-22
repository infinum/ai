---
name: dependency-adoption-review
description: Due-diligence review of a new third-party dependency before you add it to a project — answers "should we take this dependency at all?". Checks necessity vs. native/existing alternatives, license (and relicensing risk), maintenance health, governance and bus factor, security track record, adoption signals, and transitive footprint, then returns a scored Adopt / Adopt-with-caution / Avoid / Don't-add verdict. Use before adding a library, when choosing between competing packages, or when the user mentions /security-check:dependency-adoption-review. Hands the deep supply-chain/malware pass off to system-package-audit. Not Cowork-ready — needs `gh`, package-registry and deps.dev egress, and optionally local package managers.
---

# Dependency Adoption Review

Decide whether to take on a new third-party dependency **before it lands in the project**. Most "should I install X?" decisions are made on vibes; this skill grounds them in license, maintenance, governance, security track record, and — first of all — whether the dependency is even necessary.

This is a **strategic adoption decision**, distinct from the sibling skills in the `security-check` plugin:

- **`/security-check:system-package-audit`** — the deep supply-chain/malware vet of a *specific version* (install scripts, tarball-vs-source, typosquatting, maintainer takeover). This skill **hands the malware pass off to it** rather than duplicating it.
- **`/security-check:vulnerability-report-triage`** — triage reported vulnerabilities in dependencies you *already* have.

## Usage
/security-check:dependency-adoption-review <ecosystem>:<package>
/security-check:dependency-adoption-review <package>        (auto-detect ecosystem from the repo)
/security-check:dependency-adoption-review <package> vs <alternative>   (compare candidates)

## Guiding principle: the best dependency is often no dependency

Every dependency is a permanent liability — a future vulnerability source, an upgrade treadmill, a supply-chain entry point, and a license/legal surface. **Bias toward not adding one.** A few lines of owned code, a modern language/stdlib feature, or a capability an existing dependency already provides usually beats a new package. Adopt when the dependency genuinely earns its keep.

## Step 1 — Resolve the candidate

Establish the ecosystem (detect from the repo's manifests if not given — see `system-package-audit` Step 1 for the detection pattern), the package name, the **target version**, the registry, and the **source repository URL**. If the user named two candidates, run the review for each and compare at the end.

## Step 2 — Necessity & alternatives (the first gate)

Before any other check, ask whether the dependency should exist in the project at all:

- **Can a modern language / stdlib / platform feature replace it?** Examples: `fetch` over axios/request, `crypto.randomUUID()` over uuid, `Intl` / `Temporal` over moment/dayjs, `structuredClone` over lodash.cloneDeep, native `Array`/`Object` methods over lodash helpers, built-in mappers/AI-generated code over a mapping library.
- **Is it trivial enough to vendor?** A handful of lines you own beats a micro-dependency (the `left-pad` / `is-odd` anti-pattern) and its transitive tail.
- **Does an existing project dependency already cover this?** Avoid redundant libraries that do the same job.

If the functionality is replaceable cheaply, the recommendation can be **Don't add** before spending effort on the remaining checks — but still note the finding. Otherwise continue.

## Step 3 — License & legal

- **License type & compatibility** with our use: permissive (MIT/BSD/Apache-2.0) vs. weak copyleft (LGPL/MPL) vs. strong copyleft (GPL/AGPL) vs. **source-available / commercial** (BSL, SSPL, Elastic, "free for non-commercial"). Flag anything that is copyleft or non-OSI for legal review, especially for distributed/SaaS products.
- **Obligations**: attribution/NOTICE requirements, patent grants (Apache-2.0), copyleft reach.
- **Transitive licenses**: a permissive top-level package can still pull in a copyleft transitive dependency — check the graph (deps.dev surfaces this).
- **License-change / relicensing risk**: is the project trending toward a commercial pivot? Recent history of permissive → source-available relicensing (AutoMapper, Redis, Elastic, Terraform, Sentry, MongoDB) is a real adoption risk — a dependency that's free today can become paid or restricted. Note maintainer signals (a company that monetizes the project, "open core" model, recent license discussions).

## Step 4 — Maintenance health & governance / bus factor

Pull repo and registry signals (via `gh`, the registry API, and deps.dev):

- **Activity**: date of last release and last commit; release cadence; is it **archived / deprecated / explicitly unmaintained**?
- **Responsiveness**: open-vs-closed issue/PR ratio, whether security issues get timely responses, release discipline (changelogs, semver adherence).
- **Bus factor**: number of *active* contributors. A single-maintainer project is a sustainability and security risk (one burnout or one compromised account away from trouble).
- **Backing**: is there an organization or foundation behind it (OpenJS, Apache, CNCF, a funded company) vs. a solo hobby project? Funding/sponsorship signals. Presence of `SECURITY.md`, `CONTRIBUTING`, and a governance model.

## Step 5 — Security track record & posture

- **CVE history**: how many advisories, how severe, and **how fast they were patched** (query OSV.dev / GitHub Advisory DB). A library with past CVEs that were fixed quickly can be *more* trustworthy than one with none and no process.
- **Prior incidents**: any supply-chain compromise (maintainer account takeover, malicious release, protestware).
- **Posture**: publish-time 2FA, signed releases / provenance (npm provenance, Sigstore), an **OpenSSF Scorecard** rating (deps.dev surfaces this for many packages).
- **Deep supply-chain/malware pass → hand off.** Do *not* re-implement install-script / tarball-vs-source / typosquatting / maintainer-takeover analysis here. Recommend running **`/security-check:system-package-audit <ecosystem>:<package>`** on the chosen version as the concrete next step (and as a gate before installing).

## Step 6 — Adoption signals & operational fit

- **Adoption**: downloads and dependent count, GitHub stars (a weak signal), real-world usage. Widely-used packages get more eyes and faster vulnerability discovery.
- **Maturity & quality**: stable (`>=1.0`) vs. `0.x` experimental; ships types (or has maintained `@types`); has tests and CI; documentation quality.
- **Operational footprint**: how many **transitive dependencies** it drags in (each is its own liability); install size / bundle-size impact (matters for frontend); runtime/framework version compatibility with this project (Node/Ruby/language version, framework version).
- **Churn**: major-version frequency and breaking-change history — how much upgrade maintenance are you signing up for?

## Step 7 — Score & verdict

Score each dimension `✅ / ⚠️ / ⛔` and synthesize a single verdict:

- **✅ Adopt** — necessary, healthy, clean license, good security posture.
- **⚠️ Adopt with caution** — usable but with specific risks to accept/mitigate (e.g. single maintainer → pin and watch; minor license obligation; thin tests).
- **🟧 Avoid (use alternative)** — a materially better-maintained or better-licensed alternative exists; recommend it.
- **⛔ Don't add** — replaceable by native/existing capability, or a blocking license/security problem.

If the verdict is **Adopt** or **Adopt with caution**, the closing action is: *"Run `/security-check:system-package-audit <ecosystem>:<package>` on the target version before installing."*

### Output template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 DEPENDENCY ADOPTION REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Package:      <name> (<ecosystem>)   target <version>
🔗 Repository:   <url>
🧭 For project:  <stack / use case>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [1] Necessity & alternatives   ✅ / ⚠️ / ⛔   <can native/existing replace it?>
  [2] License & legal            ✅ / ⚠️ / ⛔   <license · obligations · relicensing risk>
  [3] Maintenance & governance   ✅ / ⚠️ / ⛔   <cadence · bus factor · backing>
  [4] Security track record      ✅ / ⚠️ / ⛔   <CVE history · posture · scorecard>
  [5] Adoption & operational fit ✅ / ⚠️ / ⛔   <usage · maturity · transitive footprint>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚦 VERDICT: Adopt | Adopt with caution | Avoid (use <alternative>) | Don't add
   <one-paragraph rationale>

💡 If adopting:
   • Run /security-check:system-package-audit <ecosystem>:<package>  (supply-chain vet before install)
   • <any caution to mitigate: pin version / watch maintenance / note license obligation>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

When comparing candidates, show a one-row-per-candidate comparison and recommend one.

## Data sources

- **Registry APIs** — npm (`npm view <pkg> --json`), PyPI (`https://pypi.org/pypi/<pkg>/json`), crates.io, RubyGems, NuGet, Packagist — versions, maintainers, publish times, license field.
- **GitHub** (`gh`) — repo activity, contributors, releases, `SECURITY.md`, archived/deprecated status, issue/PR responsiveness.
- **deps.dev** — cross-ecosystem license, dependency graph (transitive footprint + transitive licenses), and OpenSSF Scorecard data in one place.
- **OSV.dev** / **GitHub Advisory Database** — CVE/advisory history and patch latency.
- **OpenSSF Scorecard** — automated security-posture score (maintained, signed releases, branch protection, etc.).

## Notes & limitations

- This is **advisory** — it gathers public signals and applies judgment; it does not install anything or modify the repo.
- Popularity is a weak signal — widely-used ≠ safe; weigh it alongside maintenance and security posture.
- Re-run before a *major* version adoption, not just first adoption — license and governance can change between versions (see relicensing risk).
- Confirm license interpretations with legal for anything copyleft or non-OSI before relying on this skill's read.
