#!/usr/bin/env node
// =============================================================================
// stack-essentials — SessionStart hook
//
// Notifies the user when any installed source (the public base repo, or
// a private overlay added via `--extend <owner/repo>`) has advanced past their
// last installer run. The notification is all this hook does; re-running the
// installer is how the update is picked up. Silent when up-to-date or offline.
//
// The hook is GENERIC: it reads whatever sources the local manifest lists and
// never hardcodes a private repo name — so no private identifier lives in this
// (public) plugin. Only repo-name sources are update-checked; local-path
// overlays have no remote to compare against.
//
// Mechanism:
//   1. Read ~/.claude/<config dir>/.manifest.json. v2 manifests carry a `sources`
//      map ({ <marketplace>: { upstream, upstreamSha } }); each source with a
//      non-null `upstream` is a target. Old v1 manifests fall back to the flat
//      `rulesUpstreamSha` (public base only).
//   2. Per target, get the latest HEAD sha of `main` (24h cache, else
//      `git ls-remote https://github.com/<upstream>`).
//   3. If any target's latest sha differs from its recorded baseline, print a
//      banner naming the stale source(s) and the exact re-run command.
//
// Bail-out paths are all silent (env opt-out, missing/malformed manifest, any
// network/parse failure — the cache timestamp still advances so we don't
// hammer GitHub when offline).
// =============================================================================

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LS_REMOTE_TIMEOUT_MS = 1500;
const TARGET_REF = "refs/heads/main";
// ── BRAND (keep in sync with bin/lib/brand.js) ──────────────────────────────
// This hook ships as an installed plugin and can't import bin/lib/brand.js at
// runtime, so it carries its own copy of the identity tokens. When adopting the
// harness for a new org, update these to match brand.js.
const BASE_ID = "infinum-ai"; // marketplace name — brand.js MARKETPLACE_NAME
const BASE_UPSTREAM = "infinum/ai"; // owner/repo — brand.js REPOSITORY_NAME
const CONFIG_DIR_NAME = "infinum"; // ~/.claude/<dir> — brand.js CONFIG_DIR_NAME
const SKIP_UPDATE_ENV = "INFINUM_STACK_SKIP_UPDATE_CHECK"; // brand.js SKIP_UPDATE_ENV

// ---- pure logic (unit-tested in test/update-check.test.js) ---------------

// Gather the repos to check from a manifest. v2 → one target per source with a
// non-null `upstream` (local-path overlays have null and are skipped). v1 →
// the flat `rulesUpstreamSha` maps to the public base only.
export function gatherUpstreamTargets(manifest) {
	if (manifest?.sources && typeof manifest.sources === "object") {
		return Object.entries(manifest.sources)
			.filter(([, e]) => typeof e?.upstream === "string" && e.upstream)
			.map(([id, e]) => ({
				id,
				upstream: e.upstream,
				baseline: typeof e.upstreamSha === "string" ? e.upstreamSha : null,
			}));
	}
	if (typeof manifest?.rulesUpstreamSha === "string") {
		return [{ id: BASE_ID, upstream: BASE_UPSTREAM, baseline: manifest.rulesUpstreamSha }];
	}
	return [];
}

// A target is stale when we have both a recorded baseline and a fetched latest
// sha and they differ.
export function selectStaleTargets(targets, latestByUpstream) {
	return targets.filter((t) => {
		const latest = latestByUpstream[t.upstream];
		return latest && t.baseline && latest !== t.baseline;
	});
}

// One actionable re-run command covering all stale sources (base re-run plus a
// --extend for each stale overlay).
export function buildBanner(staleTargets) {
	if (!staleTargets.length) return null;
	const names = staleTargets.map((t) => t.id).join(", ");
	const extendArgs = staleTargets
		.filter((t) => t.id !== BASE_ID)
		.map((t) => `--extend ${t.upstream}`)
		.join(" ");
	const cmd = `pnpm dlx github:${BASE_UPSTREAM}${extendArgs ? ` ${extendArgs}` : ""}`;
	return `[${BASE_UPSTREAM}] A newer version is available for: ${names}. Re-run to apply:\n  ${cmd}`;
}

// ---- IO ------------------------------------------------------------------

function getClaudeDir() {
	return process.env.CLAUDE_CONFIG_DIR
		? resolve(process.env.CLAUDE_CONFIG_DIR)
		: join(homedir(), ".claude");
}

async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

async function writeJson(path, value) {
	try {
		await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
	} catch {
		// Cache write failure is non-fatal — worst case we re-fetch next session.
	}
}

async function fetchLatestSha(upstream) {
	try {
		const { stdout } = await execFileAsync(
			"git",
			["ls-remote", "--exit-code", `https://github.com/${upstream}`, TARGET_REF],
			{ timeout: LS_REMOTE_TIMEOUT_MS, encoding: "utf8" },
		);
		const sha = stdout.split(/\s+/, 1)[0];
		return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
	} catch {
		return null;
	}
}

// A SessionStart hook surfaces a message to the user via a `systemMessage`
// field on stdout (plain stdout/stderr is unseen by the user).
function printBanner(message) {
	process.stdout.write(
		`${JSON.stringify({
			systemMessage: message,
			hookSpecificOutput: { hookEventName: "SessionStart" },
		})}\n`,
	);
}

async function main() {
	if (process.env[SKIP_UPDATE_ENV] === "1") return;

	const claudeDir = getClaudeDir();
	const manifestPath = join(claudeDir, CONFIG_DIR_NAME, ".manifest.json");
	const cachePath = join(claudeDir, CONFIG_DIR_NAME, ".update-check.json");

	const targets = gatherUpstreamTargets(await readJson(manifestPath));
	if (targets.length === 0) return;

	const cache = (await readJson(cachePath)) ?? {};
	const fresh = Date.now() - (typeof cache.lastCheckedAt === "number" ? cache.lastCheckedAt : 0) < CACHE_TTL_MS;

	let latestByUpstream;
	if (fresh && cache.latest && typeof cache.latest === "object") {
		latestByUpstream = cache.latest;
	} else {
		latestByUpstream = {};
		const upstreams = [...new Set(targets.map((t) => t.upstream))];
		for (const upstream of upstreams) {
			latestByUpstream[upstream] =
				(await fetchLatestSha(upstream)) ?? cache.latest?.[upstream] ?? null;
		}
		await writeJson(cachePath, { lastCheckedAt: Date.now(), latest: latestByUpstream });
	}

	const banner = buildBanner(selectStaleTargets(targets, latestByUpstream));
	if (banner) printBanner(banner);
}

// Only run when invoked as the hook — not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(() => {
		// Never block session start.
	});
}
