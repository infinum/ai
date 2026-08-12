# claude-no-attribution

Turns off Claude Code's automatic commit and PR attribution inside a Docker
Sandbox.

This is a mixin for the built-in `claude` sandbox agent. At sandbox
creation it merges `attribution.commit: ""` and `attribution.pr: ""` into
`~/.claude/settings.json` via `jq`, so the "🤖 Generated with Claude Code"
commit trailer and the "Co-Authored-By: Claude" line are suppressed, while
every other setting already in that file (or added by other kits) is left
untouched.

## How it works

The install command runs once, as root, at sandbox creation:

- If `~/.claude/settings.json` doesn't exist yet, it's created as `{}` first,
  so the `jq` merge below always has valid JSON to work with.
- `jq '.attribution.commit = "" | .attribution.pr = ""'` merges only those
  two keys — every other setting already in the file, or added by another
  kit's install step, survives untouched.
- The merge writes to a temp file in the same directory as `settings.json`,
  then `mv`s it into place — an atomic rename rather than an in-place edit,
  so a reader never sees a half-written file.
- The install runs as root, so both `~/.claude` (if freshly created) and the
  rewritten `settings.json` would end up root-owned — and agent-run Claude
  Code couldn't save its own settings under a root-owned file. The kit
  `chown`s the directory and the file back to `agent:agent`, both
  non-recursively, so ownership of anything else already inside
  `~/.claude` (like `.credentials.json`) is left alone.

## Schema version

Written as `schemaVersion: "2"`: the install step lives under `setup.install`
and the sandbox note lives under `agentInstructions.content`.

## Usage

```console
$ sbx run claude --kit ./claude-no-attribution/ /path/to/project
```

Combine with the other kits in this directory:

```console
$ sbx run claude \
    --kit ./claude-no-attribution/ \
    --kit ./infinum-ai/ \
    --kit ./maven-central/ \
    --kit ./superpowers/ \
    /path/to/project
```

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./claude-no-attribution/
```

## Verify

```console
$ sbx exec my-sandbox -- cat /home/agent/.claude/settings.json
```

`attribution.commit` and `attribution.pr` should both be `""`.

## References

- [Kit spec](spec.yaml)
- `attribution` key in the Claude Code `settings.json` schema (replaces the
  deprecated `includeCoAuthoredBy` boolean).
