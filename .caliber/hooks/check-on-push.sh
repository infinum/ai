#!/usr/bin/env bash
# Caliber check on push: the runner. caliber-hooks-version: 12
# Written by /caliber:setup. Do not edit: the next version replaces the file whole.
#
# Started detached by .caliber/hooks/pre-push:  check-on-push.sh <branch> <sha> [remote]
#
# It checks the pushed commit out as a detached worktree in a private temporary
# directory and runs the Caliber check there with `claude -p`, unattended: the Caliber
# MCP server, read-only file tools and a git wrapper held to the checkout. It never
# pushes and writes nothing to the repository or the provider. One run per branch at a
# time: a newer push stops the run of the older commit. Two ways in:
#
# - Token mode (CALIBER_TOKEN set): it first asks Caliber whether the pushed branch is
#   to be checked (the project's check_timing, the pull request or the branch's check,
#   what still has a gap), then runs the `check` prompt in restricted mode with the
#   token's MCP server only.
# - Plugin mode (no CALIBER_TOKEN): the Caliber plugin's server, with the sign-in made
#   once in an interactive Claude Code session. The agent asks Caliber itself (the
#   `check` tool). The run loads your own Claude Code settings and plugins
#   (--setting-sources user), never the pushed commit's; it stops at once when the
#   plugin's server is not signed in or did not start. The project it names is this
#   clone's (`git config --local caliber.project <slug>`), else the one the Caliber
#   block of the pushed commit names.
#
# Environment
#   CALIBER_TOKEN     your Caliber token (token mode). It is sent only to the endpoint this
#                     clone was set up with, and written to one file: the agent's MCP
#                     config, in a directory only you can read, outside the checkout,
#                     removed when the run ends.
#   CALIBER_MCP_URL   the project's MCP endpoint, token mode only (default: `git config
#                     caliber.mcpUrl`, which `pre-push --install` recorded. The
#                     repository's files are not asked again: a commit that changes
#                     them cannot send your token elsewhere)
# Log: <git dir>/caliber/check-<branch>.log (a `/` in the name becomes `_`), the last
# run per branch. When the run ends
# it shows a desktop notification; `git config caliber.notify false` turns that off.

set -uo pipefail
umask 077

branch="${1:?usage: check-on-push.sh <branch> <sha> [remote]}"
sha="${2:?usage: check-on-push.sh <branch> <sha> [remote]}"
remote="${3:-origin}"

root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
common="$(cd "$(git -C "${root}" rev-parse --git-common-dir)" 2>/dev/null && pwd -P)" || exit 0
state="${common}/caliber"
mkdir -p "${state}" || exit 0
# The branch as a file name: other characters become `_`. The log has that name, as the
# texts say (check-feat_x.log). The lock also gets a short hash when the name changed,
# so two branches that differ only in such characters (feat/a, feat_a) never stop each
# other; they share a log, which the later one writes.
name="$(printf '%s' "${branch}" | tr -c 'A-Za-z0-9._-' '_')"
log="${state}/check-${name}.log"
if [ "${name}" != "${branch}" ]; then
  name="${name}-$(printf '%s' "${branch}" | git hash-object --stdin | cut -c1-8)"
fi
lock="${state}/check-${name}.pid"

# 1. One run per branch: a run of an older commit of this branch is stopped first.
# The pid in the lock is trusted only while it is still this script (a pid can be
# reused after a crash or a restart).
is_runner() {
  if [ -r "/proc/$1/cmdline" ]; then
    tr '\0' ' ' < "/proc/$1/cmdline" | grep -q 'check-on-push\.sh'
  else
    ps -o command= -p "$1" 2> /dev/null | grep -q 'check-on-push\.sh'
  fi
}
if [ -f "${lock}" ]; then
  # The lock holds the run: "<pid> <sha>".
  read -r old old_sha < "${lock}" 2> /dev/null || true
  case "${old:-}" in '' | *[!0-9]*) old="" ;; esac
  if [ -n "${old}" ] && [ "${old}" != "$$" ] && kill -0 "${old}" 2> /dev/null &&
     is_runner "${old}"; then
    # The same commit is being checked already (a push that pushed nothing new).
    [ "${old_sha:-}" != "${sha}" ] || exit 0
    # Its own session (pre-push starts it so): the group is the run and its agent.
    kill -TERM -- "-${old}" 2>/dev/null || kill -TERM "${old}" 2>/dev/null || true
    waited=0
    while kill -0 "${old}" 2> /dev/null && is_runner "${old}" && [ "${waited}" -lt 100 ]; do
      sleep 0.1
      waited=$((waited + 1))
    done
    kill -KILL -- "-${old}" 2>/dev/null || true
  fi
fi
printf '%s %s\n' "$$" "${sha}" > "${lock}"
exec > "${log}" 2>&1 < /dev/null

PRIVATE_ROOT=""
fresh=""
checkout_dir=""
agent_pid=""
mode=""
CALIBER_TMP=""
# The agent, and in plugin mode everything it started (the stdio MCP servers of your
# settings): its whole tree, which a kill of the agent alone would leave running.
# shellcheck disable=SC2317,SC2329  # run by cleanup, from the traps below
stop_agent() {
  [ -n "${agent_pid}" ] || return 0
  if [ "${mode}" = "plugin" ] && [ -f "${CALIBER_TMP}/plugin.py" ]; then
    python3 -I "${CALIBER_TMP}/plugin.py" kill "${agent_pid}" 2> /dev/null ||
      kill -TERM "${agent_pid}" 2> /dev/null || true
  else
    kill -TERM "${agent_pid}" 2> /dev/null || true
  fi
}
# shellcheck disable=SC2317,SC2329  # run by the traps below
cleanup() {
  stop_agent
  if [ -n "${checkout_dir}" ]; then
    git -C "${root}" worktree remove --force "${checkout_dir}" > /dev/null 2>&1 || true
  fi
  if [ -n "${fresh}" ] && [ -d "${fresh}" ]; then
    rm -rf -- "${fresh}"
  fi
  if [ -n "${PRIVATE_ROOT}" ] && [ -d "${PRIVATE_ROOT}" ]; then
    chmod -R u+w "${PRIVATE_ROOT}" 2> /dev/null || true
    rm -rf -- "${PRIVATE_ROOT}"
  fi
  git -C "${root}" worktree prune > /dev/null 2>&1 || true
  if [ "$(cut -d' ' -f1 "${lock}" 2> /dev/null || true)" = "$$" ]; then
    rm -f "${lock}"
  fi
}
trap cleanup EXIT
trap 'echo "Caliber check: stopped (a newer push of this branch, or a signal)."; exit 143' TERM INT HUP

stop() {
  echo "Caliber check: $*"
  exit 0
}

echo "Caliber check on push: ${branch} at ${sha} ($(date '+%Y-%m-%d %H:%M:%S'))"
command -v claude > /dev/null 2>&1 || stop "not started: the claude CLI is not installed."
if [ -n "${CALIBER_TOKEN:-}" ]; then
  mode="token"
  # The agent runs in restricted mode (below): a CLI without it cannot be held to the checkout.
  claude --help 2> /dev/null | grep -q -- '--restricted' ||
    stop "not started: this claude CLI has no --restricted mode; update it (npm i -g @anthropic-ai/claude-code)."
else
  mode="plugin"
  echo "Caliber check: no CALIBER_TOKEN; the Caliber plugin's sign-in is used."
fi

# This clone's project, read before the block (plugin mode; a token is one project's): only
# the clone's own `git config --local caliber.project` counts, and only a slug as Caliber
# makes one. Anything else is named in this log and ignored, never put in the prompt.
CALIBER_PROJECT=""
if [ "${mode}" = "plugin" ]; then
  CALIBER_PROJECT="$(git -C "${root}" config --local --get caliber.project 2> /dev/null || true)"
  slug_re='^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
  if [ -n "${CALIBER_PROJECT}" ] && ! [[ "${CALIBER_PROJECT}" =~ ${slug_re} ]]; then
    shown="$(printf '%s' "${CALIBER_PROJECT}" | tr -c '[:print:]' '?' | cut -c1-100)"
    echo "Caliber check: this clone's caliber.project (${shown}) is not a project slug; ignored."
    CALIBER_PROJECT=""
  fi
fi
export CALIBER_PROJECT

# 2. The endpoint and the repository, as Caliber names them. The endpoint is the one
# this clone was set up with, not what the working tree says now: the token goes there.
# (Token mode only: the plugin has its own server.)
if [ "${mode}" = "token" ]; then
if [ -z "${CALIBER_MCP_URL:-}" ]; then
  CALIBER_MCP_URL="$(git -C "${root}" config --get caliber.mcpUrl 2> /dev/null || true)"
fi
[ -n "${CALIBER_MCP_URL}" ] || stop "not started: this clone has no Caliber endpoint (run .caliber/hooks/pre-push --install, or /caliber:setup)."
# https, or http on this machine; the host compared whole, and no credentials in it (nor
# in the log: a user and password in it are not repeated).
shown="$(printf '%s' "${CALIBER_MCP_URL}" | sed -E 's#^([A-Za-z][A-Za-z0-9+.-]*://)[^/]*@#\1#')"
python3 -I - "${CALIBER_MCP_URL}" << 'PY' || stop "not started: the Caliber endpoint must be an https URL without credentials (${shown})."
import re, sys
from urllib.parse import urlsplit
try:
    url = urlsplit(sys.argv[1])
    host = url.hostname or ""
    local = host in ("localhost", "127.0.0.1", "::1")
    plain = re.fullmatch(r"https?://[A-Za-z0-9.\-:\[\]]+(/[A-Za-z0-9._~/%\-]*)?", sys.argv[1])
    ok = plain and (url.scheme == "https" or (url.scheme == "http" and local)) and host \
        and url.username is None and url.password is None
except ValueError:
    ok = False
sys.exit(0 if ok else 1)
PY
export CALIBER_MCP_URL
fi

# The repository's address without credentials: https://<host>/<path>.
CALIBER_REPO="$(git -C "${root}" remote get-url "${remote}" 2> /dev/null | python3 -I -c '
import re, sys
url = sys.stdin.read().strip()
match = (re.match(r"^[a-z][a-z0-9+.-]*://(?:[^@/]*@)?([^/:]+)(?::\d+)?/(.+)$", url, re.I)
         or re.match(r"^(?:[^@/]+@)?([^/:]+):(.+)$", url))
if match:
    host, path = match.group(1).lower(), match.group(2).strip("/")
    path = path[:-4] if path.endswith(".git") else path
    if re.match(r"^[A-Za-z0-9._~/-]+$", path):
        print("https://" + host + "/" + path)
')"
export CALIBER_REPO

# One JSON-RPC call to the MCP endpoint: rpc <method> <params-json>; prints the
# response body. The token is read from the environment, never from an argument.
rpc() {
  python3 -I - "$1" "$2" << 'PY'
import json, os, sys, urllib.request
method, params = sys.argv[1], json.loads(sys.argv[2])
body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
req = urllib.request.Request(
    os.environ["CALIBER_MCP_URL"], data=body, method="POST",
    headers={"Content-Type": "application/json",
             "Accept": "application/json, text/event-stream",
             "Authorization": "Bearer " + os.environ["CALIBER_TOKEN"]})
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
except Exception as exc:  # noqa: BLE001 - any failure is a request failure
    print("Caliber check: request failed: " + type(exc).__name__ + ": " + str(exc), file=sys.stderr)
    sys.exit(2)
sys.stdout.write(raw.decode("utf-8", "replace"))
PY
}

# get_check_status arguments as JSON: status_args <key> <value> [<key> <value>]
status_args() {
  python3 -I - "$@" << 'PY'
import json, os, sys
args = dict(zip(sys.argv[1::2], sys.argv[2::2]))
if "pr_number" in args:
    args["pr_number"] = int(args["pr_number"])
if os.environ.get("CALIBER_REPO"):
    args["repo"] = os.environ["CALIBER_REPO"]
print(json.dumps({"name": "get_check_status", "arguments": args}))
PY
}

# 3. Wait for the push to land: git moves the remote-tracking ref when it did. A push
# that was refused (or a dry run) never does, and its commit is not checked. A clone
# whose fetch refspecs do not cover the branch (single-branch, a mirror) has no such
# ref: there is nothing to wait on, and the check starts at once.
tracking="$(git -C "${root}" config --get-all "remote.${remote}.fetch" 2> /dev/null | python3 -I -c '
import sys
ref = "refs/heads/" + sys.argv[1]
for line in sys.stdin:
    src, _, dst = line.strip().lstrip("+").partition(":")
    if not dst:
        continue
    if src == ref:
        print(dst)
        break
    if src.endswith("*") and dst.endswith("*") and ref.startswith(src[:-1]):
        print(dst[:-1] + ref[len(src) - 1:])
        break
' "${branch}" || true)"
if [ -n "${tracking}" ]; then
  waited=0
  while [ "$(git -C "${root}" rev-parse --verify --quiet "${tracking}" || true)" != "${sha}" ]; do
    if [ "${waited}" -ge 300 ]; then
      stop "not started: ${sha} did not reach ${remote}/${branch} (the push was refused, or a newer one replaced it)."
    fi
    sleep 1
    waited=$((waited + 1))
  done
else
  echo "Caliber check: no remote-tracking ref for ${branch} in this clone; not waiting for the push."
fi

# 4. Ask Caliber what to do. The answer names the project's check_timing, the base
# branches of its open pull requests, and the check of this branch when it has one.
# (Token mode. In plugin mode the agent asks: the `check` tool's first answer says
# whether there is anything to check, and the run ends there when there is not.)
pr_number=""
if [ "${mode}" = "plugin" ]; then
  DECISION="branch"
else
BRANCH_JSON="$(rpc tools/call "$(status_args head_branch "${branch}")")" || stop "not started: Caliber did not answer."
COMMIT_JSON=""
if printf '%s' "${BRANCH_JSON}" | grep -q 'no open check for branch'; then
  # No pull request and no check of the branch yet: the commit's answer has the policy.
  COMMIT_JSON="$(rpc tools/call "$(status_args head_sha "${sha}")")" || stop "not started: Caliber did not answer."
fi
DECISION="$(BRANCH_JSON="${BRANCH_JSON}" COMMIT_JSON="${COMMIT_JSON}" python3 -I - "${branch}" "${sha}" << 'PY'
import json, os, sys
branch, sha = sys.argv[1], sys.argv[2]


def body(raw):
    """(the tool's answer, None) or (None, why it has none)."""
    try:
        data = json.loads(raw)
    except ValueError:
        return None, "Caliber's answer was not JSON"
    if "error" in data:
        return None, str((data["error"] or {}).get("message"))
    result = data.get("result") or {}
    if result.get("isError"):
        return None, "".join(c.get("text", "") for c in result.get("content", [])
                             if isinstance(c, dict))
    return result.get("structuredContent") or {}, None


new = bool(os.environ.get("COMMIT_JSON"))
status, error = body(os.environ["COMMIT_JSON"] if new else os.environ["BRANCH_JSON"])
if status is None:
    print("stop not started: " + " ".join((error or "no answer").split())[:300])
    sys.exit(0)
timing = status.get("check_timing")
change = status.get("change") or {}
if timing == "manual":
    print("stop not started: this project runs no automatic checks (check_timing is manual).")
elif branch in (status.get("base_branches") or []):
    print("stop not started: " + branch + " is the base branch of an open pull request.")
elif not change and timing == "before_pr":
    print("branch")
elif not change:
    print("stop not started: no pull request yet (this project checks after the pull "
          "request opens).")
else:
    # The pull request, or the check an earlier push made for the branch.
    checks = status.get("checks") or {}
    gap = any(isinstance(row, dict) and row.get("state") == "gap"
              for key, row in checks.items() if key.endswith("_audit"))
    conformance = (checks.get("conformance") or {}).get("state") in ("missing", "stale")
    if status.get("head_sha") == sha and not gap and not conformance:
        print("stop nothing to check: every audit covers " + sha[:7] + " (" +
              str(status.get("status")) + ").")
    elif change.get("pr_number") is not None:
        print("pr " + str(int(change["pr_number"])))
    else:
        print("branch")
PY
)"
fi
case "${DECISION}" in
  "pr "*)
    pr_number="${DECISION#pr }"
    echo "Caliber check: pull request #${pr_number}."
    ;;
  branch)
    pr_number=""
    if [ "${mode}" = "plugin" ]; then
      echo "Caliber check: the agent asks Caliber what to check on ${branch}."
    else
      echo "Caliber check: no pull request yet; checking the branch."
    fi
    ;;
  "stop "*) stop "${DECISION#stop }" ;;
  *) stop "not started: Caliber's answer could not be read." ;;
esac

# 5. The pushed commit as a detached worktree in a private directory outside the
# checkout: switching branch or editing here does not change what is checked.
umask 077
git -C "${root}" worktree prune > /dev/null 2>&1 || true
# A directory of this user alone under /tmp (not $TMPDIR, which is full of other
# programs' files): few neighbours, so the agent can be denied each of them below.
base="$(cd "${CALIBER_PUSH_TMP:-/tmp}" 2> /dev/null && pwd -P)" || stop "not started: no temporary directory."
runs="${base}/caliber-push-$(id -u)"
mkdir -p "${runs}" 2> /dev/null || true
if [ ! -d "${runs}" ] || [ -L "${runs}" ] || [ ! -O "${runs}" ]; then
  stop "not started: ${runs} is not a directory of yours."
fi
chmod 700 "${runs}"
# What a run that was killed left behind (its token file, its worktree).
for stale in "${runs}"/run.*; do
  [ -d "${stale}" ] || continue
  stale_pid="$(cat "${stale}/pid" 2> /dev/null || true)"
  case "${stale_pid}" in '' | *[!0-9]*) continue ;; esac     # every run.* has its pid
  if ! kill -0 "${stale_pid}" 2> /dev/null || ! is_runner "${stale_pid}"; then
    git -C "${root}" worktree remove --force "${stale}/checkout" > /dev/null 2>&1 || true
    chmod -R u+w "${stale}" 2> /dev/null || true
    rm -rf -- "${stale}"
  fi
done
git -C "${root}" worktree prune > /dev/null 2>&1 || true
# Made under a name the sweep of another run does not look at, and renamed once it says
# whose it is.
fresh="$(mktemp -d "${runs}/new.XXXXXX")" || { fresh=""; stop "not started: no temporary directory."; }
printf '%s\n' "$$" > "${fresh}/pid" || stop "not started: no temporary directory."
PRIVATE_ROOT="${runs}/run.${fresh##*/new.}"
mv "${fresh}" "${PRIVATE_ROOT}" || { PRIVATE_ROOT=""; stop "not started: no temporary directory."; }
fresh=""
case "${PRIVATE_ROOT}/" in
  "${root}/"*) stop "not started: the temporary directory is inside the checkout (${PRIVATE_ROOT})." ;;
esac
checkout_dir="${PRIVATE_ROOT}/checkout"
if ! git -C "${root}" worktree add --detach "${checkout_dir}" "${sha}" > /dev/null 2>&1; then
  checkout_dir=""
  stop "not started: git could not check ${sha} out."
fi
# The agent's private files live beside the checkout, not in it.
CALIBER_TMP="${PRIVATE_ROOT}/private"
mkdir "${CALIBER_TMP}"
tmp_real="${CALIBER_TMP}"

# Plugin mode's helpers, one file (bash 3.2 misreads a here-document inside $(...), so
# none is run that way): the prompt, the run's system/init line, its status line, and
# stopping the agent's whole process tree.
if [ "${mode}" = "plugin" ]; then
cat > "${CALIBER_TMP}/plugin.py" << 'PY'
import json
import os
import re
import subprocess
import sys
import time

NAME = "plugin:caliber:caliber"


SLUG = r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?"


def block_slug(checkout):
    """The project the Caliber block of the checkout names, or None. A project slug as
    Caliber makes one; anything else in the pushed commit is not repeated."""
    for name in ("CLAUDE.md", "AGENTS.md"):
        try:
            with open(os.path.join(checkout, name), encoding="utf-8", errors="replace") as fh:
                text = fh.read(1000000)
        except OSError:
            continue
        start = text.find("<!-- caliber:start")
        if start < 0:
            continue
        end = text.find("<!-- caliber:end -->", start)
        block = text[start:end if end >= 0 else len(text)]
        found = re.search(r'get_project\(project="([^"]*)"\)', block) \
            or re.search(r"Caliber project `([^`]*)`", block)
        return found.group(1) if found and re.fullmatch(SLUG, found.group(1)) else None
    return None


def prompt(checkout):
    """The fixed prompt: the `check` tool, with this clone's project (`caliber.project`,
    checked by the runner), else the project of the repository's block."""
    slug = os.environ.get("CALIBER_PROJECT") or None
    if slug and not re.fullmatch(SLUG, slug):
        slug = None
    if not slug:
        slug = block_slug(checkout)
    arguments = ["`unattended=true`", "`push=no`",
                 "`head_branch=" + json.dumps(os.environ["BRANCH"]) + "`"]
    if os.environ.get("CALIBER_REPO"):
        arguments.append("`repo=" + json.dumps(os.environ["CALIBER_REPO"]) + "`")
    if slug:
        arguments.append("`project=" + json.dumps(slug) + "`")
    first = "" if slug else (
        "Without a project slug, call `projects`; if it lists exactly one project use "
        "it (pass its slug as `project`), otherwise stop with `CALIBER_STATUS: not started: "
        "name the project (run /caliber:setup to write the Caliber block, or git config "
        "--local caliber.project <slug>)`. ")
    print(first + "Call the Caliber tool `check` with " + ", ".join(arguments) + ", follow "
          "what it returns, and end with one line `CALIBER_STATUS: <status> <url>`: the "
          "check's status as `get_check_status` reports it at the end, and its url.")


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    try:                        # an exited agent nobody reaped yet is over
        with open("/proc/%d/stat" % pid) as fh:
            return fh.read().rsplit(")", 1)[1].split()[0] != "Z"
    except OSError:
        pass
    try:
        state = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True,
                               text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return True
    return bool(state) and not state.startswith("Z")


def first_init(path, final):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if not line.endswith("\n") and not final:
                    return None             # still being written
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if isinstance(event, dict) and event.get("type") == "system" \
                        and event.get("subtype") == "init":
                    return event
    except OSError:
        pass
    return None


def init(path, pid):
    """The status of the plugin's server in the run's system/init line."""
    deadline = time.time() + 300
    while True:
        event = first_init(path, False)
        if event is not None:
            break
        if not alive(pid):
            event = first_init(path, True)
            if event is None:
                print("no answer")
                return
            break
        if time.time() > deadline:
            print("timed out")
            return
        time.sleep(0.1)
    errors = event.get("plugin_errors")
    if errors:
        sys.stderr.write("Caliber check: plugin errors: "
                         + " ".join(json.dumps(errors).split())[:300] + "\n")
    status = "absent"
    for server in event.get("mcp_servers") or []:
        if isinstance(server, dict) and server.get("name") == NAME:
            status = str(server.get("status") or "absent")
            break
    print("".join(c for c in status if c.isalnum() or c in "-_")[:40] or "absent")


def result(path):
    """The text of the run's last `result` event (or of the whole file as one JSON)."""
    text = None
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            raw = fh.read()
    except OSError:
        return ""
    for line in raw.splitlines():
        try:
            data = json.loads(line)
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("type") == "result" \
                and isinstance(data.get("result"), str):
            text = data["result"]
    if text is None:
        try:
            data = json.loads(raw)
        except ValueError:
            data = None
        if isinstance(data, dict) and isinstance(data.get("result"), str):
            text = data["result"]
    return text or ""


def summary(path):
    """Two lines: the headline, and the check's url, from the last CALIBER_STATUS line."""
    # `not started: <why>` when the run could not name the project (its `<slug>` is the one
    # pair of angle brackets taken).
    found = re.findall(r"CALIBER_STATUS:[ \t]*(not started:(?:[^\n`<>\x22]|<slug>){1,200}"
                       r"|[A-Za-z_-]{1,40})"
                       r"(?:[ \t]+(https?://[^\s`<>\x22\x27]{1,300}))?", result(path))
    if not found:
        print("finished; see the log")
        print("")
        return
    state, url = found[-1]
    state = state.strip()
    words = {"passed": "Passed", "signed_off": "Passed and signed off", "blocked": "Blocked",
             "pending": "Pending"}
    print(words.get(state.lower(), state))
    print(url)


def kill(pid):
    """TERM to the agent and every process under it."""
    try:
        rows = subprocess.run(["ps", "-A", "-o", "pid=", "-o", "ppid="], capture_output=True,
                              text=True, timeout=10).stdout.split("\n")
    except (OSError, subprocess.SubprocessError):
        rows = []
    children = {}
    for row in rows:
        parts = row.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            children.setdefault(int(parts[1]), []).append(int(parts[0]))
    tree, todo = [], [pid]
    while todo:
        current = todo.pop()
        if current in tree:
            continue
        tree.append(current)
        todo.extend(children.get(current, []))
    for target in tree:
        try:
            os.kill(target, 15)
        except OSError:
            pass


if __name__ == "__main__":
    what = sys.argv[1]
    if what == "prompt":
        prompt(sys.argv[2])
    elif what == "init":
        init(sys.argv[2], int(sys.argv[3]))
    elif what == "summary":
        summary(sys.argv[2])
    elif what == "kill":
        kill(int(sys.argv[2]))
PY
fi

MCP_CONFIG="${CALIBER_TMP}/caliber-mcp.json"
if [ "${mode}" = "token" ]; then
python3 -I - "${MCP_CONFIG}" << 'PY'
import json, os, sys
config = {"mcpServers": {"caliber": {
    "type": "http",
    "url": os.environ["CALIBER_MCP_URL"],
    "headers": {"Authorization": "Bearer " + os.environ["CALIBER_TOKEN"]},
}}}
with open(sys.argv[1], "w") as fh:
    json.dump(config, fh)
PY
fi

# 6. The check prompt, unattended. Plugin mode: a fixed text that has the agent call the
# `check` tool (with this clone's `caliber.project`, else the project the repository's
# Caliber block names, when it has one)
# and end with the status it found.
if [ "${mode}" = "plugin" ]; then
PROMPT="$(BRANCH="${branch}" python3 -I "${CALIBER_TMP}/plugin.py" prompt "${checkout_dir}")" ||
  stop "not started: the check prompt could not be written."
else
PROMPT_JSON="$(PR_NUMBER="${pr_number}" BRANCH="${branch}" python3 -I -c '
import json, os
arguments = {"unattended": "true", "push": "no"}
if os.environ["PR_NUMBER"]:
    arguments["pr_number"] = os.environ["PR_NUMBER"]
else:
    arguments["head_branch"] = os.environ["BRANCH"]
if os.environ.get("CALIBER_REPO"):
    arguments["repo"] = os.environ["CALIBER_REPO"]
print(json.dumps({"name": "check", "arguments": arguments}))
')"
PROMPT_JSON="$(rpc prompts/get "${PROMPT_JSON}")" || stop "not started: Caliber did not answer."
PROMPT="$(printf '%s' "${PROMPT_JSON}" | python3 -I -c '
import json, sys
try:
    data = json.load(sys.stdin)
    if "error" in data:
        print("REFUSED " + " ".join(str(data["error"].get("message")).split())[:300])
    else:
        print(data["result"]["messages"][0]["content"]["text"])
except (ValueError, KeyError, IndexError, TypeError):
    print("REFUSED the answer could not be read")
')"
case "${PROMPT}" in
  "REFUSED "*) stop "not started: Caliber gave no check prompt: ${PROMPT#REFUSED }" ;;
  "") stop "not started: Caliber gave no check prompt." ;;
esac
fi

# 7. The git the agent may run: caliber-git, a wrapper written into the private
# directory, the one the CI job uses (ci/caliber-check.sh; a test keeps the two equal).
# >>> shared with ci/caliber-check.sh
GIT_WRAPPER="${CALIBER_TMP}/bin/caliber-git"
mkdir "${CALIBER_TMP}/bin"
{
  printf '#!/usr/bin/env python3\n'
  printf 'ROOT = %s\n' "$(python3 -I -c 'import json, sys; print(json.dumps(sys.argv[1]))' "${checkout_dir}")"
  cat <<'CALIBER_GIT'
import os
import sys

SUBCOMMANDS = ("diff", "log", "show", "merge-base", "rev-parse", "rev-list")
# Long options that read or write files outside the checkout, run a program or repoint
# git. git takes any unambiguous prefix of a long option, so every prefix is refused.
BLOCKED = ("--no-index", "--output", "--output-directory", "--ext-diff", "--textconv",
           "--orderfile", "--git-dir", "--work-tree", "--exec-path", "--namespace",
           "--config", "--config-env", "--paginate", "--super-prefix")
ALLOWED_EXACT = ("--text",)  # a real option that is also a prefix of --textconv
# Short options whose value is stuck to them (-U0, -Sfoo): the rest of the cluster is
# that value, not more options. -O<orderfile> reads a file and is refused.
VALUE_SHORT = "UMCBlSGXInL"
ROOT = os.path.realpath(ROOT)
GIT_DIR = os.path.join(ROOT, ".git")


def refuse(reason):
    sys.stderr.write("caliber-git: refused: " + reason + "\n")
    sys.exit(2)


def inside(path, base):
    return path == base or path.startswith(base + os.sep)


def check_option(arg):
    if arg.startswith("--"):
        name = arg.split("=", 1)[0]
        if name in ALLOWED_EXACT:
            return
        for blocked in BLOCKED:
            if len(name) > 2 and blocked.startswith(name):
                refuse(arg + " (" + blocked + " is not allowed)")
        return
    for char in arg[1:]:
        if char == "O":
            refuse(arg + " (-O reads a file)")
        if char in VALUE_SHORT:
            return


def check_path(arg):
    candidate = os.path.join(ROOT, arg)
    if inside(os.path.normpath(candidate), GIT_DIR):
        refuse(arg + " is in .git")
    if not (os.path.isabs(arg) or ".." in arg.split("/") or os.path.lexists(candidate)):
        return  # a revision, a pattern or a path that does not exist
    real = os.path.realpath(candidate)
    if not inside(real, ROOT):
        refuse(arg + " resolves outside the checkout")
    if inside(real, GIT_DIR):
        refuse(arg + " resolves into .git")


def main(argv):
    if not argv or argv[0] not in SUBCOMMANDS:
        refuse("the first argument must be one of " + ", ".join(SUBCOMMANDS))
    sub, args = argv[0], argv[1:]
    paths_only = False
    for arg in args:
        if "\0" in arg:
            refuse("NUL in an argument")
        if paths_only:
            check_path(arg)
        elif arg == "--":
            paths_only = True
        elif arg.startswith("-") and arg != "-":
            check_option(arg)
        else:
            check_path(arg)
    safe = ["--no-ext-diff", "--no-textconv"] if sub in ("diff", "log", "show") else []
    env = {k: v for k, v in os.environ.items()
           if not k.startswith("GIT_") and k != "ANTHROPIC_API_KEY"}
    env["GIT_PAGER"] = "cat"
    command = ["git", "--no-pager", "-C", ROOT, "-c", "core.fsmonitor=false",
               "-c", "core.hooksPath=/dev/null", sub] + safe + args
    try:
        os.execvpe("git", command, env)
    except OSError as exc:
        refuse("cannot run git: " + str(exc))


main(sys.argv[1:])
CALIBER_GIT
} > "${GIT_WRAPPER}"
chmod 500 "${GIT_WRAPPER}"

# Symlinks in the checkout that lead outside it (or into .git): the PR controls them,
# so each gets its own Read deny rule in case the file tools match the link's path.
LINK_RULES=()
while IFS= read -r -d '' rule; do
  LINK_RULES+=("${rule}")
done < <(python3 -I - "${checkout_dir}" <<'PY'
import os, sys
root = os.path.realpath(sys.argv[1])
git_dir = os.path.join(root, ".git")
def inside(path, base):
    return path == base or path.startswith(base + os.sep)
for dirpath, dirnames, filenames in os.walk(root):
    if dirpath == root and ".git" in dirnames:
        dirnames.remove(".git")
    for name in dirnames + filenames:
        path = os.path.join(dirpath, name)
        if os.path.islink(path):
            real = os.path.realpath(path)
            if not inside(real, root) or inside(real, git_dir):
                sys.stdout.write("Read(/" + path + ")\0Read(/" + path + "/**)\0")
PY
)
if [ "${#LINK_RULES[@]}" -gt 0 ]; then
  echo "Caliber check: $(( ${#LINK_RULES[@]} / 2 )) symlink(s) in the checkout lead outside it; the agent may not read them."
fi
# <<< shared with ci/caliber-check.sh

# The one command the agent may run. The CLI lets some read-only commands through
# without a rule; this hook, given to it with --settings, refuses every Bash command
# that is not caliber-git with plain arguments. It tells the wrapper by its path, so
# that path must be one word.
case "${GIT_WRAPPER}" in
  *[!A-Za-z0-9_./-]*) stop "not started: the temporary directory has a space or another special character in its path (${GIT_WRAPPER})." ;;
esac
# The Caliber tools a check needs, the ones a CI token is held to: an unattended run
# does not save specs, set statuses, comment or triage findings in your name.
CALIBER_TOOLS=(mcp__caliber__get_check_status mcp__caliber__start_audit
  mcp__caliber__submit_audit mcp__caliber__verify_spec mcp__caliber__list_findings
  mcp__caliber__link_pr mcp__caliber__get_project mcp__caliber__read_spec
  mcp__caliber__search_specs mcp__caliber__get_workflow mcp__caliber__check)
# The same tools as the plugin's server names them (plugin mode), and `projects`
# (read-only): the sign-in may see several projects, and a checkout without the block
# names none. `list_projects` is its old name, kept while hooks v3 are out.
PLUGIN_TOOLS=("${CALIBER_TOOLS[@]/#mcp__caliber__/mcp__plugin_caliber_caliber__}"
  mcp__plugin_caliber_caliber__projects mcp__plugin_caliber_caliber__list_projects)

ONLY_GIT="${CALIBER_TMP}/bin/only-caliber-git"
{
  printf '#!/usr/bin/env python3\n'
  printf 'WRAPPER = %s\n' "$(python3 -I -c 'import json, sys; print(json.dumps(sys.argv[1]))' "${GIT_WRAPPER}")"
  # Plugin mode loads your settings, whose permissions may allow other servers' tools
  # (or skip the asking): the hook refuses every MCP tool but the check's. Token mode has
  # the Caliber server alone.
  if [ "${mode}" = "plugin" ]; then
    printf 'MCP_TOOLS = %s\n' "$(python3 -I -c 'import json, sys; print(json.dumps(sys.argv[1:]))' "${PLUGIN_TOOLS[@]}")"
  else
    printf 'MCP_TOOLS = None\n'
  fi
  cat << 'ONLY_GIT'
import json
import re
import sys


def refuse():
    sys.stderr.write("Only caliber-git <subcommand> <args> may be run here, one command at a time.\n")
    sys.exit(2)


# Anything it cannot read is refused: the hook never lets a command through by failing.
try:
    data = json.load(sys.stdin)
    tool = data.get("tool_name")
    command = (data.get("tool_input") or {}).get("command") if tool == "Bash" else None
except Exception:
    refuse()
if MCP_TOOLS is not None and isinstance(tool, str) and tool.startswith("mcp__") \
        and tool not in MCP_TOOLS:
    sys.stderr.write("Only the Caliber check's tools may be called here.\n")
    sys.exit(2)
if tool != "Bash":
    sys.exit(0)
# The wrapper, then words a shell (bash or zsh) takes as they are: plain characters, or
# one word in single quotes for a path with brackets, parentheses, a space, % or #.
# No substitution, redirection, glob outside quotes, or second command.
PLAIN = r"[A-Za-z0-9_./:@^,+=~{}-]+"
QUOTED = r"\x27[A-Za-z0-9_./:@^,+=~{}\[\]()%# -]+\x27"
if not isinstance(command, str) or not command.startswith(WRAPPER) \
        or not re.fullmatch("( (?:" + PLAIN + "|" + QUOTED + "))*", command[len(WRAPPER):]):
    refuse()
ONLY_GIT
} > "${ONLY_GIT}"
chmod 500 "${ONLY_GIT}"
# Token mode: every Bash call goes through the hook; plugin mode: every call.
matcher="Bash"
[ "${mode}" = "token" ] || matcher=".*"
AGENT_SETTINGS="$(python3 -I -c '
import json, sys
print(json.dumps({"hooks": {"PreToolUse": [{"matcher": sys.argv[2], "hooks": [
    {"type": "command", "command": sys.argv[1]}]}]}}))
' "${ONLY_GIT}" "${matcher}")"


PROMPT="In this run use git only as \`${GIT_WRAPPER} <subcommand> <args>\` (subcommands: diff, log, show, merge-base, rev-parse, rev-list; it runs in the checkout root, so give paths relative to it; put a path that has brackets, parentheses, a space, % or # in single quotes, e.g. 'app/[slug]/page.tsx'); one command at a time, no pipes or redirection; a plain \`git\` command is not allowed. Read only files inside the checkout, ${checkout_dir}.

${PROMPT}"

# 8. The agent: read-only tools, caliber-git, no push. What it audits is untrusted
# input. Token mode runs it restricted: its file tools are confined to the checkout (not
# the private directory, whose MCP config carries the token, not another run, the
# repository's git directory, the working tree the push came from or your home), the
# only command it may run is caliber-git (a hook of this run refuses any other), the
# only Caliber tools are the ones a check needs, and the settings files of the pushed
# commit (hooks, permissions) and of your account are not loaded. It does not get the
# token in its environment.
# Plugin mode cannot be restricted (restricted mode loads no installed plugin and no
# stored sign-in) and keeps the plugin's server (--strict-mcp-config drops it): it loads
# your own settings, plugins and MCP servers (--setting-sources user) and never the
# pushed commit's .claude/settings*.json. Your permission mode is set back to asking
# (nobody answers, so what is not allowed is refused), the hook refuses every MCP tool
# but the check's, and the allow-list and the deny-list below are the same.
DENIED=("Read(/${CALIBER_TMP}/**)" "Read(/${tmp_real}/**)"
  "Read(/${common}/**)" "Read(/${root}/**)" "Read(/${checkout_dir}/.git)"
  "Read(//proc/**)" "Read(//dev/**)" "Read(//sys/**)" "Read(~/**)"
  Edit Write NotebookEdit WebFetch WebSearch
  ${LINK_RULES[@]+"${LINK_RULES[@]}"})
# Other runs of yours (another clone or branch pushed at the same time) keep their
# private files next to this one, in token mode an MCP config with the token: the agent
# reads none of them. Every run's private directory by pattern (a run that starts later
# too), a run being made, and every other run directory there now.
DENIED+=("Read(/${runs}/run.*/private/**)" "Read(/${runs}/new.*/**)")
for sibling in "${runs}"/run.*; do
  if [ -d "${sibling}" ] && [ "${sibling}" != "${PRIVATE_ROOT}" ]; then
    DENIED+=("Read(/${sibling}/**)")
  fi
done
RUN_JSON="${CALIBER_TMP}/caliber-run.json"
echo "Caliber check: the agent is running (this takes a few minutes)."
if [ "${mode}" = "token" ]; then
  (
    cd "${checkout_dir}" || exit 1
    exec env -u CALIBER_TOKEN \
      claude -p "${PROMPT}" \
      --restricted --tools "Bash,Read,Grep,Glob" --settings "${AGENT_SETTINGS}" \
      --mcp-config "${MCP_CONFIG}" --strict-mcp-config \
      --allowedTools "${CALIBER_TOOLS[@]}" "Bash(${GIT_WRAPPER}:*)" Read Grep Glob \
      --disallowedTools "${DENIED[@]}" \
      --max-turns 200 --output-format json > "${RUN_JSON}"
  ) &
else
  (
    cd "${checkout_dir}" || exit 1
    exec env -u CALIBER_TOKEN \
      claude -p "${PROMPT}" \
      --setting-sources user --settings "${AGENT_SETTINGS}" --permission-mode default \
      --tools "Bash,Read,Grep,Glob" \
      --allowedTools "${PLUGIN_TOOLS[@]}" "Bash(${GIT_WRAPPER}:*)" Read Grep Glob \
      --disallowedTools "${DENIED[@]}" \
      --max-turns 200 --output-format stream-json --verbose > "${RUN_JSON}"
  ) &
fi
agent_pid=$!

# Plugin mode: the run's first line (system/init) says whether the plugin's server is
# signed in. Anything but `connected` stops the run before it does any work.
if [ "${mode}" = "plugin" ]; then
  server="$(python3 -I "${CALIBER_TMP}/plugin.py" init "${RUN_JSON}" "${agent_pid}")"
  case "${server}" in
    connected) echo "Caliber check: the Caliber plugin's server is signed in." ;;
    needs-auth)
      stop "not started: sign in to Caliber once in Claude Code (\`/mcp\` → caliber, or \`claude mcp login plugin:caliber:caliber\`)."
      ;;
    *) stop "not started: the Caliber plugin's server did not start (${server:-absent}); open Claude Code and run /mcp." ;;
  esac
fi
# Waited for, not run in the foreground: a signal stops the run (and the agent) at once.
wait "${agent_pid}"
agent_exit=$?
agent_pid=""
if [ "${agent_exit}" -ne 0 ]; then
  if [ "${mode}" = "token" ]; then
    echo "Caliber check: the agent exited with ${agent_exit}; asking Caliber for the status anyway."
  else
    echo "Caliber check: the agent exited with ${agent_exit}."
  fi
fi
# The agent's last words: the one result of token mode, the last `result` event of the
# plugin mode's stream.
python3 -I - "${RUN_JSON}" << 'PY' || true
import json, sys
text = None
try:
    with open(sys.argv[1], encoding="utf-8", errors="replace") as fh:
        raw = fh.read()
except OSError:
    sys.exit(0)
for line in raw.splitlines():
    try:
        data = json.loads(line)
    except ValueError:
        continue
    if isinstance(data, dict) and data.get("type") == "result" \
            and isinstance(data.get("result"), str):
        text = data["result"]
if text is None:                # one JSON that is not on one line
    try:
        data = json.loads(raw)
    except ValueError:
        data = None
    if isinstance(data, dict) and isinstance(data.get("result"), str):
        text = data["result"]
if isinstance(text, str) and text.strip():
    print("--- agent summary ---")
    print(text.strip())
    print("---------------------")
PY

# 9. What Caliber holds now: the log's last lines and a desktop notification. Plugin
# mode makes no call of its own: the agent's last `CALIBER_STATUS:` line says it.
if [ "${mode}" = "plugin" ]; then
SUMMARY="$(python3 -I "${CALIBER_TMP}/plugin.py" summary "${RUN_JSON}")"
else
if [ -n "${pr_number}" ]; then
  STATUS_JSON="$(rpc tools/call "$(status_args pr_number "${pr_number}")")" || STATUS_JSON=""
else
  STATUS_JSON="$(rpc tools/call "$(status_args head_branch "${branch}")")" || STATUS_JSON=""
fi
SUMMARY="$(printf '%s' "${STATUS_JSON}" | python3 -I -c '
import json, sys
try:
    data = json.load(sys.stdin)
except ValueError:
    data = {}
status = (data.get("result") or {}).get("structuredContent") or {}
state = status.get("status")
if not state:
    print("the check ran; Caliber did not return its status")
    print("")
    sys.exit(0)
words = {"passed": "Passed", "signed_off": "Passed and signed off", "blocked": "Blocked",
         "pending": "Pending"}
line = words.get(state, str(state))
action = " ".join(str(status.get("next_action") or "").split())
if action and not action.startswith("Passed"):
    line += " — " + action
print(line[:300])
print(str(status.get("url") or ""))
')"
fi
headline="$(printf '%s\n' "${SUMMARY}" | sed -n 1p)"
url="$(printf '%s\n' "${SUMMARY}" | sed -n 2p)"
echo "Caliber: ${headline}"
[ -z "${url}" ] || echo "${url}"

if [ "$(git -C "${root}" config --type=bool --get caliber.notify 2> /dev/null || true)" = "false" ]; then
  : # no desktop notification for this clone (or, with --global, this machine)
elif command -v osascript > /dev/null 2>&1; then
  osascript -e 'on run argv' \
    -e 'display notification (item 1 of argv) with title "Caliber" subtitle (item 2 of argv)' \
    -e 'end run' -- "${headline}" "${branch}" > /dev/null 2>&1 || true
elif command -v notify-send > /dev/null 2>&1; then
  # Its body is markup: `<slug>` of a "name the project" line is shown as written.
  body="$(printf '%s' "${headline}" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')"
  notify-send "Caliber — ${branch}" "${body}" > /dev/null 2>&1 || true
fi
exit 0
