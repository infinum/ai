#!/bin/sh
# Caliber check on push: the agent session hook. caliber-hooks-version: 12
# Written by /caliber:setup. Do not edit: the next version replaces the file whole.
#
# An agent's hook runs this after each shell command:  agent-post-push.sh <agent>
# with <agent> one of claude, codex, cursor, copilot, or gemini for an earlier setup's
# entry (the format of what the agent sends on stdin and reads on stdout). After a successful `git push`, or a pull
# request opened from the command line, it tells the agent to run the Caliber check
# in this session. Every other command, and a failed one: no output.
#
# The Caliber plugin of Claude Code ships this same file and runs it in every
# repository as  agent-post-push.sh claude plugin : with that marker it does nothing in
# a repository that has no Caliber block (CLAUDE.md, AGENTS.md) and no .caliber/, or
# whose .claude/settings.json runs the repository's own copy (one message, not two).
# At the start of a session it runs  agent-post-push.sh claude plugin session : one line
# naming the project, where it came from and the Caliber instance (the host of
# CALIBER_URL, else app.caliberhq.io); it asks nobody anything. Where the repository has
# no Caliber block and no caliber.project, the line instead tells the agent to offer the
# setup once (Yes, recommended; Not now; Don't ask again: git config --local caliber.askSetup false)
# when a project of the sign-in lists the clone's origin, which the line gives without
# any userinfo; with caliber.askSetup false (or no, off, 0) it says nothing, and on a
# resume or a compaction it says nothing again. Every python3 here runs with -I, so a
# module planted at the repository's root never runs.
#
# The project is this clone's own `git config --local caliber.project <slug>`, else the
# one the Caliber block names.
#
# In a clone of a virtual repository (caliber.syncActivity true, with its sync token), the
# start of a session also starts the activity sync in the background, at most once an
# hour (pre-push --sync --session: the plugin's own copy beside this file, else the copy
# the install put in <git common dir>/caliber/hooks/, never a file of the client's working
# tree), and offers no setup.
#
#   git config --local caliber.checkInSession false    turn it off for this clone

agent=${1:-claude}
session=""
if [ -n "${3:-}" ]; then
  [ "$#" -eq 3 ] && [ "$1" = "claude" ] && [ "$2" = "plugin" ] && [ "$3" = "session" ] || exit 0
  session=1
fi
if [ "${2:-}" = "plugin" ]; then
  top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  # A repository that is Caliber's: the check after a push acts only there, and the
  # session's line names its project only there; elsewhere the session's line may offer
  # the setup (the Python below decides).
  caliber_repo=1
  if [ ! -d "$top/.caliber" ] && ! grep -qsF '<!-- caliber:start' "$top/CLAUDE.md" "$top/AGENTS.md"; then
    [ -n "$session" ] || exit 0
    caliber_repo=""
  fi
  [ -n "$session" ] || ! grep -qsF '.caliber/hooks/agent-post-push.sh' "$top/.claude/settings.json" || exit 0
fi

# What the agent is handed, written by the Python below: the session's line, or after a
# shell command the check to run. It reads the agent's JSON on stdin (it has no single
# quote in it: it is one shell word).
# shellcheck disable=SC2016
program='
import json
import os
import re
import sys
from urllib.parse import urlsplit

agent = sys.argv[1]
ROOT = os.environ.get("CALIBER_HOOK_ROOT") or "."
# A project slug as Caliber makes one; anything else is not repeated.
SLUG = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?")


# The files an agent reads, as the setup prompt writes them (the support table,
# backend/app/services/caliber/agents.py): the full block in these two,
FULL_FILES = ["AGENTS.md", "CLAUDE.md"]
# and a pointer to it in these: an exact path, the files of a directory that carry the
# markers ("<dir>/*.md"), or ".clinerules?", the path as a file or its marked files as a
# directory. A test keeps this list equal to agents.POINTER_FILES.
POINTER_FILES = [
    ".github/copilot-instructions.md", ".cursor/rules/*.mdc", ".cursorrules",
    ".omp/AGENTS.md", ".devin/rules/*.md", ".junie/AGENTS.md", ".clinerules?",
    ".cline/rules/*.md", ".agents/rules/*.md", ".windsurf/rules/*.md", ".windsurfrules",
    ".kiro/steering/*.md", "QWEN.md", ".hermes.md", "HERMES.md", ".rules", "WARP.md",
]


def marked(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return "<!-- caliber:start" in fh.read(1000000)
    except OSError:
        return False


def expand(entry):
    if entry.endswith("?"):
        path = os.path.join(ROOT, entry[:-1])
        if os.path.isfile(path):
            return [entry[:-1]]
        return expand(entry[:-1] + "/*.md") if os.path.isdir(path) else []
    if "/*." in entry:
        directory, pattern = entry.rsplit("/", 1)
        try:
            names = sorted(os.listdir(os.path.join(ROOT, directory)))
        except OSError:
            return []
        found = []
        for name in names:
            path = os.path.join(ROOT, directory, name)
            if name.endswith(pattern[1:]) and os.path.isfile(path) and marked(path):
                found.append(directory + "/" + name)
        return found
    return [entry] if os.path.isfile(os.path.join(ROOT, entry)) else []


def instruction_files():
    """The full-block files, then every pointer file the repository has, sorted."""
    return FULL_FILES + sorted({p for entry in POINTER_FILES for p in expand(entry)})


def block():
    """(whether an instruction file of this repository has a Caliber block, the project
    it names or None)."""
    for name in instruction_files():
        try:
            with open(os.path.join(ROOT, name), encoding="utf-8", errors="replace") as fh:
                text = fh.read(1000000)
        except OSError:
            continue
        start = text.find("<!-- caliber:start")
        if start < 0:
            continue
        end = text.find("<!-- caliber:end -->", start)
        found_in = text[start:end if end >= 0 else len(text)]
        found = re.search(r"get_project\(project=\x22([^\x22]*)\x22\)", found_in) \
            or re.search(r"Caliber project `([^`]*)`", found_in)
        return True, (found.group(1) if found and SLUG.fullmatch(found.group(1)) else None)
    return False, None


def block_slug():
    """The project the Caliber block of this repository names, or None."""
    return block()[1]


def origin_for_context():
    """The clone\x27s origin as the model may read it: no userinfo (a token in an
    https URL, a user other than git in an scp-like one), only plain characters, at
    most 200 of them; else `unknown`."""
    raw = (os.environ.get("CALIBER_HOOK_ORIGIN") or "").strip()
    if "://" in raw:
        scheme, _, rest = raw.partition("://")
        netloc, slash, path = rest.partition("/")
        raw = scheme + "://" + netloc.rsplit("@", 1)[-1] + slash + path
    else:
        scp = re.match(r"(?:(.*)@)?([^@:/]+):(.*)\Z", raw, re.DOTALL)
        if scp:
            raw = ("git@" if scp.group(1) == "git" else "") + scp.group(2) + ":" + scp.group(3)
    return raw if re.fullmatch(r"[A-Za-z0-9._:@/+-]{1,200}", raw) else "unknown"


def clone_slug():
    """This clone\x27s own `caliber.project`, when it is a slug."""
    value = os.environ.get("CALIBER_HOOK_PROJECT") or ""
    return value if SLUG.fullmatch(value) else None


if os.environ.get("CALIBER_HOOK_SESSION"):  # the line a session starts with
    override = clone_slug()
    has_block, named = block()
    slug = override or named
    if not slug:
        # No project anywhere: offer the setup once, unless a block that names no project
        # is there (an old one; the agent sees it), the clone said not to ask, or the
        # session goes on (a resume or a compaction: the person answered already).
        try:
            source = (json.load(sys.stdin) or {}).get("source")
        except (ValueError, OSError, AttributeError):
            source = None
        if has_block or (os.environ.get("CALIBER_HOOK_ASK") or "").strip().lower() == "false" \
                or os.environ.get("CALIBER_HOOK_SYNC") or source not in (None, "startup", "clear"):
            sys.exit(0)
        offer = ("Caliber: this repository has no Caliber block and no `caliber.project` "
                 "(origin: `" + origin_for_context() + "`). The first time this session "
                 "needs a Caliber project, call `projects`: when one project lists this "
                 "repository, ask the person once whether to set it up here, with the answers "
                 "Yes (Recommended), Not now and Don\x27t ask again \u2014 yes: the "
                 "`setup` tool with that project\x27s slug, in this session; not now: "
                 "nothing; don\x27t ask again: `git config --local caliber.askSetup false`. "
                 "When none lists it, say nothing.")
        # Context for the model only: the person hears it as the agent\x27s question.
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart",
                                                 "additionalContext": offer}}))
        sys.exit(0)
    if not os.environ.get("CALIBER_HOOK_CALIBER_REPO"):
        sys.exit(0)  # the clone\x27s project alone, outside a Caliber repository: as before
    if not override:
        source = "the Caliber block"
    elif named and named != override:
        source = "the block names `" + named + "`; this clone\x27s caliber.project overrides it"
    else:
        source = "this clone\x27s caliber.project"
    try:
        host = urlsplit(os.environ.get("CALIBER_URL") or "https://app.caliberhq.io").hostname
    except ValueError:
        host = None
    if not host or not re.fullmatch(r"[a-z0-9.:-]{1,253}", host):
        host = "CALIBER_URL names no plain host"
    line = "Caliber: project `" + slug + "` (" + source + ") \u00b7 " + host
    # The context reaches the model; `systemMessage` shows the same line to the person.
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart",
                                             "additionalContext": line},
                      "systemMessage": line}))
    sys.exit(0)

try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)


def loads(value):
    """A value some agents send as a JSON string, others as an object."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def text_of(value):
    """Every string in a tool result, whatever its shape."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return "\n".join(text_of(v) for v in value.values())
    if isinstance(value, list):
        return "\n".join(text_of(v) for v in value)
    return ""


# What each agent calls the command it ran and what came back.
if agent == "copilot":
    tool_input, result = loads(data.get("toolArgs")), data.get("toolResult")
elif agent == "cursor":
    tool_input, result = loads(data.get("tool_input")), loads(data.get("tool_output"))
else:  # claude, codex, gemini
    tool_input, result = loads(data.get("tool_input")), data.get("tool_response")
command = tool_input.get("command") if isinstance(tool_input, dict) else None
if not isinstance(command, str):
    sys.exit(0)

# The command as the shell reads it, in one pass (time in proportion to its length; at
# most the first 200 kB are read): words of simple commands, with quoted text taken as
# its words, here-document bodies and comments skipped, redirections dropped. A word
# with an expansion ($x, $(...), backticks) is None: its value is not known here.
src, n = command[:200000], min(len(command), 200000)
commands, words, word = [], [], []
has_word = unknown = redirect = False
depth, pending, i = 0, [], 0


def end_word():
    global word, has_word, unknown, redirect
    if has_word:
        if redirect:
            redirect = False
        else:
            words.append(None if unknown else "".join(word))
    word, has_word, unknown = [], False, False


def end_command():
    global words
    end_word()
    if words:
        commands.append((depth, words))
    words = []


while i < n:
    c = src[i]
    if c == "\x27":
        j = src.find("\x27", i + 1)
        j = n if j < 0 else j
        word.append(src[i + 1:j])
        has_word, i = True, j + 1
    elif c == "\x22":
        j = i + 1
        while j < n and src[j] != "\x22":
            if src[j] == "\\" and j + 1 < n:
                word.append(src[j + 1])
                j += 2
                continue
            if src[j] in "$`":
                unknown = True
            word.append(src[j])
            j += 1
        has_word, i = True, j + 1
    elif c == "\\":
        if i + 1 < n and src[i + 1] != "\n":
            word.append(src[i + 1])
            has_word = True
        i += 2
    elif c == "`":
        j = src.find("`", i + 1)
        has_word, unknown, i = True, True, (n if j < 0 else j + 1)
    elif c == "$" and src.startswith("$(", i):
        level, j = 0, i + 1
        while j < n:
            if src[j] == "(":
                level += 1
            elif src[j] == ")":
                level -= 1
                if level == 0:
                    break
            j += 1
        has_word, unknown, i = True, True, j + 1
    elif c == "$":
        word.append(c)
        has_word, unknown, i = True, True, i + 1
    elif c == "#" and not has_word:
        j = src.find("\n", i)
        i = n if j < 0 else j
    elif c in " \t":
        end_word()
        i += 1
    elif c == "\n":
        end_command()
        i += 1
        for delimiter, tabs in pending:          # here-document bodies, in order
            while i < n:
                j = src.find("\n", i)
                j = n if j < 0 else j
                line = src[i:j]
                i = j + 1
                if (line.lstrip("\t") if tabs else line) == delimiter:
                    break
        pending = []
    elif src.startswith("<<", i) and not src.startswith("<<<", i):
        end_word()
        j = i + 2
        tabs = j < n and src[j] == "-"
        j += 1 if tabs else 0
        while j < n and src[j] in " \t":
            j += 1
        k = j
        while k < n and src[k] not in " \t\n;&|<>()":
            k += 1
        delimiter = src[j:k].replace("\x27", "").replace("\x22", "").replace("\\", "")
        if delimiter:
            pending.append((delimiter, tabs))
        i = k
    elif c in "<>":
        if has_word and "".join(word).isdigit() and not unknown:
            word, has_word = [], False           # the 2 of 2>
        end_word()
        while i < n and src[i] in "<>&":
            i += 1
        redirect = not (i < n and src[i].isdigit() and src[i - 1] == "&")
        if not redirect:
            while i < n and src[i].isdigit():
                i += 1
    elif c in ";&|(){}":
        end_command()
        depth = depth + 1 if c == "(" else max(0, depth - 1) if c == ")" else depth
        i += 1
    else:
        word.append(c)
        has_word, i = True, i + 1
end_command()

# What the simple commands do, in order.
WRAPPERS = {"then", "do", "else", "elif", "if", "while", "until", "time", "command",
            "nohup", "exec", "sudo", "!"}
WHERE = {"GIT_DIR", "GIT_WORK_TREE"}
pushed = opened = elsewhere = unnamed = deleted = False
moved, exported = set(), False         # a cd at these subshell depths; export GIT_DIR=...
target = None                          # the branch a push names, when it names one
for level, words in commands:
    moved = {m for m in moved if m <= level}
    k, assigned, env_moved = 0, set(), False
    while k < len(words):
        w = words[k]
        if w in WRAPPERS:
            k += 1
        elif w == "timeout":
            k += 1
            while k < len(words) and words[k] and words[k].startswith("-"):
                k += 1
            k += 1                             # the duration
        elif w == "env":
            k += 1
            while k < len(words) and words[k] and words[k].startswith("-"):
                flag = words[k]
                k += 1
                if flag in ("-C", "--chdir", "-u", "--unset") and k < len(words):
                    k += 1
                env_moved = env_moved or flag in ("-C", "--chdir") or flag.startswith("--chdir=")
        elif w and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", w):
            assigned.add(w.split("=", 1)[0])
            k += 1
        else:
            break
    if k >= len(words):
        continue
    name, rest = words[k], words[k + 1:]
    if name in ("cd", "pushd"):
        if not pushed:
            moved.add(level)
        continue
    if name == "export":
        exported = exported or (not pushed and any(
            w and w.split("=", 1)[0] in WHERE for w in rest))
        continue
    if name == "git":
        j, here = 0, False
        while j < len(rest) and rest[j] and rest[j].startswith("-"):
            option = rest[j]
            j += 1
            if option in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") and j < len(rest):
                j += 1
            here = here or option in ("-C", "--git-dir", "--work-tree") \
                or option.startswith(("--git-dir=", "--work-tree="))
        if j >= len(rest) or rest[j] != "push":
            continue
        args = rest[j + 1:]
        if any(a in ("--dry-run", "-n", "--delete", "-d", "--tags") for a in args):
            continue
        if pushed:
            unnamed = True                     # a second push: which one to name?
            continue
        pushed = True
        elsewhere = here or env_moved or bool(moved) or exported or bool(assigned & WHERE)
        positional, m = [], 0
        while m < len(args):
            a = args[m]
            m += 1
            if a is None or not a.startswith("-"):
                positional.append(a)
            elif a in ("-o", "--push-option", "--repo", "--receive-pack", "--exec") \
                    and m < len(args):
                m += 1
        unnamed = unnamed or any(a in ("--all", "--mirror", "--branches") for a in args)
        refspecs = positional[1:]
        if len(refspecs) > 1 or None in refspecs:
            unnamed = True
        elif refspecs:
            spec = refspecs[0].lstrip("+")
            source, colon, dst = spec.rpartition(":")
            dst = dst if colon else spec
            if colon and not source:
                deleted = True                 # git push origin :branch deletes it
            elif dst.startswith("refs/tags/") or (dst.startswith("refs/") and not
                                                  dst.startswith("refs/heads/")):
                unnamed = True
            else:
                dst = dst[len("refs/heads/"):] if dst.startswith("refs/heads/") else dst
                target = "HEAD" if dst in ("HEAD", "@") else dst
        continue
    if [name] + rest[:2] in (["gh", "pr", "create"], ["glab", "mr", "create"]):
        opened = True
    elif name == "curl" and any(w and "pullrequests" in w for w in rest) and (
            "POST" in rest or any(w in ("-d", "--data", "--json") or (w or "").startswith(
                ("-XPOST", "--data=", "--request=POST")) for w in rest)):
        opened = True
if deleted and not opened:
    sys.exit(0)
if not (pushed or opened):
    sys.exit(0)
current = os.environ.get("CALIBER_HOOK_BRANCH") or ""
if target not in (None, "HEAD", current):
    elsewhere_branch = target       # another branch than the one checked out here
else:
    elsewhere_branch = None
if not (elsewhere or unnamed) and elsewhere_branch is None \
        and os.environ.get("CALIBER_HOOK_RUNNING"):
    sys.exit(0)            # the background check of this branch is under way

# The command failed: nothing reached the remote.
if isinstance(result, dict):
    for key in ("exitCode", "exit_code", "returncode", "code"):
        if isinstance(result.get(key), int) and result[key] != 0:
            sys.exit(0)
    if result.get("resultType") in ("failure", "error", "denied", "rejected"):
        sys.exit(0)
    if result.get("error") or result.get("interrupted") is True:
        sys.exit(0)
output = text_of(result)
if re.search(r"(?m)^\s*(?:fatal:|error: failed to push|! \[(?:rejected|remote rejected)\])",
             output) or "Everything up-to-date" in output:
    sys.exit(0)

branch = "" if elsewhere or unnamed else elsewhere_branch or current
if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._/@+#=,-]{0,254}$", branch) or ".." in branch:
    branch = ""
# The project: this clone\x27s `caliber.project`, else the one the Caliber block of this
# repository names; a sign-in that sees several projects needs it on every call. (Not for
# a command run in another directory: that may be another repository.)
slug = None if elsewhere else clone_slug() or block_slug()
if slug:
    project = ", project=\x22" + slug + "\x22"
    named = " and `project=\x22" + slug + "\x22`"
    hint = ""
else:
    project = named = ""
    hint = ("Pass `project` = the slug the repository\x27s Caliber block names "
            "(`get_project(project=\x22<slug>\x22)`), when it names one, to both calls.\n")

what = ("opened a pull request" if opened and not pushed else "pushed") + (
    " for `" + branch + "`" if opened and not pushed and branch
    else " `" + branch + "`" if branch else " (in the repository and on the branch the command used)")
message = (
    "Caliber (check on push): this session just " + what + ". If this session has the "
    "Caliber MCP tools, check it now, here, without asking first:\n"
    "1. In the repository the command pushed from: `get_check_status(head_sha=<git "
    "rev-parse " + (branch if branch and branch != current else "HEAD") + ">" + project
    + ")` and read "
    "`check_timing`. "
    "`manual`: this project runs no automatic checks, do nothing.\n"
    "2. `after_pr` and the branch has no pull request yet: do nothing.\n"
    "3. Otherwise call the Caliber `check` tool with `push=no`" + named + " and follow "
    "what it returns "
    "(the same as the `/caliber:check` prompt); when it finds nothing with a gap, say so "
    "in one line.\n" + hint +
    "Without the Caliber tools, ignore this. To turn it off for this clone: "
    "`git config --local caliber.checkInSession false`."
)

if agent == "cursor":
    out = {"additional_context": message}
elif agent == "copilot":
    out = {"additionalContext": message}
else:
    event = "AfterTool" if agent == "gemini" else "PostToolUse"
    out = {"hookSpecificOutput": {"hookEventName": event, "additionalContext": message}}
print(json.dumps(out))'

# The session's line: no stdin to read, no call to make.
if [ -n "$session" ]; then
  command -v python3 >/dev/null 2>&1 || exit 0
  project=$(git -C "$top" config --local --get caliber.project 2>/dev/null) || project=""
  origin=$(git -C "$top" remote get-url origin 2>/dev/null) || origin=""
  # As git reads a boolean: false, no, off and 0 all say no (a value that is none: ask).
  ask=$(git -C "$top" config --type=bool --get caliber.askSetup 2>/dev/null) || ask=""
  # The SessionStart input (its `source`) comes on stdin; a terminal is not read.
  if [ -t 0 ]; then exec </dev/null; fi
  # A clone set up for the activity sync: the sync starts now, detached (it ends at once
  # when it last ran less than an hour ago), and the clone is set up, so no offer. It is
  # the pre-push beside this file (the plugin's own copy), else the git directory's copy:
  # never a file of the working tree, where a merge may have put the client's.
  sync=""
  if [ "$(git -C "$top" config --local --type=bool --get caliber.syncActivity 2>/dev/null)" = true ]; then
    common=$(cd "$top" && cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P) || common=""
    beside=$(cd "$(dirname "$0")" 2>/dev/null && pwd -P) || beside=""
    syncer="$beside/pre-push"
    if [ -z "$beside" ] || [ ! -x "$syncer" ]; then syncer="$common/caliber/hooks/pre-push"; fi
    if [ -n "$common" ] && [ -f "$common/caliber/sync-token" ] && [ -x "$syncer" ]; then
      sync=1
      (cd "$top" && nohup python3 -I -c 'import os, sys
try:
    os.setsid()
except OSError:
    pass
os.execv(sys.argv[1], sys.argv[1:])' "$syncer" --sync --session \
        </dev/null >/dev/null 2>&1 &)
    fi
  fi
  CALIBER_HOOK_SESSION=1 CALIBER_HOOK_ROOT=$top CALIBER_HOOK_PROJECT=$project \
    CALIBER_HOOK_CALIBER_REPO=$caliber_repo CALIBER_HOOK_ORIGIN=$origin CALIBER_HOOK_ASK=$ask \
    CALIBER_HOOK_SYNC=$sync python3 -I -c "$program" "$agent"
  exit 0
fi

input=$(cat)

# Nearly every command ends here: one pass of grep, whatever the length of the input.
printf '%s' "$input" | grep -q -e push -e 'pr create' -e 'mr create' -e pullrequests || exit 0
command -v python3 >/dev/null 2>&1 || exit 0
top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ "$(git config --type=bool --get caliber.checkInSession 2>/dev/null)" != "false" ] || exit 0
project=$(git -C "$top" config --local --get caliber.project 2>/dev/null) || project=""

branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) || branch=""
# The background check of this branch is running (the git hook started it for this
# very push): one check per push. Whether the push was of this branch at all, the
# script below decides from the command.
running=""
if [ -n "$branch" ]; then
  common=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P) || common=""
  name=$(printf '%s' "$branch" | tr -c 'A-Za-z0-9._-' '_')
  if [ "$name" != "$branch" ]; then
    name="$name-$(printf '%s' "$branch" | git hash-object --stdin | cut -c1-8)"
  fi
  lock="$common/caliber/check-$name.pid"
  if [ -n "$common" ] && [ -f "$lock" ]; then
    read -r pid _ <"$lock" 2>/dev/null || pid=""
    case "$pid" in '' | *[!0-9]*) pid="" ;; esac
    # Alive, and still the runner (a pid is reused after a crash or a restart).
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      if [ -r "/proc/$pid/cmdline" ]; then
        tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q 'check-on-push\.sh' && running=1
      else
        ps -o command= -p "$pid" 2>/dev/null | grep -q 'check-on-push\.sh' && running=1
      fi
    fi
  fi
fi

# The agent sent JSON on stdin; the program above reads it there.
printf '%s' "$input" | CALIBER_HOOK_SESSION='' CALIBER_HOOK_BRANCH=$branch \
  CALIBER_HOOK_RUNNING=$running CALIBER_HOOK_ROOT=$top CALIBER_HOOK_PROJECT=$project \
  python3 -I -c "$program" "$agent"
