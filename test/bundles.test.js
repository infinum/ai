// Tests for bin/lib/bundles.js — bundle enumeration, install, removal.

import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
	installBundle,
	listRuleBundles,
	removeBundle,
} from "../bin/lib/bundles.js";

let workDir;
let rulesDir;

beforeEach(async () => {
	workDir = await mkdtemp(join(tmpdir(), "infinum-bundles-test-"));
	rulesDir = join(workDir, "rules");
	await mkdir(rulesDir, { recursive: true });
});

afterEach(async () => {
	await rm(workDir, { recursive: true, force: true });
});

describe("listRuleBundles", () => {
	test("returns empty array when rules/ has no subdirs", async () => {
		await writeFile(join(rulesDir, "top-level.md"), "# rule");
		const result = await listRuleBundles(rulesDir);
		assert.deepEqual(result, []);
	});

	test("returns each subdirectory as a bundle", async () => {
		await mkdir(join(rulesDir, "sa"));
		await mkdir(join(rulesDir, "ios"));
		await writeFile(join(rulesDir, "sa", "rule.md"), "# sa rule");

		const result = await listRuleBundles(rulesDir);
		assert.equal(result.length, 2);
		assert.deepEqual(
			result.map((b) => b.name).sort(),
			["ios", "sa"],
		);
	});

	test("extracts description from bundle README.md first non-heading line", async () => {
		await mkdir(join(rulesDir, "sa"));
		await writeFile(
			join(rulesDir, "sa", "README.md"),
			"# SA Bundle\n\nRules for the solution-architect team.\n",
		);

		const result = await listRuleBundles(rulesDir);
		assert.equal(result[0].description, "Rules for the solution-architect team.");
	});

	test("returns empty description when bundle has no README", async () => {
		await mkdir(join(rulesDir, "sa"));
		const result = await listRuleBundles(rulesDir);
		assert.equal(result[0].description, "");
	});

	test("returns empty array when rulesDir does not exist", async () => {
		const result = await listRuleBundles(join(workDir, "missing"));
		assert.deepEqual(result, []);
	});
});

describe("installBundle", () => {
	test("copies .md files (except README.md) to destDir and returns hash map", async () => {
		const bundleSrc = join(rulesDir, "sa");
		await mkdir(bundleSrc);
		await writeFile(join(bundleSrc, "README.md"), "skip me");
		await writeFile(join(bundleSrc, "rule-a.md"), "content a");
		await writeFile(join(bundleSrc, "rule-b.md"), "content b");
		await writeFile(join(bundleSrc, "ignored.txt"), "not markdown");

		const destDir = join(workDir, "out", "sa");
		const hashes = await installBundle(bundleSrc, destDir);

		assert.deepEqual(Object.keys(hashes).sort(), ["rule-a.md", "rule-b.md"]);
		assert.equal((await readFile(join(destDir, "rule-a.md"), "utf8")), "content a");
		assert.equal((await readFile(join(destDir, "rule-b.md"), "utf8")), "content b");
		assert.equal(existsSync(join(destDir, "README.md")), false);
		assert.equal(existsSync(join(destDir, "ignored.txt")), false);
		assert.equal(hashes["rule-a.md"].length, 64); // sha256 hex
	});
});

describe("removeBundle", () => {
	test("removes previously installed files and the empty bundle dir", async () => {
		const infinum = join(workDir, "infinum");
		const bundleDest = join(infinum, "sa");
		await mkdir(bundleDest, { recursive: true });
		await writeFile(join(bundleDest, "rule-a.md"), "a");
		await writeFile(join(bundleDest, "rule-b.md"), "b");

		await removeBundle(infinum, "sa", {
			"rule-a.md": "hash-a",
			"rule-b.md": "hash-b",
		});

		assert.equal(existsSync(bundleDest), false);
	});

	test("leaves dir in place if user added extra files", async () => {
		const infinum = join(workDir, "infinum");
		const bundleDest = join(infinum, "sa");
		await mkdir(bundleDest, { recursive: true });
		await writeFile(join(bundleDest, "rule-a.md"), "a");
		await writeFile(join(bundleDest, "user-note.md"), "user file");

		await removeBundle(infinum, "sa", { "rule-a.md": "hash-a" });

		assert.equal(existsSync(join(bundleDest, "rule-a.md")), false);
		assert.equal(existsSync(join(bundleDest, "user-note.md")), true);
	});

	test("is a no-op when previous files do not exist", async () => {
		const infinum = join(workDir, "infinum");
		await removeBundle(infinum, "sa", { "rule-a.md": "hash-a" });
		// no throw
	});
});
