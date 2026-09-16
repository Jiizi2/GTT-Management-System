# Frontend Incremental Restart Audit — 2026-09-16

## Decision

Do not promote `feat/agent-portal-shared-data-alignment` to production. Restart from
`origin/master` (`07afaaa`, whose application tree matches the shared base
`c8facfd`) and limit the next delivery to frontend-only changes that consume the
existing production contracts.

No deployment, database migration, production write, or production configuration
change is authorized by this restart.

## Evidence and limits

- The abandoned implementation is preserved at commit `945cda6` on both
  `feat/agent-portal-shared-data-alignment` and
  `archive/pre-frontend-restart-20260916-945cda6`.
- A complete Git bundle is stored locally at
  `.local-backups/pre-frontend-restart-20260916-945cda6.bundle`.
- The closest verified code baseline is `origin/master` at `07afaaa`. Its tree
  matches `c8facfd`; the seven later commits on `origin/master` are merge commits.
- Database comparison uses the read-only local production dump
  `.local-backups/production_backup.sql`, captured 2026-09-13. The latest applied
  migration in that snapshot is `20260821000000_add_visa_setup_flight_details`,
  which matches the baseline repository.
- Direct SSH/server revision evidence was not available in this workspace. The
  live server commit must therefore be confirmed separately before any future
  release; this audit does not claim that `origin/master` is the running SHA.

## Why the current implementation is unsafe to promote

The branch diverges from the production-aligned base by 472 files and roughly
66,030 insertions. It changes 308 backend files, 132 frontend files, and adds 14
database migrations plus 15 Prisma models.

The 2026-09-13 production snapshot contains the legacy operational shape: 95
Groups, 168 HotelAgreementDraft rows, 263 ItineraryItem rows, and no rows in
AgentPortalUser or VisaApplication. It does not contain the new canonical models
for Travel Groups, Flight Plans, Hotel Agreements, shared itinerary, or transport
requirements. The new frontend calls endpoints such as `/travel-groups`,
`/hotel-agreements`, `/visa-applications`, and canonical flight-plan/lifecycle
routes that are not part of the baseline contract.

Deploying the branch would therefore require backend rollout flags, migrations,
backfills, reconciliation decisions, and account provisioning. That is the
opposite of a frontend-first incremental change.

## What to retain

Retain these as reference material, not as a wholesale cherry-pick:

1. The GTT Serene visual direction, accessible focus behavior, responsive Agent
   layouts, reduced-motion handling, explicit empty/error states, and clearer
   journey/visa information hierarchy.
2. The product and design notes, visual fixtures, and regression-test ideas from
   the archived branch.
3. Pure presentation helpers and copy improvements only when they can be
   reimplemented against existing fields and endpoints without fallback business
   logic.
4. The test patterns for keyboard navigation, touch targets, horizontal overflow,
   theme coverage, and stale-query isolation.

## What to simplify

1. Improve one existing surface at a time; begin with the Agent Home/dashboard
   because it offers visible user value while remaining read-only.
2. Preserve the current navigation, route names, status vocabulary, and server
   payloads. Do not rename Agreement Inbox to Agreement Registry in the first
   frontend pass.
3. Reuse existing Agent group, visa, itinerary, and checklist reads. Present
   missing information honestly instead of deriving a new lifecycle or joining
   data through a new backend contract.
4. Adopt only a small token layer and a few shared presentation components. The
   archived `styles.css` addition is too broad to transplant as one block.
5. Keep each pull request independently reversible and limited to one user flow.

## What not to apply

- All new Prisma models and the 14 post-baseline migrations.
- Travel Group, Hotel Agreement master/allocation, Flight Plan, shared itinerary,
  transport requirement, and lifecycle command services.
- Backfill, reconciliation, cutover, rollout, and production-pilot machinery.
- Frontend hooks or pages that require the new canonical endpoints.
- Route replacement or workflow changes that remove or reinterpret existing
  production behavior.
- Any inferred status, deadline, ownership, or fallback data not returned by the
  existing server.

## Frontend-first delivery slices

### Slice 1 — Agent Home clarity

- Restyle the existing Agent dashboard using its current read model.
- Improve hierarchy, loading/error/empty states, mobile reading order, focus, and
  primary navigation clarity.
- No new route, API call, field, status, mutation, or backend change.

### Slice 2 — Visa tracking usability

- Improve scanning, labels, status explanation, and responsive behavior using the
  existing visa payload.
- Preserve all current actions and validation semantics.

### Slice 3 — Journey/group detail consistency

- Align spacing, section hierarchy, action placement, and feedback across the
  existing detail screens.
- Do not introduce canonical Travel Group or Flight Plan concepts.

Backend/database work may only be proposed after these frontend slices make a
specific missing contract visible and the production data has been audited for
that single contract.

## Gate for every slice

- Diff is frontend-only and narrowly scoped.
- Existing API paths and response fields only.
- No migration, seed, backfill, rollout flag, or production command.
- Desktop and mobile visual review, keyboard path, visible focus, 44 px touch
  targets, no horizontal overflow, and reduced-motion verification.
- Frontend build, lint, unit, component, and relevant browser tests pass.
- Deployment remains a separate, explicit decision after review.

## Current archived-branch verification

- Frontend production build: pass.
- Unit tests: 41 files / 170 tests pass.
- Component tests: 53 files / 584 tests pass.
- Lint: 0 errors / 61 warnings.
- Initial bundle: approximately 280 KB JavaScript graph and 164 KB CSS; the
  statistics chunk is approximately 409 KB.
- Impeccable detector over the full frontend: 561 findings (37 warnings and 524
  advisories), dominated by token/type-ramp drift. The archived Agent-specific
  audit is stronger than the repository-wide result, reinforcing that future
  changes should stay surface-scoped.

