#!/usr/bin/env python3
"""Claude Code usage statistics from local session transcripts.

Reads ~/.claude/projects/*/*.jsonl (plus subagent transcripts) and
~/.claude/history.jsonl, and reports:

  * per-day Claude active time vs. time spent waiting for the user
  * parallelism (how much work overlaps across sessions and subagents)
  * turn shape (turn length, reply latency, long turns)
  * behaviour signals (interrupts, denials, questions, plan mode, subagents)
  * long-term prompt habits from history.jsonl (slash commands, chores, acks)

It also writes three files into --out for the qualitative review:
  prompts_sample.txt   random sample of human prompts
  corrections.txt      what the user said after interrupts / tool denials
  report.json          every number printed, machine-readable

Only standard library. Nothing leaves the machine.

Usage:
  python3 -I usage-stats.py --out DIR [--days N] [--tz Europe/Zagreb]
                            [--sample 300] [--claude-dir ~/.claude]
"""
import argparse, collections, datetime, glob, json, os, random, re, sys
from zoneinfo import ZoneInfo

GAP = 10 * 60        # silent gap inside a turn above this = stall, not work
WAIT_CAP = 30 * 60   # user reply gap above this = session parked, not "waiting"

CHORE = re.compile(r'^(commit|push|open (a )?(draft )?pr|commit (this|and push).*|push (it|the branch)|'
                   r'resolve conflicts.*|update pr title.*|open a draft pr.*|commit and push.*)$')
ACK = re.compile(r'^(yes|ok|okay|continue|proceed|go ahead|confirmed|both|do it|implement|retry|y)\.?$')
STUCK = re.compile(r'are you stuck|what are you doing|still working\?|hello\?')
# Prompts that look like they carry a credential. Counted, never printed.
SECRET = re.compile(r'(password|passwd|pwd)\s*[:=]\s*\S|api[_ -]?key\s*[:=]|secret\s*[:=]\s*\S|bearer\s+[a-z0-9._-]{16,}|'
                    r'\bAKIA[0-9A-Z]{16}\b|\bsk-[a-z0-9_-]{16,}|\bgh[pousr]_[a-z0-9]{20,}|\bxox[abp]-[a-z0-9-]{10,}', re.I)


def ts(s, tz):
    return datetime.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(tz)


def load(path):
    out = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def chain(points):
    """points: sorted (time, ends_user_wait). Returns (intervals, stall_count).
    Consecutive events closer than GAP form one active interval. A gap that ends
    with the user answering a question/permission is a wait, not a stall."""
    iv, stalls, cs, ce = [], 0, None, None
    for t, user_wait in points:
        if cs is None:
            cs = ce = t
            continue
        g = (t - ce).total_seconds()
        if g <= GAP and not user_wait:
            ce = t
        else:
            iv.append((cs, ce))
            if not user_wait and g > GAP:
                stalls += 1
            cs = ce = t
    if cs is not None:
        iv.append((cs, ce))
    return iv, stalls


def union(iv):
    iv = sorted(iv)
    tot, cs, ce = 0.0, None, None
    for s, e in iv:
        if cs is None:
            cs, ce = s, e
        elif s <= ce:
            ce = max(ce, e)
        else:
            tot += (ce - cs).total_seconds()
            cs, ce = s, e
    if cs is not None:
        tot += (ce - cs).total_seconds()
    return tot


def concurrency(iv):
    pts = []
    for s, e in iv:
        pts += [(s, 1), (e, -1)]
    pts.sort()
    cur, prev, dist = 0, None, collections.Counter()
    for t, d in pts:
        if prev is not None and cur > 0:
            dist[cur] += (t - prev).total_seconds()
        cur += d
        prev = t
    return dist


def pct(a, p):
    a = sorted(a)
    return a[min(int(len(a) * p), len(a) - 1)] if a else 0


def human_text(rec):
    """Return the prompt text if this user record is a human prompt, else None."""
    if rec.get('isMeta'):
        return None
    c = rec.get('message', {}).get('content')
    if isinstance(c, str):
        if rec.get('origin', {}).get('kind') == 'human' or rec.get('promptSource'):
            return c
        return None                     # task notifications etc.
    if isinstance(c, list):
        if any(b.get('type') == 'tool_result' for b in c):
            return None
        return ' '.join(b.get('text', '') for b in c if b.get('type') == 'text')
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True, help='directory for prompts_sample.txt, corrections.txt, report.json (created if missing)')
    ap.add_argument('--days', type=int, default=0, help='only transcripts from the last N days (default 0 = everything on disk, i.e. the cleanupPeriodDays window)')
    ap.add_argument('--tz', default=None, help='IANA timezone for day boundaries (default: the system timezone)')
    ap.add_argument('--sample', type=int, default=300, help='number of prompts to sample for qualitative review')
    ap.add_argument('--claude-dir', default=os.path.expanduser('~/.claude'))
    args = ap.parse_args()

    tz = ZoneInfo(args.tz) if args.tz else datetime.datetime.now().astimezone().tzinfo
    os.makedirs(args.out, exist_ok=True)
    root = os.path.join(args.claude_dir, 'projects')
    cutoff = datetime.datetime.now(tz) - datetime.timedelta(days=args.days) if args.days else None

    R = {'params': {'tz': str(tz), 'days': args.days, 'gap_s': GAP, 'wait_cap_s': WAIT_CAP}}
    sess_iv, sub_iv = {}, {}
    turns, waits, ask_waits = [], [], []
    stall_total, stall_after = 0, collections.Counter()
    sig, models, efforts, tools, skills, plugin_use = (collections.Counter() for _ in range(6))
    prompts, corrections, cost = [], [], {}
    queued_human = 0

    for f in glob.glob(os.path.join(root, '*', '*.jsonl')):
        sid = os.path.basename(f)[:-6]
        proj = os.path.basename(os.path.dirname(f))
        recs = load(f)
        if not any(r.get('type') == 'user' for r in recs):
            continue
        ev, pending_ask = [], set()
        for r in recs:
            t = r.get('type')
            if t == 'cost-state':
                cost[sid] = r
                continue
            if t == 'queue-operation' and r.get('operation') == 'enqueue' and not str(r.get('content', '')).startswith('<'):
                queued_human += 1
                continue
            if 'timestamp' not in r or r.get('isSidechain'):
                continue
            if r.get('attributionPlugin'):
                plugin_use[r['attributionPlugin']] += 1
            if str(r.get('attributionMcpServer', '')).startswith('plugin:'):      # "plugin:<plugin>:<server>"
                plugin_use[r['attributionMcpServer'].split(':')[1]] += 1
            when = ts(r['timestamp'], tz)
            if cutoff and when < cutoff:
                continue
            if t == 'system' and r.get('subtype') == 'compact_boundary':
                sig['compactions'] += 1
            elif t == 'system' and r.get('subtype') == 'away_summary':
                sig['turns_finished_while_user_away'] += 1
            elif t == 'system' and r.get('subtype') == 'turn_duration':
                sig['turns_harness'] += 1
            elif t == 'user':
                txt = human_text(r)
                c = r.get('message', {}).get('content')
                if txt is not None:
                    if txt.startswith('[Request interrupted'):
                        sig['interrupts'] += 1
                        ev.append((when, 'interrupt', None))
                    else:
                        if isinstance(c, list) and any(b.get('type') == 'image' for b in c):
                            sig['prompts_with_image'] += 1
                        m = re.search(r'<command-name>([^<]+)', txt)
                        if m:
                            skills[m.group(1).strip()] += 1
                        ev.append((when, 'prompt', None))
                        prompts.append((when, proj, txt))
                elif isinstance(c, list) and any(b.get('type') == 'tool_result' for b in c):
                    ids = [b.get('tool_use_id') for b in c if b.get('type') == 'tool_result']
                    denied = False
                    for b in c:
                        body = b.get('content') if b.get('type') == 'tool_result' else None
                        if isinstance(body, str):
                            if body.startswith("The user doesn't want to proceed"):
                                denied = True
                                sig['tool_denied_by_user'] += 1
                                m = re.search(r'the user said:\n(.*)', body, re.S)
                                if m:
                                    corrections.append((when, proj, 'DENY', m.group(1)[:400]))
                            elif 'auto mode classifier' in body:
                                sig['auto_mode_classifier_block'] += 1
                    ev.append((when, 'result', denied or any(i in pending_ask for i in ids)))
                elif isinstance(c, str):
                    ev.append((when, 'notify', None))
            elif t == 'assistant':
                m = r.get('message', {})
                models[m.get('model', '?')] += 1
                efforts[str(r.get('effort'))] += 1
                last_tool = None
                for b in m.get('content') or []:
                    if b.get('type') == 'tool_use':
                        last_tool = b.get('name')
                        tools[last_tool] += 1
                        inp = b.get('input', {}) or {}
                        if last_tool == 'Skill':
                            skills['/' + str(inp.get('skill'))] += 1
                        elif last_tool == 'Agent':
                            sig['subagents_spawned'] += 1
                        elif last_tool == 'AskUserQuestion':
                            sig['ask_user_question'] += 1
                            pending_ask.add(b.get('id'))
                        elif last_tool == 'ExitPlanMode':
                            sig['plan_mode_used'] += 1
                        elif last_tool == 'Bash' and inp.get('run_in_background'):
                            sig['bash_background'] += 1
                ev.append((when, 'assistant', last_tool))
        ev.sort(key=lambda x: x[0])

        # what the user typed right after an interrupt
        for i, (_, k, _) in enumerate(ev):
            if k == 'interrupt':
                for j in range(i + 1, min(i + 4, len(ev))):
                    if ev[j][1] == 'prompt':
                        p = next((p for p in prompts if p[0] == ev[j][0]), None)
                        if p:
                            corrections.append((p[0], proj, 'AFTER-INTERRUPT', p[2][:400]))
                        break

        # turns: human prompt -> everything until the next human prompt
        ivs, i = [], 0
        while i < len(ev):
            if ev[i][1] != 'prompt':
                i += 1
                continue
            start, j, pts, last_tool, prev = ev[i][0], i + 1, [(ev[i][0], False)], None, ev[i][0]
            while j < len(ev) and ev[j][1] != 'prompt':
                t, k, x = ev[j]
                if k == 'assistant':
                    pts.append((t, False)); last_tool = x
                elif k == 'result':
                    if x:
                        ask_waits.append((t - prev).total_seconds())
                    pts.append((t, bool(x)))
                else:
                    pts.append((t, False))
                if k in ('assistant', 'result') and not (k == 'result' and x) and (t - prev).total_seconds() > GAP:
                    stall_after[last_tool] += 1
                prev = t
                j += 1
            tiv, st = chain(pts)
            stall_total += st
            ivs += tiv
            turns.append(sum((e - s).total_seconds() for s, e in tiv))
            end = max(e for _, e in tiv)
            if j < len(ev):
                waits.append((ev[j][0] - end).total_seconds())
            i = j
        sess_iv[sid] = ivs

        siv = []
        sd = os.path.join(os.path.dirname(f), sid, 'subagents')
        for sf in glob.glob(os.path.join(sd, '*.jsonl')):
            pts = sorted((ts(r['timestamp'], tz), False) for r in load(sf)
                         if 'timestamp' in r and r.get('type') in ('assistant', 'user'))
            pts = [p for p in pts if not cutoff or p[0] >= cutoff]
            if pts:
                siv += chain(pts)[0]
        sub_iv[sid] = siv

    if not turns:
        print('No human turns found in', root, '(check --days / --claude-dir)')
        sys.exit(1)

    # ---------- per day ----------
    days = collections.defaultdict(lambda: {'main': [], 'sub': [], 'sess': set()})
    for sid in sess_iv:
        for s, e in sess_iv[sid]:
            d = s.date().isoformat(); days[d]['main'].append((s, e)); days[d]['sess'].add(sid)
        for s, e in sub_iv[sid]:
            days[s.date().isoformat()]['sub'].append((s, e))
    rows, agg = [], collections.Counter()
    print('# Claude Code usage statistics')
    print(f'Transcripts on disk: {min(days)} .. {max(days)} ({len(days)} active days, {len(sess_iv)} sessions). Timezone {tz}.\n')
    print('## Per day: Claude active time (hours)\n')
    print('| day | sessions | main thread | subagents | all (union) | all (sum) | parallelism | >=2 sessions | >=2 streams incl. subagents |')
    print('|---|---|---|---|---|---|---|---|---|')
    for d in sorted(days):
        D = days[d]
        mu, su = union(D['main']), union(D['sub'])
        allv = D['main'] + D['sub']
        au = union(allv)
        ssum = sum(union([x for x in sess_iv[s] + sub_iv[s] if x[0].date().isoformat() == d]) for s in D['sess'])
        dist = concurrency(allv); tot = sum(dist.values()) or 1
        m2 = sum(v for k, v in dist.items() if k >= 2) / tot * 100
        dm = concurrency(D['main']); totm = sum(dm.values()) or 1
        s2 = sum(v for k, v in dm.items() if k >= 2) / totm * 100       # overlap between sessions only
        print(f'| {d} | {len(D["sess"])} | {mu/3600:.2f} | {su/3600:.2f} | {au/3600:.2f} | {ssum/3600:.2f} | {ssum/au if au else 0:.2f}x | {s2:.0f}% | {m2:.0f}% |')
        rows.append({'day': d, 'sessions': len(D['sess']), 'main_h': mu/3600, 'sub_h': su/3600, 'union_h': au/3600, 'sum_h': ssum/3600, 'multi_session_pct': s2, 'multi_stream_pct': m2})
        agg['mu'] += mu; agg['su'] += su; agg['au'] += au; agg['ss'] += ssum; agg['m2'] += m2; agg['s2'] += s2
    n = len(days)
    w = [x for x in waits if x <= WAIT_CAP]
    summary = {
        'active_days': n,
        'claude_active_union_h_per_day': agg['au'] / 3600 / n,
        'claude_active_main_h_per_day': agg['mu'] / 3600 / n,
        'claude_active_subagents_h_per_day': agg['su'] / 3600 / n,
        'parallelism_x': agg['ss'] / agg['au'] if agg['au'] else 0,
        'share_time_with_2plus_streams_pct': agg['m2'] / n,
        'share_time_with_2plus_sessions_pct': agg['s2'] / n,
        'waiting_for_user_h_per_day': (sum(w) + sum(min(a, WAIT_CAP) for a in ask_waits)) / 3600 / n,
        'days_over_1h': sum(r['union_h'] > 1 for r in rows),
        'median_day_h': sorted(r['union_h'] for r in rows)[n // 2],
        'best_day_h': max(r['union_h'] for r in rows),
    }
    print('\n## Averages per active day\n')
    print(f"- Claude active (union of all sessions and subagents): **{summary['claude_active_union_h_per_day']:.2f} h**")
    print(f"- of which subagents: {summary['claude_active_subagents_h_per_day']:.2f} h")
    print(f"- Claude waiting for the user inside live sessions (reply gaps <=30 min + question/permission waits): **{summary['waiting_for_user_h_per_day']:.2f} h**")
    print(f"- parallelism (summed session time / wall-clock): **{summary['parallelism_x']:.2f}x**; time with >=2 sessions running: {summary['share_time_with_2plus_sessions_pct']:.0f}%; with >=2 streams counting subagents: {summary['share_time_with_2plus_streams_pct']:.0f}% (the difference is overlap that comes from subagents, not from a second session)")
    print(f"- days with >1 h of Claude work: {summary['days_over_1h']}/{n}; median day {summary['median_day_h']:.2f} h; best day {summary['best_day_h']:.2f} h")

    # ---------- turns ----------
    T = {
        'turns': len(turns),
        'turn_active_median_s': pct(turns, .5), 'turn_active_p75_s': pct(turns, .75), 'turn_active_p90_s': pct(turns, .9),
        'turns_over_10min': sum(t > 600 for t in turns), 'turns_over_30min': sum(t > 1800 for t in turns),
        'turn_active_total_h': sum(turns) / 3600,
        'reply_median_s': pct(w, .5), 'reply_p75_s': pct(w, .75), 'reply_p90_s': pct(w, .9),
        'reply_within_60s_pct': sum(x < 60 for x in w) / len(w) * 100 if w else 0,
        'reply_within_5min_pct': sum(x < 300 for x in w) / len(w) * 100 if w else 0,
        'reply_total_h': sum(w) / 3600, 'parked_gaps_over_30min': sum(x > WAIT_CAP for x in waits),
        'question_waits': len(ask_waits), 'question_wait_median_s': pct(ask_waits, .5), 'question_wait_p90_s': pct(ask_waits, .9),
        'stalls_over_10min': stall_total, 'stalls_after_tool': dict(stall_after.most_common(6)),
    }
    print('\n## Turn shape\n')
    print(f"- {T['turns']} human-initiated turns; active time per turn median {T['turn_active_median_s']:.0f}s, p75 {T['turn_active_p75_s']:.0f}s, p90 {T['turn_active_p90_s']:.0f}s; {T['turns_over_10min']} turns >10 min, {T['turns_over_30min']} >30 min; total {T['turn_active_total_h']:.1f} h")
    print(f"- user reply latency after a turn (<=30 min): median {T['reply_median_s']:.0f}s, p75 {T['reply_p75_s']:.0f}s, p90 {T['reply_p90_s']:.0f}s; within 60s {T['reply_within_60s_pct']:.0f}%, within 5 min {T['reply_within_5min_pct']:.0f}%; total {T['reply_total_h']:.1f} h; parked gaps >30 min: {T['parked_gaps_over_30min']}")
    print(f"- waits on AskUserQuestion/permission: {T['question_waits']}, median {T['question_wait_median_s']:.0f}s, p90 {T['question_wait_p90_s']:.0f}s")
    print(f"- stalls (silent >10 min inside a turn, not a question): {T['stalls_over_10min']}; after tool: {T['stalls_after_tool']}")
    sl = collections.Counter()
    for p in prompts:
        sl[p[1]] += 1
    tf = sig.get('turns_harness') or len(turns)
    print(f"- turns that ended with an 'away' recap (Claude Code writes one when the terminal was not in focus at turn end): {sig['turns_finished_while_user_away']}/{tf} = {sig['turns_finished_while_user_away']/tf*100:.0f}% of all harness-counted turns (that count includes turns started by background-task notifications, so it is larger than the human-initiated turn count)")

    # ---------- signals ----------
    P = [p[2].strip().lower() for p in prompts if not p[2].startswith('<')]
    chores = sum(bool(CHORE.match(p)) for p in P); acks = sum(bool(ACK.match(p)) for p in P)
    stuck = sum(bool(STUCK.search(p)) for p in P); voice = sum((' uh,' in p or p.startswith('uh,') or ' um,' in p) for p in P)
    lens = [len(p) for p in P]
    secrets = sum(bool(SECRET.search(p)) for p in P)
    repeated = sum(v - 1 for v in collections.Counter(p[:60] for p in P if len(p) > 30).values() if v > 1)
    S = dict(sig)
    S.update({'queued_prompts_typed_while_busy': queued_human, 'prompts': len(P),
              'chore_prompts_commit_push_pr': chores, 'chore_pct': chores / len(P) * 100 if P else 0,
              'ack_prompts': acks, 'stuck_checks': stuck, 'voice_filler_prompts': voice,
              'prompts_that_look_like_they_contain_a_credential': secrets,
              'repeated_prompts_same_first_60_chars': repeated,
              'prompt_len_median': pct(lens, .5), 'prompt_len_p90': pct(lens, .9),
              'short_prompts_le20_pct': sum(l <= 20 for l in lens) / len(lens) * 100 if lens else 0})
    print('\n## Behaviour signals (transcript window)\n')
    for k in ('prompts', 'queued_prompts_typed_while_busy', 'chore_prompts_commit_push_pr', 'ack_prompts', 'stuck_checks',
              'voice_filler_prompts', 'repeated_prompts_same_first_60_chars', 'prompts_that_look_like_they_contain_a_credential',
              'interrupts', 'tool_denied_by_user', 'ask_user_question', 'plan_mode_used',
              'subagents_spawned', 'bash_background', 'compactions', 'prompts_with_image', 'auto_mode_classifier_block'):
        print(f'- {k}: {S.get(k, 0)}')
    print(f"- prompt length: median {S['prompt_len_median']} chars, p90 {S['prompt_len_p90']}; <=20 chars: {S['short_prompts_le20_pct']:.0f}%")
    hod = collections.Counter(p[0].hour for p in prompts)
    print('- prompts by hour: ' + ' '.join(f'{h:02d}:{hod[h]}' for h in range(24) if hod[h]))
    print('- prompts by weekday: ' + str(dict(collections.Counter(p[0].strftime('%a') for p in prompts))))
    print('- models: ' + str(dict(models.most_common())))
    print('- effort: ' + str(dict(efforts.most_common())))
    print('- top tools: ' + str(tools.most_common(15)))
    print('- skills/commands used: ' + str(skills.most_common(25)))
    print('- prompts by project: ' + str(sl.most_common(10)))
    enabled = {}
    try:
        with open(os.path.join(args.claude_dir, 'settings.json'), encoding='utf-8') as fh:
            enabled = {k.split('@')[0]: v for k, v in (json.load(fh).get('enabledPlugins') or {}).items() if v}
    except (OSError, json.JSONDecodeError):
        pass
    unused = sorted(p for p in enabled if plugin_use.get(p, 0) == 0)
    print(f"- plugins: {len(enabled)} enabled in settings.json; used in this window (tool/skill attributions): {plugin_use.most_common(12)}; enabled but never used: {unused}")
    S['plugins_enabled'] = len(enabled); S['plugins_unused'] = unused; S['plugin_use'] = dict(plugin_use)
    api = sum(c.get('totalAPIDuration', 0) for c in cost.values()) / 3.6e6
    usd = sum(c.get('totalCostUSD', 0) for c in cost.values())
    by_model = collections.Counter()
    for c in cost.values():
        for m, v in c.get('modelUsage', {}).items():
            by_model[m] += v.get('costUSD', 0)
    print(f"- session cost records ({len(cost)} sessions): API time {api:.1f} h total ({api/n:.2f} h/day), API-equivalent cost ${usd:.0f} total (${usd/n:.0f}/day); by model {dict((k, round(v)) for k, v in by_model.most_common(6))}")

    # ---------- long-term history ----------
    H = {}
    hist = os.path.join(args.claude_dir, 'history.jsonl')
    if os.path.exists(hist):
        hr = []
        for r in load(hist):
            r['t'] = datetime.datetime.fromtimestamp(r['timestamp'] / 1000, tz); hr.append(r)
        hr.sort(key=lambda r: r['t'])
        bym = collections.defaultdict(lambda: {'p': 0, 'days': set(), 'sess': set()})
        byd = collections.defaultdict(list)
        for r in hr:
            B = bym[r['t'].strftime('%Y-%m')]; B['p'] += 1; B['days'].add(r['t'].date()); B['sess'].add(r['sessionId'])
            byd[r['t'].date()].append(r)
        print(f"\n## Long-term prompt history ({hr[0]['t'].date()} .. {hr[-1]['t'].date()}, {len(hr)} prompts, {len(byd)} active days)\n")
        print('| month | prompts | active days | prompts/day | sessions |'); print('|---|---|---|---|---|')
        for m in sorted(bym):
            B = bym[m]; print(f"| {m} | {B['p']} | {len(B['days'])} | {B['p']/len(B['days']):.1f} | {len(B['sess'])} |")
        overl, switches, sess_per_day = [], [], []
        for d, rs in byd.items():
            spans = {}
            for r in rs:
                spans.setdefault(r['sessionId'], [r['t'], r['t']])[1] = r['t']
            sess_per_day.append(len(spans))
            switches.append(sum(1 for a, b in zip(rs, rs[1:]) if a['sessionId'] != b['sessionId']))
            pts = []
            for s, e in spans.values():
                pts += [(s, 1), (e + datetime.timedelta(seconds=1), -1)]
            pts.sort(); cur = mx = 0
            for _, x in pts:
                cur += x; mx = max(mx, cur)
            overl.append(mx)
        disp = [r['display'] for r in hr]
        slash = collections.Counter(d.split()[0] for d in disp if d.startswith('/'))
        H = {'prompts': len(hr), 'active_days': len(byd), 'sessions_per_day_median': pct(sess_per_day, .5),
             'days_with_overlapping_sessions_pct': sum(o >= 2 for o in overl) / len(overl) * 100,
             'session_switches_per_day_median': pct(switches, .5),
             'slash_pct': sum(d.startswith('/') for d in disp) / len(disp) * 100,
             'top_slash': slash.most_common(20), 'shell_bang_prompts': sum(d.startswith('!') for d in disp),
             'weekend_pct': sum(r['t'].weekday() >= 5 for r in hr) / len(hr) * 100}
        print(f"\n- sessions per day median {H['sessions_per_day_median']}; days with overlapping sessions {H['days_with_overlapping_sessions_pct']:.0f}%; session switches per day median {H['session_switches_per_day_median']}")
        print(f"- slash-command prompts {H['slash_pct']:.0f}%; top: {H['top_slash']}")
        print(f"- `!` shell prompts {H['shell_bang_prompts']}; weekend prompts {H['weekend_pct']:.0f}%")

    # ---------- files for the qualitative review ----------
    random.seed(7)
    hp = [p for p in prompts if not p[2].startswith('<')]
    with open(os.path.join(args.out, 'prompts_sample.txt'), 'w', encoding='utf-8') as fh:
        for t, p, txt in sorted(random.sample(hp, min(args.sample, len(hp)))):
            fh.write(f"[{t.strftime('%Y-%m-%d %H:%M')}] {p.replace('-Users-', '').replace('-projects-', '/')}\n{txt[:500].replace(chr(10), ' | ')}\n\n")
    with open(os.path.join(args.out, 'corrections.txt'), 'w', encoding='utf-8') as fh:
        for t, p, k, txt in sorted(corrections):
            fh.write(f"[{t.strftime('%Y-%m-%d %H:%M')}] {k} {p.replace('-Users-', '').replace('-projects-', '/')}\n{txt.replace(chr(10), ' | ')}\n\n")
    R.update({'summary': summary, 'per_day': rows, 'turns': T, 'signals': S, 'history': {k: v for k, v in H.items() if k != 'top_slash'},
              'models': dict(models), 'efforts': dict(efforts), 'tools': dict(tools.most_common(40)), 'skills': dict(skills)})
    with open(os.path.join(args.out, 'report.json'), 'w', encoding='utf-8') as fh:
        json.dump(R, fh, indent=1, default=str)
    print(f"\nWrote {args.out}/prompts_sample.txt ({min(args.sample, len(hp))} prompts), corrections.txt ({len(corrections)} entries), report.json")


if __name__ == '__main__':
    main()
