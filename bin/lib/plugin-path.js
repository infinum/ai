// Resolve the on-disk path of a marketplace plugin and substitute the
// ${CLAUDE_PLUGIN_ROOT} template variable used in .mcp.json.
//
// Claude Code installs plugins in two layouts:
//   - Local-source plugins (marketplace.json source is a relative path)
//     live in their marketplace's clone at:
//       ~/.claude/plugins/marketplaces/<marketplace>/plugins/<plugin>/
//   - Remote-source plugins (git/tarball) get versioned-cached at:
//       ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/
//     with a `.in_use` marker file in the active version's dir.
//
// resolvePluginPath() probes both, preferring the marketplace clone.

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const TEMPLATE_VAR = "${CLAUDE_PLUGIN_ROOT}";

// Resolved at call time so tests can override HOME / CLAUDE_CONFIG_DIR between runs.
function pluginsBase() {
	const base = process.env.CLAUDE_CONFIG_DIR
		? resolve(process.env.CLAUDE_CONFIG_DIR)
		: join(homedir(), ".claude");
	return join(base, "plugins");
}

export function resolvePluginPath(marketplaceName, pluginName) {
	const base = pluginsBase();
	const localPath = join(
		base,
		"marketplaces",
		marketplaceName,
		"plugins",
		pluginName,
	);
	if (existsSync(localPath)) return localPath;

	const cacheDir = join(base, "cache", marketplaceName, pluginName);
	if (!existsSync(cacheDir)) return null;

	const versions = readdirSync(cacheDir).filter((name) => {
		try {
			return statSync(join(cacheDir, name)).isDirectory();
		} catch {
			return false;
		}
	});
	if (versions.length === 0) return null;

	const inUse = versions.find((v) =>
		existsSync(join(cacheDir, v, ".in_use")),
	);
	const chosen = inUse || versions.sort().pop();
	return join(cacheDir, chosen);
}

export function substitutePluginRoot(value, pluginRoot) {
	if (typeof value === "string") {
		return value.split(TEMPLATE_VAR).join(pluginRoot);
	}
	if (Array.isArray(value)) {
		return value.map((v) => substitutePluginRoot(v, pluginRoot));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [
				k,
				substitutePluginRoot(v, pluginRoot),
			]),
		);
	}
	return value;
}
