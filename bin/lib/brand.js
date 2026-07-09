// =============================================================================
// brand.js — single source of truth for this harness's ORG / REPO identity.
//
// Adopting the harness for a different organization means changing the six
// values in the ADOPT block below. Everything the installer prints, writes, and
// checks flows from here: the marketplace it registers, the ~/.claude/<dir> it
// owns, the GitHub repo it tracks for updates, and the install command it
// prints. Defaults ship as Infinum's.
//
// Two things that CANNOT import this module (they're static or run detached),
// so an adoption must update them too — an internal adoption tool (kept in a
// separate private repo) does this for you:
//   • the JSON manifests, rules, docs, and the LICENSE copyright header line;
//   • the stack-essentials update hook, which ships as an installed plugin and
//     carries its own copy of these values in a
//     "BRAND (keep in sync with bin/lib/brand.js)" block.
// =============================================================================

// ── ADOPT: change these six values to adopt the harness for your org ─────────

// Repository "owner/repo" slug — marketplace source, update checks, clone URL.
// The value is consumed as `github:<slug>` today (see INSTALL_CMD); the name is
// vendor-neutral so an org on another host (e.g. Bitbucket) reads sensibly.
export const REPOSITORY_NAME = "infinum/ai";

// Claude Code marketplace name. Must match the npm package `name`, because the
// install command is `--allow-build=<MARKETPLACE_NAME> github:<REPOSITORY_NAME>`.
export const MARKETPLACE_NAME = "infinum-ai";

// Subdirectory the installer owns under the Claude config dir: ~/.claude/<name>/.
export const CONFIG_DIR_NAME = "infinum";

// Prefix for environment variables, e.g. `<ENV_PREFIX>_STACK_SKIP_UPDATE_CHECK`.
export const ENV_PREFIX = "INFINUM";

// Product name shown in the installer UI (intro / outro / help).
export const DISPLAY_NAME = "Infinum AI";

// Company / organization name (whoami stub example, marketplace owner, copyright).
export const ORG_NAME = "Infinum";

// ── Derived — do not edit ────────────────────────────────────────────────────

// Env var whose presence (=== "1") disables the stack-essentials update banner.
export const SKIP_UPDATE_ENV = `${ENV_PREFIX}_STACK_SKIP_UPDATE_CHECK`;

// One-shot install/update command shown in help text and update banners.
export const INSTALL_CMD = `pnpm dlx --allow-build=${MARKETPLACE_NAME} github:${REPOSITORY_NAME}`;
