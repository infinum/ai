#!/usr/bin/env python3
"""List the versions of a dependency that are newer than the current one.

Prints each newer version with its release date and bump type, the newest
version inside the current major, and how many pre-releases it hid.

Usage:
  list_versions.py maven  <group>:<artifact>      [--current V] [--pre] [--repo URL]
  list_versions.py github <owner>/<repo> | <url>  [--current V] [--pre]
  list_versions.py git    <clone-url>             [--current V] [--pre]

maven   maven-metadata.xml from Google Maven, Maven Central, and the Gradle
        Plugin Portal (or only --repo), merged: one repository's metadata
        can be stale. Release date = Last-Modified of the POM.
        Never the search.maven.org API: it lags by months.
github  Tags from `git ls-remote`; dates from GitHub releases (`gh api`, or
        the public REST API without gh), else from the tag's commit.
git     Tags from `git ls-remote` only; no dates.

Standard library only (Python 3.9+).
"""
import argparse
import concurrent.futures
import datetime
import email.utils
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HEADERS = {"User-Agent": "dependency-update-skill"}
TIMEOUT = 20
MAX_LISTED = 30
MAX_DATE_LOOKUPS = 40
MAX_COMMIT_LOOKUPS = 12

GOOGLE = "https://dl.google.com/dl/android/maven2"
CENTRAL = "https://repo1.maven.org/maven2"
PORTAL = "https://plugins.gradle.org/m2"
GOOGLE_GROUPS = (
    "androidx.", "android.arch.", "com.android.", "com.google.android.",
    "com.google.firebase", "com.google.gms", "com.google.mlkit", "com.google.ar.",
    "com.google.testing.platform",
)

# Pre-release words and their maturity rank (higher = closer to a release).
PRE_WORDS = {
    "dev": 0, "alpha": 0, "a": 0, "preview": 1, "eap": 1, "ea": 1, "beta": 1, "b": 1,
    "milestone": 2, "m": 2, "rc": 3, "cr": 3, "pre": 3, "snapshot": 4,
}
RELEASE_WORDS = {"", "final", "release", "ga"}
VERSION_RE = re.compile(r"^[vV]?(\d+(?:\.\d+)*)(.*)$")
PRE_RE = re.compile(r"^(alpha|beta|milestone|preview|snapshot|rc|cr|pre|eap|dev|ea|m|a|b)[.\-_]?(\d*)(.*)$")
TAG_RE = re.compile(r"^[vV]?\d+(\.\d+)*([-.+][0-9A-Za-z.\-+]*)?$")


class Version:
    """A version string split into numbers, a pre-release stage, and a flavor.

    Flavor is a non-pre-release qualifier such as `jre` or `android` (Guava);
    versions are only compared inside the same flavor.
    """

    def __init__(self, raw):
        self.raw = raw
        m = VERSION_RE.match(raw.strip())
        if not m:
            raise ValueError(raw)
        self.nums = [int(x) for x in m.group(1).split(".")]
        rest = m.group(2).split("+", 1)[0]  # build metadata never orders versions
        self.extra = []
        self.pre = None
        self.flavor = ""
        numeric = re.fullmatch(r"[-.](\d+(?:\.\d+)*)", rest)
        if numeric:  # e.g. old KSP `1.9.0-1.0.13`: a release with a sub-version
            self.extra = [int(x) for x in numeric.group(1).split(".")]
            return
        q = rest.lstrip("-._").lower()
        p = PRE_RE.match(q)
        if p and (len(p.group(1)) > 1 or p.group(2)):
            self.pre = (PRE_WORDS[p.group(1)], int(p.group(2) or 0))
            self.flavor = p.group(3).lstrip("-._")
        elif q not in RELEASE_WORDS:
            self.flavor = q

    def triple(self):
        return (self.nums + [0, 0, 0])[:3]

    def key(self):
        nums = (self.nums + [0, 0, 0])[:max(3, len(self.nums))] + self.extra
        stage = (1, 0, 0) if self.pre is None else (0,) + self.pre
        return tuple((nums + [0] * 8)[:8]), stage


def parse(raw):
    try:
        return Version(raw)
    except ValueError:
        return None


def bump(cur, tgt):
    if tgt.key() == cur.key():
        return "same"
    if tgt.key() < cur.key():
        return "rollback"
    c, t = cur.triple(), tgt.triple()
    if t[0] != c[0]:
        return "major"
    if t[1] != c[1]:
        return "major (0.x)" if c[0] == 0 else "minor"
    return "patch"


def http(url, method="GET"):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read() if method == "GET" else r.headers


# --- Maven -----------------------------------------------------------------

def maven_versions(coord, repo):
    """Merge the version lists of every repository that has the artifact.

    One repository's metadata can be stale (Maven Central lists
    sonarqube-gradle-plugin only up to 3.3, while the Gradle Plugin Portal
    has 7.x), so all of them are read. Returns the group, the artifact,
    one (url, count, newest) row per repository that answered, and the
    first repository (in priority order) that lists each version.
    """
    parts = coord.split(":")
    if len(parts) < 2:
        sys.exit("maven coordinate must be <group>:<artifact>")
    group, artifact = parts[0], parts[1]
    path = f"{group.replace('.', '/')}/{artifact}"
    if repo:
        repos = [repo.rstrip("/")]
    elif group.startswith(GOOGLE_GROUPS):
        repos = [GOOGLE, CENTRAL, PORTAL]
    elif artifact.endswith(".gradle.plugin"):
        repos = [PORTAL, CENTRAL, GOOGLE]
    else:
        repos = [CENTRAL, GOOGLE, PORTAL]

    def fetch(base):
        url = f"{base}/{path}/maven-metadata.xml"
        try:
            root = ET.fromstring(http(url))
        except (urllib.error.URLError, ET.ParseError, TimeoutError, OSError) as e:
            return base, url, [], str(e)
        return base, url, [v.text.strip() for v in root.findall("./versioning/versions/version") if v.text], "no versions"

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(fetch, repos))  # keeps the priority order
    sources, repo_of, errors = [], {}, []
    for base, url, versions, error in results:
        if not versions:
            errors.append(f"{url}: {error}")
            continue
        parsed = [v for v in map(parse, versions) if v]
        newest = max(parsed, key=Version.key).raw if parsed else versions[-1]
        sources.append((url, len(versions), newest))
        for v in versions:
            repo_of.setdefault(v, base)
    if not repo_of:
        sys.exit("no maven-metadata.xml found:\n  " + "\n  ".join(errors))
    return group, artifact, sources, repo_of


def maven_date(base, group, artifact, version):
    url = f"{base}/{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.pom"
    try:
        modified = http(url, "HEAD").get("Last-Modified")
        return email.utils.parsedate_to_datetime(modified).date().isoformat() if modified else None
    except Exception:
        return None


# --- Git and GitHub --------------------------------------------------------

def github_repo(arg):
    m = re.search(r"github\.com[/:]([^/]+)/([^/#?]+?)(?:\.git)?/?$", arg)
    if m:
        return m.group(1), m.group(2)
    if re.fullmatch(r"[\w.-]+/[\w.-]+", arg):
        owner, name = arg.split("/")
        return owner, re.sub(r"\.git$", "", name)
    sys.exit(f"not a GitHub repository: {arg}")


def git_tags(url):
    try:
        out = subprocess.run(["git", "ls-remote", "--tags", url], capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired) as e:
        sys.exit(f"git ls-remote failed: {e}")
    if out.returncode:
        sys.exit(f"git ls-remote failed: {out.stderr.strip()}")
    tags = {}
    for line in out.stdout.splitlines():
        sha, ref = line.split("\t", 1)
        name = ref[len("refs/tags/"):]
        if name.endswith("^{}"):
            tags[name[:-3]] = sha  # the peeled commit of an annotated tag
        else:
            tags.setdefault(name, sha)
    return tags


def gh_json(path):
    if shutil.which("gh"):
        out = subprocess.run(["gh", "api", path], capture_output=True, text=True, timeout=60)
        if out.returncode == 0:
            return json.loads(out.stdout)
        # gh not logged in, or no access: try the public API below
    try:
        return json.loads(http("https://api.github.com/" + path))
    except Exception:
        return None


def release_dates(owner, repo, pages=5):
    dates = {}
    for page in range(1, pages + 1):
        data = gh_json(f"repos/{owner}/{repo}/releases?per_page=100&page={page}")
        if not isinstance(data, list) or not data:
            break
        for release in data:
            if not release.get("draft") and release.get("published_at"):
                dates[release["tag_name"]] = release["published_at"][:10]
        if len(data) < 100:
            break
    return dates


def commit_date(owner, repo, sha):
    data = gh_json(f"repos/{owner}/{repo}/commits/{sha}")
    try:
        return data["commit"]["committer"]["date"][:10]
    except (TypeError, KeyError):
        return None


# --- Report ----------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=["maven", "github", "git"])
    ap.add_argument("name")
    ap.add_argument("--current")
    ap.add_argument("--pre", action="store_true", help="include pre-releases")
    ap.add_argument("--repo", help="maven: repository base URL")
    args = ap.parse_args()

    cur = parse(args.current) if args.current else None
    if args.current and not cur:
        sys.exit(f"cannot parse current version: {args.current}")

    entries = {}  # normalized version -> [Version, date, date source, tag]
    if args.kind == "maven":
        group, artifact, sources, repo_of = maven_versions(args.name, args.repo)
        source = "maven-metadata.xml" + (", merged from:" if len(sources) > 1 else "") + "".join(
            f"\n  {url} ({count} versions, newest {newest})" for url, count, newest in sources)
        if len({newest for _, _, newest in sources}) > 1:
            source += "\n  note: the repositories disagree on the newest version; the list below merges them"
        for r in repo_of:
            v = parse(r)
            if v:
                entries[r] = [v, None, "", None]
    else:
        url = args.name if "://" in args.name or args.name.startswith("git@") else f"https://github.com/{args.name}"
        tags = git_tags(url)
        source = f"git ls-remote {url}"
        for tag, sha in tags.items():
            if not TAG_RE.match(tag):
                continue  # e.g. `CocoaPods-12.0.0`, `analytics-1.0`
            v = parse(tag)
            if v:
                entries.setdefault(tag.lstrip("vV"), [v, None, "", tag, sha])

    def visible(v):
        if cur is not None and v.flavor != cur.flavor:
            return False
        if v.pre is None or args.pre:
            return True
        return cur is not None and cur.pre is not None and v.pre >= cur.pre

    all_versions = [e for e in entries.values() if cur is None or e[0].flavor == cur.flavor]
    newer = [e for e in all_versions if cur is None or e[0].key() > cur.key()]
    hidden = [e for e in newer if not visible(e[0])]
    newer = sorted((e for e in newer if visible(e[0])), key=lambda e: e[0].key(), reverse=True)
    listed = newer[:MAX_LISTED] if cur else newer[:15]

    if args.kind == "maven":
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            dates = pool.map(lambda e: maven_date(repo_of[e[0].raw], group, artifact, e[0].raw), listed[:MAX_DATE_LOOKUPS])
            for e, d in zip(listed, dates):
                e[1], e[2] = d, "POM Last-Modified" if d else ""
    elif args.kind == "github":
        owner, repo = github_repo(args.name)
        source += " + GitHub releases"
        released = release_dates(owner, repo)
        for e in listed:
            if e[3] in released:
                e[1], e[2] = released[e[3]], "release"
        missing = [e for e in listed if not e[1]][:MAX_COMMIT_LOOKUPS]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for e, d in zip(missing, pool.map(lambda e: commit_date(owner, repo, e[4]), missing)):
                if d:
                    e[1], e[2] = d, "tag commit"

    today = datetime.date.today()

    def age(e):
        return f"{(today - datetime.date.fromisoformat(e[1])).days}d" if e[1] else "age unknown"

    print(f"source: {source}")
    if cur:
        known = any(e[0].key() == cur.key() for e in all_versions)
        print(f"current: {args.current}" + ("" if known else "  (not in the version list: check the spelling or the repository)"))
    if not listed:
        print("newer versions: none" + (" (up to date)" if cur else ""))
    else:
        print("newer versions, newest first:" if cur else "newest versions:")
        for e in listed:
            label = e[3] if e[3] and e[3] != e[0].raw else e[0].raw
            date = e[1] or "-"
            extra = f"  ({e[2]})" if e[2] and e[2] != "release" and e[2] != "POM Last-Modified" else ""
            kind = f"  {bump(cur, e[0])}" if cur else ""
            print(f"  {label:<24} {date:<10}{kind}{extra}")
        if len(newer) > len(listed):
            print(f"  ... and {len(newer) - len(listed)} older")
        top = listed[0]
        if cur:
            print(f"latest: {top[0].raw} ({bump(cur, top[0])}, {age(top)})")
            same_major = [e for e in newer if e[0].triple()[0] == cur.triple()[0]]
            if same_major and same_major[0] is not top:
                print(f"newest in current major: {same_major[0][0].raw} ({bump(cur, same_major[0][0])}, {age(same_major[0])})")
            elif not same_major:
                print("newest in current major: none newer")
        else:
            print(f"latest: {top[0].raw} ({age(top)})")
    if hidden:
        print(f"hidden: {len(hidden)} newer pre-release version(s); pass --pre to list them")
    if args.kind == "git":
        print("dates: not available from git tags; treat age as unknown")


if __name__ == "__main__":
    main()
