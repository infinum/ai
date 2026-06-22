# dependency-adoption-review

Due-diligence review of a new third-party dependency **before you add it to a project** — it answers *"should we take this dependency at all?"*. It grounds the decision in necessity, license, maintenance, governance, security track record, adoption, and footprint, then returns a scored **Adopt / Adopt-with-caution / Avoid / Don't-add** verdict.

## Usage

```
/security-check:dependency-adoption-review <ecosystem>:<package>
/security-check:dependency-adoption-review <package>                 # auto-detect ecosystem
/security-check:dependency-adoption-review <package> vs <alternative> # compare candidates
```

## What it checks

1. **Necessity & alternatives** *(first gate)* — can a modern language/stdlib/platform feature, a few lines of owned code, or an existing dependency replace it? The best dependency is often no dependency.
2. **License & legal** — license type and compatibility, obligations, transitive licenses, and **relicensing risk** (the AutoMapper/Redis/Elastic commercial-pivot pattern).
3. **Maintenance health & governance** — release cadence, archived/deprecated status, responsiveness, contributor count / bus factor, and whether an organization or foundation backs it.
4. **Security track record & posture** — CVE history and patch latency, prior supply-chain incidents, publish-time 2FA, signed releases/provenance, and OpenSSF Scorecard. The deep malware pass is **handed off to `/security-check:system-package-audit`**.
5. **Adoption & operational fit** — usage/maturity, typed & tested, docs, transitive-dependency footprint, bundle size, runtime/framework compatibility, and breaking-change churn.

Data comes from registry APIs, GitHub (`gh`), **deps.dev** (license + dependency graph + Scorecard), OSV.dev, and the GitHub Advisory Database.

## Output

A scored card per dimension (`✅/⚠️/⛔`) and a single verdict — **Adopt**, **Adopt with caution**, **Avoid (use alternative)**, or **Don't add** — with a rationale. When the verdict is to adopt, the closing step is to run `/security-check:system-package-audit` on the target version before installing.

## When to use

- Before adding a library to a project.
- When choosing between competing packages that do the same thing.
- When a teammate proposes a dependency and you want a defensible, written basis for yes/no.

## Requirements

- `gh` authenticated (repo signals); internet access for registry APIs, deps.dev, and advisory databases.
- Optionally the local package manager (to inspect the resolved transitive footprint).

## Limitations

- Advisory only — it gathers public signals and applies judgment; it installs nothing and modifies no files.
- Popularity is a weak signal; weigh it alongside maintenance and security posture.
- Confirm copyleft / non-OSI license interpretations with legal.

## Related skills

- **`/security-check:system-package-audit`** — supply-chain/malware vet of the specific version before install.
- **`/security-check:vulnerability-report-triage`** — triage reported vulnerabilities in dependencies you already have.
