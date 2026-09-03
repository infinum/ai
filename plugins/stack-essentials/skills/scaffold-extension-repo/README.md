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
3. **Get the skeleton** — a copy of the bundled [`template/`](template/) with the names filled in: `marketplace.json`, a README with the exact install command, agent instructions, and optionally a first plugin and a rule bundle. Everything the owning team must write is marked `TODO`.
4. **Optionally create the GitHub repo** — the skill asks before running `gh repo create`.
5. **Verify** — a local-path install against the real installer, then clean-up.

## The template

[`template/`](template/) is a complete extension repository with `__PLACEHOLDER__` names. You can also use it by hand: copy the directory, rename the placeholder folders, search-and-replace the placeholders, delete the optional parts you do not need (`plugins/`, `rules/`, the `<!-- private-only -->` block in the README), and fill in the `TODO`s.

| Placeholder | Meaning |
|---|---|
| `__REPO_NAME__` | repository name without `infinum/`, e.g. `ai-team-javascript-private` |
| `__MARKETPLACE_NAME__` | `infinum-` + repo name, e.g. `infinum-ai-team-javascript-private` |
| `__NAME_PREFIX__` | the `{name}` part; prefix for plugin, bundle and rule names |
| `__OWNER_LABEL__` / `__OWNER__` | human label (`JavaScript team`) / maintainer |
| `__VISIBILITY__` | `public` or `private` |
| `__PLUGIN_NAME__` / `__SKILL_NAME__` | first plugin and its first skill |
| `__BUNDLE_NAME__` / `__RULE_NAME__` | first rule bundle and its first rule file |

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

`-private` is present exactly when the repository is private, so the name alone tells you what to expect. The marketplace name mirrors the repo: `infinum-ai-team-javascript`. The two core repos, `infinum/ai` and `infinum/ai-private`, sit outside the template (`ai-private` is installed with the same `--extend` mechanism, but it is a core repo, not a team or project one).

## When to use

| Situation | Use this skill? |
|---|---|
| A team wants to collect its rules and skills in one shared place | Yes — a team repo |
| A project spans several code repositories and shares tooling between them | Yes — a project repo |
| A skill or rule is useful to every Infinum engineer | No — open a PR against `infinum/ai` |
| A rule is only relevant to one code repository | No — commit it to that repo's `.claude/` folder |

Background: [CONTRIBUTING.md — Extending with additional marketplaces](https://github.com/infinum/ai/blob/main/CONTRIBUTING.md#extending-with-additional-marketplaces).
