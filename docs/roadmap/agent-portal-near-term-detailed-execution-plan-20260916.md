# Detailed Near-Term Agent Portal Execution Plan

Date: 2026-09-16  
Horizon: 2–4 weeks  
Active branch: `feat/frontend-incremental-restart`  
Code baseline: `origin/master` at `07afaaa`  
Data baseline: local restore of the 2026-09-13 production dump  

## 1. Objective

Improve Agent Portal flow, usability, consistency, accessibility, and responsive
behavior without changing backend code, database schema, API contracts, business
status, or production state.

The near-term release is successful when an Agent can quickly:

1. read factual workload statistics on Dashboard;
2. inspect visa progress in Visa Tracking;
3. find an assigned group and inspect its itinerary in Perjalanan;
4. distinguish missing data from completed work or request failure.

Portal Admin work is optional and limited to low-risk changes caused by shared
components or existing Agent-account administration. It is not a parallel redesign.

## 2. Fixed boundaries

### Allowed

- Files under `apps/frontend/`.
- Focused frontend tests and deterministic browser fixtures.
- Small shared-component changes when both Agent and Admin behavior are verified.
- Local-only test account provisioning through the existing API on a disposable
  working copy of the restored database.
- Documentation and screenshot evidence stored outside production data.

### Not allowed

- Backend source changes.
- Prisma schema or migration changes.
- New API endpoints, fields, status values, or fallback business rules.
- Seed/backfill/cutover scripts.
- Production credentials, writes, deployment, or configuration changes.
- Wholesale cherry-picking from `feat/agent-portal-shared-data-alignment`.
- Renaming or replacing established workflows in the Admin portal.

Stop the active slice immediately if it crosses one of these boundaries.

## 3. Existing contract freeze

The implementation may consume only the existing Agent endpoints:

- authentication: `/agent/auth/login`, `/agent/auth/session`, `/agent/auth/logout`;
- overview: `/agent/dashboard`;
- groups: `/agent/groups` and current group detail/itinerary/timeline reads;
- group facets: existing `/visa`, `/hotel-agreements`, and `/transportation` reads;
- profile: `/agent/profile`.

Existing detail and utility routes remain available:

- `/agent/overview`;
- `/agent/groups/:identity`;
- `/agent/visa` and `/agent/visa/:identity`;
- `/agent/checklist`;
- `/agent/profile`.

N1 may add the frontend index route `/agent/groups` by reusing the existing groups
endpoint. Existing detail routes and bookmarks remain valid; no backend route is
added.

The reviewer must compare browser network traffic against this allowlist for every
slice. A new request is a stop condition, not an implementation detail.

## 4. Real data scenarios

Use the production-aligned data ranges as the test matrix:

| Scenario | Purpose | Required evidence |
| --- | --- | --- |
| No groups | First-use/empty experience | No misleading metrics or actions |
| 1–3 groups | Typical Agent workload; median is 2 | Fast scanning and direct detail navigation |
| 19 groups | Maximum currently observed | Search/filter usability, stable scrolling, no overflow |
| Entry-only group | Incomplete operational record | Missing data is explicit, not presented as complete |
| Active group | Current operational work | Status and next known activity are prominent |
| Missing itinerary | 26 of 95 groups currently have none | Honest empty state |
| Missing checklist | 42 of 95 groups currently have none | Clear dependency/absence message |
| Long identifiers/content | Stress responsive layout | Safe wrap/truncation with accessible full meaning |

The restored snapshot has zero `AgentPortalUser` rows. Preserve the restored
database as the reference copy. If live login is required, create a disposable
local working database from it and provision only local test accounts through the
existing `/agent-portal-accounts` capability. Never modify the source dump or VPS.

## 5. Delivery topology

Work in four independently reviewable slices:

| Slice | Target duration | Primary outcome | Code-change ceiling |
| --- | ---: | --- | --- |
| N0 — Baseline | 1–2 days | Reproducible current-state evidence | No runtime UI change |
| N1 — Three destinations | 3–5 days | Dashboard, Visa, and Perjalanan have clear ownership | Shell plus minimum Dashboard/Perjalanan separation |
| N2 — Visa | 3–4 days | Visa state is easy to scan and inspect | Visa list/detail only |
| N3 — Perjalanan | 3–5 days | Itinerary and trip readiness read coherently | Perjalanan detail/readiness only |
| N4 — Hardening | 2–3 days | Release candidate evidence | Fixes only; no new features |

If capacity is limited to two weeks, stop after N2 and harden what is complete.
N3 must not be squeezed into the same review unit.

## 6. Phase N0 — Baseline and safe preview

### N0.1 — Freeze references

Tasks:

- Record `HEAD`, `origin/master`, dump checksum, database name, and latest migration.
- Confirm Git working tree is clean before visual work.
- Confirm backend uses the restored local PostgreSQL database.
- Keep the current pre-restart Git bundle and local database backup intact.

Deliverable: one baseline manifest containing hashes and no secrets.

### N0.2 — Prepare local Agent access

Tasks:

- Clone the restored local database into a disposable Agent UI working database.
- Select representative Agents by group count, not by publishing personal names.
- Provision local-only accounts through the existing supported account endpoint.
- Verify tenant isolation by confirming each account sees only its assigned groups.
- Record account identifiers only in ignored/private local artifacts.

Exit criteria:

- Login, session refresh, and logout work locally.
- No production system was contacted or changed.
- Reference restore remains recoverable.

### N0.3 — Capture incumbent truth

Capture these routes at desktop (1440 × 900), tablet (1024 × 768), and mobile
(390 × 844):

- Login;
- Home with 0, typical, and maximum group counts;
- Visa Tracking and Visa Detail;
- Group Detail with complete and missing itinerary;
- Checklist with data and without assignments;
- Profile.

For each route, record:

- first meaningful content and visual hierarchy;
- keyboard order and visible focus;
- heading/landmark structure;
- touch-target failures;
- horizontal overflow;
- loading, error, empty, and authentication-expiry behavior;
- browser requests and response shapes used by the page.

### N0.4 — Approve the first slice

Produce a one-page N1 design brief containing only:

- exact problems to solve;
- unchanged facts/actions;
- desktop/mobile target composition;
- acceptance screenshots and tests.

N0 exit gate: baseline evidence is accepted before N1 code begins.

## 7. Phase N1 — Three-destination foundation

### Target files

Primary:

- `apps/frontend/src/agent/agent-shell.tsx`;
- `apps/frontend/src/agent/pages/dashboard-page.tsx`;
- `apps/frontend/src/agent/pages/trips-page.tsx`;
- `apps/frontend/src/agent/components/data-state.tsx`;
- a small number of Agent-scoped presentation components if extraction materially
  improves readability.

Shared-risk files requiring Admin regression review:

- `apps/frontend/src/pages/overview-page.tsx`;
- components imported by `OverviewScreen`;
- `apps/frontend/src/styles.css`.

Prefer Agent wrappers or explicit variant props over global/shared behavior changes.

### N1.1 — Shell accessibility and orientation

- Add or verify a skip-to-content path.
- Give the main region a stable focus target on route change without stealing focus
  on initial page load.
- Keep Dashboard, Visa Tracking, and Perjalanan labels visible in active and
  inactive states.
- Move Profile out of primary navigation while keeping it clearly reachable as an
  account utility.
- Treat Group Detail as Perjalanan context and Visa Detail as Visa Tracking context.
- Ensure navigation and collapse/logout controls have accessible names and at least
  44 × 44 px touch targets.
- Preserve sidebar collapse behavior and all permission filtering.
- Provide an intentional reduced-motion alternative for sidebar, hover, and mobile
  navigation transitions.

Acceptance tests:

- exact accessible names for all navigation destinations;
- keyboard traversal from skip link through primary actions;
- active route conveyed independently of color;
- no mobile content hidden behind the bottom navigation.

### N1.2 — Dashboard information hierarchy

Order content by task value:

1. page identity and Agent context;
2. server-authoritative workload statistics;
3. concise upcoming/recent context already returned by the endpoint;
4. direct routes to Visa Tracking and Perjalanan.

Do not create deadlines, priority scores, or inferred attention reasons. Existing
dashboard counts remain server-authoritative. Do not keep the full searchable
group list on Dashboard.

### N1.3 — Minimum Perjalanan index

- Move/reuse existing group-code/name search, active-only filter, month filter,
  ordering, and pagination under `/agent/groups`.
- Make active filters visible and offer one clear reset.
- Keep filter state stable while opening and returning from a group when practical
  without introducing a new global store.
- Show “no groups assigned” separately from “no results for these filters.”
- Ensure the 19-group case remains responsive.

### N1.4 — State handling

Define Agent-specific copy for:

- initial load;
- recoverable request failure with retry;
- expired session, which returns to login;
- zero assigned groups;
- no matching filter result;
- missing next activity/itinerary.

Copy must explain what happened and the available next action without exposing
technical errors or promising unavailable data.

### N1.5 — Tests and review

Add focused coverage for:

- Agent shell routing and accessible navigation;
- dashboard mapping without changing contract fields;
- 0, 2, and 19-group rendering;
- filter/reset behavior;
- loading/error/empty distinctions;
- desktop/mobile overflow and touch targets in browser tests.

N1 exit gate:

- frontend-only diff;
- existing API allowlist unchanged;
- Dashboard and minimum Perjalanan index approved at desktop and mobile;
- shared Admin Overview regression test passes if any shared file changed.

## 8. Phase N2 — Visa Tracking and Visa Detail

### Target files

Primary:

- `apps/frontend/src/agent/pages/visa-tracking-page.tsx`;
- `apps/frontend/src/agent/pages/visa-detail-page.tsx`;
- current Agent data adapters/contracts only if presentation typing requires it.

Shared-risk files:

- `apps/frontend/src/pages/visa-tracking-page.tsx`;
- shared Visa tracking rows, status components, and styles.

### N2.1 — List scanability

- Lead each record with group code/name and current factual visa status.
- Keep bus/payment/hotel information subordinate and only when already authorized.
- Use text plus visual treatment for statuses; never color alone.
- Keep one explicit detail action per record.
- Handle long codes, narrow screens, and missing values without horizontal scroll.

### N2.2 — Detail comprehension

- Establish a predictable back path to Visa Tracking.
- Group existing visa and hotel facts into clearly titled sections.
- Distinguish “not recorded” from request failure or rejected status.
- Preserve all current read-only behavior and tenant boundaries.
- Treat required-document readiness as a separate evidence gate. The current
  frontend contract exposes no per-document data; audit the current server before
  proposing any document UI, and do not invent document names or completion.

### N2.3 — Tests and Admin impact

- Extend `agent-visa-tracking.test.tsx` for missing/partial/long data and navigation.
- Add browser checks for list/detail keyboard flow and mobile overflow.
- If a shared Visa component changes, capture and test the Admin Visa view in the
  same commit.

N2 exit gate: every presented label maps to a current response field or established
display mapping, and no new status semantics are introduced.

## 9. Phase N3 — Perjalanan itinerary and readiness

### Target files

Primary:

- `apps/frontend/src/agent/pages/group-detail-page.tsx`;
- `apps/frontend/src/agent/pages/checklist-page.tsx`;
- Agent-scoped state/presentation helpers.

Shared-risk files:

- `apps/frontend/src/pages/group-detail-page.tsx` and its child components;
- `apps/frontend/src/pages/checklist-page.tsx` and its child components.

### N3.1 — Perjalanan detail sequence

Present existing content in this order:

1. group identity, lifecycle status, and travel dates;
2. next known activity and itinerary chronology;
3. visa and hotel facts already returned by the current API;
4. transportation/H-1 readiness facts;
5. supporting notes that are already allowed for Agent users.

The page must not merge records into a new Travel Group concept or synthesize a
canonical lifecycle.

### N3.2 — Missing and partial data

- Missing itinerary: state that no itinerary is recorded.
- Missing hotel agreement: show absence, not rejection.
- Missing transportation: show unavailable/not assigned based only on existing
  fields.
- Missing checklist: explain that no checklist assignment is available.
- Partial responses: retain available sections and isolate the failed section where
  the current query structure permits it; do not fabricate fallback values.

### N3.3 — Trip-readiness density and performance

- Preserve current read-only checklist behavior.
- Present H-1 Checklist as supporting Perjalanan information, not primary
  navigation and not visa-document readiness.
- Make incomplete versus assigned/verified states explicit in text.
- Measure the maximum 19-group request pattern; record any fan-out cost.
- Frontend-only batching/cache improvements are allowed only if requests and
  responses remain identical and tenant boundaries are unchanged.

### N3.4 — Tests and Admin impact

- Add Agent Group Detail component coverage for complete and missing sections.
- Add checklist coverage for zero, typical, and maximum Agent group counts.
- Run Admin Group Detail/Checklist regressions for every shared component change.

N3 exit gate: users can distinguish “missing,” “pending,” and “complete” without
color or assumed business logic.

## 10. Phase N4 — Bounded hardening

No new features enter N4.

### N4.1 — Automated gates

Run:

- `npm run check --workspace frontend`;
- `npm run lint --workspace frontend`;
- `npm run test:unit --workspace frontend`;
- `npm run test:component --workspace frontend`;
- relevant Playwright Agent journeys;
- `npm run build --workspace frontend`;
- `npm run analyze:bundle --workspace frontend`;
- Impeccable detector only across changed UI targets.

Lint may retain pre-existing warnings, but changed files must introduce no new
warning. Build and tests must have zero failures.

### N4.2 — One visual defect pass

Inspect desktop and mobile captures together for all changed routes. Batch all
verified defects into one fix pass, then perform at most one confirmation pass.

Check:

- hierarchy and reading order;
- long and missing content;
- light/dark modes;
- keyboard focus and status semantics;
- touch targets and fixed-navigation clearance;
- reduced motion;
- horizontal overflow and text scaling.

### N4.3 — Performance guard

- Initial JavaScript graph must not grow by more than 5% from the recorded baseline
  without explicit approval.
- Initial CSS must not grow by more than 5%.
- Do not add a new runtime dependency for presentation-only work.
- Route-specific work remains lazy-loaded where it already is.

### N4.4 — Handoff evidence

Produce:

- before/after screenshots;
- test/build/bundle results;
- changed endpoint inventory showing no additions;
- known limitations and deferred ideas;
- explicit statement that no backend/database/production change occurred.

## 11. Commit and review plan

Recommended commit boundaries:

1. `test(agent): capture production-aligned portal baseline`
2. `feat(agent-ui): establish three primary destinations`
3. `feat(agent-ui): separate dashboard and perjalanan flows`
4. `feat(agent-ui): improve visa tracking flow`
5. `feat(agent-ui): align group detail and checklist presentation`
6. `test(agent-ui): harden responsive and accessibility coverage`

Do not merge these into one monolithic commit. Do not push or deploy unless the
user later requests that action explicitly.

## 12. Definition of done per slice

A slice is done only when all are true:

- user outcome is demonstrated with production-aligned local data;
- diff is scoped to the named flow;
- no backend, Prisma, migration, or database source file changed;
- existing endpoint and field inventory is unchanged;
- loading, error, empty, partial, and maximum-content states are covered;
- desktop and mobile are reviewed together;
- keyboard, visible focus, status text, touch targets, and overflow pass;
- affected Agent tests pass;
- affected Admin tests pass when shared files changed;
- build passes and changed files add no lint warning;
- the slice can be reverted without affecting later independent work.

## 13. Decision log required during execution

For each slice, record only material decisions:

- shared component changed versus Agent-specific wrapper, and why;
- any copy/status mapping retained from the server;
- any idea rejected because it required a backend or schema change;
- bundle/test/accessibility deltas;
- whether an Admin companion improvement was included or deferred.

## 14. Next executable checkpoint

N0 is complete. The next reviewable slice is **N1 only**:

1. establish the three-destination shell;
2. separate factual Dashboard statistics from the group list;
3. move/reuse group discovery in the minimum Perjalanan index;
4. return with desktop/mobile evidence before beginning N2.

No Visa or deep Perjalanan redesign begins in this checkpoint.
