// Rule bundles — opt-in subfolder collections under rules/.
//
// Top-level rules/*.md are auto-installed (handled in install.js).
// Subfolders like rules/<bundle>/ are bundles users opt into via a TTY prompt.
// Each bundle's optional README.md first non-heading line is shown as the
// hint in the prompt; bundle files install to ~/.claude/<config dir>/<bundle>/.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	mkdir,
	readFile,
	readdir,
	rmdir,
	unlink,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { isCancel, log, multiselect } from "@clack/prompts";

const ALL = "__all__";

export async function listRuleBundles(rulesDir) {
	if (!existsSync(rulesDir)) return [];
	const entries = await readdir(rulesDir, { withFileTypes: true });
	const bundles = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (!entry.isDirectory()) continue;
		const dir = join(rulesDir, entry.name);
		bundles.push({
			name: entry.name,
			description: await readBundleDescription(dir),
			dir,
		});
	}
	return bundles;
}

async function readBundleDescription(bundleDir) {
	const readme = join(bundleDir, "README.md");
	if (!existsSync(readme)) return "";
	try {
		const content = await readFile(readme, "utf8");
		const firstLine = content
			.split("\n")
			.map((l) => l.trim())
			.find((l) => l.length > 0 && !l.startsWith("#"));
		return firstLine || "";
	} catch {
		return "";
	}
}

function sha256(buf) {
	return createHash("sha256").update(buf).digest("hex");
}

// Copy a bundle's .md files (excluding README.md) to <destDir>.
// Returns { filename: sha256 } for files written.
export async function installBundle(bundleDir, destDir) {
	await mkdir(destDir, { recursive: true });
	const entries = await readdir(bundleDir);
	const hashes = {};
	for (const name of entries.sort()) {
		if (!name.endsWith(".md") || name === "README.md") continue;
		const buf = await readFile(join(bundleDir, name));
		await writeFile(join(destDir, name), buf);
		hashes[name] = sha256(buf);
	}
	return hashes;
}

// Remove files from a previously-installed bundle and rmdir if empty.
export async function removeBundle(configDir, bundleName, prevFiles) {
	const dir = join(configDir, bundleName);
	for (const fileName of Object.keys(prevFiles || {})) {
		const filePath = join(dir, fileName);
		if (existsSync(filePath)) await unlink(filePath);
	}
	try {
		await rmdir(dir);
	} catch {
		/* dir not empty (user placed extra files) or already gone */
	}
}

// Prompt for bundle selection (TTY only). Returns names selected.
// Non-TTY and cancel: preserves prior selection — a non-interactive
// re-run (e.g. a non-interactive `pnpm dlx` install) must not silently strip
// bundles the user previously opted into.
export async function promptBundleSelection(bundles, prevBundleNames = []) {
	if (!process.stdin.isTTY) {
		if (prevBundleNames.length > 0) {
			log.info(
				`Keeping previously selected bundle(s): ${prevBundleNames.join(", ")} (non-interactive shell)`,
			);
		}
		return prevBundleNames;
	}
	if (bundles.length === 0) return [];

	const prevSet = new Set(prevBundleNames);
	const initial = bundles.filter((b) => prevSet.has(b.name)).map((b) => b.name);

	const result = await multiselect({
		message: "Which rule bundles to install? (Space to toggle, Enter to confirm)",
		options: [
			{
				value: ALL,
				label: "Install all bundles",
				hint: `${bundles.length} total — overrides individual picks`,
			},
			...bundles.map((b) => ({
				value: b.name,
				label: b.name,
				hint: b.description || undefined,
			})),
		],
		initialValues: initial,
		required: false,
	});

	if (isCancel(result)) {
		log.warn("Skipped bundle selection — keeping previous choice");
		return prevBundleNames;
	}
	if (result.includes(ALL)) {
		return bundles.map((b) => b.name);
	}
	return result.filter((v) => v !== ALL);
}
