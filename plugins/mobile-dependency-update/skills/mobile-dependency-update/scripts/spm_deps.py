#!/usr/bin/env python3
"""List the Swift Package Manager dependencies of an Xcode or SwiftPM project.

Usage: spm_deps.py [project-root]

Reads every *.xcodeproj/project.pbxproj (package references, their rules,
and the products the targets use), every Package.resolved (the pins), the
root Package.swift, and the Package.swift of each local package. Prints:

  direct packages        coordinate, resolved pin, every rule with file:line,
                         products (= module names to look for in imports)
  branch or revision     packages pinned to a branch or a commit
  transitive pins        resolved, but no project or manifest declares them
  local packages         path, binary targets and their versions, and the
                         remote packages they declare
  binaries outside SPM   .xcframework / .framework folders in the tree

The current version of a package is its pin, not the rule's minimum.
Standard library only (Python 3.9+).
"""
import json
import os
import plistlib
import re
import sys
from pathlib import Path

SKIP_DIRS = {".git", ".build", "DerivedData", "SourcePackages", "Pods", "Carthage", "node_modules", ".swiftpm"}
MAX_DEPTH = 7


def coord(url):
    """`https://github.com/Foo/Bar.git` -> `github.com/Foo/Bar` (OSV SwiftURL form)."""
    u = url.strip()
    u = re.sub(r"^[a-z+]+://", "", u)
    u = re.sub(r"^[^@/]+@", "", u)
    if re.match(r"^[\w.-]+:[^/\d]", u):  # scp form: github.com:Foo/Bar
        u = u.replace(":", "/", 1)
    return re.sub(r"\.git$", "", u.rstrip("/"))


def line_of(text, offset):
    return text.count("\n", 0, offset) + 1


def blank_comments(src):
    """Replace // and /* */ comments with spaces; keep strings and line breaks."""
    out, i, n = list(src), 0, len(src)
    while i < n:
        c = src[i]
        if c == '"':
            i += 1
            while i < n and src[i] != '"':
                i += 2 if src[i] == "\\" else 1
            i += 1
        elif src.startswith("//", i):
            while i < n and src[i] != "\n":
                out[i] = " "
                i += 1
        elif src.startswith("/*", i):
            end = src.find("*/", i + 2)
            end = n if end < 0 else end + 2
            for j in range(i, end):
                if out[j] != "\n":
                    out[j] = " "
            i = end
        else:
            i += 1
    return "".join(out)


def balanced(text, open_at, open_ch, close_ch):
    """Index of the bracket that closes the one at `open_at`, skipping strings."""
    depth, i = 0, open_at
    while i < len(text):
        c = text[i]
        if c == '"':
            i += 1
            while i < len(text) and text[i] != '"':
                i += 2 if text[i] == "\\" else 1
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text) - 1


# --- project.pbxproj -------------------------------------------------------

def section_objects(text, name):
    m = re.search(r"/\* Begin %s section \*/\n(.*?)/\* End %s section \*/" % (name, name), text, re.S)
    if not m:
        return
    for obj in re.finditer(r"(\w{24}) /\* (.*?) \*/ = \{", m.group(1)):
        start = m.start(1) + obj.end() - 1
        end = balanced(text, start, "{", "}")
        yield obj.group(1), text[start:end + 1], start


def fields(body):
    return {k: v.strip().strip('"') for k, v in re.findall(r'(\w+) = ("(?:[^"\\]|\\.)*"|[^;{}]+);', body)}


def rule_text(req):
    kind = req.get("kind", "?")
    if kind in ("upToNextMajorVersion", "upToNextMinorVersion"):
        return f"{kind} from {req.get('minimumVersion')}"
    if kind == "exactVersion":
        return f"exactVersion {req.get('version')}"
    if kind == "versionRange":
        return f"versionRange {req.get('minimumVersion')} ..< {req.get('maximumVersion')}"
    if kind == "branch":
        return f"branch {req.get('branch')}"
    if kind == "revision":
        return f"revision {req.get('revision')}"
    return kind


def read_pbxproj(path, root, direct, locals_):
    text = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(root)
    project_dir = path.parent.parent
    ids = {}
    for oid, body, start in section_objects(text, "XCRemoteSwiftPackageReference"):
        f = fields(body)
        url = f.get("repositoryURL")
        if not url:
            continue
        req_m = re.search(r"requirement = \{(.*?)\};", body, re.S)
        req = fields(req_m.group(1)) if req_m else {}
        key_m = re.search(r"\b(minimumVersion|version|branch|revision) = ", body)
        line = line_of(text, start + (key_m.start() if key_m else 0))
        entry = direct.setdefault(coord(url).lower(), {"coord": coord(url), "rules": [], "products": set()})
        entry["rules"].append((rule_text(req), req.get("kind", ""), f"{rel}:{line}"))
        ids[oid] = entry
    for oid, body, start in section_objects(text, "XCLocalSwiftPackageReference"):
        f = fields(body)
        if f.get("relativePath"):
            pkg = (project_dir / f["relativePath"]).resolve()
            locals_.setdefault(pkg, set()).add(f"{rel}:{line_of(text, start)}")
    for oid, body, start in section_objects(text, "XCSwiftPackageProductDependency"):
        f = fields(body)
        pkg_id = re.match(r"\w{24}", f.get("package", ""))
        if pkg_id and pkg_id.group(0) in ids and f.get("productName"):
            ids[pkg_id.group(0)]["products"].add(f["productName"])


# --- Package.swift ---------------------------------------------------------

def read_manifest(path, root, direct):
    raw = path.read_text(encoding="utf-8", errors="replace")
    src = blank_comments(raw)
    rel = path.relative_to(root) if path.is_relative_to(root) else path
    info = {"tools": None, "platforms": None, "binaries": [], "remote": [], "local": []}
    tools = re.match(r"\s*//\s*swift-tools-version\s*:\s*([\d.]+)", raw)
    info["tools"] = tools.group(1) if tools else None
    plat = re.search(r"platforms\s*:\s*\[(.*?)\]", src, re.S)
    info["platforms"] = " ".join(plat.group(1).split()) if plat else None
    for m in re.finditer(r"\.package\s*\(", src):
        call = src[m.start():balanced(src, m.end() - 1, "(", ")") + 1]
        line = line_of(src, m.start())
        url = re.search(r'url\s*:\s*"([^"]+)"', call)
        path_arg = re.search(r'path\s*:\s*"([^"]+)"', call)
        if url:
            req = call[url.end():].strip().lstrip(",").strip()
            req = re.sub(r"\)\s*$", "", req).strip() or "?"
            entry = direct.setdefault(coord(url.group(1)).lower(), {"coord": coord(url.group(1)), "rules": [], "products": set()})
            kind = "branch" if re.search(r"\bbranch\b", req) else "revision" if re.search(r"\brevision\b", req) else "manifest"
            entry["rules"].append((" ".join(req.split()), kind, f"{rel}:{line}"))
            info["remote"].append(coord(url.group(1)))
        elif path_arg:
            info["local"].append(path_arg.group(1))
    for m in re.finditer(r"\.binaryTarget\s*\(", src):
        call = src[m.start():balanced(src, m.end() - 1, "(", ")") + 1]
        name = re.search(r'name\s*:\s*"([^"]+)"', call)
        loc = re.search(r'(path|url)\s*:\s*"([^"]+)"', call)
        info["binaries"].append((name.group(1) if name else "?", loc.group(2) if loc else "?", loc.group(1) if loc else ""))
    return info


def framework_version(folder):
    """CFBundleShortVersionString from an .xcframework slice or a .framework."""
    candidates = [folder / "Info.plist"] if folder.suffix == ".framework" else []
    candidates += sorted(folder.glob("*/*.framework/Info.plist")) + sorted(folder.glob("*/*.framework/Resources/Info.plist"))
    for plist in candidates:
        try:
            with plist.open("rb") as fh:
                data = plistlib.load(fh)
            if str(data.get("CFBundleShortVersionString", "")).strip():
                return str(data["CFBundleShortVersionString"]).strip()
        except Exception:
            continue
    return None


# --- Package.resolved ------------------------------------------------------

def read_resolved(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    fmt = data.get("version", 1)
    pins = data.get("object", {}).get("pins", []) if fmt == 1 else data.get("pins", [])
    out = {}
    for p in pins:
        location = p.get("location") or p.get("repositoryURL") or p.get("identity") or ""
        state = p.get("state", {})
        out[coord(location).lower()] = {
            "coord": coord(location), "kind": p.get("kind", "remoteSourceControl"),
            "version": state.get("version"), "branch": state.get("branch"), "revision": state.get("revision") or "",
        }
    return fmt, out


def pin_text(pin):
    if not pin:
        return "not resolved"
    if pin["version"]:
        return f"{pin['version']}  (revision {pin['revision'][:7]})"
    if pin["branch"]:
        return f"branch {pin['branch']} @ {pin['revision'][:7]}"
    return f"revision {pin['revision'][:12]}"


# --- Walk ------------------------------------------------------------------

def walk(root):
    projects, resolved, binaries, workspaces = [], [], [], []
    for dirpath, dirnames, filenames in os.walk(root):
        here = Path(dirpath)
        depth = len(here.relative_to(root).parts)
        keep = []
        for d in dirnames:
            full = here / d
            if d in SKIP_DIRS or depth >= MAX_DEPTH:
                continue
            if d.endswith(".xcodeproj"):
                if (full / "project.pbxproj").is_file():
                    projects.append(full / "project.pbxproj")
                embedded = full / "project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
                if embedded.is_file():
                    resolved.append(embedded)
            elif d.endswith(".xcworkspace"):
                workspaces.append(full)
                pins = full / "xcshareddata/swiftpm/Package.resolved"
                if pins.is_file():
                    resolved.append(pins)
            elif d.endswith((".xcframework", ".framework")):
                binaries.append(full)
            else:
                keep.append(d)
        dirnames[:] = keep
        if here == root and "Package.resolved" in filenames:
            resolved.append(here / "Package.resolved")
    return projects, resolved, binaries, workspaces


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    if not root.is_dir():
        sys.exit(f"not a directory: {root}")
    projects, resolved_files, binaries, workspaces = walk(root)
    direct, locals_ = {}, {}

    for pbx in sorted(projects):
        read_pbxproj(pbx, root, direct, locals_)
    for ws in workspaces:  # folder references to local packages
        data = (ws / "contents.xcworkspacedata")
        if data.is_file():
            for loc in re.findall(r'location = "group:([^"]+)"', data.read_text(errors="replace")):
                pkg = (ws.parent / loc).resolve()
                if (pkg / "Package.swift").is_file():
                    locals_.setdefault(pkg, set()).add(str(ws.relative_to(root)))
    root_manifest = read_manifest(root / "Package.swift", root, direct) if (root / "Package.swift").is_file() else None
    local_info = {pkg: read_manifest(pkg / "Package.swift", root, direct)
                  for pkg in sorted(locals_) if (pkg / "Package.swift").is_file()}

    pins = {}
    print("Projects: " + (", ".join(str(p.parent.relative_to(root)) for p in sorted(projects)) or "none"))
    for rf in resolved_files:
        fmt, found = read_resolved(rf)
        print(f"Pins: {rf.relative_to(root)} (format {fmt}, {len(found)} pins)")
        for k, pin in found.items():
            if k in pins and pins[k]["version"] != pin["version"]:
                print(f"  conflict: {pin['coord']} is {pins[k]['version']} and {pin['version']} in different files")
            pins.setdefault(k, pin)
    if not resolved_files:
        print("Pins: no Package.resolved found (packages not resolved yet)")
    if root_manifest:
        print(f"Root Package.swift: tools {root_manifest['tools']}, platforms {root_manifest['platforms']}")
        for name, loc, kind in root_manifest["binaries"]:
            print(f"  binary    {name:<28} {loc}")
        for p in root_manifest["local"]:
            print(f"  local     {p}")

    versioned = {k: e for k, e in direct.items() if not any(r[1] in ("branch", "revision") for r in e["rules"])}
    floating = {k: e for k, e in direct.items() if k not in versioned}

    print(f"\nDirect packages ({len(versioned)}):")
    for k in sorted(versioned, key=lambda k: versioned[k]["coord"].lower()):
        e = versioned[k]
        print(f"{e['coord']}\n  resolved  {pin_text(pins.get(k))}")
        for text, _, where in e["rules"]:
            print(f"  rule      {text:<40} {where}")
        if e["products"]:
            print(f"  products  {', '.join(sorted(e['products']))}")

    if floating:
        print(f"\nBranch or revision ({len(floating)}) - no version to compare:")
        for k in sorted(floating, key=lambda k: floating[k]["coord"].lower()):
            e = floating[k]
            wheres = ", ".join(r[2] for r in e["rules"])
            print(f"{e['coord']}\n  resolved  {pin_text(pins.get(k))}\n  declared  {wheres}")
            if e["products"]:
                print(f"  products  {', '.join(sorted(e['products']))}")

    transitive = {k: p for k, p in pins.items() if k not in direct and p["kind"] != "localSourceControl"}
    if transitive:
        print(f"\nTransitive pins ({len(transitive)}) - pulled in by the packages above:")
        for k in sorted(transitive, key=lambda k: transitive[k]["coord"].lower()):
            print(f"  {transitive[k]['coord']:<52} {pin_text(transitive[k])}")

    inside_local = set()
    if locals_:
        print(f"\nLocal packages ({len(locals_)}):")
        for pkg in sorted(locals_):
            rel = pkg.relative_to(root) if str(pkg).startswith(str(root)) else pkg
            info = local_info.get(pkg)
            if not info:
                print(f"{rel}  (no Package.swift)")
                continue
            print(f"{rel}  (swift-tools-version {info['tools']}; platforms {info['platforms']})")
            for name, loc, kind in info["binaries"]:
                version = None
                if kind == "path":
                    folder = (pkg / loc).resolve()
                    inside_local.add(folder)
                    version = framework_version(folder)
                shown = f"version {version}" if version else "version unknown"
                print(f"  binary    {name:<28} {loc}  ({shown})")
            for r in info["remote"]:
                print(f"  declares  {r}")
            for p in info["local"]:
                print(f"  local     {p}")

    outside = [b for b in binaries if b.resolve() not in inside_local
               and not any(str(b.resolve()).startswith(str(pkg) + os.sep) for pkg in locals_)]
    if outside:
        print(f"\nBinaries outside SPM ({len(outside)}) - no registry; check the vendor:")
        for b in sorted(outside):
            version = framework_version(b)
            print(f"  {str(b.relative_to(root)):<60} {('version ' + version) if version else 'version unknown'}")

    unresolved = [versioned[k]["coord"] for k in versioned if k not in pins]
    if unresolved and resolved_files:
        print("\nDeclared but not in Package.resolved: " + ", ".join(sorted(unresolved)))


if __name__ == "__main__":
    main()
