# Agent Portal Frontend Plan — Near and Long Term

Date: 2026-09-16  
Branch: `feat/frontend-incremental-restart`  
Baseline: `origin/master` at `07afaaa`  

## Product brief

### Job and audience

Agent Portal is a read-only operational workspace organized around three primary
destinations: Dashboard for statistics, Visa Tracking for visa progress and
verified document readiness, and Perjalanan for group itineraries. The primary
visitor mode is **Operate**.

Portal Admin remains secondary. It may receive small improvements when they
directly support Agent onboarding, data clarity, or cross-portal consistency.

### Outcome and proof

The first success condition is that an Agent can answer these questions without
assistance:

1. What does the current assigned workload look like statistically?
2. How far has each group's visa application progressed?
3. What itinerary belongs to each assigned group?

Proof comes from the existing production-aligned data and endpoints, not invented
status or inferred workflow. The local production snapshot currently contains 32
active Agents and 95 assigned Groups. Per-Agent group volume ranges from 0 to 19,
with a median of 2. The snapshot includes 63 active, 27 entry-only, and 5 inactive
groups; 69 groups have itinerary rows, 94 have Visa Setup, and 53 have checklist
assignments.

### Selected direction

Refine the existing GTT interface rather than replace it. Use the archived GTT
Serene work as visual and accessibility reference only. The structural thesis is
"summary, visa, journey." Dashboard carries factual statistics, Visa Tracking
carries visa progress, and Perjalanan carries group discovery and itinerary
detail. Profile, theme, and logout remain utilities rather than primary
destinations.

### Scope and boundaries

- Existing `/agent` routes, API paths, permissions, payloads, and status vocabulary
  remain authoritative.
- Near-term work is frontend-only. No migration, seed, backfill, canonical model,
  rollout flag, or production configuration change.
- Missing information is shown as unavailable or not yet recorded; the frontend
  must not infer business truth.
- Payment and internal-only notes remain outside Agent Portal.
- Admin changes are limited to existing Agent/account capabilities and shared UI
  consistency. A broad Admin redesign is an anti-goal.
- Deployment is a separate decision after review; this plan does not authorize it.

### States and ranges

Every changed surface must cover:

- no assigned groups, typical volume of 1–3 groups, and maximum observed volume of
  19 groups;
- entry-only, active, inactive, completed, and archived lifecycle values already
  supported by the contract;
- missing itinerary, partial visa/hotel data, and missing checklist assignments;
- loading, authentication expiry, recoverable request error, empty filter result,
  and long content;
- desktop, tablet, narrow mobile, keyboard navigation, reduced motion, and light/
  dark themes where already supported.

### Interaction and layout

- Dashboard leads with server-authoritative statistics and concise summaries.
- Search and filtering live with the group list under Perjalanan.
- Desktop uses the existing sidebar; mobile keeps three destinations with labels
  visible, adequate touch targets, and no content hidden behind the bottom dock.
- Detail navigation is explicit and reversible. Back actions return users to their
  previous list/filter context where practical.
- Loading and refresh feedback must not replace already visible data unnecessarily.

## Near-term plan — 2 to 4 weeks

### Phase N0 — Baseline and safe preview (1–2 days)

Goal: establish repeatable evidence before changing the interface.

- Run Agent Portal against the restored production-aligned local database.
- Create or use an existing supported local-only Portal Agent account for preview;
  never provision production as part of frontend work.
- Select three representative local scenarios: 0 groups, median-volume groups,
  and the observed 19-group maximum.
- Capture current desktop and mobile screenshots for Home, Visa Tracking, Group
  Detail, Checklist, and Profile.
- Record current keyboard path, overflow, loading, error, and empty-state behavior.

Exit gate: baseline evidence is reproducible and no application/schema change was
needed to obtain it.

### Phase N1 — Three-destination foundation (week 1)

Goal: deliver the first visible improvement without changing data behavior.

- Establish exactly three primary destinations: Dashboard, Visa Tracking, and
  Perjalanan.
- Keep all three mobile navigation labels visible and touch-safe.
- Add/preserve a usable skip-to-content and visible focus path.
- Recompose Dashboard around current factual statistics and concise summaries.
- Move/reuse group discovery as a minimum Perjalanan index at `/agent/groups`, with
  current search/filter/reset behavior.
- Keep Profile, theme, and logout available as account utilities.
- Improve loading, request error, no-group, and no-filter-result messages.
- Preserve `/dashboard` and `/groups` requests exactly as they are; add no backend
  route.

Acceptance:

- An Agent can distinguish Dashboard, Visa Tracking, and Perjalanan, then find and
  open a known group from Perjalanan.
- 0, 2, and 19-group scenarios remain readable without horizontal overflow.
- No new backend route, API request, response field, or business status appears in
  the diff; `/agent/groups` is a frontend-only index route.

### Phase N2 — Visa tracking usability (week 2)

Goal: make visa status and missing data easier to scan.

- Improve row/card hierarchy around group code, group name, visa status, bus status,
  payment visibility rules, and detail action using only current payload fields.
- Keep status communication textual; color is secondary.
- Distinguish request failure, no assigned groups, and an empty filter result.
- Preserve existing Visa Detail behavior and validation semantics.
- Audit the server for an existing authorized source of required-document data.
  The current frontend contract has no per-document status, so do not fabricate a
  checklist. If no source exists, record it as a future additive contract gap.

Optional Admin companion: align labels or status presentation on the existing Admin
Visa surface only when the same established status mapping is reused.

Acceptance: status meaning matches the server contract, long group identifiers wrap
or truncate safely, and all actions remain keyboard/touch accessible.

### Phase N3 — Perjalanan itinerary and readiness (week 3)

Goal: create a coherent path from overview to operational evidence.

- Align the Perjalanan index and Group Detail around itinerary comprehension.
- Make itinerary chronology and next known activity easier to understand without
  creating a new lifecycle.
- Place transportation/H-1 checklist information as supporting trip readiness,
  not a fourth primary navigation destination.
- Preserve read-only behavior and current endpoints for group, visa, hotel, and
  transportation data.

Optional Admin companion: reuse presentation fixes for the corresponding existing
Admin component only when it does not alter an Admin workflow.

Acceptance: every visible value can be traced to an existing response field, and a
missing section never appears as completed.

### Phase N4 — Bounded hardening and review (week 4)

Goal: close the frontend increment without scope growth.

- Run build, lint, unit, component, and relevant browser tests.
- Review desktop and mobile together in one bounded pass; fix findings in one batch
  and confirm once.
- Verify visible focus, heading/landmark structure, 44 px touch targets, reduced
  motion, no horizontal overflow, and non-color status cues.
- Compare network requests against the baseline allowlist.
- Produce screenshots and a short before/after decision record.

Exit gate: each slice is independently revertible, the diff remains frontend-only,
and review explicitly confirms that backend/database work is unnecessary.

## Near-term delivery structure

Use one reviewable commit or pull request per slice:

1. `agent-three-destination-foundation`
2. `agent-visa-tracking-usability`
3. `agent-perjalanan-itinerary-readiness`
4. `agent-frontend-hardening`

Do not batch these into one large feature branch. Each slice must remain usable if
the following slice is postponed.

## Long-term plan — 3 to 6 months

### Phase L1 — Observe and consolidate (month 1)

- Pilot the completed frontend slices with representative Agent users outside
  production deployment until explicitly approved.
- Record task friction, misunderstood labels, repeated support questions, and real
  missing-data cases.
- Convert feedback into a ranked contract-gap register; visual preference alone is
  not a backend requirement.
- Extract shared tokens/components only after they have proven useful on at least
  two shipped surfaces.

Decision gate: identify at most one backend contract gap with measurable Agent
impact.

### Phase L2 — Agent access and onboarding (months 1–2)

The restored snapshot has 32 active Agents and zero `AgentPortalUser` rows. Before
a real Agent rollout, audit the existing account-provisioning flow independently.

- Improve the existing Admin Agent/account screen first if it can expose account
  readiness, activation state, and clear recovery feedback using current APIs.
- Define pilot ownership, credential delivery, account disable/recovery, and audit
  evidence.
- Do not bulk-provision or change production accounts without a separate approval,
  backup, and rollback plan.

### Phase L3 — One contract gap at a time (months 2–4)

If frontend evidence proves an existing API cannot support a critical task:

1. document the exact missing field or behavior;
2. audit production data availability and null/legacy cases;
3. design the smallest additive, backward-compatible API change;
4. implement backend and frontend behind separate commits;
5. avoid schema work unless the information does not already exist;
6. rehearse rollback before any release proposal.

Potential topics such as canonical Travel Groups, Hotel Agreement allocation,
Flight Plans, or shared lifecycle remain deferred. They may not re-enter scope as
a combined transformation.

### Phase L4 — Cross-portal consistency (months 3–5)

- Align shared terminology, status chips, date formatting, error patterns, and
  responsive primitives between Agent and Admin portals.
- Preserve role-specific information density and permissions; shared styling must
  not imply shared access.
- Address Admin workflows only in small, separately reviewed slices.

### Phase L5 — Controlled release readiness (months 5–6)

- Confirm the exact VPS commit and migration state read-only.
- Refresh the production data audit and backup evidence.
- Run security, tenant-isolation, accessibility, performance, and rollback checks.
- Start with an explicitly named Agent pilot cohort and observable success/rollback
  criteria.
- Expand only after the pilot evidence passes; no automatic full rollout.

## Prioritization rules

A candidate change enters the next slice only when it satisfies all of these:

1. It solves an observed Agent task problem.
2. It works with current production data and contracts.
3. It has no schema or backend dependency.
4. It is independently testable and reversible.
5. Its success can be demonstrated on desktop and mobile.

Admin work additionally requires a direct connection to Agent onboarding, shared
status understanding, or a low-risk reusable UI correction.

## Stop conditions

Pause the active slice and return to audit if it requires:

- a new API endpoint or response field;
- a new/inferred status or lifecycle rule;
- a migration, seed, backfill, or production data write;
- removal or reinterpretation of an existing workflow;
- more than one primary user flow in the same review unit.

## Immediate next decision

N0 is complete. Begin Phase N1 only after the revised three-destination brief is
confirmed; do not combine N1 with the deeper Visa or Perjalanan slices.
