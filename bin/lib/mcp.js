// Cross-platform MCP translator.
//
// Plugin authors maintain one file — the Claude-native .mcp.json — and opt
// in implicitly by shipping it. This module reads .mcp.json, substitutes
// ${CLAUDE_PLUGIN_ROOT} with the absolute plugin path (since non-Claude-Code
// clients don't expand the template variable), and merges entries into each
// detected client's MCP config. Idempotent: re-running produces no changes.
//
// Ownership tracking: the installer's manifest records, per plugin and per
// client, the exact server names we wrote. mergeServers() consults that
// "owned" set on every run — it overwrites entries we wrote before but
// SKIPS entries the user (or another tool) added with the same name. This
// keeps re-running the installer safe even when the user has hand-curated
// MCP entries in Claude Desktop / Cursor / Gemini.
//
// (We can't put an explicit "crossPlatform: true" flag in plugin.json
// because Claude Code's manifest validator rejects unknown root keys —
// a plugin that adds custom fields is silently dropped from the marketplace.
// Using .mcp.json presence as the signal is also more honest: a plugin that
// ships an MCP server has by definition declared one.)
//
// Supported targets: Claude Desktop, Gemini CLI, Cursor. Other tools
// (Copilot, OpenCode, Antigravity) need manual setup — see CONTRIBUTING.md.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolvePluginPath, substitutePluginRoot } from "./plugin-path.js";

export function defaultClients(env = process.env, platform = process.platform) {
	const home = homedir();
	const appdata = env.APPDATA || "";
	const claudeDesktop =
		platform === "darwin"
			? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
			: platform === "win32"
				? join(appdata, "Claude", "claude_desktop_config.json")
				: join(home, ".config", "Claude", "claude_desktop_config.json");

	return [
		{ name: "Claude Desktop", configPath: claudeDesktop },
		{ name: "Gemini CLI", configPath: join(home, ".gemini", "settings.json") },
		{ name: "Cursor", configPath: join(home, ".cursor", "mcp.json") },
	];
}

// Substitute ${CLAUDE_PLUGIN_ROOT} in a plugin's mcpServers map.
// Pure — no IO. Suitable for unit testing.
export function buildResolvedServers(pluginMcpServers, pluginPath) {
	return substitutePluginRoot(pluginMcpServers ?? {}, pluginPath);
}

// Build a Set of server names this installer owns in a given client, by
// unioning the writtenTo[clientName] entries across every plugin in the
// manifest's mcpRegistrations.
export function ownedNamesForClient(mcpRegistrations, clientName) {
	const owned = new Set();
	for (const entry of Object.values(mcpRegistrations ?? {})) {
		const list = entry?.writtenTo?.[clientName];
		if (Array.isArray(list)) {
			for (const name of list) owned.add(name);
		}
	}
	return owned;
}

// Merge resolved server entries into an existing client config object.
// Returns { config, changed, skipped, written }:
//   - skipped: names already in existingConfig but NOT in ownedNames (i.e.,
//     the user added them themselves — we leave those alone).
//   - written: names this call actually wrote (either added or updated).
// Idempotent for owned entries: identical re-merge has changed=false.
export function mergeServers(existingConfig, resolvedServers, ownedNames = new Set()) {
	const out = { ...(existingConfig ?? {}) };
	out.mcpServers = { ...(existingConfig?.mcpServers ?? {}) };
	let changed = false;
	const skipped = [];
	const written = [];
	for (const [name, server] of Object.entries(resolvedServers)) {
		const existing = out.mcpServers[name];
		if (existing) {
			if (JSON.stringify(existing) === JSON.stringify(server)) {
				// Already the value we'd write — no-op even if not in ownedNames,
				// because writing the same thing is harmless and lets first-time
				// runs adopt entries the user happened to set identically.
				written.push(name);
				continue;
			}
			if (!ownedNames.has(name)) {
				skipped.push(name);
				continue;
			}
		}
		out.mcpServers[name] = server;
		written.push(name);
		changed = true;
	}
	return { config: out, changed, skipped, written };
}

// Remove specified servers from existingConfig, but only ones we own.
// Returns { config, changed, removed, kept }:
//   - kept: requested names that weren't removed (because they aren't owned).
// This matters for uninstall: a user may have hand-edited a plugin-shipped
// server name to point at a different transport; we shouldn't blow that away.
export function removeServers(existingConfig, serverNames, ownedNames = null) {
	const out = { ...(existingConfig ?? {}) };
	out.mcpServers = { ...(existingConfig?.mcpServers ?? {}) };
	let changed = false;
	const removed = [];
	const kept = [];
	for (const name of serverNames) {
		if (!(name in out.mcpServers)) continue;
		// `null` ownedNames = legacy callers — remove unconditionally.
		if (ownedNames && !ownedNames.has(name)) {
			kept.push(name);
			continue;
		}
		delete out.mcpServers[name];
		removed.push(name);
		changed = true;
	}
	return { config: out, changed, removed, kept };
}

async function readJsonOrEmpty(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return {};
	}
}

// Register one plugin's MCP servers with all detected client configs.
//
// Pass `mcpRegistrations` (the current manifest's mcpRegistrations object)
// so the merge can tell ours-to-update from theirs-to-preserve.
//
// Returns:
//   { ok: true, pluginPath, serverNames, results: [...], writtenTo }
//     - results[i].status: "registered" | "up-to-date" | "client-absent"
//                        | "skipped-conflict" | "error:<msg>"
//     - results[i].skipped: names we declined to overwrite in this client.
//     - writtenTo: { <clientName>: [<serverName>, ...] } — what we wrote in
//       this run. The caller persists this into the manifest.
// or:
//   { ok: false, reason }
export async function registerPluginMcp({
	marketplaceName,
	pluginName,
	clients = defaultClients(),
	mcpRegistrations = {},
}) {
	const pluginPath = resolvePluginPath(marketplaceName, pluginName);
	if (!pluginPath) {
		return { ok: false, reason: "plugin not found on disk" };
	}

	const mcpJsonPath = join(pluginPath, ".mcp.json");
	if (!existsSync(mcpJsonPath)) {
		return { ok: false, reason: "no .mcp.json — not an MCP-capable plugin" };
	}
	const mcpConfig = await readJsonOrEmpty(mcpJsonPath);
	if (!mcpConfig?.mcpServers || Object.keys(mcpConfig.mcpServers).length === 0) {
		return { ok: false, reason: "no servers declared in .mcp.json" };
	}

	const resolved = buildResolvedServers(mcpConfig.mcpServers, pluginPath);
	const serverNames = Object.keys(resolved);

	const results = [];
	const writtenTo = {};
	for (const client of clients) {
		if (!existsSync(client.configPath)) {
			results.push({
				client: client.name,
				status: "client-absent",
				configPath: client.configPath,
			});
			continue;
		}
		try {
			const existing = await readJsonOrEmpty(client.configPath);
			const owned = ownedNamesForClient(mcpRegistrations, client.name);
			const { config, changed, skipped, written } = mergeServers(
				existing,
				resolved,
				owned,
			);
			if (changed) {
				await writeFile(
					client.configPath,
					`${JSON.stringify(config, null, 2)}\n`,
				);
			}
			writtenTo[client.name] = written;
			let status;
			if (skipped.length > 0 && !changed) {
				status = "skipped-conflict";
			} else if (skipped.length > 0) {
				status = "registered-partial";
			} else if (changed) {
				status = "registered";
			} else {
				status = "up-to-date";
			}
			results.push({
				client: client.name,
				status,
				configPath: client.configPath,
				skipped,
			});
		} catch (err) {
			results.push({
				client: client.name,
				status: `error:${err.message}`,
				configPath: client.configPath,
			});
		}
	}

	return { ok: true, pluginPath, serverNames, results, writtenTo };
}

// Remove a plugin's MCP entries from each client's config. `writtenTo` comes
// from the manifest — each client's list is the exact set of names we wrote
// for this plugin, so we only remove our own.
//
// Legacy form (serverNames + no per-client scoping) is still accepted: in
// that case removeServers runs without ownership checking.
export async function unregisterPluginMcp({
	writtenTo,
	serverNames,
	clients = defaultClients(),
}) {
	const results = [];
	for (const client of clients) {
		if (!existsSync(client.configPath)) {
			results.push({ client: client.name, status: "client-absent" });
			continue;
		}
		try {
			const existing = await readJsonOrEmpty(client.configPath);
			const namesForThisClient = writtenTo
				? writtenTo[client.name] || []
				: serverNames || [];
			if (namesForThisClient.length === 0) {
				results.push({ client: client.name, status: "nothing-to-remove" });
				continue;
			}
			// When writtenTo is provided, we already know we own these names,
			// so pass them through as ownedNames too.
			const owned = writtenTo ? new Set(namesForThisClient) : null;
			const { config, changed, removed } = removeServers(
				existing,
				namesForThisClient,
				owned,
			);
			if (changed) {
				await writeFile(
					client.configPath,
					`${JSON.stringify(config, null, 2)}\n`,
				);
				results.push({
					client: client.name,
					status: "removed",
					removed,
				});
			} else {
				results.push({ client: client.name, status: "nothing-to-remove" });
			}
		} catch (err) {
			results.push({ client: client.name, status: `error:${err.message}` });
		}
	}
	return { results };
}
