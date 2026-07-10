# Data Schema for generate_sheet.py

The generation script expects a JSON file at `/tmp/ca_data.json` with the following structure.

---

## Top-Level Structure

```json
{
  "project_name": "string — shown in the header",
  "client_name": "string — name for the client column (always first scored column)",
  "categories": [ ...CategoryObject ],
  "site_metrics": [ ...SiteMetricObject ]
}
```

---

## CategoryObject

```json
{
  "name": "string — category heading (e.g. 'Navigation + IA')",
  "metrics": [ ...MetricObject ]
}
```

---

## MetricObject

```json
{
  "label": "string — the metric question or statement",
  "scores": {
    "Client Name": 2,
    "Competitor A": 1,
    "Competitor B": 3,
    "Competitor C": null
  },
  "rationale": "string — 1–2 sentences explaining the scores across competitors"
}
```

**Score values:**
- `0` = Not present / doesn't work
- `1` = Minimal / inconsistent
- `2` = Adequate / more often than not
- `3` = Excellent / all the time
- `null` = Insufficient information to score (cell left blank)

The **order of keys** in `scores` determines the column order. The client should always
be the first key.

---

## SiteMetricObject

Site metrics (below the scored section) are free-form key/value rows — no scoring.

```json
{
  "label": "string — metric name (e.g. 'Page Speed Insights Desktop')",
  "values": {
    "Client Name": "87",
    "Competitor A": "72",
    "Competitor B": "91",
    "Competitor C": "N/A"
  }
}
```

Site metrics are optional. Omit the `site_metrics` key entirely if none are needed.

---

## Full Example

```json
{
  "project_name": "Proph+IT Daily Flash",
  "client_name": "Proph+IT",
  "categories": [
    {
      "name": "Navigation + IA",
      "metrics": [
        {
          "label": "Does the navigation structure make logical sense?",
          "scores": {
            "Proph+IT": 2,
            "Competitor A": 3,
            "Competitor B": 1
          },
          "rationale": "Proph+IT has adequate top-nav but sidebar lacks hierarchy. Competitor A uses clear labelled tabs. Competitor B relies on an unlabelled icon bar."
        },
        {
          "label": "Are CTAs clear and prominent?",
          "scores": {
            "Proph+IT": 1,
            "Competitor A": 3,
            "Competitor B": 2
          },
          "rationale": "Proph+IT CTAs are small and low contrast. Competitor A uses high-contrast buttons consistently. Competitor B has clear primary CTAs but secondary actions are buried."
        }
      ]
    }
  ],
  "site_metrics": [
    {
      "label": "Page Speed Insights Desktop",
      "values": {
        "Proph+IT": "N/A",
        "Competitor A": "88",
        "Competitor B": "74"
      }
    }
  ]
}
```

---

## SummaryObject

Keyed by competitor name (must match keys in `scores`). Included in the top-level `summary` map.

```json
{
  "strengths":  [ "string", "string", ... ],
  "weaknesses": [ "string", "string", ... ]
}
```

Include 3–6 bullets per list. The client gets the same treatment — be honest about weaknesses.

---

## OpportunityObject

```json
{
  "title":  "string — short label (e.g. 'Self-Serve Filtering')",
  "detail": "string — 1–3 sentences grounding the opportunity in the scoring data"
}
```

Include 3–6 opportunities. Ground each in the scoring: where does the client lag and where
is no competitor currently strong? These are the highest-value items for the client brief.

---

## Updated Full Example (with summary + opportunities)

```json
{
  "project_name": "Proph+IT Daily Flash",
  "client_name":  "Proph+IT",
  "categories": [ ... ],
  "site_metrics": [ ... ],
  "summary": {
    "Proph+IT": {
      "strengths":  ["Native SSO integration", "Clear top-level navigation"],
      "weaknesses": ["Limited self-serve filtering", "Low-contrast CTAs"]
    },
    "Competitor A": {
      "strengths":  ["Best-in-class interactive charts", "One-click export"],
      "weaknesses": ["Premium pricing barrier", "Steep onboarding curve"]
    }
  },
  "opportunities": [
    {
      "title":  "Self-Serve Filtering",
      "detail": "Every competitor except Proph+IT offers multi-dimensional self-serve filtering. Closing this gap would directly address the top GM complaint from discovery."
    }
  ]
}
```
