// Tests for bin/lib/mcp.js — pure translator functions + registration IO.

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	buildResolvedServers,
	mergeServers,
	registerPluginMcp,
	removeServers,
} from "../bin/lib/mcp.js";

describe("buildResolvedServers (pure)", () => {
	test("substitutes ${CLAUDE_PLUGIN_ROOT} in args", () => {
		const input = {
			sa: {
				command: "npm",
				args: ["run", "--prefix", "${CLAUDE_PLUGIN_ROOT}", "start"],
			},
		};
		const out = buildResolvedServers(input, "/abs/plugin");
		assert.deepEqual(out.sa.args, ["run", "--prefix", "/abs/plugin", "start"]);
	});

	test("substitutes within nested env objects", () => {
		const input = {
			sa: {
				command: "node",
				args: ["${CLAUDE_PLUGIN_ROOT}/bin/server.js"],
				env: { CONFIG_DIR: "${CLAUDE_PLUGIN_ROOT}/config" },
			},
		};
		const out = buildResolvedServers(input, "/abs/plugin");
		assert.equal(out.sa.args[0], "/abs/plugin/bin/server.js");
		assert.equal(out.sa.env.CONFIG_DIR, "/abs/plugin/config");
	});

	test("leaves non-template values untouched", () => {
		const input = {
			sa: { command: "node", args: ["/already/absolute"] },
		};
		const out = buildResolvedServers(input, "/abs/plugin");
		assert.equal(out.sa.args[0], "/already/absolute");
	});

	test("handles empty input", () => {
		assert.deepEqual(buildResolvedServers({}, "/abs"), {});
		assert.deepEqual(buildResolvedServers(undefined, "/abs"), {});
	});
});

describe("mergeServers (pure, idempotent)", () => {
	test("adds new server to empty config", () => {
		const { config, changed } = mergeServers({}, {
			sa: { command: "npm", args: ["start"] },
		});
		assert.equal(changed, true);
		assert.deepEqual(config.mcpServers.sa, { command: "npm", args: ["start"] });
	});

	test("preserves unrelated existing servers", () => {
		const existing = {
			mcpServers: {
				other: { command: "other-cmd", args: [] },
			},
		};
		const { config, changed } = mergeServers(existing, {
			sa: { command: "npm", args: ["start"] },
		});
		assert.equal(changed, true);
		assert.equal(config.mcpServers.other.command, "other-cmd");
		assert.equal(config.mcpServers.sa.command, "npm");
	});

	test("second identical merge is a no-op", () => {
		const existing = {
			mcpServers: { sa: { command: "npm", args: ["start"] } },
		};
		const { changed } = mergeServers(existing, {
			sa: { command: "npm", args: ["start"] },
		});
		assert.equal(changed, false);
	});

	test("changing args triggers update (when owned)", () => {
		const existing = {
			mcpServers: { sa: { command: "npm", args: ["start"] } },
		};
		const { config, changed } = mergeServers(
			existing,
			{ sa: { command: "npm", args: ["start", "--new-flag"] } },
			new Set(["sa"]),
		);
		assert.equal(changed, true);
		assert.deepEqual(config.mcpServers.sa.args, ["start", "--new-flag"]);
	});

	test("skips overwriting an existing entry the installer doesn't own", () => {
		// User added `sa` themselves with a different command — we must not
		// clobber it. Empty ownedNames = no claim of ownership.
		const existing = {
			mcpServers: { sa: { command: "their-custom", args: [] } },
		};
		const { config, changed, skipped, written } = mergeServers(
			existing,
			{ sa: { command: "npm", args: ["start"] } },
			new Set(),
		);
		assert.equal(changed, false);
		assert.deepEqual(skipped, ["sa"]);
		assert.deepEqual(written, []);
		assert.equal(config.mcpServers.sa.command, "their-custom");
	});

	test("identical existing value is a no-op even without ownership", () => {
		// If the user happens to have set the exact same entry we'd write,
		// adopt it silently — no skipped warning needed.
		const same = { command: "npm", args: ["start"] };
		const { changed, skipped, written } = mergeServers(
			{ mcpServers: { sa: same } },
			{ sa: same },
			new Set(),
		);
		assert.equal(changed, false);
		assert.deepEqual(skipped, []);
		assert.deepEqual(written, ["sa"]);
	});

	test("partial conflict: some owned, some user-set", () => {
		const existing = {
			mcpServers: {
				owned: { command: "old", args: [] },
				user: { command: "their-thing", args: [] },
			},
		};
		const { config, changed, skipped, written } = mergeServers(
			existing,
			{
				owned: { command: "new", args: [] },
				user: { command: "from-plugin", args: [] },
			},
			new Set(["owned"]),
		);
		assert.equal(changed, true);
		assert.deepEqual(skipped, ["user"]);
		assert.deepEqual(written, ["owned"]);
		assert.equal(config.mcpServers.owned.command, "new");
		assert.equal(config.mcpServers.user.command, "their-thing");
	});
});

describe("ownedNamesForClient", () => {
	test("unions writtenTo across all plugins for a given client", async () => {
		// import lazily to avoid circular-import warnings
		const { ownedNamesForClient } = await import("../bin/lib/mcp.js");
		const mcpRegistrations = {
			"mp/plugin-a": {
				writtenTo: { "Claude Desktop": ["sa"], Cursor: ["sa"] },
			},
			"mp/plugin-b": {
				writtenTo: { "Claude Desktop": ["productive"] },
			},
			"mp/legacy-no-writtenTo": {
				serverNames: ["legacy"], // old manifest, no writtenTo
			},
		};
		const cd = ownedNamesForClient(mcpRegistrations, "Claude Desktop");
		const cur = ownedNamesForClient(mcpRegistrations, "Cursor");
		assert.deepEqual([...cd].sort(), ["productive", "sa"]);
		assert.deepEqual([...cur].sort(), ["sa"]);
	});
});

describe("removeServers (pure)", () => {
	test("removes named servers, leaves others", () => {
		const existing = {
			mcpServers: {
				sa: { command: "npm", args: ["start"] },
				other: { command: "x", args: [] },
			},
		};
		const { config, changed } = removeServers(existing, ["sa"]);
		assert.equal(changed, true);
		assert.equal(config.mcpServers.sa, undefined);
		assert.equal(config.mcpServers.other.command, "x");
	});

	test("no-op when server is not present", () => {
		const existing = { mcpServers: { other: { command: "x", args: [] } } };
		const { changed } = removeServers(existing, ["sa"]);
		assert.equal(changed, false);
	});
});

describe("registerPluginMcp (IO)", () => {
	let workDir;

	beforeEach(async () => {
		workDir = await mkdtemp(join(tmpdir(), "infinum-mcp-test-"));
	});
	afterEach(async () => {
		await rm(workDir, { recursive: true, force: true });
	});

	async function setupFakePlugin({ mcpServers } = {}) {
		// Lay out a fake plugin under ~/.claude/plugins/marketplaces/<m>/plugins/<p>
		// by overriding HOME for this test process. plugin-path.js resolves
		// against os.homedir(), so we set HOME to workDir and mirror the layout.
		const pluginsBase = join(workDir, ".claude", "plugins");
		const marketplaceDir = join(pluginsBase, "marketplaces", "test-marketplace");
		const pluginDir = join(marketplaceDir, "plugins", "test-plugin");
		await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });

		await writeFile(
			join(pluginDir, ".claude-plugin", "plugin.json"),
			JSON.stringify({
				name: "test-plugin",
				version: "1.0.0",
				description: "test",
			}),
		);
		// .mcp.json presence is the implicit opt-in signal — plugins without it
		// are treated as non-MCP plugins and skipped by registerPluginMcp.
		if (mcpServers) {
			await writeFile(
				join(pluginDir, ".mcp.json"),
				JSON.stringify({ mcpServers }),
			);
		}
		return pluginDir;
	}

	test("registers servers into a scratch client config", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			await setupFakePlugin({
				mcpServers: {
					demo: {
						command: "npm",
						args: ["run", "--prefix", "${CLAUDE_PLUGIN_ROOT}", "start"],
					},
				},
			});

			const scratchClientPath = join(workDir, "client-config.json");
			await writeFile(scratchClientPath, JSON.stringify({}));

			const result = await registerPluginMcp({
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [{ name: "Scratch", configPath: scratchClientPath }],
			});

			assert.equal(result.ok, true);
			assert.deepEqual(result.serverNames, ["demo"]);
			assert.equal(result.results[0].status, "registered");

			const written = JSON.parse(await readFile(scratchClientPath, "utf8"));
			assert.equal(written.mcpServers.demo.command, "npm");
			// Template variable must be substituted with the absolute plugin path.
			const args = written.mcpServers.demo.args;
			assert.equal(args.includes("${CLAUDE_PLUGIN_ROOT}"), false);
			assert.ok(args.some((a) => a.endsWith("/plugins/test-plugin")));
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("second call is up-to-date (idempotency)", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			await setupFakePlugin({
				mcpServers: {
					demo: {
						command: "node",
						args: ["${CLAUDE_PLUGIN_ROOT}/server.js"],
					},
				},
			});

			const scratchClientPath = join(workDir, "client-config.json");
			await writeFile(scratchClientPath, JSON.stringify({}));
			const opts = {
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [{ name: "Scratch", configPath: scratchClientPath }],
			};

			const first = await registerPluginMcp(opts);
			assert.equal(first.results[0].status, "registered");

			const second = await registerPluginMcp(opts);
			assert.equal(second.results[0].status, "up-to-date");
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("skips clients whose config file is absent", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			await setupFakePlugin({
				mcpServers: { demo: { command: "node", args: [] } },
			});

			const result = await registerPluginMcp({
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [{ name: "Missing", configPath: join(workDir, "nope.json") }],
			});

			assert.equal(result.ok, true);
			assert.equal(result.results[0].status, "client-absent");
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("returns ok:false when plugin ships no .mcp.json", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			// Plugin exists on disk (plugin.json present) but no .mcp.json —
			// the implicit opt-in signal is absent.
			await setupFakePlugin();

			const result = await registerPluginMcp({
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [],
			});
			assert.equal(result.ok, false);
			assert.match(result.reason, /no \.mcp\.json/);
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("preserves a user-set entry with the same name", async () => {
		// User has `demo` already in their client config (set themselves);
		// installer's manifest has no record of writing it. We must leave
		// the existing entry alone and report skipped-conflict.
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			await setupFakePlugin({
				mcpServers: {
					demo: { command: "node", args: ["plugin-version.js"] },
				},
			});
			const scratchClientPath = join(workDir, "client-config.json");
			await writeFile(
				scratchClientPath,
				JSON.stringify({
					mcpServers: {
						demo: { command: "user-tool", args: ["--user-flag"] },
					},
				}),
			);

			const result = await registerPluginMcp({
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [{ name: "Scratch", configPath: scratchClientPath }],
				mcpRegistrations: {}, // we don't own anything
			});
			assert.equal(result.ok, true);
			assert.equal(result.results[0].status, "skipped-conflict");
			assert.deepEqual(result.results[0].skipped, ["demo"]);
			assert.deepEqual(result.writtenTo, { Scratch: [] });

			// User's entry untouched on disk.
			const written = JSON.parse(await readFile(scratchClientPath, "utf8"));
			assert.equal(written.mcpServers.demo.command, "user-tool");
			assert.deepEqual(written.mcpServers.demo.args, ["--user-flag"]);
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("updates an existing entry the installer owns from a prior run", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			await setupFakePlugin({
				mcpServers: {
					demo: { command: "node", args: ["v2.js"] },
				},
			});
			const scratchClientPath = join(workDir, "client-config.json");
			await writeFile(
				scratchClientPath,
				JSON.stringify({
					mcpServers: {
						demo: { command: "node", args: ["v1.js"] },
					},
				}),
			);

			const result = await registerPluginMcp({
				marketplaceName: "test-marketplace",
				pluginName: "test-plugin",
				clients: [{ name: "Scratch", configPath: scratchClientPath }],
				mcpRegistrations: {
					"test-marketplace/test-plugin": {
						serverNames: ["demo"],
						writtenTo: { Scratch: ["demo"] },
					},
				},
			});
			assert.equal(result.ok, true);
			assert.equal(result.results[0].status, "registered");
			assert.deepEqual(result.results[0].skipped, []);
			assert.deepEqual(result.writtenTo.Scratch, ["demo"]);

			const written = JSON.parse(await readFile(scratchClientPath, "utf8"));
			assert.deepEqual(written.mcpServers.demo.args, ["v2.js"]);
		} finally {
			process.env.HOME = origHome;
		}
	});

	test("returns ok:false when plugin is missing on disk", async () => {
		const origHome = process.env.HOME;
		process.env.HOME = workDir;
		try {
			const result = await registerPluginMcp({
				marketplaceName: "nope-marketplace",
				pluginName: "nope-plugin",
				clients: [],
			});
			assert.equal(result.ok, false);
			assert.match(result.reason, /not found/);
		} finally {
			process.env.HOME = origHome;
		}
	});
});
