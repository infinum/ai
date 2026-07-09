#!/usr/bin/env node
// =============================================================================
// Claude Code installer — org/repo identity lives in bin/lib/brand.js
//
// What this does:
//   1. Adds the base marketplace (the "base" source), plus any private
//      extension marketplaces passed via --extend (or remembered from a prior run)
//   2. Installs the house rules into ~/.claude/<config dir>/   (we own this dir)
//   3. Selects opt-in rule bundles in <source>/rules/<bundle>/
//   4. Installs marketplace plugins (per source)
//   5. For installed plugins that opt in, mirrors their .mcp.json into
//      Claude Desktop / Gemini CLI / Cursor configs (cross-platform MCP)
//   6. Appends ONE @import line to ~/.claude/CLAUDE.md        (idempotent)
//
// Flags (run `--help` for the generated list of bundles/plugins):
//   --help, -h          Print capabilities + available rules/bundles/plugins.
//   --bundles <list>    Comma-separated bundle names, or `all` / `none`.
//   --plugins <list>    Comma-separated plugin names, or `all` / `none`.
//   --extend <repo|path> Layer an extra marketplace (private or public) on top. Repeatable.
//                        Value is a GitHub owner/repo or a local checkout path.
//                        Remembered across runs (apt-style); `--extend none`
//                        clears the remembered set (base-only).
//   --local, -l         Point the base marketplace at this checkout (dev only).
//
// The manifest (~/.claude/<config dir>/.manifest.json) records only installer-owned
// state — rules/bundles we wrote, the cross-platform MCP mirror entries, and
// per-source bookkeeping. It never tracks which plugins are installed (that's
// Claude Code's state, read live when needed).
//
// Re-running is safe — nothing user-owned gets stomped.
// =============================================================================

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	cancel,
	intro,
	isCancel,
	log,
	multiselect,
	note,
	outro,
	spinner,
} from "@clack/prompts";

import {
	installBundle,
	listRuleBundles,
	removeBundle,
} from "./lib/bundles.js";
import { registerPluginMcp, unregisterPluginMcp } from "./lib/mcp.js";
import {
	CONFIG_DIR_NAME,
	DISPLAY_NAME,
	GITHUB_REPO,
	INSTALL_CMD,
	MARKETPLACE_NAME,
	ORG_NAME,
} from "./lib/brand.js";
import { classifyExtendToken, resolveExtendSet, upcastManifest } from "./lib/sources.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR
	? resolve(process.env.CLAUDE_CONFIG_DIR)
	: join(homedir(), ".claude");
const CONFIG_DIR = join(CLAUDE_DIR, CONFIG_DIR_NAME);
const MANIFEST_PATH = join(CONFIG_DIR, ".manifest.json");
const UPDATE_CHECK_PATH = join(CONFIG_DIR, ".update-check.json");
const USER_CLAUDE_MD = join(CLAUDE_DIR, "CLAUDE.md");
const INDEX_IMPORT_PATH = join(CONFIG_DIR, "index.md");
const IMPORT_LINE = `@${INDEX_IMPORT_PATH}  # managed by ${GITHUB_REPO}`;
const BASE_MARKETPLACE_NAME = MARKETPLACE_NAME;
const BASE_UPSTREAM = GITHUB_REPO;

// Plugins installed unconditionally — they ship cross-cutting plumbing
// (e.g. the stale-rules notification hook) that every user should get
// regardless of TTY availability or multiselect choice. Base source only.
const AUTO_INSTALL_PLUGINS = new Set(["stack-essentials"]);

// Parse CLI flags once. `--bundles`/`--plugins` accept either `--flag value`
// or `--flag=value`; the value is a comma-separated list or `all`/`none`.
// `--extend` is repeatable and accumulates into an array (one value each).
function parseArgs(args) {
	const flags = {
		help: false,
		local: false,
		bundles: undefined,
		plugins: undefined,
		extend: [],
		remove: [],
	};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--help" || a === "-h") flags.help = true;
		else if (a === "--local" || a === "-l") flags.local = true;
		else if (a === "--bundles" || a === "--plugins") {
			const key = a.slice(2);
			const next = args[i + 1];
			if (next === undefined || next.startsWith("-")) {
				flags[key] = "none";
			} else {
				flags[key] = next;
				i++;
			}
		} else if (a.startsWith("--bundles=")) {
			flags.bundles = a.slice("--bundles=".length);
		} else if (a.startsWith("--plugins=")) {
			flags.plugins = a.slice("--plugins=".length);
		} else if (a === "--extend") {
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("-")) {
				flags.extend.push(next);
				i++;
			}
		} else if (a.startsWith("--extend=")) {
			flags.extend.push(a.slice("--extend=".length));
		} else if (a === "--remove") {
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("-")) {
				flags.remove.push(next);
				i++;
			}
		} else if (a.startsWith("--remove=")) {
			flags.remove.push(a.slice("--remove=".length));
		}
	}
	return flags;
}

const CLI = parseArgs(process.argv.slice(2));
const LOCAL_MODE = CLI.local;

// Resolve a `--bundles`/`--plugins` flag value against what's available.
//   undefined          -> { mode: "unset" }   (caller falls back to prompts)
//   "all"              -> { mode: "all" }
//   "none" / ""        -> { mode: "none" }
//   "a,b,c"            -> { mode: "list", names: [...known], unknown: [...] }
function resolveSelection(raw, available) {
	if (raw === undefined) return { mode: "unset" };
	const value = String(raw).trim();
	const lower = value.toLowerCase();
	if (value === "" || lower === "none") return { mode: "none" };
	if (lower === "all") return { mode: "all" };
	const requested = value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const availableNames = new Set(available.map((a) => a.name));
	const names = [];
	const unknown = [];
	for (const name of requested) {
		if (availableNames.has(name)) names.push(name);
		else unknown.push(name);
	}
	return { mode: "list", names, unknown };
}

const WHOAMI_STUB = `# Who you're working with

> Replace this with your name and role so Claude can calibrate
> its responses. Example:
>
> "Senior backend engineer at ${ORG_NAME}, focused on payments.
> Comfortable with Go and Postgres; new to the iOS codebase."
`;

const ALL = "__all__";

function runClaude(args) {
	const result = spawnSync("claude", args, {
		stdio: ["ignore", "pipe", "pipe"],
		encoding: "utf8",
	});
	if (result.error) {
		return { ok: false, stdout: "", stderr: result.error.message };
	}
	return {
		ok: result.status === 0,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

function isDirSync(p) {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

async function readMarketplaceName(repoRoot) {
	const mp = join(repoRoot, ".claude-plugin", "marketplace.json");
	if (!existsSync(mp)) return null;
	try {
		const json = JSON.parse(await readFile(mp, "utf8"));
		return typeof json.name === "string" && json.name ? json.name : null;
	} catch {
		return null;
	}
}

// ---- Source descriptors --------------------------------------------------
// A "source" is a marketplace the installer pulls from: the base repo
// plus zero or more private overlays. Each carries everything the per-source
// pipeline needs.

function makeBaseSource() {
	return {
		id: BASE_MARKETPLACE_NAME,
		isBase: true,
		repoRoot: REPO_ROOT,
		rulesDir: join(REPO_ROOT, "rules"),
		marketplaceName: BASE_MARKETPLACE_NAME,
		marketplaceSource: LOCAL_MODE ? REPO_ROOT : BASE_UPSTREAM,
		upstream: BASE_UPSTREAM,
		extend: undefined,
	};
}

// Resolve one --extend token into a source descriptor, or a skip reason.
// Local paths are read straight from disk. Repo-name overlays are not wired
// yet (they need a shallow clone for their rules) — they're skipped for now.
async function buildExtendSource(token) {
	const cls = classifyExtendToken(token, isDirSync);
	if (cls.kind === "repo") {
		// Shallow-clone the overlay repo to a temp dir to read its rules +
		// marketplace name. Plugins still install from the registered (by-name)
		// marketplace so they track GitHub; the clone is only for the rules tree.
		const tmp = await mkdtemp(join(tmpdir(), `${CONFIG_DIR_NAME}-extend-`));
		const clone = spawnSync(
			"git",
			["clone", "--depth", "1", `https://github.com/${token}`, tmp],
			{ encoding: "utf8", timeout: 60000 },
		);
		if (clone.status !== 0) {
			await rm(tmp, { recursive: true, force: true });
			return { skip: true, token, reason: `clone failed (no access or network?): ${token}` };
		}
		const name = await readMarketplaceName(tmp);
		if (!name) {
			await rm(tmp, { recursive: true, force: true });
			return { skip: true, token, reason: `no .claude-plugin/marketplace.json in ${token}` };
		}
		return {
			source: {
				id: name,
				isBase: false,
				repoRoot: tmp,
				rulesDir: join(tmp, "rules"),
				marketplaceName: name,
				marketplaceSource: token,
				upstream: token,
				extend: token,
				tmpDir: tmp,
			},
		};
	}
	if (cls.kind === "invalid") {
		return { skip: true, token, reason: "not a local path or owner/repo" };
	}
	const repoRoot = resolve(token.replace(/^~(?=$|\/)/, homedir()));
	if (!isDirSync(repoRoot)) {
		return { skip: true, token, reason: `path not found: ${repoRoot}` };
	}
	const name = await readMarketplaceName(repoRoot);
	if (!name) {
		return {
			skip: true,
			token,
			reason: `no .claude-plugin/marketplace.json in ${repoRoot}`,
		};
	}
	return {
		source: {
			id: name,
			isBase: false,
			repoRoot,
			rulesDir: join(repoRoot, "rules"),
			marketplaceName: name,
			marketplaceSource: repoRoot,
			upstream: null,
			extend: token,
		},
	};
}

async function listRuleFiles(rulesDir) {
	if (!existsSync(rulesDir)) return [];
	const entries = await readdir(rulesDir);
	return entries
		.filter((name) => name.endsWith(".md") && name !== "README.md")
		.sort();
}

async function listPlugins(repoRoot) {
	const pluginsDir = join(repoRoot, "plugins");
	if (!existsSync(pluginsDir)) return [];
	const entries = await readdir(pluginsDir);
	const plugins = [];
	for (const name of entries.sort()) {
		const dir = join(pluginsDir, name);
		const s = await stat(dir).catch(() => null);
		if (!s?.isDirectory()) continue;
		const manifest = join(dir, ".claude-plugin", "plugin.json");
		let description = "";
		if (existsSync(manifest)) {
			try {
				const json = JSON.parse(await readFile(manifest, "utf8"));
				description = (json.description ?? "").trim();
			} catch {
				// Ignore malformed manifests — plugin still appears without a hint.
			}
		}
		const hasMcpJson = existsSync(join(dir, ".mcp.json"));
		plugins.push({ name, description, hasMcpJson });
	}
	return plugins;
}

async function preflight() {
	const r = runClaude(["--version"]);
	if (!r.ok) {
		log.error(
			"Claude Code CLI not found. Install: https://docs.anthropic.com/claude-code/install",
		);
		outro("Setup aborted.");
		process.exit(1);
	}
	const version = r.stdout.trim().split("\n")[0] || "unknown";
	log.success(`Claude Code CLI detected: ${version}`);
}

// Parse `claude plugin marketplace list` for the source line of a given name.
function existingMarketplaceSource(marketplaceName) {
	const list = runClaude(["plugin", "marketplace", "list"]);
	if (!list.ok) return null;
	const lines = list.stdout.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (trimmed.startsWith("❯ ") && trimmed.slice(2).trim() === marketplaceName) {
			for (let j = i + 1; j < lines.length; j++) {
				const next = lines[j].trim();
				if (next.length > 0) return next;
			}
			return "";
		}
	}
	return null;
}

function sourceMatchesIntent(source, sourceLine) {
	if (!sourceLine) return false;
	// Local path sources register as "Source: Directory (/abs/path)".
	if (LOCAL_MODE && source.isBase) {
		return sourceLine.includes(`Directory (${source.marketplaceSource})`);
	}
	if (source.marketplaceSource.startsWith("/")) {
		return sourceLine.includes(`Directory (${source.marketplaceSource})`);
	}
	// GitHub sources register as "Source: GitHub (owner/repo)".
	return sourceLine.includes(`(${source.marketplaceSource})`);
}

function addMarketplace(source) {
	const s = spinner();
	const target = source.marketplaceSource;

	const existing = existingMarketplaceSource(source.marketplaceName);
	if (existing !== null) {
		if (sourceMatchesIntent(source, existing)) {
			s.start(`Verifying marketplace: ${source.marketplaceName}`);
			s.stop(`Marketplace already added: ${source.marketplaceName} (${target})`);
			return;
		}
		s.stop(
			`Marketplace ${source.marketplaceName} is registered but pointing at:\n  ${existing}\nNot what this run wants (${target}).`,
			1,
		);
		log.warn(
			`Remove it first, then re-run:\n  claude plugin marketplace remove ${source.marketplaceName}`,
		);
		return;
	}

	s.start(`Adding marketplace: ${source.marketplaceName} (${target})`);
	const add = runClaude(["plugin", "marketplace", "add", target]);
	if (add.ok) {
		s.stop(`Marketplace added: ${source.marketplaceName}`);
		return;
	}
	s.stop(`Could not add marketplace: ${source.marketplaceName}`, 1);
	log.warn(`Add it manually: claude plugin marketplace add ${target}`);
	if (add.stderr) log.warn(add.stderr.trim().split("\n").slice(0, 4).join("\n"));
}

function sha256(buffer) {
	return createHash("sha256").update(buffer).digest("hex");
}

// Best-effort HEAD SHA of a GitHub repo's main via `git ls-remote`. "" on any
// failure. Only repo-name sources have an upstream to track.
function fetchLatestRulesSha(upstream) {
	if (!upstream) return "";
	const child = spawnSync(
		"git",
		["ls-remote", "--exit-code", `https://github.com/${upstream}`, "refs/heads/main"],
		{ encoding: "utf8", timeout: 1500 },
	);
	if (child.status !== 0 || !child.stdout) return "";
	const sha = child.stdout.split(/\s+/, 1)[0];
	return /^[0-9a-f]{40}$/.test(sha) ? sha : "";
}

function fetchRulesChangelog(prevInstalledAt) {
	if (!prevInstalledAt) return [];
	let child;
	try {
		child = spawnSync(
			"gh",
			[
				"api",
				`repos/${BASE_UPSTREAM}/commits`,
				"-f",
				"sha=main",
				"-f",
				"path=rules",
				"-f",
				`since=${prevInstalledAt}`,
				"-f",
				"per_page=30",
			],
			{ encoding: "utf8", timeout: 3000 },
		);
	} catch {
		return [];
	}
	if (!child || child.status !== 0 || !child.stdout) return [];
	try {
		const data = JSON.parse(child.stdout);
		if (!Array.isArray(data)) return [];
		return data
			.map((c) => ({
				sha: typeof c?.sha === "string" ? c.sha.slice(0, 7) : "",
				subject:
					typeof c?.commit?.message === "string"
						? c.commit.message.split("\n")[0]
						: "",
			}))
			.filter((c) => c.sha && c.subject);
	} catch {
		return [];
	}
}

async function readManifest() {
	if (!existsSync(MANIFEST_PATH)) return null;
	try {
		return upcastManifest(
			JSON.parse(await readFile(MANIFEST_PATH, "utf8")),
			{ baseId: BASE_MARKETPLACE_NAME, baseUpstream: BASE_UPSTREAM },
		);
	} catch {
		return null;
	}
}

// Copy one source's top-level rules into ~/.claude/<config dir>/. Cleanup is scoped
// to THIS source's previously-recorded rules — so a base-only run never
// touches an overlay's rules (and vice-versa). Returns { ruleFiles, ruleHashes }.
async function installTopLevelRules(source, prevSource) {
	await mkdir(CONFIG_DIR, { recursive: true });

	const ruleFiles = await listRuleFiles(source.rulesDir);
	const ruleHashes = {};
	for (const name of ruleFiles) {
		const buf = await readFile(join(source.rulesDir, name));
		await writeFile(join(CONFIG_DIR, name), buf);
		ruleHashes[name] = sha256(buf);
	}

	for (const name of Object.keys(prevSource?.rules ?? {})) {
		if (!(name in ruleHashes)) {
			const stalePath = join(CONFIG_DIR, name);
			if (existsSync(stalePath)) await unlink(stalePath);
		}
	}

	if (source.isBase) {
		const whoamiPath = join(CONFIG_DIR, "whoami.md");
		if (!existsSync(whoamiPath)) {
			await writeFile(whoamiPath, WHOAMI_STUB);
			log.success("Created whoami.md (edit it to introduce yourself)");
		}
	}

	return { ruleFiles, ruleHashes };
}

// Choose bundle names once, across the union of all sources' bundles. Honors
// --bundles (list/all/none), else prompts in a TTY, else keeps the prior
// selection. Returns the selected names.
async function selectBundles(allBundles, prevSelected, bundlesFlag) {
	const sel = resolveSelection(bundlesFlag, allBundles);
	if (sel.mode === "all") return allBundles.map((b) => b.name);
	if (sel.mode === "none") {
		log.info("Rule bundles (--bundles): (none)");
		return [];
	}
	if (sel.mode === "list") {
		if (sel.unknown?.length) {
			log.warn(
				`Unknown bundle(s) ignored: ${sel.unknown.join(", ")}. Available: ${
					allBundles.map((b) => b.name).join(", ") || "(none)"
				}`,
			);
		}
		log.info(`Rule bundles (--bundles): ${sel.names.join(", ") || "(none)"}`);
		return sel.names;
	}
	// unset → prompt (TTY) or keep previous
	if (!process.stdin.isTTY) {
		if (prevSelected.length > 0) {
			log.info(`Keeping previously selected bundle(s): ${prevSelected.join(", ")}`);
		}
		return prevSelected;
	}
	if (allBundles.length === 0) return [];
	const prevSet = new Set(prevSelected);
	const result = await multiselect({
		message: "Which rule bundles to install? (Space to toggle, Enter to confirm)",
		options: [
			{ value: ALL, label: "Install all bundles", hint: `${allBundles.length} total` },
			...allBundles.map((b) => ({ value: b.name, label: b.name, hint: b.description || undefined })),
		],
		initialValues: allBundles.filter((b) => prevSet.has(b.name)).map((b) => b.name),
		required: false,
	});
	if (isCancel(result)) return prevSelected;
	return result.includes(ALL) ? allBundles.map((b) => b.name) : result.filter((v) => v !== ALL);
}

// Install the selected bundles per source, and remove a source's deselected
// bundles. Returns { <sourceId>: { <bundle>: { <file>: sha } } }.
async function installBundlesPerSource(sources, prevManifest, selectedNames) {
	const out = {};
	for (const source of sources) {
		const bundles = await listRuleBundles(source.rulesDir);
		const prevBundles = prevManifest?.sources?.[source.id]?.bundles ?? {};
		const installed = {};
		for (const name of selectedNames) {
			const bundle = bundles.find((b) => b.name === name);
			if (!bundle) continue; // this source doesn't ship that bundle
			installed[name] = await installBundle(bundle.dir, join(CONFIG_DIR, name));
		}
		for (const name of Object.keys(prevBundles)) {
			if (!(name in installed)) {
				await removeBundle(CONFIG_DIR, name, prevBundles[name]);
			}
		}
		out[source.id] = installed;
		const count = Object.keys(installed).length;
		if (count > 0) {
			log.success(
				`[${source.id}] installed bundle(s): ${Object.keys(installed).join(", ")}`,
			);
		}
	}
	return out;
}

// Remove the rules + bundles of sources that were remembered before but are no
// longer wanted (e.g. cleared via `--extend none`). Their files are unlinked
// and they're omitted from the new manifest. Carried-forward (skipped) sources
// are left alone.
async function cleanupDroppedSources(prevManifest, keepIds) {
	for (const [id, entry] of Object.entries(prevManifest?.sources ?? {})) {
		if (keepIds.has(id)) continue;
		for (const name of Object.keys(entry.rules ?? {})) {
			const p = join(CONFIG_DIR, name);
			if (existsSync(p)) await unlink(p);
		}
		for (const bundle of Object.keys(entry.bundles ?? {})) {
			await removeBundle(CONFIG_DIR, bundle, entry.bundles[bundle]);
		}
		log.info(`Dropped source: ${id} (rules removed)`);
	}
}

// Rebuild index.md from a sources map: whoami + every source's rule files +
// bundle files. Shared by the install pipeline and --remove.
async function writeIndexFromSources(sourcesMap) {
	const indexLines = [`@${join(CONFIG_DIR, "whoami.md")}`];
	for (const entry of Object.values(sourcesMap)) {
		for (const name of Object.keys(entry.rules ?? {}).sort()) {
			indexLines.push(`@${join(CONFIG_DIR, name)}`);
		}
	}
	for (const entry of Object.values(sourcesMap)) {
		for (const bundle of Object.keys(entry.bundles ?? {}).sort()) {
			for (const file of Object.keys(entry.bundles[bundle]).sort()) {
				indexLines.push(`@${join(CONFIG_DIR, bundle, file)}`);
			}
		}
	}
	await writeFile(join(CONFIG_DIR, "index.md"), `${indexLines.join("\n")}\n`);
	log.success("Regenerated index.md");
}

async function writeIndexAndManifest({
	sources,
	ruleResults,
	bundleResults,
	carriedSources,
	prevManifest,
}) {
	// Build sources map: active sources (fresh) + carried (skipped) sources.
	const sourcesOut = {};
	for (const source of sources) {
		sourcesOut[source.id] = {
			rules: ruleResults[source.id].ruleHashes,
			bundles: bundleResults[source.id],
			...(source.isBase ? {} : { extend: source.extend }),
			upstream: source.upstream,
			upstreamSha: source.upstream ? fetchLatestRulesSha(source.upstream) : null,
		};
	}
	for (const [id, entry] of Object.entries(carriedSources)) {
		sourcesOut[id] = entry;
	}

	await writeIndexFromSources(sourcesOut);

	const mcpRegistrations = prevManifest?.mcpRegistrations ?? {};
	const baseSha = sourcesOut[BASE_MARKETPLACE_NAME]?.upstreamSha ?? null;

	const currentManifest = {
		version: 2,
		updatedAt: new Date().toISOString(),
		whoamiStubHash: sha256(Buffer.from(WHOAMI_STUB)),
		sources: sourcesOut,
		mcpRegistrations,
		// Mirror for an OLD stack-essentials hook that reads the flat key.
		rulesUpstreamSha: baseSha,
	};
	await writeFile(MANIFEST_PATH, `${JSON.stringify(currentManifest, null, 2)}\n`);

	if (baseSha) {
		await writeFile(
			UPDATE_CHECK_PATH,
			`${JSON.stringify({ lastCheckedAt: Date.now(), latestSha: baseSha }, null, 2)}\n`,
		);
	}

	return currentManifest;
}

// Aggregate rules/bundles across all sources of a manifest into flat maps, for
// the "changes since last setup" notification.
function aggregateArtifacts(manifest) {
	const rules = {};
	const bundles = {};
	for (const entry of Object.values(manifest?.sources ?? {})) {
		Object.assign(rules, entry.rules ?? {});
		for (const [b, files] of Object.entries(entry.bundles ?? {})) bundles[b] = files;
	}
	return { rules, bundles };
}

function showRuleChangeNotifications(prevManifest, currentManifest) {
	if (!prevManifest) return;
	const prev = aggregateArtifacts(prevManifest);
	const cur = aggregateArtifacts(currentManifest);

	const lines = [];
	for (const [name, hash] of Object.entries(cur.rules)) {
		if (!(name in prev.rules)) lines.push(`✦ New rule       ${name}`);
		else if (prev.rules[name] !== hash) lines.push(`⟳ Updated rule   ${name}`);
	}
	for (const name of Object.keys(prev.rules)) {
		if (!(name in cur.rules)) lines.push(`✕ Removed rule   ${name}`);
	}
	for (const name of Object.keys(cur.bundles)) {
		if (!(name in prev.bundles)) lines.push(`✦ New bundle     ${name}`);
	}
	for (const name of Object.keys(prev.bundles)) {
		if (!(name in cur.bundles)) lines.push(`✕ Removed bundle ${name}`);
	}

	const commits = fetchRulesChangelog(prevManifest.updatedAt);
	const shown = commits.slice(0, 8);
	const commitLines = shown.map((c) => `  ${c.sha}  ${c.subject}`);
	if (commits.length > shown.length) commitLines.push(`  …and ${commits.length - shown.length} more`);

	if (lines.length === 0 && commitLines.length === 0) return;
	const body = [];
	if (lines.length > 0) body.push(lines.join("\n"));
	if (commitLines.length > 0) {
		body.push(`Upstream commits touching rules/:\n${commitLines.join("\n")}`);
	}
	note(body.join("\n\n"), "Changes since your last setup");
}

async function linkClaudeMd() {
	if (!existsSync(USER_CLAUDE_MD)) {
		await writeFile(USER_CLAUDE_MD, "");
	}
	const current = await readFile(USER_CLAUDE_MD, "utf8");
	if (current.includes(IMPORT_LINE)) {
		log.success(`Import line already present in ${USER_CLAUDE_MD}`);
		return;
	}
	const sep = current.length === 0 || current.endsWith("\n") ? "" : "\n";
	await writeFile(USER_CLAUDE_MD, `${current}${sep}\n${IMPORT_LINE}\n`);
	log.success(`Appended one line to ${USER_CLAUDE_MD}`);
}

async function installSinglePlugin(source, plugin, currentManifest) {
	const s = spinner();
	s.start(`Installing ${plugin.name}@${source.marketplaceName}`);
	const r = runClaude([
		"plugin",
		"install",
		`${plugin.name}@${source.marketplaceName}`,
	]);
	if (r.ok) {
		s.stop(`Installed ${plugin.name}@${source.marketplaceName}`);
	} else {
		s.stop(`Failed to install ${plugin.name}@${source.marketplaceName}`, 1);
		log.warn(
			`Try manually: claude plugin install ${plugin.name}@${source.marketplaceName}`,
		);
		return;
	}
	if (plugin.hasMcpJson) {
		await registerMcpForPlugin(source, plugin.name, currentManifest);
	}
}

async function installAutoPlugins(baseSource, currentManifest) {
	const plugins = await listPlugins(baseSource.repoRoot);
	for (const plugin of plugins.filter((p) => AUTO_INSTALL_PLUGINS.has(p.name))) {
		await installSinglePlugin(baseSource, plugin, currentManifest);
	}
}

async function promptPluginMultiselect(source, plugins) {
	const result = await multiselect({
		message: `Which plugins to install from ${source.marketplaceName}? (Space to toggle, Enter to confirm)`,
		options: [
			{ value: ALL, label: "Install all", hint: `${plugins.length} total` },
			...plugins.map((p) => ({ value: p.name, label: p.name, hint: p.description || undefined })),
		],
		required: false,
	});
	if (isCancel(result)) return null;
	return result.includes(ALL) ? plugins.map((p) => p.name) : result.filter((v) => v !== ALL);
}

async function installSelectedPlugins(source, currentManifest, pluginsFlag) {
	const plugins = (await listPlugins(source.repoRoot)).filter(
		(p) => !(source.isBase && AUTO_INSTALL_PLUGINS.has(p.name)),
	);
	if (plugins.length === 0) return;

	const sel = resolveSelection(pluginsFlag, plugins);
	let selected;
	if (sel.mode === "unset") {
		if (!process.stdin.isTTY) {
			log.info(
				`[${source.marketplaceName}] skipping plugin selection (non-interactive) — pass --plugins to choose`,
			);
			return;
		}
		selected = await promptPluginMultiselect(source, plugins);
		if (selected === null) return;
	} else if (sel.mode === "all") {
		selected = plugins.map((p) => p.name);
	} else if (sel.mode === "none") {
		selected = [];
	} else {
		selected = sel.names;
	}

	for (const name of selected) {
		const plugin = plugins.find((p) => p.name === name);
		if (plugin) await installSinglePlugin(source, plugin, currentManifest);
	}
}

async function registerMcpForPlugin(source, pluginName, currentManifest) {
	const result = await registerPluginMcp({
		marketplaceName: source.marketplaceName,
		pluginName,
		mcpRegistrations: currentManifest.mcpRegistrations,
	});
	if (!result.ok) {
		log.warn(`MCP registration skipped for ${pluginName}: ${result.reason}`);
		return;
	}
	currentManifest.mcpRegistrations[`${source.marketplaceName}/${pluginName}`] = {
		serverNames: result.serverNames,
		writtenTo: result.writtenTo,
		registeredAt: new Date().toISOString(),
	};
	await writeFile(MANIFEST_PATH, `${JSON.stringify(currentManifest, null, 2)}\n`);
	const summary = result.results
		.filter((r) => r.status !== "client-absent")
		.map((r) => `${r.client}: ${r.status}`)
		.join(", ");
	if (summary) note(`MCP ${result.serverNames.join(", ")} for ${pluginName}:\n${summary}`, "Cross-platform MCP");
}

// Remove MCP entries for plugins that were registered under an ACTIVE source's
// marketplace but no longer exist there. Registrations belonging to non-active
// marketplaces (skipped/carried sources) are left untouched.
async function cleanupStaleMcpRegistrations(currentManifest, sources) {
	const current = new Set();
	for (const source of sources) {
		for (const p of await listPlugins(source.repoRoot)) {
			current.add(`${source.marketplaceName}/${p.name}`);
		}
	}
	const activeMarketplaces = new Set(sources.map((s) => s.marketplaceName));
	const regs = currentManifest.mcpRegistrations ?? {};
	let changed = false;
	for (const key of Object.keys(regs)) {
		const mp = key.split("/")[0];
		if (!activeMarketplaces.has(mp)) continue; // not ours to reconcile this run
		if (current.has(key)) continue;
		const reg = regs[key];
		await unregisterPluginMcp({ writtenTo: reg.writtenTo, serverNames: reg.serverNames });
		delete regs[key];
		changed = true;
		log.info(`Removed stale MCP registration: ${key}`);
	}
	if (changed) {
		await writeFile(MANIFEST_PATH, `${JSON.stringify(currentManifest, null, 2)}\n`);
	}
}

// ---- --remove: tear down an extended source ------------------------------

// Claude Code's live view of installed plugins (ids are "<plugin>@<marketplace>").
// We never mirror this in the manifest — it would desync if a user installs or
// uninstalls plugins directly via /plugin.
function liveInstalledPluginIds() {
	const r = runClaude(["plugin", "list", "--json"]);
	if (!r.ok) return [];
	try {
		const j = JSON.parse(r.stdout);
		const arr = j.installed_plugins ?? j.plugins ?? [];
		return arr.map((p) => p?.id).filter((id) => typeof id === "string");
	} catch {
		return [];
	}
}

async function removeSource(id, manifest) {
	const entry = manifest.sources[id];
	const s = spinner();
	s.start(`Removing ${id}`);

	// 1. Uninstall its plugins — from the live list, not a tracked one.
	const installed = liveInstalledPluginIds().filter((pid) => pid.endsWith(`@${id}`));
	for (const pid of installed) runClaude(["plugin", "uninstall", pid, "-y"]);

	// 2. Unregister the MCP entries we mirrored for this marketplace.
	for (const key of Object.keys(manifest.mcpRegistrations ?? {})) {
		if (key.split("/")[0] !== id) continue;
		const reg = manifest.mcpRegistrations[key];
		await unregisterPluginMcp({ writtenTo: reg.writtenTo, serverNames: reg.serverNames });
		delete manifest.mcpRegistrations[key];
	}

	// 3. Remove its rules + bundles from ~/.claude/<config dir>/.
	for (const name of Object.keys(entry?.rules ?? {})) {
		const p = join(CONFIG_DIR, name);
		if (existsSync(p)) await unlink(p);
	}
	for (const bundle of Object.keys(entry?.bundles ?? {})) {
		await removeBundle(CONFIG_DIR, bundle, entry.bundles[bundle]);
	}

	// 4. Deregister the marketplace; 5. drop it from the manifest.
	runClaude(["plugin", "marketplace", "remove", id]);
	delete manifest.sources[id];

	s.stop(
		`Removed ${id} — ${installed.length} plugin(s) uninstalled, rules/bundles + marketplace cleaned`,
	);
}

async function runRemove(tokens, prevManifest) {
	if (!prevManifest?.sources) {
		log.warn("Nothing is installed yet — nothing to remove.");
		return;
	}
	const nonBase = () =>
		Object.keys(prevManifest.sources).filter((id) => id !== BASE_MARKETPLACE_NAME);

	for (const token of tokens) {
		if (token === BASE_MARKETPLACE_NAME) {
			log.warn(
				`Refusing to remove the base (${BASE_MARKETPLACE_NAME}). To fully uninstall: delete the import line from ${USER_CLAUDE_MD}, rm -rf ${CONFIG_DIR}, and run \`claude plugin marketplace remove ${BASE_MARKETPLACE_NAME}\`.`,
			);
			continue;
		}
		let matchId = prevManifest.sources[token] ? token : null;
		if (!matchId) {
			for (const id of nonBase()) {
				if (prevManifest.sources[id].extend === token) {
					matchId = id;
					break;
				}
			}
		}
		if (!matchId) {
			log.warn(
				`No extended source matches "${token}". Remembered: ${nonBase().join(", ") || "(none)"}`,
			);
			continue;
		}
		await removeSource(matchId, prevManifest);
	}

	await writeIndexFromSources(prevManifest.sources);
	prevManifest.updatedAt = new Date().toISOString();
	prevManifest.rulesUpstreamSha =
		prevManifest.sources[BASE_MARKETPLACE_NAME]?.upstreamSha ?? null;
	await writeFile(MANIFEST_PATH, `${JSON.stringify(prevManifest, null, 2)}\n`);
}

// ---- Preflight guards (abort before any mutation) ------------------------

function assertDistinctMarketplaceNames(sources) {
	const seen = new Set();
	for (const s of sources) {
		if (seen.has(s.marketplaceName)) {
			throw new Error(
				`Two sources share the marketplace name "${s.marketplaceName}". Each extended marketplace must use a distinct name (and not "${BASE_MARKETPLACE_NAME}").`,
			);
		}
		seen.add(s.marketplaceName);
	}
}

async function assertDisjointArtifacts(sources) {
	const ruleOwners = new Map();
	const bundleOwners = new Map();
	for (const s of sources) {
		for (const f of await listRuleFiles(s.rulesDir)) {
			if (ruleOwners.has(f)) {
				throw new Error(
					`Rule file "${f}" is shipped by both ${ruleOwners.get(f)} and ${s.id}. Sources must use disjoint rule filenames.`,
				);
			}
			ruleOwners.set(f, s.id);
		}
		for (const b of await listRuleBundles(s.rulesDir)) {
			if (bundleOwners.has(b.name)) {
				throw new Error(
					`Bundle "${b.name}" is shipped by both ${bundleOwners.get(b.name)} and ${s.id}. Sources must use disjoint bundle names.`,
				);
			}
			bundleOwners.set(b.name, s.id);
		}
	}
}

function printSourceList(sources, skipped) {
	const lines = sources.map((s) => {
		const where = s.isBase ? "(base)" : s.extend === s.marketplaceSource ? "(this run · local path)" : "(extended)";
		return `  • ${s.marketplaceName}  →  ${s.marketplaceSource}  ${where}`;
	});
	for (const sk of skipped) {
		lines.push(`  • (skipped) ${sk.token} — ${sk.reason}`);
	}
	note(lines.join("\n"), "Sources this run");
}

function printSummary() {
	outro(
		[
			"Done. What's next:",
			`  • Personalize: edit ${join(CONFIG_DIR, "whoami.md")}`,
			"  • Browse plugins: open Claude Code and run /plugin",
			"",
			"Updating later:",
			`  ${INSTALL_CMD}`,
			"",
			"Uninstall:",
			`  Remove "${IMPORT_LINE}" from ${USER_CLAUDE_MD}`,
			`  rm -rf ${CONFIG_DIR}`,
			`  claude plugin marketplace remove ${BASE_MARKETPLACE_NAME}`,
		].join("\n"),
	);
}

async function printHelp() {
	const base = makeBaseSource();
	const [ruleFiles, bundles, plugins] = await Promise.all([
		listRuleFiles(base.rulesDir),
		listRuleBundles(base.rulesDir),
		listPlugins(base.repoRoot),
	]);
	const optPlugins = plugins.filter((p) => !AUTO_INSTALL_PLUGINS.has(p.name));
	const fmt = (name, desc) => `  ${name}${desc ? `  — ${desc}` : ""}`;
	const out = [
		`${DISPLAY_NAME} — Claude Code installer`,
		"",
		"USAGE",
		`  ${INSTALL_CMD} [options]`,
		"  node bin/install.js [options]              # from a clone",
		"",
		"OPTIONS",
		"  -h, --help            Show this help and exit.",
		"  --bundles <list>      Rule bundles to install: names, or 'all' / 'none'.",
		"  --plugins <list>      Plugins to install: names, or 'all' / 'none'.",
		"  --extend <repo|path>  Layer an extra marketplace on top (repeatable).",
		"                        A GitHub owner/repo or a local checkout path.",
		"                        Remembered across runs; '--extend none' clears them.",
		"  --remove <repo|path|name>",
		"                        Uninstall an extended marketplace (repeatable): its",
		"                        plugins, rules, MCP entries, and marketplace.",
		"  -l, --local           Point the base marketplace at this checkout (dev).",
		"",
		"HOUSE RULES (always installed)",
		...(ruleFiles.length ? ruleFiles.map((r) => `  ${r}`) : ["  (none)"]),
		"",
		"RULE BUNDLES (opt in via --bundles)",
		...(bundles.length ? bundles.map((b) => fmt(b.name, b.description)) : ["  (none)"]),
		"",
		"PLUGINS (opt in via --plugins)",
		...(optPlugins.length ? optPlugins.map((p) => fmt(p.name, p.description)) : ["  (none)"]),
		"",
		"EXAMPLES",
		"  node bin/install.js --help                       # list everything",
		"  node bin/install.js --plugins none               # house rules only",
		"  node bin/install.js --extend <org>/<extension-repo> --bundles <bundle>",
	];
	console.log(out.join("\n"));
}

async function main() {
	if (CLI.help) {
		await printHelp();
		return;
	}

	intro(
		LOCAL_MODE
			? `${DISPLAY_NAME} — Claude Code setup (LOCAL mode: ${REPO_ROOT})`
			: `${DISPLAY_NAME} — Claude Code setup`,
	);

	const tmpDirs = [];
	try {
		await preflight();

		const prevManifest = await readManifest();

		if (CLI.remove.length > 0) {
			await runRemove(CLI.remove, prevManifest);
			outro("Removal complete.");
			return;
		}

		// Resolve the active extend set: remembered (from prior sources) ∪ this run.
		const remembered = Object.values(prevManifest?.sources ?? {})
			.filter((e) => typeof e.extend === "string")
			.map((e) => e.extend);
		const wantTokens = resolveExtendSet({ remembered, cli: CLI.extend });

		const base = makeBaseSource();
		const extendSources = [];
		const skipped = [];
		for (const token of wantTokens) {
			const r = await buildExtendSource(token);
			if (r.source) {
				extendSources.push(r.source);
				if (r.source.tmpDir) tmpDirs.push(r.source.tmpDir);
			} else {
				skipped.push({ token, reason: r.reason });
			}
		}
		const sources = [base, ...extendSources];

		assertDistinctMarketplaceNames(sources);
		await assertDisjointArtifacts(sources);

		printSourceList(sources, skipped);

		for (const source of sources) addMarketplace(source);

		// Rules per source.
		const ruleResults = {};
		for (const source of sources) {
			ruleResults[source.id] = await installTopLevelRules(
				source,
				prevManifest?.sources?.[source.id],
			);
		}

		// Bundles: one selection across the union, installed per source.
		const allBundles = [];
		const seenBundle = new Set();
		for (const source of sources) {
			for (const b of await listRuleBundles(source.rulesDir)) {
				if (!seenBundle.has(b.name)) {
					seenBundle.add(b.name);
					allBundles.push(b);
				}
			}
		}
		const prevSelected = [
			...new Set(
				Object.values(prevManifest?.sources ?? {}).flatMap((e) =>
					Object.keys(e.bundles ?? {}),
				),
			),
		];
		const selectedBundles = await selectBundles(allBundles, prevSelected, CLI.bundles);
		const bundleResults = await installBundlesPerSource(sources, prevManifest, selectedBundles);

		// Carry forward remembered-but-skipped sources; drop the rest.
		const activeIds = new Set(sources.map((s) => s.id));
		const carriedSources = {};
		const skippedTokens = new Set(skipped.map((s) => s.token));
		for (const [id, entry] of Object.entries(prevManifest?.sources ?? {})) {
			if (activeIds.has(id)) continue;
			if (typeof entry.extend === "string" && skippedTokens.has(entry.extend)) {
				carriedSources[id] = entry;
			}
		}
		const keepIds = new Set([...activeIds, ...Object.keys(carriedSources)]);
		await cleanupDroppedSources(prevManifest, keepIds);

		const currentManifest = await writeIndexAndManifest({
			sources,
			ruleResults,
			bundleResults,
			carriedSources,
			prevManifest,
		});
		showRuleChangeNotifications(prevManifest, currentManifest);

		await cleanupStaleMcpRegistrations(currentManifest, sources);
		await linkClaudeMd();
		await installAutoPlugins(base, currentManifest);
		for (const source of sources) {
			await installSelectedPlugins(source, currentManifest, CLI.plugins);
		}
		printSummary();
	} catch (err) {
		cancel(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	} finally {
		for (const d of tmpDirs) {
			await rm(d, { recursive: true, force: true }).catch(() => {});
		}
	}
}

main();
