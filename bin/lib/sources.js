// Pure logic for the multi-source ("--extend") installer.
//
// No IO lives here — callers pass an `existsDir` predicate into
// classifyExtendToken — so every function below is unit-tested in
// test/sources.test.js. The orchestration (cloning, marketplace add,
// per-source install/cleanup) stays in bin/install.js.

const BASE_ID = "infinum-ai";
const BASE_UPSTREAM = "infinum/ai";

// Upcast a manifest read from disk to the source-scoped v2 shape.
//   - null            -> null          (no prior install)
//   - v2              -> returned as-is (idempotent)
//   - v1 (flat shape) -> v2: the flat rules/bundles/rulesUpstreamSha move under
//                        sources[baseId]; a top-level `rulesUpstreamSha` mirror
//                        is kept so an OLD stack-essentials hook still works.
export function upcastManifest(
	manifest,
	{ baseId = BASE_ID, baseUpstream = BASE_UPSTREAM } = {},
) {
	if (manifest == null) return null;
	if (manifest.version === 2) return manifest;

	const {
		rules = {},
		bundles = {},
		rulesUpstreamSha = null,
		version: _v,
		...rest
	} = manifest;

	return {
		version: 2,
		...rest,
		sources: {
			[baseId]: {
				rules,
				bundles,
				upstream: baseUpstream,
				upstreamSha: rulesUpstreamSha ?? null,
			},
		},
		rulesUpstreamSha: rulesUpstreamSha ?? null,
	};
}

// Decide whether a single `--extend` value is a local path or a GitHub
// owner/repo. `existsDir(token)` reports whether the token resolves to an
// existing directory (an existing dir always wins the ambiguity).
//   { kind: "path" | "repo" | "invalid", value }
export function classifyExtendToken(token, existsDir = () => false) {
	const value = String(token);
	if (/^(\.\/|\.\.\/|\/|~)/.test(value)) return { kind: "path", value };
	if (existsDir(value)) return { kind: "path", value };
	// owner/repo: exactly one slash, non-empty segments, no whitespace.
	if (/^[^/\s]+\/[^/\s]+$/.test(value)) return { kind: "repo", value };
	return { kind: "invalid", value };
}

// Resolve the active extend set for this run from the remembered set (tokens
// from the manifest) and this run's --extend flags.
//   - no `none`     -> remembered ∪ cli   (apt-style: adds, persists)
//   - `none` present -> start empty, then add the other cli values
//                       (so `none` alone clears; `none X` replaces with X)
// Order preserved, deduped by token.
export function resolveExtendSet({ remembered = [], cli = [] } = {}) {
	const hasNone = cli.includes("none");
	const start = hasNone ? [] : remembered;
	const additions = cli.filter((t) => t !== "none");

	const out = [];
	const seen = new Set();
	for (const token of [...start, ...additions]) {
		if (seen.has(token)) continue;
		seen.add(token);
		out.push(token);
	}
	return out;
}
