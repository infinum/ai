# sandbox-kits

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) kits for a `claude` sandbox.

A kit packages a set of capabilities a sandbox can use, such as tools to install or network rules to set.

## Kits

- [**infinum-full**](./infinum-full/README.md): Base Infinum sandbox setup that disables Claude commit/PR attribution, installs the Infinum plugins, and registers Context7 MCP server.

**Atlassian**, **Productive**, and **GitHub** MCPs are not included in the kit. Use Claude's
built-in connectors, enabled on Claude account level.

## Usage

```console
sbx run claude --kit "git@github.com:infinum/ai.git#dir=sandbox-kits/<kit>" <workspace-dir>
```

The kits fail sandbox creation on error. They can be applied to a running sandbox with:

```console
sbx kit add <sandbox> "git@github.com:infinum/ai.git#dir=sandbox-kits/<kit>"
```

Applying a kit to a running sandbox skips `agentInstructions.content` update for `kind: mixin` kits. It is preferred to use `sbx run --kit` to set up your sandbox at creation time.

## References

- Docker Sandboxes kits documentation: <https://docs.docker.com/ai/sandboxes/customize/kits/>
- Community repository for sbx kits: <https://github.com/docker/sbx-kits-contrib>