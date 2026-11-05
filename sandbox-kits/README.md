# Sandbox kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) run Claude Code in an isolated microVM, so the agent can
work with permission prompts off without touching your machine. A **kit** is a pre-packaged setup (plugins,
configuration, network rules) applied to a sandbox when it is created. The kits here give you an Infinum-ready
`claude` sandbox in one command.

## Before you start

1. **Install the `sbx` CLI.** Follow the official
   [Docker Sandboxes getting started guide](https://docs.docker.com/ai/sandboxes/get-started/).
2. **Allow Infinum kits** (one time). `sbx` only loads kits from sources you allow:

   ```console
   sbx settings set kit.allowedSources '["docker.io/","github.com/infinum/"]'
   ```

## Available kits

| Kit                                       | What it is                                                                                                                  |
|-------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| [**infinum-full**](./infinum-full/README.md) | The baseline Infinum setup for a Claude sandbox: Infinum plugins, house rules and team tooling, ready for everyday project work. |

Each kit's README covers what it installs and the steps to take after installing it.

## Using a kit

Create a sandbox with a kit:

```console
sbx run claude --kit "git+https://github.com/infinum/ai.git#dir=sandbox-kits/<kit>" <workspace-dir>
```

**Already have a sandbox?** You can apply a kit to a running sandbox:

```console
sbx kit add <sandbox> "git+https://github.com/infinum/ai.git#dir=sandbox-kits/<kit>"
```

This skips the kit's instructions for Claude, so creating a new sandbox with `sbx run --kit` is preferred.

## Atlassian, Productive and GitHub

These integrations don't come from a kit. Enable them as connectors on your Claude account (claude.ai). Once enabled
there, they work inside the sandbox.

## Tips and tricks

- **Copying text out of a sandbox:** if selecting text and pressing <kbd>Cmd</kbd>+<kbd>C</kbd> doesn't copy it out
  of the sandbox terminal, hold <kbd>Fn</kbd> while you select, then press <kbd>Cmd</kbd>+<kbd>C</kbd> (on a Mac).

---

## Contributing

### Kit layout

Each kit has its own directory under `sandbox-kits/`:

| File               | Purpose                                                                                                                                         |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `<kit>.yaml`       | The kit descriptor ([v3 format](https://github.com/docker/sbx-kits-contrib/blob/v3/CONTRIBUTING.md)): network policy, install hooks, agent context. |
| `<kit>-context.md` | Instructions added to the agent's context, so Claude knows what the kit set up.                                                                  |
| `README.md`        | User docs. Follow the [infinum-full README](./infinum-full/README.md) structure: what it is, install, post-install steps, features, then contributing. |

When you add a kit, add a row to [Available kits](#available-kits). Keep the description broad, without plugin names
or host lists, so it doesn't go stale when the kit changes.

### Testing

Validate a kit locally (this builds it):

```console
sbx kit inspect ./<kit>
```

Install from a branch before merging:

```console
sbx run claude --kit "git+https://github.com/infinum/ai.git#ref=<branch>&dir=sandbox-kits/<kit>" <workspace-dir>
```

A kit that errors fails sandbox creation, so hooks should exit non-zero only on real failures.

### References

- [Docker Sandboxes kits documentation](https://docs.docker.com/ai/sandboxes/customize/kits/)
- [Kit v3 format and contribution guide](https://github.com/docker/sbx-kits-contrib/blob/v3/CONTRIBUTING.md)
- [Community kits repository](https://github.com/docker/sbx-kits-contrib)
