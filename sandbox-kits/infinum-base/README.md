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
key in it survives. Three states are handled:

| State | Behaviour |
|---|---|
| `~/.claude` does not exist | Created, seeded with `{}` |
| `settings.json` is zero bytes | Reseeded with `{}` before `jq` reads it |
| `settings.json` has content | Read-modify-write; unrelated keys preserved |

The zero-byte case is guarded with `-s` rather than `-f` deliberately. A
zero-byte file passes `-f`, and `jq` on empty input exits **0** with empty
output — so an `-f` guard leads to overwriting `settings.json` with a bare
newline while reporting success. That was a real bug in
`claude-no-attribution`, fixed there too.

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

## Applying it

```console
$ sbx run claude --kit ./infinum-base/ /path/to/project
```

Applying it alongside `claude-no-attribution` or `maven-central` is
redundant but harmless: `setup.install` lists concatenate, the attribution
write is idempotent, and the allow-lists union.
