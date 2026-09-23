# Agent Portal N2 Visa Implementation Record — 2026-09-17

## Outcome

N2 improves Agent Visa Tracking and Visa Detail without changing production,
backend code, database schema, or business mutations. The Agent flow remains
read-only and continues to enforce the authenticated Agent scope on the server.

## Contract audit

The production-aligned backend already exposes an authorized read contract at
`GET /api/agent/visa-applications` and `GET /api/agent/visa-applications/:id`.
The service filters by the authenticated `agentId` and removes internal notes,
creator identity, audit logs, and document storage keys from Agent responses.

The typical local preview account currently returns zero visa-application rows.
Therefore the UI merges this additive source with the established group visa
facet. Existing groups remain visible, while document readiness is explicitly
shown as **Belum dicatat** instead of being inferred as complete. When application
records exist, their exact progress facets and public document metadata are used.

## Implemented slice

- Replaced the shared Admin-oriented visa board in Agent Portal with an
  Agent-specific, read-only list.
- Added factual summary counts for attention, processing, and issued states.
- Added URL-backed search and progress filters with distinct unassigned and empty
  filter states.
- Kept group code/name as the leading identity and made long identifiers wrap
  safely.
- Preserved one explicit detail action per row with keyboard/touch-safe sizing.
- Added predictable return navigation that preserves list search/filter state.
- Grouped Visa Detail into progress, current facts, process stages, documents,
  and hotel agreements.
- Added public document type, filename, review status, and review note rendering
  only when returned by the authorized application endpoint.
- Kept missing document/application data visibly different from verified,
  rejected, and request-failure states.
- Added component coverage for navigation, document revision data, missing
  document records, long identifiers, and empty filter results.

## Verification

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run test:unit`: 32 files / 142 tests passed.
- `npm run test:component`: 46 files / 566 tests passed.
- Targeted Agent Visa component suite: 4 tests passed.
- `npm run lint`: 0 errors; existing repository warnings remain. The one N2
  warning found during the run was removed.
- Impeccable detector on both changed Agent Visa pages: `[]`.
- Browser verification using the two-group preview Agent:
  - list and detail passed at 1440 × 900 and 390 × 844;
  - no horizontal overflow;
  - visible mobile buttons and inputs met the 40 px test floor;
  - no failed requests after authentication;
  - list-to-detail and back navigation worked.

## Boundaries retained

- No backend or Prisma file changed.
- No migration, seed, or production data operation ran.
- No write action was added to Agent Portal.
- Admin Visa screens and workflows were not changed.
- No deployment or remote push was performed.
