#!/usr/bin/env python3
"""Compare the security advisories (OSV) that affect two versions of a package.

Usage: osv_check.py <ecosystem> <name> <current> <target>

  ecosystem  OSV ecosystem name: Maven, SwiftURL, npm, PyPI, Go, crates.io, ...
  name       Maven: "group:artifact". SwiftURL: "github.com/owner/repo"
             (a full clone URL also works).

Prints the advisories fixed by the target, new in the target, and still
open in the target. OSV aggregates the GitHub Advisory Database, NVD-linked
reports, and others, and needs no source URL. Exit code 2 if OSV is
unreachable: report "advisory check unavailable" and continue.
Standard library only (Python 3.9+).
"""
import json
import re
import sys
import urllib.error
import urllib.request

API = "https://api.osv.dev/v1/query"


def query(ecosystem, name, version):
    vulns, token = {}, None
    while True:
        body = {"package": {"ecosystem": ecosystem, "name": name}, "version": version}
        if token:
            body["page_token"] = token
        req = urllib.request.Request(API, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "User-Agent": "dependency-update-skill"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        for v in data.get("vulns", []):
            vulns[v["id"]] = v
        token = data.get("next_page_token")
        if not token:
            return vulns


def names(ecosystem, name):
    if ecosystem.lower() != "swifturl":
        return [name]
    n = re.sub(r"^[a-z+]+://", "", name.strip())
    n = re.sub(r"^[^@/]+@", "", n).replace("github.com:", "github.com/")
    n = re.sub(r"\.git$", "", n.rstrip("/"))
    return list(dict.fromkeys([n, n.lower()]))  # advisories use either case


def describe(v):
    cves = [a for a in v.get("aliases", []) if a.startswith("CVE-")]
    severity = (v.get("database_specific") or {}).get("severity") or ""
    if not severity and v.get("severity"):
        severity = v["severity"][0].get("score", "")
    summary = v.get("summary") or (v.get("details") or "").strip().split("\n")[0]
    return f"{v['id']}  {' '.join(cves) or '-'}  {severity or 'severity n/a'}  {summary[:110]}"


def main():
    if len(sys.argv) == 2 and sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    ecosystem, name, current, target = sys.argv[1:]
    if ecosystem.lower() == "swifturl":
        ecosystem = "SwiftURL"
    cur, tgt = {}, {}
    try:
        for n in names(ecosystem, name):
            cur.update(query(ecosystem, n, current))
            tgt.update(query(ecosystem, n, target))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        print(f"advisory check unavailable: {e}")
        sys.exit(2)

    print(f"OSV {ecosystem} {names(ecosystem, name)[0]}")
    print(f"affect {current} (current): {len(cur)}")
    print(f"affect {target} (target): {len(tgt)}")
    groups = (
        ("fixed by the target", [cur[i] for i in cur if i not in tgt]),
        ("new in the target", [tgt[i] for i in tgt if i not in cur]),
        ("still open in the target", [tgt[i] for i in tgt if i in cur]),
    )
    for title, items in groups:
        print(f"{title}: {len(items) or 'none'}")
        for v in sorted(items, key=lambda v: v["id"]):
            print(f"  {describe(v)}")


if __name__ == "__main__":
    main()
