# maven-central

Allows egress to the Maven Central repository inside a Docker Sandbox, so JVM
build tools can resolve dependencies.

This is a mixin, agent-agnostic (no `requires.agent`) and policy-only: it
installs nothing, writes no files, and runs no commands. All it contributes is
two entries on `permissions.network.allow`:

- `repo.maven.apache.org` — the canonical Maven Central host. Maven's built-in
  `central` repository and Gradle's `mavenCentral()` both point here.
- `repo1.maven.org` — the original hostname, still the default for sbt,
  Coursier and Leiningen, and hardcoded in plenty of existing
  `pom.xml`/`build.gradle` files. Same content, different name; allow both.

Neither host redirects to a separate CDN domain, so no further entries are
needed to complete a download.

This kit does **not** ship a JDK, Maven, or Gradle — it only opens the network
path. Pair it with whatever installs your toolchain (e.g. the `mise` kit, or a
sandbox image that already has one).

## What this kit deliberately does not allow

Allowlists are the security surface, so this kit stays narrow. These hosts are
part of the wider JVM ecosystem but are not needed to resolve a declared
dependency from Central:

| Host | What it's for |
|---|---|
| `central.sonatype.com`, `search.maven.org` | Searching for coordinates; the publishing portal |
| `plugins.gradle.org` | The Gradle Plugin Portal — a separate repository |
| `oss.sonatype.org`, `s01.oss.sonatype.org` | Sonatype snapshot and staging repos |
| `jitpack.io`, `jcenter.bintray.com`, … | Other third-party repositories |

Leaving a host out is not the same as blocking it: the effective policy is the
union of every applied kit's allow list, the host's own `sbx policy` rules and
any org policy. Check `sbx policy ls` rather than inferring from this table.

If your project needs one, fork this kit and extend the list:

```yaml
permissions:
  network:
    allow:
      - repo.maven.apache.org
      - repo1.maven.org
      - plugins.gradle.org      # Gradle Plugin Portal
      - central.sonatype.com    # coordinate search
```

Or, for a one-off, allow it on the host without touching the kit:

```console
$ sbx policy allow network plugins.gradle.org
```

## Usage

```console
$ sbx run claude --kit ./maven-central/ /path/to/project
```

This kit has no `requires.agent`, so it works with any base agent, not just
`claude`. To combine it with the other kits here, see the
[sandbox-kits README](../README.md#applying-the-kits).

Apply to an already-running sandbox:

```console
$ sbx kit add my-sandbox ./maven-central/
```

> [!NOTE]
> `sbx kit add` applies the network policy but **not** this kit's
> `agentInstructions.content` — the engine skips the kit-memory write for
> `kind: mixin` artifacts. Egress works; the agent just won't have been told
> which JVM repositories are reachable and which aren't, which is most of this
> kit's value. Use `sbx run --kit` for a sandbox you intend to work in. See
> [Applying the kits](../README.md#applying-the-kits).

## Verify

```console
$ sbx policy ls my-sandbox
$ sbx exec my-sandbox -- curl -sS -o /dev/null -w '%{http_code}\n' \
    https://repo.maven.apache.org/maven2/org/junit/jupiter/junit-jupiter/maven-metadata.xml
```

A `200` means the policy is in effect. A `403` whose body starts with
`Blocked by network policy` means either the kit was not applied or a `deny`
rule is overriding its `allow` — deny wins, whichever layer it came from.
`sbx policy log` shows which rule matched.

## References

- [Kit spec](spec.yaml)
- Maven Central: <https://central.sonatype.com/>
