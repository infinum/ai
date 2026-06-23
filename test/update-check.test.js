// Tests for the pure logic of the stack-essentials update-check hook:
// gathering per-source upstream targets, deciding staleness, and the banner.

import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
	buildBanner,
	gatherUpstreamTargets,
	selectStaleTargets,
} from "../plugins/stack-essentials/hooks/check-rules-updates.mjs";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);

describe("gatherUpstreamTargets", () => {
	test("v2: one target per source with a non-null upstream; local-path sources skipped", () => {
		const manifest = {
			version: 2,
			sources: {
				"infinum-ai": { upstream: "infinum/ai", upstreamSha: A },
				"infinum-ai-private": { upstream: "infinum/ai-private", upstreamSha: B },
				"local-overlay": { upstream: null, upstreamSha: null },
			},
		};
		assert.deepEqual(gatherUpstreamTargets(manifest), [
			{ id: "infinum-ai", upstream: "infinum/ai", baseline: A },
			{ id: "infinum-ai-private", upstream: "infinum/ai-private", baseline: B },
		]);
	});

	test("v1 fallback: flat rulesUpstreamSha maps to the public base only", () => {
		assert.deepEqual(gatherUpstreamTargets({ rulesUpstreamSha: A }), [
			{ id: "infinum-ai", upstream: "infinum/ai", baseline: A },
		]);
	});

	test("empty / missing manifest yields no targets", () => {
		assert.deepEqual(gatherUpstreamTargets(null), []);
		assert.deepEqual(gatherUpstreamTargets({}), []);
	});
});

describe("selectStaleTargets", () => {
	const targets = [
		{ id: "infinum-ai", upstream: "infinum/ai", baseline: A },
		{ id: "infinum-ai-private", upstream: "infinum/ai-private", baseline: B },
	];

	test("stale when latest differs from baseline", () => {
		const stale = selectStaleTargets(targets, { "infinum/ai": C, "infinum/ai-private": B });
		assert.deepEqual(stale.map((t) => t.id), ["infinum-ai"]);
	});

	test("not stale when latest is missing or equal", () => {
		assert.deepEqual(selectStaleTargets(targets, { "infinum/ai": A }), []);
		assert.deepEqual(selectStaleTargets(targets, {}), []);
	});

	test("not stale when baseline is null (couldn't be recorded)", () => {
		const t = [{ id: "x", upstream: "o/x", baseline: null }];
		assert.deepEqual(selectStaleTargets(t, { "o/x": C }), []);
	});
});

describe("buildBanner", () => {
	test("returns null when nothing is stale", () => {
		assert.equal(buildBanner([]), null);
	});

	test("base-only stale → plain re-run command", () => {
		const msg = buildBanner([{ id: "infinum-ai", upstream: "infinum/ai", baseline: A }]);
		assert.match(msg, /github:infinum\/ai/);
		assert.doesNotMatch(msg, /--extend/);
	});

	test("overlay stale → re-run command carries --extend <upstream>", () => {
		const msg = buildBanner([
			{ id: "infinum-ai-private", upstream: "infinum/ai-private", baseline: B },
		]);
		assert.match(msg, /--extend infinum\/ai-private/);
	});

	test("base + overlay stale → one command listing both", () => {
		const msg = buildBanner([
			{ id: "infinum-ai", upstream: "infinum/ai", baseline: A },
			{ id: "infinum-ai-private", upstream: "infinum/ai-private", baseline: B },
		]);
		assert.match(msg, /github:infinum\/ai/);
		assert.match(msg, /--extend infinum\/ai-private/);
	});
});
