# infinum-base

The Infinum baseline for a Claude sandbox. Two things that are wanted in
every sandbox and have nothing to do with each other:

- **No AI attribution on commits.** Sets `attribution.commit` and
  `attribution.pr` to `""` in `~/.claude/settings.json`, dropping the
  "🤖 Generated with Claude Code" trailer and the "Co-Authored-By: Claude"
  line.
- **Maven Central egress.** Allows `repo.maven.apache.org` and
  `repo1.maven.org` so Maven, Gradle, sbt and Coursier can resolve
  dependencies.

This consolidates the `claude-no-attribution` and `maven-central` kits, both
of which remain in this repository and are unchanged in behaviour.

## Why `requires.agent: claude`

The two halves disagreed. `claude-no-attribution` declares
`requires.agent: claude` — it writes a Claude-specific settings file.
`maven-central` deliberately declares no `requires` at all, so its egress
policy layers onto any base agent. A merged kit can hold only one value, and
it takes `claude`.

That costs nothing here, because `maven-central` still exists: a non-Claude
sandbox that needs Maven Central applies that kit directly. Revisit this if
`maven-central` is ever deleted.

## The settings write

`~/.claude/settings.json` is read-modify-written with `jq`, so every other
key in it survives. Five states are handled:

| State | Behaviour |
|---|---|
| `~/.claude` does not exist | Created, seeded with `{}` |
| `settings.json` is zero bytes | Reseeded with `{}` before `jq` reads it |
| `settings.json` is whitespace-only (e.g. a single newline) | Reseeded with `{}` before `jq` reads it |
| `settings.json` has content and is a JSON object | Read-modify-write; unrelated keys preserved |
| `settings.json` is valid JSON but not an object (e.g. `[]`, `"string"`) | `jq` exits 5 (`Cannot index array/string with string "attribution"`), the step fails loudly under `set -eu`, and the file is left untouched |

The zero-byte and whitespace-only cases are both guarded by checking for
actual JSON content, not just file size:
`[ -s "$f" ] && [ -n "$(tr -d '[:space:]' < "$f")" ]`. A bare `-s` guard only
rules out zero bytes — a file holding a single newline is 1 byte, so it
passes `-s`, and `jq` on whitespace-only input exits **0** with empty
output, so the write below would replace the file with a bare newline while
still reporting success. That was a real, shipped bug, and worse than the
usual edge case: a home volume already damaged by the pre-fix
`claude-no-attribution` kit — which left behind exactly a 1-byte newline
file — was *not* repaired by re-running the fixed kit, because the old `-s`
guard treated that file as "has content" and handed it straight to `jq`.
A `[ -n "$merged" ]` check right before the write is a second line of
defense against the same class of silent-blank failure, in case some future
change makes `jq` exit 0 with nothing to say.

The merge is captured into a variable before the file is touched, so a `jq`
failure aborts without writing, and the write is in place so the file keeps
its own mode and owner.

Re-running is a no-op: the same two keys are set to the same two values.

## What Maven Central does not include

Only `repo.maven.apache.org` and `repo1.maven.org`. Not the Gradle Plugin
Portal (`plugins.gradle.org`), Sonatype snapshot/staging repos, Maven Central
*search* (`central.sonatype.com`, `search.maven.org`), or any private
repository. That is not the same as those being blocked — the effective
policy also includes host and org rules, so check `sbx policy ls`.

Neither allowed host redirects to a CDN, so the two entries are sufficient on
their own.

## Usage

```console
$ sbx run claude --kit ./infinum-base/ /path/to/project
```

Applying it alongside `claude-no-attribution` or `maven-central` is
redundant but harmless: `setup.install` lists concatenate, the attribution
write is idempotent, and the allow-lists union.

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./infinum-base/
```

## Verify

```console
$ sbx exec my-sandbox -- jq '.attribution' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- curl -sS -o /dev/null -w '%{http_code}\n' \
    https://repo.maven.apache.org/maven2/org/junit/jupiter/junit-jupiter/maven-metadata.xml
```

Expect `attribution.commit` and `attribution.pr` both `""`; the `stat` to
report `agent`, not `root` — `root` means the `user: "1000"` setting on the
install command regressed; and the `curl` to report `200`, confirming the
Maven Central policy is in effect. A `403` whose body starts with `Blocked by
network policy` means either the kit was not applied or a `deny` rule is
overriding its `allow` — deny wins, whichever layer it came from. `sbx policy
log` shows which rule matched.

> [!NOTE]
> `sbx kit add` applies the install command and the network policy, but
> **not** this kit's `agentInstructions.content` — the engine skips the
> kit-memory write for `kind: mixin` artifacts. The attribution keys still
> get set and Maven Central is still reachable; the agent just isn't told
> either happened, including what the "What Maven Central does not include"
> section above warns about. Use `sbx run --kit` for a sandbox you intend to
> work in. See [Applying the kits](../README.md#applying-the-kits).

## References

- [Kit spec](spec.yaml)
- [`claude-no-attribution`](../claude-no-attribution/) and
  [`maven-central`](../maven-central/) — the two kits this one consolidates
- `attribution` key in the Claude Code `settings.json` schema (replaces the
  deprecated `includeCoAuthoredBy` boolean)
- Maven Central: <https://central.sonatype.com/>
