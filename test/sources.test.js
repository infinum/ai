// Tests for bin/lib/sources.js — pure logic for the multi-source installer:
//   - upcastManifest:     v1 (flat) -> v2 (source-scoped), idempotent on v2
//   - classifyExtendToken: a --extend value is a local path or an owner/repo
//   - resolveExtendSet:   remembered ∪ this-run --extend, with `none` clearing

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
	classifyExtendToken,
	resolveExtendSet,
	upcastManifest,
} from "../bin/lib/sources.js";

describe("upcastManifest", () => {
	test("returns null for null (no prior install)", () => {
		assert.equal(upcastManifest(null), null);
	});

	test("moves a v1 manifest's flat rules/bundles under sources[base]", () => {
		const v1 = {
			version: 1,
			updatedAt: "2026-01-01T00:00:00Z",
			whoamiStubHash: "abc",
			rules: { "ai-assisted-prs.md": "sha-r" },
			bundles: { demo: { "team-rule.md": "sha-b" } },
			mcpRegistrations: { "infinum-ai/sa": { serverNames: ["productive"] } },
			rulesUpstreamSha: "f".repeat(40),
		};
		const v2 = upcastManifest(v1);

		assert.equal(v2.version, 2);
		assert.deepEqual(v2.sources["infinum-ai"].rules, { "ai-assisted-prs.md": "sha-r" });
		assert.deepEqual(v2.sources["infinum-ai"].bundles, { demo: { "team-rule.md": "sha-b" } });
		assert.equal(v2.sources["infinum-ai"].upstream, "infinum/ai");
		assert.equal(v2.sources["infinum-ai"].upstreamSha, "f".repeat(40));
		// preserved
		assert.equal(v2.updatedAt, "2026-01-01T00:00:00Z");
		assert.equal(v2.whoamiStubHash, "abc");
		assert.deepEqual(v2.mcpRegistrations, { "infinum-ai/sa": { serverNames: ["productive"] } });
		// top-level mirror kept for the old hook
		assert.equal(v2.rulesUpstreamSha, "f".repeat(40));
		// no stray flat keys
		assert.equal(v2.rules, undefined);
		assert.equal(v2.bundles, undefined);
	});

	test("v1 without rulesUpstreamSha yields null upstreamSha", () => {
		const v2 = upcastManifest({ version: 1, rules: {}, bundles: {} });
		assert.equal(v2.sources["infinum-ai"].upstreamSha, null);
	});

	test("is idempotent: a v2 manifest passes through unchanged", () => {
		const v2 = {
			version: 2,
			sources: { "infinum-ai": { rules: {}, bundles: {}, upstream: "infinum/ai", upstreamSha: null } },
			mcpRegistrations: {},
			rulesUpstreamSha: null,
		};
		assert.deepEqual(upcastManifest(v2), v2);
	});

	test("honors a custom base id / upstream", () => {
		const v2 = upcastManifest(
			{ version: 1, rules: {}, bundles: {}, rulesUpstreamSha: "a".repeat(40) },
			{ baseId: "acme", baseUpstream: "acme/stack" },
		);
		assert.ok(v2.sources.acme);
		assert.equal(v2.sources.acme.upstream, "acme/stack");
	});
});

describe("classifyExtendToken", () => {
	const noDirs = () => false;

	test("classifies ./ ../ / ~ prefixes as local paths", () => {
		for (const t of ["./ai-private", "../ai-private", "/abs/ai-private", "~/ai-private"]) {
			assert.equal(classifyExtendToken(t, noDirs).kind, "path", t);
		}
	});

	test("an owner/repo shape with no matching dir is a repo name", () => {
		assert.deepEqual(classifyExtendToken("infinum/ai-private", noDirs), {
			kind: "repo",
			value: "infinum/ai-private",
		});
	});

	test("an existing local directory wins over the owner/repo shape", () => {
		const existing = (p) => p === "infinum/ai-private";
		assert.equal(classifyExtendToken("infinum/ai-private", existing).kind, "path");
	});

	test("a bare name (no slash, not a dir) is invalid", () => {
		assert.equal(classifyExtendToken("ai-private", noDirs).kind, "invalid");
	});

	test("more than one slash (not a dir, no path prefix) is invalid", () => {
		assert.equal(classifyExtendToken("a/b/c", noDirs).kind, "invalid");
	});
});

describe("resolveExtendSet", () => {
	test("no --extend keeps the remembered set as-is", () => {
		assert.deepEqual(resolveExtendSet({ remembered: ["infinum/ai-private"], cli: [] }), [
			"infinum/ai-private",
		]);
	});

	test("--extend X adds X to the remembered set (union, order preserved)", () => {
		assert.deepEqual(
			resolveExtendSet({ remembered: ["a"], cli: ["b"] }),
			["a", "b"],
		);
	});

	test("dedups across remembered and cli", () => {
		assert.deepEqual(resolveExtendSet({ remembered: ["a"], cli: ["a"] }), ["a"]);
		assert.deepEqual(resolveExtendSet({ remembered: [], cli: ["a", "b", "a"] }), ["a", "b"]);
	});

	test("'none' alone clears the set (base-only)", () => {
		assert.deepEqual(resolveExtendSet({ remembered: ["a", "b"], cli: ["none"] }), []);
	});

	test("'none' then X is replace-with-X", () => {
		assert.deepEqual(resolveExtendSet({ remembered: ["a", "b"], cli: ["none", "x"] }), ["x"]);
	});
});
