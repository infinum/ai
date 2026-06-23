---
name: package-security-check
description: Comprehensive security audit of a package before updating. Checks GitHub source, registry metadata, postinstall scripts, known vulnerabilities, maintainer changes, and supply chain risks. Use when the user wants to audit a dependency before upgrading or mentions /package-security-check. Not Cowork-ready — requires local package managers (`brew`/`npm`/`pip`/etc.) and registry egress.
---

# Package Security Check

Comprehensive security audit of a package before updating, supporting multiple package managers and protecting against
supply chain attacks.

## Usage
/package-security-check <manager>:<package>
/package-security-check <package>  (auto-detect)

## Supported Package Managers
- `brew` - Homebrew
- `npm` / `npx` - Node.js
- `pip` / `pip3` - Python
- `cargo` - Rust
- `gem` - Ruby
- `apt` - Debian/Ubuntu

## Step 1 - Parse Input

If input contains `:`, split on `:` to get manager and package.
If no `:`, auto-detect by running these checks in order:
1. `brew list --versions <package>` → if output, it's brew
2. `npm list -g <package>` → if output, it's npm
3. `pip show <package>` → if output, it's pip
4. `cargo install --list | grep <package>` → if output, it's cargo
5. `gem list <package>` → if output, it's gem

## Step 2 - Get Versions & Registry Metadata

### brew
- Installed: `brew list --versions <package>`
- Latest: `brew info <package>`
- Repo URL: extract from `brew info <package>` output
- Bottle info: `brew info --json=v2 <package>` → check `bottle` field for prebuilt binaries

### npm
- Installed: `npm list -g <package> --depth=0`
- Latest: `npm view <package> version`
- Repo URL: `npm view <package> repository.url`
- **Registry metadata:** `npm view <package> --json` → save full output for later analysis
- **Tarball URL:** `npm view <package> dist.tarball`
- **Maintainers:** `npm view <package> maintainers`
- **Publish time:** `npm view <package> time.<version>`

### pip
- Installed: `pip show <package>`
- Latest: from `https://pypi.org/pypi/<package>/json`
- Repo URL: `pip show <package>` → Home-page field
- **Registry metadata:** fetch `https://pypi.org/pypi/<package>/json`
- **Maintainers:** check `info.author` and release `uploaded_by` field
- **Wheels:** check if `.whl` files contain native binaries

### cargo
- Installed: `cargo install --list | grep <package>`
- Latest: `cargo search <package>`
- Repo URL: `https://crates.io/api/v1/crates/<package>`
- **Registry metadata:** fetch `https://crates.io/api/v1/crates/<package>`
- **Owners:** `https://crates.io/api/v1/crates/<package>/owners`

### gem
- Installed: `gem list <package>`
- Latest: `gem search <package>`
- Repo URL: `https://rubygems.org/api/v1/gems/<package>.json`
- **Registry metadata:** fetch `https://rubygems.org/api/v1/gems/<package>.json`

### apt
- Installed: `apt list --installed | grep <package>`
- Latest: `apt-cache policy <package>`
- Repo URL: `apt-cache show <package>` → Homepage field

### After detecting versions, IMMEDIATELY print:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PACKAGE:  <name>
📌 MANAGER:  <package manager>
📌 Installed version:  <version>
🆕 Available version:  <version>
🔗 Repository:         <url>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ Running security audit (8 checks)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Do NOT wait until the end to show this — print it immediately after Step 2 completes.

---

## Step 3 - Known Vulnerabilities Check

Check public vulnerability databases for both installed and target version.

### npm

Run: `npm audit --json --package-lock-only` against a temp dir with the target version, OR query the GitHub Advisory
Database via GitHub MCP:

- Search advisories for `ecosystem:npm package:<name>`
- Check if any advisories cover the version range you're upgrading through

### pip

Query OSV.dev public API (no auth needed):

- `https://api.osv.dev/v1/query` with payload
  `{"package":{"ecosystem":"PyPI","name":"<package>"},"version":"<installed>"}`
- Repeat for target version

### cargo

- Query OSV.dev with `ecosystem:crates.io`
- Or check `https://rustsec.org/advisories/` via GitHub MCP (rustsec/advisory-db repo)

### gem

- Query OSV.dev with `ecosystem:RubyGems`

### brew / apt

- These rely on upstream — query OSV.dev for the underlying project name
- For brew: check the formula's `tap` for any security notes

**Report:** list any CVEs found with severity (CRITICAL/HIGH/MED/LOW). If installed version has known CVE that's fixed
in target — flag this as a REASON TO UPGRADE.

---

## Step 4 - Maintainer & Publisher Analysis

This catches account takeover and ownership transfer attacks (e.g. `event-stream`, `ua-parser-js`).

### npm

- Compare maintainers list now vs. at last installed version
    - `npm view <package>@<installed_version> maintainers`
    - `npm view <package>@<latest_version> maintainers`
- Flag if maintainers changed
- Check publish account for the target version: is it a new/unknown maintainer?
- Check if package recently changed ownership (look at `time` field for unusual gaps)

### pip

- Compare `info.author` and project URLs for both versions
- Check release upload history in PyPI JSON API

### cargo

- Compare `/owners` endpoint output
- Check publication history

### Flag conditions:

- New maintainer published the target version (HIGH risk if unknown)
- Maintainer added in last 30 days (MED risk)
- Long gap between releases followed by sudden release (MED risk - possible account takeover)
- Package transferred to new org/user (HIGH risk)

---

## Step 5 - Install Script & Hook Analysis

This catches malicious code that runs at install time (most common npm attack vector).

### npm

Fetch the package tarball metadata without installing:

- `npm view <package>@<latest> --json` and check the `scripts` field
- Look for: `preinstall`, `install`, `postinstall`, `prepare`, `prepublish`
- If any exist, **download the tarball** to a temp dir and inspect:
  ```
  npm pack <package>@<latest> --pack-destination /tmp/secaudit
  tar -xzf /tmp/secaudit/<package>-<version>.tgz -C /tmp/secaudit
  ```
- Read each script referenced in `package.json` scripts hooks
- Look for: network calls (curl, wget, fetch), file writes outside package, child_process, eval, base64 decoded
  execution, env var exfiltration

### pip

- Check if package has `setup.py` (legacy) vs `pyproject.toml` (modern)
- `setup.py` runs at install time — download sdist and inspect:
    - `pip download <package>==<version> --no-deps --dest /tmp/secaudit`
    - Inspect any `setup.py` for suspicious code
- Check for `__init__.py` side effects on import

### cargo

- Check `build.rs` if present — runs at build time
- Inspect `Cargo.toml` for `build = ` directive

### gem

- Check `extconf.rb` and post_install_message in gemspec

### brew

- Check formula's `install` block for suspicious commands
- Check if formula uses `bottle` (prebuilt binary) — if yes, source-level analysis is incomplete

### Flag conditions:

- ANY new install script in target version that wasn't in installed version (HIGH)
- Install script makes network calls (HIGH)
- Install script reads env vars like `AWS_*`, `GITHUB_TOKEN`, `NPM_TOKEN`, `*_KEY` (CRITICAL)
- Install script writes outside package directory (HIGH)
- Install script uses base64 / hex / obfuscation (CRITICAL)

---

## Step 6 - Source vs. Registry Verification

This catches the case where GitHub source is clean but registry artifact is malicious.

### npm

- Fetch tarball: `npm pack <package>@<latest> --pack-destination /tmp/secaudit`
- List files in tarball: `tar -tzf /tmp/secaudit/<package>-<version>.tgz`
- For each `.js` file in the tarball, check if it exists in the GitHub repo at the matching tag
- For files that exist in both:
    - Sample a few critical ones (entry point from `package.json` main, any auth/network related)
    - Compare via GitHub MCP `get_file_contents` vs. tarball content
- Flag mismatches

### pip

- Same approach: `pip download` then compare to GitHub repo at tag
- Pay special attention to `.whl` files — they may contain prebuilt `.so` / `.pyd` binaries

### cargo

- Source distributions in cargo are generally closer to repo (no separate publish step), lower risk
- Still verify `Cargo.toml` matches between repo and crates.io

### Flag conditions:

- File present in tarball but missing in repo (HIGH)
- File content differs significantly (HIGH)
- Binary files in tarball not present or referenced in repo (CRITICAL)
- Minified/bundled JS that doesn't match a build script in the repo (MED)

---

## Step 7 - Diff Analysis

Use GitHub MCP:

1. List tags → find tags matching installed and latest versions
    - Try formats: `v{version}`, `{package}-{version}`, `{package}-{version_with_underscores}`, `{version}`
2. Compare the two tags to get commits and changed files
3. Categorize files:
    - **CRITICAL:** auth, crypto, network, child_process, eval, exec, fs writes, env reads, package.json scripts
    - **HIGH:** `src/`, `lib/`, `include/`, main entry points
    - **LOW:** `tests/`, `docs/`, `*.md`, CI configs
4. For CRITICAL/HIGH files, fetch and analyze the actual diff

### Patterns to flag in diff:

- New network endpoints (especially non-HTTPS, IP addresses, suspicious domains)
- Cryptography algorithm changes or weakening
- New `eval`, `exec`, `Function()`, `child_process.spawn/exec`
- New file system writes outside expected paths
- New env var reads, especially for known secret names
- Hardcoded URLs, IPs, tokens, base64 blobs
- New transitive dependencies in package files
- Obfuscated / minified code added
- Permission or privilege escalation
- Time-based or condition-based code branches (e.g. `if (Date.now() > ...)`)

---

## Step 8 - Dependency Tree Audit

Many supply chain attacks come through transitive dependencies.

### npm

- `npm view <package>@<latest> dependencies` → list direct deps
- For each new or version-bumped dep, recursively check:
    - Is it a known package? (search npm registry)
    - When was it published?
    - Does it have install scripts?
- Flag any dep added in target version that wasn't in installed version
- Pay special attention to deps with names similar to popular packages (typosquatting)

### pip

- Check `requires_dist` in PyPI JSON for both versions
- Same flow as npm

### cargo

- Check `dependencies` in Cargo.toml between versions
- Cargo's lockfile reduces dependency confusion risk

### Flag conditions:

- New dependency added in target version (MED, investigate further)
- Dependency name similar to a popular package (HIGH - possible typosquatting)
- Dependency from new/unknown publisher (MED)
- Dependency published very recently (< 30 days) (MED)

---

## Step 9 - Typosquatting & Name Similarity Check

Confirm the package being audited is the one the user actually wants.

- Search registry for similar package names (Levenshtein distance ≤ 2)
- For npm: `npm search <package>` and compare top results
- Flag if a more popular package with similar name exists (could indicate user installed typosquat)
- Check package age — typosquats are usually recent

---

## Step 10 - Final Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 SECURITY AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Package:            <name>
📌 Manager:            <manager>
📌 Installed version:  <version>  (published <date>)
🆕 Available version:  <version>  (published <date>)
🔗 Repository:         <url>
👤 Publisher:          <maintainer> <(NEW!) if applicable>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️  AUDIT RESULTS

  [1] Known Vulnerabilities    ✅ / ⚠️ / ⛔
       <details>

  [2] Maintainer Analysis      ✅ / ⚠️ / ⛔
       <details>

  [3] Install Scripts          ✅ / ⚠️ / ⛔
       <details>

  [4] Source vs. Registry      ✅ / ⚠️ / ⛔
       <details>

  [5] Code Diff Analysis       ✅ / ⚠️ / ⛔
       <details>

  [6] Dependency Changes       ✅ / ⚠️ / ⛔
       <details>

  [7] Typosquatting Check      ✅ / ⚠️ / ⛔
       <details>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL FINDINGS
   <list or "None">

⚠️  HIGH RISK FINDINGS
   <list or "None">

ℹ️  MEDIUM / LOW FINDINGS
   <list or "None">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERDICT: Safe to update
⚠️  VERDICT: Update with caution — review HIGH findings
⛔ VERDICT: DO NOT UPDATE — critical risks detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Recommended actions:
   <bullet list of next steps>
```

---

## Notes & Limitations

- This skill performs **static analysis** only. Dynamic/runtime behavior is not detected.
- Time-bombed malware (activates on date/condition) may evade diff analysis.
- Native binaries (`.node`, `.so`, `.pyd`, `.wasm`) are flagged but not deeply analyzed.
- Build pipeline compromises that don't show in source or registry can still slip through.
- For absolutely critical updates, supplement this skill with: **Snyk**, **Socket.dev**, **GitHub Dependabot**, manual
  review.
- All temporary downloads should be cleaned up: `rm -rf /tmp/secaudit` at the end.

## Cleanup

After audit completes, run: `rm -rf /tmp/secaudit`
