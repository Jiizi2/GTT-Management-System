# Agent Portal N0 Baseline — 2026-09-16

## Baseline manifest

| Evidence | Value |
| --- | --- |
| Working branch before this report | `ad820317eb34f86536d6664918bd5dc55d1cd533` |
| Production-aligned code base | `origin/master` at `07afaaa48e7d9c266a17aa1c534e6fc639ebb381` |
| Source dump | `.local-backups/production_backup.sql` |
| Source dump SHA-256 | `C0C75FCCF7D4D4389F8C3958EF9DB234CB2E3EE4187418BD2230BA38939ADF33` |
| Reference local database | `gtt_ops_vps_20260913_qa` |
| Disposable working database | `gtt_ops_agent_ui_dev_20260916` |
| Latest migration | `20260821000000_add_visa_setup_flight_details` |
| Runtime data source | PostgreSQL via Prisma, local only |

The disposable database was restored from the source dump. Its local super-admin
password was reset only inside that disposable database, then three preview
accounts were provisioned through the existing `/agent-portal-accounts` API. No
source dump, reference database, VPS, or production account was changed.

Preview credentials are intentionally not recorded in Git. Screenshots may contain
production-derived operational data and remain under ignored local `artifacts/`.

## Data scenarios verified

| Scenario | Expected groups | API result |
| --- | ---: | ---: |
| Empty | 0 | 0 |
| Typical | 2 | 2 |
| Maximum observed | 19 | 19 |

Cross-tenant detail access from the empty account to a typical account's group
returned `404`. Backend health returned `200` with database `up`.

## Visual evidence

Twenty-seven screenshots are stored locally in
`artifacts/agent-portal-n0/screenshots/` and are excluded from Git.

Coverage includes:

- login at desktop and mobile;
- Home at 0, 2, and 19 groups on desktop/mobile;
- Home, Visa, Checklist, Profile, and Group Detail at tablet;
- Visa Tracking, Visa Detail, Checklist, Profile, and Group Detail at
  desktop/mobile;
- Home and Group Detail in dark mode at desktop/mobile.

## Implementation integrity verdict

**PASS WITH MATERIAL GAPS.** The current portal is product-specific, tenant-scoped,
and uses real operational concepts. It is not a generic template. However, the
Agent shell has accessibility gaps, current empty-state copy conflates different
conditions, maximum-data detail routes create request fan-out, and one committed
component test is already inconsistent with its shared navigation implementation.

## Audit health score

| # | Dimension | Score | Key finding |
| --- | --- | ---: | --- |
| 1 | Accessibility | 2/4 | No bypass link; search has no accessible name; inactive mobile labels are invisible |
| 2 | Performance | 2/4 | Maximum case makes 21 Checklist requests and 39 Group Detail requests |
| 3 | Responsive design | 3/4 | No horizontal overflow, but several controls are below the 44 px project target |
| 4 | Theming | 3/4 | Light/dark render coherently; contrast still needs automated AA evidence |
| 5 | Implementation integrity | 3/4 | Coherent product UI, but shared-component/test drift is present |
| **Total** |  | **13/20** | **Acceptable — significant focused work needed** |

Issue count: **P0 0 · P1 3 · P2 5 · P3 1**.

## Detailed findings

### P1 — Mobile navigation labels disappear outside the active destination

- **Location:** `apps/frontend/src/agent/agent-shell.tsx`, mobile navigation.
- **Category:** Accessibility / responsive design.
- **Evidence:** inactive destination labels compute to `opacity: 0`. On Group Detail
  no destination is active, so all four labels are invisible.
- **Impact:** users must identify destinations from icons alone and lose location
  context on detail routes.
- **Standard:** WCAG 1.3.3 and 3.2.3; project requirement that status/navigation not
  depend on visual shorthand alone.
- **Recommendation:** keep every label visible and indicate the active destination
  using text, color, and persistent state. Map Group Detail to Overview context and
  Visa Detail to Visa Tracking context.
- **Suggested command:** `$impeccable adapt`.

### P1 — No bypass mechanism or route-aware main focus

- **Location:** `apps/frontend/src/agent/agent-shell.tsx`.
- **Category:** Accessibility.
- **Evidence:** keyboard traversal begins at theme toggle and proceeds through all
  page controls; no skip link reaches `#main-content`. Route changes do not move
  focus to the new page heading/main region.
- **Impact:** keyboard and assistive-technology users repeatedly traverse navigation
  and may not be told that routed content changed.
- **Standard:** WCAG 2.4.1 and 2.4.3.
- **Recommendation:** add a visible-on-focus skip link and route-aware main focus
  behavior that does not steal focus on the initial page load.
- **Suggested command:** `$impeccable harden`.

### P1 — Search input has no accessible name

- **Location:** shared Overview/Checklist search rendered inside Agent pages.
- **Category:** Accessibility.
- **Evidence:** browser focus inspection reports the text input with an empty
  accessible name; placeholder text is the only instruction.
- **Impact:** screen-reader users cannot reliably identify the input's purpose.
- **Standard:** WCAG 3.3.2 and 4.1.2.
- **Recommendation:** provide an explicit visible label or `aria-label` appropriate
  to each surface.
- **Suggested command:** `$impeccable harden`.

### P2 — Empty account and empty filter share misleading copy

- **Location:** Agent Home through shared `OverviewScreen` empty state.
- **Category:** Implementation integrity / UX copy.
- **Evidence:** the zero-group account shows “No groups found” and asks the user to
  try another keyword even though no search/filter produced the state.
- **Impact:** an Agent may believe data is hidden by a filter instead of having no
  assigned groups.
- **Recommendation:** distinguish initial zero assignment from filtered zero result;
  offer reset only for the latter.
- **Suggested command:** `$impeccable clarify`.

### P2 — Maximum-data routes fan out requests

- **Location:** `useAgentGroupData` and Agent Checklist query flow.
- **Category:** Performance.
- **Evidence:** local maximum scenario makes 39 requests to open Group Detail (one
  group list plus visa/hotel pairs for 19 groups) and 21 requests for Checklist.
  Local measured times were approximately 548 ms and 1,290 ms respectively.
- **Impact:** production network latency can make a single detail page feel slow and
  magnify partial failure risk.
- **Recommendation:** in the frontend-first scope, avoid preloading unrelated group
  facets where current endpoints permit targeted loading. Any server aggregation is
  deferred and requires separate approval.
- **Suggested command:** `$impeccable optimize`.

### P2 — Multiple controls miss the 44 px project touch target

- **Location:** shell collapse, filters, export/detail/back/copy actions, and All
  Days control.
- **Category:** Accessibility / responsive design.
- **Evidence:** measured heights range from 24–40 px on changed target surfaces.
- **Impact:** controls are harder to operate on touch devices, especially in dense
  operational contexts.
- **Recommendation:** increase target boxes while retaining compact visual labels.
- **Suggested command:** `$impeccable adapt`.

### P2 — Committed component baseline is not green

- **Location:** `src/components/__tests__/mobile-nav.test.tsx`.
- **Category:** Implementation integrity.
- **Evidence:** 558 component tests pass and one fails. The test expects
  `opacity-0` for an inactive shared Admin mobile label, while the implementation
  keeps it visible.
- **Impact:** the suite cannot serve as an unambiguous regression gate until the
  stale expectation is resolved.
- **Recommendation:** confirm the intended shared Admin behavior, then update only
  the stale assertion; do not change working UI merely to satisfy stale coverage.
- **Suggested command:** `$impeccable harden`.

### P2 — Language and task hierarchy are inconsistent

- **Location:** Login, Home, Group Detail, Visa, and Checklist.
- **Category:** Implementation integrity.
- **Evidence:** English and Indonesian labels mix within single flows; the Weekly
  Summary export and metric cards precede the primary group-finding task.
- **Impact:** scanning requires more interpretation and the primary Agent job is
  visually delayed.
- **Recommendation:** use Indonesian for touched task/action copy while preserving
  identifiers and canonical values; place group discovery before secondary export
  and aggregate context.
- **Suggested command:** `$impeccable clarify`, then `$impeccable layout`.

### P3 — Brand heading precedes the page H1

- **Location:** Agent sidebar brand mark.
- **Category:** Accessibility / semantics.
- **Evidence:** heading order starts with `H2: GTT` before the page `H1`.
- **Impact:** document outline contains a decorative/brand heading unrelated to the
  page hierarchy.
- **Recommendation:** render the brand mark as non-heading text.
- **Suggested command:** `$impeccable harden`.

## Positive findings

- Tenant isolation works for the three preview accounts and cross-tenant detail is
  hidden with `404`.
- All tested surfaces have zero horizontal overflow at 1440, 1024, and 390 px.
- Existing routes and read-only behavior work against the production-aligned data.
- Light and dark themes present coherent product-specific visual systems.
- The 0, 2, and 19-group scenarios render without crashes.
- Frontend build passes; 32 unit files / 142 tests pass.
- Lint has zero errors and 61 pre-existing warnings.
- Initial bundle baseline is 279.6 KB JavaScript graph and 116.9 KB CSS; Agent
  application chunk is 32.9 KB.
- The generic Impeccable detector reports no deterministic finding inside
  `src/agent`; this result is limited because the master baseline has no local
  `DESIGN.md` contract.

## Recommended actions

1. **P1 `$impeccable harden`:** fix bypass/focus, accessible search naming, and
   route context.
2. **P1 `$impeccable adapt`:** keep mobile labels visible and make controls
   touch-safe.
3. **P2 `$impeccable clarify`:** distinguish empty assignment from empty filter and
   normalize touched copy.
4. **P2 `$impeccable optimize`:** reduce current frontend request fan-out without
   adding endpoints.
5. **P2 `$impeccable layout`:** put Agent group discovery before supporting metrics
   and export.
6. **P3 `$impeccable polish`:** perform the bounded final consistency pass.

## N0 exit verdict

N0 is complete. The production-aligned local environment, representative access,
tenant boundary, screenshot matrix, baseline performance, build, and automated
test state are documented. N1 may begin only after its brief is accepted.

