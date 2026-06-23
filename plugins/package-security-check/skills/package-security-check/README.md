# package-security-check

Comprehensive security audit of a package before updating it. Compares installed vs. latest version, fetches data from GitHub and the package registry, and runs 7 different checks to flag supply chain attacks, malicious code, and known vulnerabilities.

## Usage

```
/package-security-check <package>
/package-security-check <manager>:<package>
```

**Examples:**

```
/package-security-check lodash
/package-security-check npm:lodash
/package-security-check brew:git
/package-security-check pip:requests
/package-security-check cargo:serde
```

If no manager is specified, the skill auto-detects it based on what's installed on your system.

## Supported package managers

| Manager       | Prefix         |
| ------------- | -------------- |
| Homebrew      | `brew`         |
| Node.js       | `npm` / `npx`  |
| Python        | `pip` / `pip3` |
| Rust          | `cargo`        |
| Ruby          | `gem`          |
| Debian/Ubuntu | `apt`          |

## What it does

The skill runs **7 layered security checks** before declaring an update safe:

1. **Version detection** — finds installed and latest version, plus the GitHub repo
2. **Known vulnerabilities** — queries OSV.dev and GitHub Advisory DB for CVEs in either version
3. **Maintainer analysis** — detects account takeovers and ownership transfers (e.g. `event-stream`, `ua-parser-js`)
4. **Install script audit** — inspects pre/post-install hooks for malicious behavior (the most common npm attack vector)
5. **Source vs. registry verification** — confirms the published artifact matches the GitHub source (catches build pipeline compromises)
6. **Diff analysis** — compares actual code changes between versions, focusing on security-relevant files
7. **Dependency tree audit** — flags new, suspicious, or typosquatted transitive dependencies
8. **Typosquatting check** — confirms you're auditing the package you actually meant to install

## What it catches

| Attack type                                         | Detected by   |
| --------------------------------------------------- | ------------- |
| Malicious PR merged to main                         | Step 6 (diff) |
| Compromised maintainer account                      | Step 3        |
| Ownership transfer to bad actor                     | Step 3        |
| Postinstall script malware                          | Step 4        |
| Source on GitHub clean, npm tarball poisoned        | Step 5        |
| Known CVEs in target version                        | Step 2        |
| Typosquatted package name                           | Step 8        |
| New malicious transitive dependency                 | Step 7        |
| Hardcoded secrets, eval/exec, suspicious endpoints  | Step 6        |

## Patterns it flags

- New network calls or changed endpoints
- Cryptography changes (hash algorithms, key handling)
- Authentication / authorization changes
- File system access changes
- New dependencies added
- Obfuscated or minified code
- Hardcoded secrets or tokens
- `eval` / `exec` / `system` calls added
- Permission or privilege escalation
- Time-based or condition-based code branches (potential time-bombs)
- Env var reads for known secret names (`AWS_*`, `GITHUB_TOKEN`, `NPM_TOKEN`, etc.)

## Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 SECURITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Package:            lodash
📌 Manager:            npm
📌 Installed version:  4.17.20  (published 2020-08-13)
🆕 Available version:  4.17.21  (published 2021-02-20)
🔗 Repository:         github.com/lodash/lodash
👤 Publisher:          jdalton
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️  AUDIT RESULTS

  [1] Known Vulnerabilities    ⚠️  CVE-2021-23337 fixed in 4.17.21
  [2] Maintainer Analysis      ✅ Same publisher across versions
  [3] Install Scripts          ✅ No install hooks
  [4] Source vs. Registry      ✅ Tarball matches GitHub source
  [5] Code Diff Analysis       ⚠️  Patch for prototype pollution in _.zipObjectDeep
  [6] Dependency Changes       ✅ No dependency changes
  [7] Typosquatting Check      ✅ No similar packages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL FINDINGS
   None

⚠️  HIGH RISK FINDINGS
   None

ℹ️  MEDIUM / LOW FINDINGS
   [LOW]  CVE-2021-23337 (command injection) — FIXED in target version

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERDICT: Safe to update — recommended for security fix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Recommended actions:
   • Run: npm install -g lodash@4.17.21
   • Verify with: npm list -g lodash
```

## When to use

- Before updating a dependency in a production project
- When a package update feels risky and you want a quick sanity check
- As part of a security review before merging a dependency bump PR
- After news of a supply chain attack — audit packages you have installed
- Periodically as part of a security hygiene routine

## Requirements

- **Claude CLI** with the GitHub MCP configured
- The package manager you're auditing must be installed locally (`npm`, `pip`, `cargo`, etc.)
- Internet connection (for registry API and OSV.dev queries)

## Limitations

This skill performs **static analysis only**. It will not catch:

- Runtime / dynamic malicious behavior
- Time-bombed malware that activates only on certain dates or conditions
- Deep analysis of native binaries (`.node`, `.so`, `.pyd`, `.wasm`) — these are flagged, not decompiled
- Build pipeline compromises that produce identical-looking source and artifact
- Zero-day vulnerabilities not yet in public databases

For absolutely critical updates, supplement with:

- **Snyk** or **Socket.dev** for deeper registry-side analysis
- **GitHub Dependabot** for continuous monitoring
- Manual code review for high-impact dependencies

## Notes

- The skill writes temporary files to `/tmp/secaudit/` and cleans them up after the audit completes.
- Public registry API queries are made without authentication — no credentials needed beyond the GitHub MCP token.
- All checks are read-only — the skill never modifies your system or installs anything.
