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

## What is deliberately not allowed

Allowlists are the security surface, so this kit stays narrow. These hosts are
part of the wider JVM ecosystem but are not needed to resolve a declared
dependency from Central:

| Host | What it's for |
|---|---|
| `central.sonatype.com`, `search.maven.org` | Searching for coordinates; the publishing portal |
| `plugins.gradle.org` | The Gradle Plugin Portal — a separate repository |
| `oss.sonatype.org`, `s01.oss.sonatype.org` | Sonatype snapshot and staging repos |
| `jitpack.io`, `jcenter.bintray.com`, … | Other third-party repositories |

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

## Schema version

Written as `schemaVersion: "2"`: egress lives under `permissions.network.allow`
and the sandbox note lives under `agentInstructions.content`.

## Usage

```console
$ sbx run claude --kit ./maven-central/ /path/to/project
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
$ sbx kit add my-sandbox ./maven-central/
```

## Verify

```console
$ sbx policy ls my-sandbox
$ sbx exec my-sandbox -- curl -sS -o /dev/null -w '%{http_code}\n' \
    https://repo.maven.apache.org/maven2/org/junit/jupiter/junit-jupiter/maven-metadata.xml
```

A `200` means the policy is in effect. A `403` whose body starts with
`Blocked by network policy` means the kit is not applied — check `sbx policy ls`
and `sbx policy log`.

## References

- [Kit spec](spec.yaml)
- Maven Central: <https://central.sonatype.com/>
