// End-to-end tests for the multi-source installer (`--extend`).
//
// Runs the REAL bin/install.js against a temp CLAUDE_CONFIG_DIR, with a fake
// `claude`/`git`/`gh` on PATH so the test is hermetic (no network, no real
// Claude Code). The base marketplace points at this repo (`--local`); the
// overlay is a tiny temp repo with its own marketplace.json + a rule bundle.
//
// The headline test is R1: a bare re-run (no --extend) must NOT delete the
// remembered overlay's bundle.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL_JS = join(REPO_ROOT, "bin", "install.js");

const FAKE = {
	// Succeeds on everything; emits empty marketplace list (so the installer
	// thinks nothing is registered and proceeds to add) and an empty plugin
	// list (for --remove).
	claude: `#!/bin/sh
[ -n "$FAKE_LOG" ] && echo "$@" >> "$FAKE_LOG"
if [ "$1" = "--version" ]; then echo "claude 1.0.0-fake"; exit 0; fi
if [ "$1" = "plugin" ] && [ "$2" = "list" ]; then
  if [ -n "$FAKE_INSTALLED" ]; then echo "$FAKE_INSTALLED"; else echo '{"installed_plugins":[]}'; fi
  exit 0
fi
exit 0
`,
	git: `#!/bin/sh
if [ "$1" = "clone" ]; then
  # git clone --depth 1 <url> <dest>  -> copy the local fixture into <dest>
  dest="$5"
  mkdir -p "$dest"
  cp -R "$FAKE_CLONE_SRC/." "$dest/"
  exit 0
fi
echo "0000000000000000000000000000000000000000	refs/heads/main"
exit 0
`,
	gh: `#!/bin/sh
echo "[]"
exit 0
`,
};

let work, configDir, binDir, overlayDir;

beforeEach(async () => {
	work = await mkdtemp(join(tmpdir(), "infinum-extend-test-"));
	configDir = join(work, "claude");
	binDir = join(work, "fakebin");
	overlayDir = join(work, "overlay");
	await mkdir(configDir, { recursive: true });
	await mkdir(binDir, { recursive: true });
	for (const [name, body] of Object.entries(FAKE)) {
		const p = join(binDir, name);
		await writeFile(p, body);
		await chmod(p, 0o755);
	}
	// Overlay repo: its own marketplace + a `demo` rule bundle.
	await mkdir(join(overlayDir, ".claude-plugin"), { recursive: true });
	await writeFile(
		join(overlayDir, ".claude-plugin", "marketplace.json"),
		`${JSON.stringify({ name: "test-overlay", owner: { name: "T" }, plugins: [] }, null, 2)}\n`,
	);
	await mkdir(join(overlayDir, "rules", "demo"), { recursive: true });
	await writeFile(join(overlayDir, "rules", "demo", "demo-rule.md"), "# demo overlay rule\n");
});

afterEach(async () => {
	await rm(work, { recursive: true, force: true });
});

function runInstaller(args, extraEnv = {}) {
	return spawnSync("node", [INSTALL_JS, "--local", ...args], {
		env: {
			...process.env,
			CLAUDE_CONFIG_DIR: configDir,
			PATH: `${binDir}:${process.env.PATH}`,
			...extraEnv,
		},
		encoding: "utf8",
	});
}

const demoRule = () => join(configDir, "infinum", "demo", "demo-rule.md");
const manifest = async () =>
	JSON.parse(await readFile(join(configDir, "infinum", ".manifest.json"), "utf8"));

describe("--extend install", () => {
	test("installs the overlay's bundle and records a v2 source-scoped manifest", async () => {
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		assert.equal(r.status, 0, r.stderr);

		assert.ok(existsSync(demoRule()), "overlay bundle rule should be installed");
		const m = await manifest();
		assert.equal(m.version, 2);
		assert.ok(m.sources["infinum-ai"], "base source recorded");
		assert.ok(m.sources["test-overlay"], "overlay source recorded");
		assert.equal(m.sources["test-overlay"].extend, overlayDir, "remembers the --extend token");

		const index = await readFile(join(configDir, "infinum", "index.md"), "utf8");
		assert.ok(index.includes(demoRule()), "index.md chains the overlay rule");
	});

	test("R1: a bare re-run (no --extend) keeps the remembered overlay's bundle", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		assert.ok(existsSync(demoRule()), "precondition: overlay installed");

		const r2 = runInstaller(["--plugins", "none"]); // NO --extend
		assert.equal(r2.status, 0, r2.stderr);

		assert.ok(existsSync(demoRule()), "R1: overlay bundle must survive a base-only re-run");
		const m = await manifest();
		assert.ok(m.sources["test-overlay"], "overlay still remembered after a bare re-run");
	});

	test("--extend none clears the remembered overlay (base-only)", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		assert.ok(existsSync(demoRule()), "precondition: overlay installed");

		const r3 = runInstaller(["--extend", "none", "--plugins", "none"]);
		assert.equal(r3.status, 0, r3.stderr);

		assert.ok(!existsSync(demoRule()), "--extend none removes the overlay's rules");
		const m = await manifest();
		assert.ok(!m.sources["test-overlay"], "--extend none forgets the overlay source");
	});

	test("graceful skip: a remembered overlay whose path vanished is kept, not deleted", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		assert.ok(existsSync(demoRule()), "precondition: overlay installed");

		await rm(overlayDir, { recursive: true, force: true }); // the checkout disappears

		const r4 = runInstaller(["--plugins", "none"]); // bare re-run; remembered path now gone
		assert.equal(r4.status, 0, r4.stderr);

		assert.ok(existsSync(demoRule()), "a skipped overlay's already-installed rule must survive");
		const m = await manifest();
		assert.ok(m.sources["test-overlay"], "a skipped overlay stays remembered (carried forward)");
	});

	test("repo-name --extend clones the repo for its rules and registers by name", async () => {
		const r = runInstaller(
			["--extend", "acme/overlay", "--bundles", "demo", "--plugins", "none"],
			{ FAKE_CLONE_SRC: overlayDir },
		);
		assert.equal(r.status, 0, r.stderr);

		assert.ok(existsSync(demoRule()), "overlay bundle installed from the cloned repo");
		const m = await manifest();
		assert.ok(m.sources["test-overlay"], "overlay source recorded");
		assert.equal(m.sources["test-overlay"].extend, "acme/overlay", "remembers the repo token");
		assert.equal(m.sources["test-overlay"].upstream, "acme/overlay", "tracks the repo upstream");
		assert.match(
			m.sources["test-overlay"].upstreamSha,
			/^[0-9a-f]{40}$/,
			"records a HEAD sha for update-check",
		);
	});
});

describe("--remove", () => {
	test("tears down an overlay: uninstalls its plugins, drops rules + manifest entry, deregisters", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		assert.ok(existsSync(demoRule()), "precondition: overlay installed");

		const callLog = join(work, "claude-calls.log");
		const r = runInstaller(["--remove", "test-overlay"], {
			FAKE_INSTALLED: JSON.stringify({
				installed_plugins: [{ id: "demo-plugin@test-overlay" }, { id: "create-prd@infinum-ai" }],
			}),
			FAKE_LOG: callLog,
		});
		assert.equal(r.status, 0, r.stderr);

		assert.ok(!existsSync(demoRule()), "overlay's bundle removed");
		const m = await manifest();
		assert.ok(!m.sources["test-overlay"], "overlay source dropped from manifest");
		assert.ok(m.sources["infinum-ai"], "base source untouched");

		const calls = await readFile(callLog, "utf8");
		assert.match(calls, /plugin uninstall demo-plugin@test-overlay -y/, "uninstalled the overlay's plugin");
		assert.doesNotMatch(calls, /uninstall create-prd@infinum-ai/, "did NOT touch base plugins");
		assert.match(calls, /plugin marketplace remove test-overlay/, "deregistered the overlay marketplace");
	});

	test("refuses to remove the base marketplace", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		const r = runInstaller(["--remove", "infinum-ai"]);
		assert.equal(r.status, 0, r.stderr);
		const m = await manifest();
		assert.ok(m.sources["infinum-ai"], "base must not be removed");
	});

	test("matches by the original --extend token too", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);
		const r = runInstaller(["--remove", overlayDir]); // the path token, not the marketplace id
		assert.equal(r.status, 0, r.stderr);
		const m = await manifest();
		assert.ok(!m.sources["test-overlay"], "removed by matching the extend token");
	});
});
