# claude-no-attribution

Turns off Claude Code's automatic commit and PR attribution inside a Docker
Sandbox.

This is a mixin with `requires.agent: claude`: it composes onto the `claude`
base agent only, and applying it to another one is a composition error that
fails sandbox creation rather than quietly doing nothing.

At sandbox creation it merges `attribution.commit: ""` and
`attribution.pr: ""` into `~/.claude/settings.json` via `jq`, so the
"🤖 Generated with Claude Code" commit trailer and the "Co-Authored-By: Claude"
line are suppressed, while every other setting already in that file (or added by
other kits) is left untouched.

## How it works

The install command runs once at sandbox creation, as the **agent** user
(`user: "1000"`) rather than the `setup.install` default of root — everything
it touches lives under the agent's own home, so root would only mean chowning
the directory and the file back afterwards:

- The target is `${CLAUDE_CONFIG_DIR:-/home/agent/.claude}/settings.json`, the
  same default `infinum-ai` uses, so both kits agree on which file Claude reads
  even if that variable points elsewhere.
- If that `settings.json` doesn't exist yet, it's created as `{}` first,
  so the `jq` merge below always has valid JSON to work with.
- `jq '.attribution.commit = "" | .attribution.pr = ""'` merges only those
  two keys — every other setting already in the file, or added by another
  kit's install step, survives untouched.
- The merged JSON is captured into a shell variable and only then written back
  over `settings.json`. Two things follow from that order: a `jq` failure (a
  hand-edited file that is no longer valid JSON) aborts under `set -eu` before
  the file is touched, and the write goes to the existing inode, so the file
  keeps its own mode and owner — no temp file, no `chmod --reference`, nothing
  left behind on the failure path.

The write is not atomic, which is deliberate: install commands run once,
sequentially, before the agent launches, so there is no concurrent reader for
an atomic rename to protect.

Unlike `infinum-ai` and `superpowers`, this kit is **not** best-effort. It runs
under `set -eu` and makes no network call, so its only failure mode is a
`settings.json` that is already invalid JSON — worth failing creation over.

`jq` is assumed present: this kit declares `requires.agent: claude`, and the
`claude` base image ships it.

## Usage

```console
$ sbx run claude --kit ./claude-no-attribution/ /path/to/project
```

To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./claude-no-attribution/
```

> [!NOTE]
> `sbx kit add` applies the install command but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. Claude won't be told the setting changed, though the
> setting itself takes effect. Use `sbx run --kit` for the full result. See
> [Applying the kits](../README.md#applying-the-kits).

## Verify

```console
$ sbx exec my-sandbox -- cat /home/agent/.claude/settings.json
$ sbx exec my-sandbox -- stat -c '%U %a %n' /home/agent/.claude/settings.json
```

`attribution.commit` and `attribution.pr` should both be `""`, and the `stat`
should report `agent` — `root` means the `user: "1000"` setting on the install
command regressed.

## References

- [Kit spec](spec.yaml)
- `attribution` key in the Claude Code `settings.json` schema (replaces the
  deprecated `includeCoAuthoredBy` boolean).
