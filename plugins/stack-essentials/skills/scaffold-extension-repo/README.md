# scaffold-extension-repo

Scaffold a new **extension marketplace** — a repository holding team- or project-specific plugins and rule bundles that is layered on top of the public `infinum/ai` base with the installer's `--extend` flag.

## Usage

```
/stack-essentials:scaffold-extension-repo
```

(Plugin-installed skills are namespaced as `/<plugin>:<skill>`. `stack-essentials` is installed for everyone by the installer, so the skill is available without opting in.)

The skill walks you through a guided flow:

1. **Say what you are creating** — a team repo or a project repo, its name, and whether it should be public, private, or both.
2. **Confirm the proposed names** — repository and marketplace names following `infinum/ai-{type}-{name}[-private]`.
3. **Get the skeleton** — `marketplace.json`, a README with the exact install command, agent instructions, and optionally a first plugin and rule bundle with `TODO` bodies.
4. **Optionally create the GitHub repo** — the skill asks before running `gh repo create`.
5. **Verify** — a local-path install against the real installer, then clean-up.

## Naming convention

```
infinum/ai-{type}-{name}[-private]
```

| Situation | Repository |
|---|---|
| JavaScript team, shareable conventions | `infinum/ai-team-javascript` |
| JavaScript team, internal companion | `infinum/ai-team-javascript-private` |
| Bizdev team — sensitive, no public half | `infinum/ai-team-bizdev-private` |
| .NET team | `infinum/ai-team-dotnet` |
| Client project | `infinum/ai-project-<client>-private` |

`-private` is present exactly when the repository is private, so the name alone tells you what to expect. The marketplace name mirrors the repo: `infinum-ai-team-javascript`. The two core repos, `infinum/ai` and `infinum/ai-private`, sit outside the template (`ai-private` is installed with the same `--extend` mechanism, but it is a core repo, not a team or project one). `infinum/ai-hpb` predates the convention and keeps its name.

## When to use

| Situation | Use this skill? |
|---|---|
| A team wants to collect its rules and skills in one shared place | Yes — a team repo |
| A project spans several code repositories and shares tooling between them | Yes — a project repo |
| Tooling can't be committed to the client's code repository | Yes — a project repo, private |
| A skill or rule is useful to every Infinum engineer | No — open a PR against `infinum/ai` |
| A rule is only relevant to one code repository | No — commit it to that repo's `.claude/` folder |

Background: [CONTRIBUTING.md — Extending with additional marketplaces](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md#extending-with-additional-marketplaces).
