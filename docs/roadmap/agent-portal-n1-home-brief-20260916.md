# Agent Portal N1 Brief — Three-Destination Foundation

Date: 2026-09-16  
Mode: Operate  
Primary scope: Agent shell, Dashboard, and minimum Perjalanan index

## Product direction

Agent Portal has exactly three primary destinations:

1. **Dashboard** — a factual statistical overview of the Agent's assigned work;
2. **Visa Tracking** — visa application progress and, only when supported by
   verified data, required-document readiness;
3. **Perjalanan** — assigned groups and each group's itinerary.

Profile, theme, and logout are account utilities rather than primary destinations.
The existing H-1 transportation checklist is supporting trip-readiness information
under Perjalanan, not a visa-document checklist and not a fourth primary page.

## Job and audience

An authenticated partner Agent needs three different levels of understanding:

- a quick statistical picture of their workload;
- the visa progress of each assigned group;
- the itinerary and travel readiness of a selected group.

The interface must keep these jobs separate so the Agent does not have to interpret
Admin information architecture or a mixed dashboard/list surface.

## Outcome and proof

N1 succeeds when an Agent can:

- recognize the three primary destinations on desktop and mobile;
- read server-authoritative statistics on Dashboard;
- move from Dashboard to Visa Tracking or Perjalanan without ambiguity;
- find an assigned group from Perjalanan and open its current Group Detail;
- return from Group Detail to the previous Perjalanan context;
- access Profile, theme, and logout without treating them as primary navigation.

Proof uses the existing `/agent/dashboard` and `/agent/groups` responses plus the
0, 2, and 19-group local scenarios. No new business state may be inferred.

## Route and navigation model

| Destination | Frontend route | Current data source | N1 behavior |
| --- | --- | --- | --- |
| Dashboard | `/agent/overview` | `/agent/dashboard` | Statistics and concise operational summaries |
| Visa Tracking | `/agent/visa` | Existing group visa reads | Existing surface retained for N2 refinement |
| Perjalanan | `/agent/groups` | `/agent/groups` | Minimum searchable group index |

Existing detail URLs remain valid:

- `/agent/groups/:identity` remains the itinerary-focused Group Detail route;
- `/agent/visa/:identity` remains Visa Detail;
- `/agent/checklist` remains temporarily addressable for compatibility, but is
  reached as trip-readiness context rather than primary navigation;
- `/agent/profile` remains addressable as an account utility.

No backend route or endpoint is added.

## Selected direction

Refine the current calm green GTT workspace. The structural thesis is **summary,
visa, journey**:

- Dashboard answers “how much and what is happening?”;
- Visa Tracking answers “how far has the visa process progressed?”;
- Perjalanan answers “where is this group going and what is its itinerary?”

N1 establishes this separation with minimum recomposition. Deeper Visa and
Perjalanan presentation changes remain independent later slices.

## Scope

Primary targets:

- `apps/frontend/src/agent/agent-shell.tsx`;
- `apps/frontend/src/agent/pages/dashboard-page.tsx`;
- `apps/frontend/src/agent/pages/trips-page.tsx`, composed from current group data;
- `apps/frontend/src/agent/pages/group-detail-page.tsx` only for its back target;
- focused Agent tests.

Shared Admin components may change only through a narrowly named Agent variant or
wrapper with Admin regression coverage.

## Required behavior

### Shell

- Show Dashboard, Visa Tracking, and Perjalanan as the only primary destinations.
- Keep all three labels visible on mobile in active and inactive states.
- Treat Group Detail as Perjalanan context and Visa Detail as Visa Tracking context.
- Move Profile out of primary/bottom navigation into a clearly reachable account
  utility.
- Keep theme and logout reachable.
- Add a visible-on-focus skip link and route-aware main focus behavior.
- Use at least 44 × 44 px target boxes and respect reduced motion.

### Dashboard

- Lead with factual counts already returned by `/agent/dashboard`: total, active,
  upcoming, completed, archived, total pax, and existing attention counts.
- Use concise recent/upcoming context only where already returned by the endpoint.
- Provide clear routes to Visa Tracking and Perjalanan.
- Do not place the full searchable group list on Dashboard.
- Do not create priority, urgency, deadline, completion percentage, or inferred
  lifecycle values.

### Minimum Perjalanan index

- Move/reuse the current assigned-group discovery flow rather than duplicate it.
- Preserve search, active-only filter, month filter, arrival-date ordering, and
  pagination where currently available.
- Lead records with group identity and travel dates, followed by package/pax and
  one explicit itinerary/detail action.
- Distinguish zero assignment from zero filter results.
- Preserve list/filter context when returning from Group Detail where feasible
  without a new global store.

### Visa data boundary

The current frontend contract contains visa status, issued date, syarikah, visa
type, and payment status. It does **not** contain a per-document requirement or
submission status. Therefore N1 must not invent a document checklist. N2 will:

1. refine progress using the current verified fields;
2. audit whether required-document data exists elsewhere on the current server;
3. present document readiness only after a factual source and access rules are
   confirmed.

## Explicit anti-goals

- No backend, Prisma, migration, seed, or database change.
- No new API endpoint, response field, status, or lifecycle.
- No fabricated visa-document names or completion states.
- No broad Admin redesign.
- No new runtime dependency.
- No deployment or push.
- No deep redesign of Visa Detail or Group Detail during N1.

## Acceptance matrix

| Area | Required proof |
| --- | --- |
| Navigation | Exactly three primary destinations on desktop/mobile |
| Route context | Group Detail activates Perjalanan; Visa Detail activates Visa Tracking |
| Dashboard | Statistics match `/agent/dashboard` for 0, 2, and 19 groups |
| Perjalanan | Group discovery and itinerary entry work for 0, 2, and 19 groups |
| Empty states | Zero assignment and zero filter result have distinct copy/actions |
| Keyboard | Skip link, primary navigation, account utility, filters, and detail actions follow a logical order |
| Touch | Changed interactive target boxes are at least 44 × 44 px |
| Responsive | No overflow at 1440 × 900, 1024 × 768, and 390 × 844 |
| Network | Only existing Agent requests occur |
| Admin safety | Shared-component regressions pass if shared files change |
| Quality | Build, unit, component, browser, lint delta, bundle delta, and detector results are recorded |

## Performance boundary

- Initial JavaScript graph may grow by at most 5% from 279.6 KB.
- Initial CSS may grow by at most 5% from 116.9 KB.
- Agent application chunk may grow by at most 5% from 32.9 KB unless approved.
- Dashboard and Perjalanan must not increase request counts over their current
  equivalent flows.

## N1 completion gate

N1 is complete only when the three-destination model is usable with current data,
the full acceptance matrix passes, and the diff remains frontend-only. N2 then
focuses only on Visa Tracking; N3 focuses only on Perjalanan itinerary and travel
readiness.
