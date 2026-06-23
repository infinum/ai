---
name: productive-debug
description: Investigate bug tasks from Productive. Fetches task details, attachments, and comments via MCP, explores codebases (including companion apps), and generates ranked hypotheses with code evidence. Use when the user shares a Productive task URL, mentions a Productive bug, or says /productive-debug. Cowork-ready.
---

# Productive Debug

Investigate a bug task from Productive end-to-end: fetch the task via MCP, read attachments and comments, explore all relevant codebases, and produce a structured analysis with ranked hypotheses. If in Debug or Agent mode, proceed to instrumentation and fix.

## Workflow

Copy this checklist and track progress:

```
Task Progress:
- [ ] Step 1: Receive bug task and companion app paths
- [ ] Step 2: Fetch task details via MCP
- [ ] Step 3: Analyze the bug report
- [ ] Step 4: Explore codebase(s)
- [ ] Step 5: Generate hypotheses
- [ ] Step 6: Act (mode-dependent)
```

---

### Step 1: Receive Bug Task

Accept a Productive task URL from the user, e.g.:
`https://app.productive.io/1-yourorg/tasks/123456`

Extract the **task ID** from the last numeric segment of the URL.

**Ask the user:**
> Are there any companion apps (e.g., a separate frontend or mobile repo) that may be relevant to this bug? If so, provide the absolute path(s).

Store the companion app paths — they will be explored in parallel with the main workspace in Step 4.

---

### Step 2: Fetch Task Details via MCP

Use the `user-productive` MCP server. Execute these calls in order:

**2a. Learn the schema** (do this once per session):
```
describe_resource(resource_type: "tasks", include: ["related"])
```
This reveals available `include_collections` values. Only use collection names confirmed here — passing unknown values will error.

**2b. Load the task:**
```
load_resource_details(
  resource_type: "tasks",
  id: "<task_id>",
  include_fields: [
    "title", "description", "due_date",
    "assignee.first_name", "assignee.last_name",
    "project.name", "workflow_status.name", "task_list.name"
  ],
  include_collections: ["todosCollection", "subtasksCollection"]
)
```

**2c. Load comments and activity:**
```
perform_resource_action(
  resource_type: "tasks",
  id: "<task_id>",
  action: "load_task_activity"
)
```
Comments appear as activity entries with `itemType: "comment"`. Read the `body` field on each comment record from the `included` array. Reconstruct the thread in chronological order by `createdAt`.

**2d. Fetch attachments:**

Attachments are embedded inside the `description` and comment `body` fields as inline JSON objects, not as a separate list. Parse these patterns:
```
@[{"type":"attachment","id":"...","attachment_url":"https://files.productive.io/...","label":"image.png"}]
```
For each unique `attachment_url` found, try:
1. `read_file_from_url(url: "<attachment_url>")` — works for non-image files and PDFs
2. `curl -sL "<attachment_url>" -o /tmp/<filename>` + `Read` — for images

> **Pitfall:** Attachment URLs require an active session cookie. If the URL redirects to the Productive login page (returns HTML with `<title>Productive</title>`), the download failed due to auth. Note this and continue — the description text usually conveys the key information.

**If MCP is unavailable:** Ask the user to paste the task title, description, and comments directly. Continue from Step 3 with that text.

**Present a summary** before continuing:
```
## Task: [title] ([URL])
- Assignee: [name] | Status: [status] | Project: [project]
- Description: [parsed plain text, no JSON artifacts]
- Attachments: [list what was retrieved vs. what failed auth]
- Comments (chronological):
  1. [Author] at [time]: [key content]
  2. ...
```

---

### Step 3: Analyze the Bug Report

Before touching any code, extract the following from the task and comments:

- **Affected feature / domain** — what page, tab, API endpoint, or user flow is broken?
- **Affected user role(s)** — e.g., commercialist, admin, dealer, bank employee
- **Reproduction steps** — extract from comments if described; note if not reproducible by the team
- **Environment** — PROD / UAT / staging; any specific record IDs mentioned (offer ID, contract ID, user ID)
- **Temporal behavior** — does it self-heal after time? (points to caching or eventual consistency)
- **Platform tag** — check custom fields: is it tagged as Frontend, Backend, or both?
- **Key terms to map to code** — the UI may use localized labels (Slovenian, Macedonian, Serbian). List them as a mapping table:

  | UI label | Likely code identifier | Where to search |
  |----------|------------------------|-----------------|
  | "Moje"   | `ClusterFilter.User` / `scope=user` | i18n files → enum/filter |
  | ...      | ...                    | ...             |

  Search locale/i18n files first (e.g., `public/locales/sl_SI/index.json`) to bridge UI labels to translation keys, then trace those keys to component names and enum values.

---

### Step 4: Explore Codebase(s)

Launch **parallel `explore` subagents** — one per codebase (workspace + each companion app path). Give each agent a focused, detailed prompt.

**For each codebase, instruct the agent to search for:**

*Backend (API / server):*
- Handlers or modules that serve the affected routes or resources (framework-specific: controllers, route handlers, gRPC services, GraphQL resolvers)
- Where list/detail data is filtered or queried (repositories, ORM scopes, query objects, SQL, stored procedures)
- Authorization rules that constrain who can read or mutate what (policies, guards, middleware, permission checks)
- How **ownership / actor foreign keys** are assigned — columns that point to the parent row or acting principal (user, account, organization, etc.): defaults, explicit assignment on create, bulk import or migration, and whether they can be null or overwritten
- Async work, search/indexing, caching, or multi-database setup that could explain stale or missing data
- Recent `git log --oneline --since="3 weeks ago"` on affected files

*Frontend (client / UI):*
- Views, routes, or screens that implement the affected flow (web pages, tabs, modals, mobile screens — whatever maps to the bug report)
- The **data-fetch layer** (hooks, stores, services, SDK calls): how the request is built — query parameters, request body, GraphQL variables, or RPC arguments — and how that differs across UI modes (e.g., per tab, segment, or filter chip)
- **Client caching and staleness** — HTTP cache headers, service worker rules, or in-memory/store caches (e.g., focus/refetch behavior, background refresh, TTL / `staleTime`, normalized caches). What assumptions does the UI make about how fresh data is?
- **Mutations vs displayed data** — after create/update/delete, does the client refetch, invalidate cache keys, optimistically update local state, or rely on navigation to remount? Gaps here often look like “UI is wrong until refresh”
- Recent `git log --oneline --since="3 weeks ago"` on affected files

**After exploration, produce:**

1. An **architecture diagram** (prose or mermaid) showing data flow from DB → API → UI for the affected feature
2. A **key files table**:

   | File | Role |
   |------|------|
   | `app/web/api/v1/informational_offers/filters/scope_filter.rb` | MOJE/SKUPINA SQL filter |
   | `src/hooks/useInfiniteLoading.ts` | SWR infinite cache config |
   | ... | ... |

---

### Step 5: Generate Hypotheses

Produce **3–5 ranked hypotheses**. More is better than fewer — aim to cover distinct subsystems. For each:

```
### H[n]: [Short label] — CONFIDENCE: HIGH / MEDIUM / LOW

**Mechanism:** [Explain precisely why this would cause the observed symptom]

**Evidence:**
- [File path:line] — [relevant snippet or description]
- [git commit hash] — [description of relevant change]

**Confirms if:** [What runtime log or DB state would prove this]
**Rejects if:** [What would rule this out]
```

**Common root cause categories to consider:**

| Category | Signals to look for |
|----------|---------------------|
| Client-side cache staleness | Aggressive caching or long TTL; refetch disabled on focus/visibility; no refresh or invalidation after mutations; lazily mounted UI that never re-fetches when shown |
| Backend filter / scope mismatch | List vs detail queries use different filters; auth scope (“what you may see”) disagrees with the data query; wrong or missing **ownership / tenant foreign keys** on persisted/replicated rows |
| Eventual consistency / indexing lag | Search or analytics index behind the primary store; queued or scheduled workers; read replicas or edge caches serving slightly old reads |
| Recent regression | `git log` shows changes to filtering, authorization, caching, or pagination on the affected path in the last 2–4 weeks |
| Data integrity on create | Alternate code paths (e.g., import, duplicate, template instantiate) set different defaults; validation allows null owner; API or form layer drops or overwrites ownership fields |

**Prioritization rule:** A hypothesis backed by a recent git commit that changed the exact code path should be ranked H1 regardless of confidence — regressions are the most common cause of PROD bugs that worked before.

---

### Step 6: Act (mode-dependent)

**In Ask mode:**
Present the full report and stop. Suggest which mode to switch to:
- Simple fix with high confidence → suggest **Agent mode**
- Unclear root cause needing runtime proof → suggest **Debug mode**

**In Plan mode:**
Present the full report and stop. Do not implement anything.

**In Debug mode:**
Proceed with the Debug mode instrumentation workflow:
1. Add targeted log statements (JS: `fetch` to the debug server endpoint; Ruby: append NDJSON to the debug log path)
2. Cover all hypotheses in parallel — minimum 1 log, maximum 10
3. Ask the user to reproduce, then analyze logs to confirm/reject each hypothesis
4. Make a targeted fix only after a hypothesis is CONFIRMED by runtime evidence
5. Re-run to verify; remove instrumentation only after the user confirms the fix

**In Agent mode:**
1. State which hypothesis you are acting on and why (highest confidence + evidence)
2. Implement the minimal fix
3. Ask the user to verify

---

## Output Template

Produce this report at the end of Step 5 (before acting):

```markdown
## Bug Summary
- **Task:** [title] ([URL])
- **Reporter:** [name] | **Assignee:** [name] | **Status:** [status]
- **Symptoms:**
  - [bullet per distinct symptom]
- **Comment Timeline:**
  1. [Author] ([time]): [key observation]
  2. ...

## Architecture
[Brief prose or mermaid diagram of data flow for the affected feature]

### Key Files
| File | Role |
|------|------|
| ... | ... |

## Hypotheses

### H1: [label] — HIGH
- **Mechanism:** ...
- **Evidence:** `path/to/file:line` — ...
- **Confirms if:** ...
- **Rejects if:** ...

### H2: [label] — MEDIUM
...

## Recommendation
- **Most likely fix:** [1-2 sentences]
- **Suggested mode:** [Debug / Agent]
```

---

## Domain Knowledge

### MCP Call Sequence

Always follow this order to avoid errors:
1. `describe_resource` — learn valid `include_collections` names (they vary by resource type)
2. `load_resource_details` — fetch the task with fields and collections
3. `perform_resource_action` with `load_task_activity` — fetch comments and changelog
4. `read_file_from_url` or `curl` — for each attachment URL found by parsing description/comment bodies

### Productive Data Model Notes

- **Attachments** are not a top-level collection on tasks. They are embedded as JSON inside the `description` and comment `body` strings: `@[{"type":"attachment","attachment_url":"..."}]`. Parse them manually.
- **Comments** are in the `activities` array returned by `load_task_activity`, filtered by `itemType: "comment"`. The comment text is in the `body` field on the corresponding record in `included`.
- **Custom fields** on tasks (like `Type: PROD bug`, `Platform: Frontend`) are under `customFields` keyed by numeric ID. The activity changelog shows the human-readable labels.
- **Task creator** is a separate field from `assignee`. Check both when determining who reported the bug.

### Localized Label → Code Mapping Pattern

Apps with localized UIs require an extra translation step:

1. Search the i18n/locale files (e.g., `public/locales/sl_SI/index.json`, `public/locales/mk_MK/index.json`) for the UI term
2. Find the translation key (e.g., `"table.offer.user": "Moje"`)
3. Search the codebase for that translation key to find the component
4. From the component, trace to the enum/constant/filter (e.g., `ClusterFilter.User = 'user'`)
5. From the enum value, find the backend filter handler (e.g., `ScopeFilter` case `'user'`)

### Git Archaeology

Always run these before generating hypotheses:

```bash
# On the affected files, check the last 3 weeks
git log --oneline --since="3 weeks ago" -- <path/to/affected/file>

# Show what changed in a suspicious commit
git show <commit_hash> -- <path/to/file>
```

A commit that changed caching settings, filter logic, or pagination in the last 2–4 weeks should immediately become H1.

### Companion App Exploration

When the bug spans a Rails API and a JS frontend (or any multi-repo setup):
- Launch **one `explore` subagent per codebase** in parallel, each with a detailed prompt scoped to its language/framework
- The agent exploring the FE should focus on: tab components, fetch hooks, caching config, cache invalidation after mutations
- The agent exploring the BE should focus on: scopes/filters, controller create paths, ownership assignment, background jobs

---

## Important

- Do **NOT** attempt a fix before completing Step 5 (hypotheses)
- Do **NOT** remove debug instrumentation before post-fix verification logs confirm success
- Always ask for companion app paths at the start — missing a codebase leads to incomplete hypotheses
- If MCP fails, fall back to manual input — the workflow still works with pasted task text
