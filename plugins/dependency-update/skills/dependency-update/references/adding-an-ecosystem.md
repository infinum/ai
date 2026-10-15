# Adding an ecosystem

Add an ecosystem deliberately, from a real project that uses it, rather than guessing at its rules during an analysis. It needs one reference file, `references/<ecosystem>.md`, with the same sections as `gradle.md` and `spm.md`: Detect, Extract, Versions and dates, Release-note sources, Evidence, Usage check, How changes show, Advisories, Apply. Do not skip "How changes show": without the commands that reveal a change, every behavior check falls back to `manual`. Then:

1. Add the detection files to step 1 of `SKILL.md`, and a row to its file table.
2. If git tags are not enough, teach `scripts/list_versions.py` the registry. Registries that give versions and dates:
   - npm: `https://registry.npmjs.org/<name>` (the `time` field)
   - PyPI: `https://pypi.org/pypi/<name>/json`
   - crates.io: `https://crates.io/api/v1/crates/<name>` (send a User-Agent)
   - Go: `https://proxy.golang.org/<module>/@v/list`, then `/@v/<version>.info` for the date
   - CocoaPods: `https://trunk.cocoapods.org/api/v1/pods/<name>` (`versions[].created_at`)

   Without release dates, the age is unknown and scores 0.
3. Find the OSV ecosystem name for `osv_check.py`: `npm`, `PyPI`, `crates.io`, `Go`, `Packagist`, `RubyGems`, `NuGet`, `Pub`, `Hex`.
4. Add eval cases for the ecosystem to a local `evals/evals.json` next to the skill. Evals are not part of the plugin: each case runs against a real project on your machine.
