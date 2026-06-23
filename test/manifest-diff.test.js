// Tests for plugin-path resolution + MCP unregister flow (cleanup path).
//
// These cover the building blocks the installer uses to track and clean up
// derived MCP entries when a plugin is removed from the marketplace.

import { strict as assert } from "node:assert";
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
import { resolvePluginPath } from "../bin/lib/plugin-path.js";
import { unregisterPluginMcp } from "../bin/lib/mcp.js";

let workDir;
let origHome;

beforeEach(async () => {
	workDir = await mkdtemp(join(tmpdir(), "infinum-manifest-test-"));
	origHome = process.env.HOME;
	process.env.HOME = workDir;
});
afterEach(async () => {
	process.env.HOME = origHome;
	await rm(workDir, { recursive: true, force: true });
});

describe("resolvePluginPath", () => {
	test("prefers marketplaces/<m>/plugins/<p>/ (local-source layout)", async () => {
		const localPath = join(
			workDir,
			".claude",
			"plugins",
			"marketplaces",
			"test-mp",
			"plugins",
			"my-plugin",
		);
		await mkdir(localPath, { recursive: true });

		const result = resolvePluginPath("test-mp", "my-plugin");
		assert.equal(result, localPath);
	});

	test("falls back to cache/<m>/<p>/<version>/ (versioned-cache layout)", async () => {
		const cacheDir = join(
			workDir,
			".claude",
			"plugins",
			"cache",
			"test-mp",
			"my-plugin",
		);
		await mkdir(join(cacheDir, "0.1.0"), { recursive: true });
		await mkdir(join(cacheDir, "0.2.0"), { recursive: true });

		const result = resolvePluginPath("test-mp", "my-plugin");
		// No .in_use marker — falls back to highest lexicographic version.
		assert.equal(result, join(cacheDir, "0.2.0"));
	});

	test("picks the .in_use version when present, even if not the highest", async () => {
		const cacheDir = join(
			workDir,
			".claude",
			"plugins",
			"cache",
			"test-mp",
			"my-plugin",
		);
		await mkdir(join(cacheDir, "0.1.0"), { recursive: true });
		await mkdir(join(cacheDir, "0.2.0"), { recursive: true });
		await writeFile(join(cacheDir, "0.1.0", ".in_use"), "");

		const result = resolvePluginPath("test-mp", "my-plugin");
		assert.equal(result, join(cacheDir, "0.1.0"));
	});

	test("returns null when plugin is nowhere on disk", () => {
		const result = resolvePluginPath("missing-mp", "missing-plugin");
		assert.equal(result, null);
	});
});

describe("unregisterPluginMcp", () => {
	test("removes named servers from each scratch client config (legacy serverNames form)", async () => {
		const clientA = join(workDir, "client-a.json");
		const clientB = join(workDir, "client-b.json");
		await writeFile(
			clientA,
			JSON.stringify({
				mcpServers: {
					sa: { command: "npm", args: ["start"] },
					other: { command: "x", args: [] },
				},
			}),
		);
		await writeFile(
			clientB,
			JSON.stringify({
				mcpServers: { sa: { command: "npm", args: ["start"] } },
			}),
		);

		const { results } = await unregisterPluginMcp({
			serverNames: ["sa"],
			clients: [
				{ name: "A", configPath: clientA },
				{ name: "B", configPath: clientB },
			],
		});

		assert.equal(results.length, 2);
		assert.equal(results[0].status, "removed");
		assert.equal(results[1].status, "removed");

		const a = JSON.parse(await readFile(clientA, "utf8"));
		const b = JSON.parse(await readFile(clientB, "utf8"));
		assert.equal(a.mcpServers.sa, undefined);
		assert.equal(a.mcpServers.other.command, "x"); // unrelated entry preserved
		assert.deepEqual(b.mcpServers, {});
	});

	test("writtenTo form scopes removal per-client", async () => {
		const clientA = join(workDir, "client-a.json");
		const clientB = join(workDir, "client-b.json");
		await writeFile(
			clientA,
			JSON.stringify({
				mcpServers: {
					sa: { command: "npm", args: [] },
					productive: { type: "http", url: "x" },
				},
			}),
		);
		await writeFile(
			clientB,
			JSON.stringify({
				mcpServers: {
					sa: { command: "npm", args: [] },
				},
			}),
		);

		// writtenTo says we installed both names in A but only `sa` in B
		// (e.g., productive wasn't supported in B at install time). Removing
		// must respect the per-client scope.
		const { results } = await unregisterPluginMcp({
			writtenTo: { A: ["sa", "productive"], B: ["sa"] },
			clients: [
				{ name: "A", configPath: clientA },
				{ name: "B", configPath: clientB },
			],
		});

		assert.equal(results.length, 2);
		assert.equal(results[0].status, "removed");
		assert.deepEqual(results[0].removed.sort(), ["productive", "sa"]);
		assert.equal(results[1].status, "removed");
		assert.deepEqual(results[1].removed, ["sa"]);

		const a = JSON.parse(await readFile(clientA, "utf8"));
		const b = JSON.parse(await readFile(clientB, "utf8"));
		assert.deepEqual(a.mcpServers, {});
		assert.deepEqual(b.mcpServers, {});
	});

	test("reports nothing-to-remove when the server is already gone", async () => {
		const client = join(workDir, "client.json");
		await writeFile(
			client,
			JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }),
		);

		const { results } = await unregisterPluginMcp({
			serverNames: ["sa"],
			clients: [{ name: "C", configPath: client }],
		});
		assert.equal(results[0].status, "nothing-to-remove");
	});

	test("skips clients whose config file is absent", async () => {
		const { results } = await unregisterPluginMcp({
			serverNames: ["sa"],
			clients: [{ name: "Missing", configPath: join(workDir, "nope.json") }],
		});
		assert.equal(results[0].status, "client-absent");
	});
});
