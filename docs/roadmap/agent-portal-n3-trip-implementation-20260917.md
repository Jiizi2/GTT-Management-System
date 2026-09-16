# Agent Portal N3 Perjalanan Implementation Record — 2026-09-17

## Outcome

N3 gives Agent users a dedicated read-only Perjalanan detail instead of reusing
the denser Admin Group Detail surface. It preserves the incumbent visual system,
existing server fields, Agent tenant scope, and all backend/database behavior.

## Implemented sequence

The detail page now presents existing evidence in this order:

1. group identity, lifecycle label, travel dates, pax, package, bus need, and
   musyrif;
2. next recorded activity;
3. chronological itinerary;
4. visa, syarikah, payment, and hotel agreements;
5. transportation and H-1 driver readiness;
6. supporting Agent-visible notes.

Missing itinerary, hotel agreement, transportation, checklist, musyrif, and notes
are shown as missing or not recorded. They are never rendered as complete.
Transportation explicitly distinguishes **Belum ditugaskan**, **Menunggu
verifikasi**, and **Driver terverifikasi** using text in addition to color.

## Request-density improvement

The previous Agent Group Detail used the all-groups adapter. In the maximum
observed 19-group account it required:

- 1 paginated group-list request;
- 19 visa-facet requests;
- 19 hotel-agreement requests;
- 39 API requests total before rendering one detail.

The new detail query requests only the opened group:

- group detail;
- visa facet;
- hotel agreements;
- transportation readiness.

Browser verification confirmed exactly 4 Agent group requests. The endpoints,
response shapes, authorization, and tenant boundaries are unchanged.

## Verification

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run test:unit`: 32 files / 142 tests passed.
- `npm run test:component`: 46 files / 568 tests passed.
- Targeted Dashboard/Perjalanan suite: 6 tests passed.
- `npm run lint`: 0 errors; the N3 warning found during the first run was removed.
- Impeccable detector for Agent Group Detail: `[]`.
- Browser verification with production-aligned preview data:
  - Perjalanan list and detail passed at desktop and mobile widths;
  - the live five-activity itinerary remained readable;
  - no horizontal overflow;
  - visible mobile buttons and inputs met the 40 px test floor;
  - no failed request after authentication.

## Boundaries retained

- No shared Admin Group Detail component changed.
- No backend, Prisma, migration, seed, or production data changed.
- No Agent write action was added.
- No deployment or remote push was performed.
