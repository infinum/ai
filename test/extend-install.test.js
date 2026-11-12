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
	// Succeeds on everything except a command starting with $FAKE_FAIL; emits
	// an empty marketplace list (so the installer thinks nothing is registered
	// and proceeds to add) and an empty plugin list unless $FAKE_INSTALLED is set.
	claude: `#!/bin/sh
[ -n "$FAKE_LOG" ] && echo "$@" >> "$FAKE_LOG"
if [ -n "$FAKE_FAIL" ]; then case "$*" in "$FAKE_FAIL"*) exit 1 ;; esac; fi
if [ "$1" = "--version" ]; then echo "claude 1.0.0-fake"; exit 0; fi
# Once \`plugin update $FAKE_UPDATE_ID\` has run, \`plugin list\` reports $FAKE_INSTALLED_AFTER.
if [ "$1" = "plugin" ] && [ "$2" = "update" ] && [ -n "$FAKE_UPDATE_ID" ] && [ "$3" = "$FAKE_UPDATE_ID" ]; then touch "$FAKE_UPDATED_FLAG"; fi
if [ "$1" = "plugin" ] && [ "$2" = "list" ]; then
  if [ -n "$FAKE_INSTALLED_AFTER" ] && [ -f "$FAKE_UPDATED_FLAG" ]; then echo "$FAKE_INSTALLED_AFTER"; exit 0; fi
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

	test("uninstalls the overlay's plugins from the top-level array current Claude Code prints", async () => {
		runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"]);

		const callLog = join(work, "claude-calls.log");
		const r = runInstaller(["--remove", "test-overlay"], {
			FAKE_INSTALLED: JSON.stringify([
				{ id: "demo-plugin@test-overlay", scope: "user", version: "1.0.0" },
				{ id: "create-prd@infinum-ai", scope: "user", version: "1.0.1" },
			]),
			FAKE_LOG: callLog,
		});
		assert.equal(r.status, 0, r.stderr);

		const calls = await readFile(callLog, "utf8");
		assert.match(calls, /plugin uninstall demo-plugin@test-overlay -y/, "uninstalled the overlay's plugin");
		assert.doesNotMatch(calls, /uninstall create-prd@infinum-ai/, "did NOT touch base plugins");
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

describe("re-run updates installed plugins", () => {
	const installed = [
		{ id: "demo-plugin@test-overlay", scope: "user", version: "1.0.0" },
		{ id: "create-prd@infinum-ai", scope: "user", version: "1.0.1" },
		{ id: "other-plugin@someone-else", scope: "user", version: "2.0.0" },
		{ id: "team-plugin@test-overlay", scope: "project", version: "1.0.0" },
	];

	test("refreshes each marketplace, then updates the user-scope plugins installed from it", async () => {
		const callLog = join(work, "claude-calls.log");
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_INSTALLED: JSON.stringify(installed),
			FAKE_LOG: callLog,
		});
		assert.equal(r.status, 0, r.stderr);

		const calls = await readFile(callLog, "utf8");
		for (const name of ["test-overlay", "infinum-ai"]) {
			assert.match(calls, new RegExp(`plugin marketplace update ${name}\\n`), `refreshed ${name}`);
		}
		assert.match(calls, /plugin update demo-plugin@test-overlay\n/, "updated the overlay plugin");
		assert.match(calls, /plugin update create-prd@infinum-ai\n/, "updated the base plugin");
		assert.ok(
			calls.indexOf("plugin marketplace update test-overlay") <
				calls.indexOf("plugin update demo-plugin@test-overlay"),
			"refreshes the marketplace before updating its plugins",
		);
		assert.doesNotMatch(calls, /plugin update other-plugin@someone-else/, "leaves other marketplaces alone");
		assert.doesNotMatch(calls, /plugin update team-plugin@test-overlay/, "leaves project-scope installs alone");
		assert.doesNotMatch(calls, /plugin (install|enable) demo-plugin/, "installs and enables nothing");
	});

	test("reports what changed and asks for a restart", async () => {
		const after = installed.map((p) =>
			p.id === "demo-plugin@test-overlay" ? { ...p, version: "1.1.0" } : p,
		);
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_INSTALLED: JSON.stringify(installed),
			FAKE_INSTALLED_AFTER: JSON.stringify(after),
			FAKE_UPDATE_ID: "demo-plugin@test-overlay",
			FAKE_UPDATED_FLAG: join(work, "updated.flag"),
		});
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /infinum-ai: 0 updated, 1 already up to date/);
		assert.match(r.stdout, /test-overlay: 1 updated, 0 already up to date/);
		assert.match(r.stdout, /demo-plugin@test-overlay {2}1\.0\.0 → 1\.1\.0/);
		assert.match(r.stdout, /Restart Claude Code to load the updated plugins/);
	});

	test("no restart hint when nothing changed", async () => {
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_INSTALLED: JSON.stringify(installed),
		});
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /test-overlay: 0 updated, 1 already up to date/);
		assert.doesNotMatch(r.stdout, /Restart Claude Code/);
	});

	test("a marketplace that can't be refreshed is skipped, and the run still succeeds", async () => {
		const callLog = join(work, "claude-calls.log");
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_INSTALLED: JSON.stringify(installed),
			FAKE_LOG: callLog,
			FAKE_FAIL: "plugin marketplace update test-overlay",
		});
		assert.equal(r.status, 0, r.stderr);
		assert.ok(existsSync(demoRule()), "rules still installed");

		const calls = await readFile(callLog, "utf8");
		assert.doesNotMatch(calls, /plugin update demo-plugin@test-overlay/, "no update against a stale copy");
		assert.match(calls, /plugin update create-prd@infinum-ai\n/, "the other marketplace still updates");
		assert.match(r.stdout, /Could not refresh marketplace test-overlay/);
	});

	test("a plugin that fails to update is reported, and the run still succeeds", async () => {
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_INSTALLED: JSON.stringify(installed),
			FAKE_FAIL: "plugin update demo-plugin@test-overlay",
		});
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /test-overlay: 0 updated, 0 already up to date, 1 failed/);
		assert.match(r.stdout, /Could not update demo-plugin@test-overlay/);
	});

	test("nothing installed: no marketplace refresh", async () => {
		const callLog = join(work, "claude-calls.log");
		const r = runInstaller(["--extend", overlayDir, "--bundles", "demo", "--plugins", "none"], {
			FAKE_LOG: callLog,
		});
		assert.equal(r.status, 0, r.stderr);
		const calls = await readFile(callLog, "utf8");
		assert.doesNotMatch(calls, /plugin marketplace update/);
		assert.doesNotMatch(calls, /plugin update/);
	});
});
