# Agent Portal N1 Brief — Shell and Home Clarity

Date: 2026-09-16  
Mode: Operate  
Primary route: `/agent/overview`  
Related shell: all `/agent/*` routes  

## Job and audience

An authenticated partner Agent arrives to find an assigned travel group and
understand its factual current state. The user may have no groups, a typical two
groups, or up to the observed maximum of nineteen. They should not need to learn
the internal Admin information architecture.

## Outcome and proof

N1 succeeds when an Agent can:

- identify the current portal and route;
- search or filter assigned groups with an accessible control;
- scan group identity, lifecycle, travel dates, pax, and next recorded activity;
- open Group Detail and return without losing orientation;
- understand zero assignment, empty filter result, loading, request failure, and
  missing itinerary as different conditions.

Proof uses only the existing `/agent/dashboard` and `/agent/groups` responses plus
the 0/2/19 local scenarios. No new meaning may be inferred.

## Selected direction

Refine the current calm green GTT workspace. The structural thesis is **group
discovery first, operational context second**.

The first viewport should contain:

1. a concise Agent Home title and context;
2. labeled search and compact filters with an explicit reset when active;
3. the start of the assigned-group list;
4. compact supporting totals, with Weekly Summary/export demoted from the primary
   focal position.

The focal moment is a readable group record with an explicit status and next known
activity, followed by one clear “Lihat detail” action.

## Scope

Primary targets:

- `apps/frontend/src/agent/agent-shell.tsx`;
- `apps/frontend/src/agent/pages/dashboard-page.tsx`;
- `apps/frontend/src/agent/components/data-state.tsx`;
- focused Agent tests.

Shared `OverviewScreen` or shared cards may change only through a narrowly named
Agent variant/prop with Admin regression coverage. Prefer an Agent wrapper when a
change would alter Admin hierarchy or behavior.

## Required behavior

### Shell

- Add a visible-on-focus skip link to `#main-content`.
- Focus the main region/page heading after client-side route changes, except initial
  load.
- Keep Overview, Visa Tracking, Checklist, and Profile labels visible in mobile
  navigation at all times.
- Treat Group Detail as Overview context and Visa Detail as Visa Tracking context.
- Use at least 44 × 44 px target boxes for shell controls.
- Preserve permissions, logout, theme switching, sidebar collapse, and routes.
- Provide reduced-motion behavior without removing visible state feedback.

### Home hierarchy

- Put group search/list ahead of Weekly Summary/export and detached metrics.
- Keep server totals factual and compact.
- Preserve current arrival-date ordering, pagination, search, active-only filter,
  and month filter.
- Do not create a “priority,” “urgent,” “deadline,” or derived journey state.
- Retain all current routes and network requests.

### Copy and states

- Touched task/action copy uses Indonesian; group codes, names, and canonical data
  values remain unchanged.
- Zero assignment: explain that no group is currently assigned to this Agent.
- Empty filter: state that no group matches the current search/filter and offer
  reset.
- Missing itinerary: say that itinerary has not been recorded.
- Recoverable request error: explain failure and provide retry.
- Expired session: return to Agent login without retaining another Agent's cache.

## Layout and interaction

- Desktop retains the sidebar; content remains within the existing application
  width and density.
- Tablet/mobile use the bottom navigation with all labels visible.
- Group identity is first in each record, followed by status and dates, pax/package,
  next recorded activity, then the detail action.
- Filters wrap rather than shrink below touch-safe size.
- The page must have no horizontal overflow at 1440 × 900, 1024 × 768, and
  390 × 844.
- Returning from Group Detail should restore the previous list/filter context when
  feasible without adding a global store.

## Explicit anti-goals

- No backend, Prisma, migration, seed, or database change.
- No new endpoint, request, response field, status, or lifecycle.
- No Agent payment data or internal-only notes.
- No broad Admin redesign.
- No new runtime dependency.
- No wholesale transplant of archived CSS or components.
- No deployment or push.

## Acceptance matrix

| Area | Required proof |
| --- | --- |
| Data | 0, 2, and 19 groups render correct server values |
| Empty states | Zero assignment and zero filter result have distinct copy/actions |
| Keyboard | Skip link, labeled search, filters, detail actions, and mobile nav are reachable in logical order |
| Mobile nav | All four labels visible; Overview context active on Group Detail |
| Touch | Changed interactive target boxes are at least 44 × 44 px |
| Responsive | No overflow at desktop/tablet/mobile target sizes |
| Motion | Reduced-motion emulation stops nonessential movement while retaining state cues |
| Network | Only existing Agent session/dashboard/groups requests occur |
| Admin safety | Shared Overview regressions pass if shared files change |
| Quality | Build, unit, component, relevant browser tests, lint delta, bundle delta, and detector pass recorded |

## Test work required

- Add Agent dashboard component coverage; current baseline lacks dedicated Home
  behavior tests.
- Extend Agent shell tests for skip link, route focus, visible mobile labels, and
  detail-route context.
- Cover zero assignment versus filtered zero result.
- Cover 19-group pagination/search without overflow.
- Resolve the stale shared `mobile-nav` assertion as a separate baseline test fix,
  retaining the intended visible-label behavior.
- Add browser assertions for request allowlist, keyboard order, touch targets,
  reduced motion, and the three viewport widths.

## Performance boundary

- Initial JavaScript graph may grow by at most 5% from 279.6 KB.
- Initial CSS may grow by at most 5% from 116.9 KB.
- Agent application chunk may grow by at most 5% from 32.9 KB unless a measured
  tradeoff is approved.
- N1 must not increase request count from the current Home baseline.

## N1 completion gate

N1 is complete only when the full acceptance matrix passes and the diff remains
frontend-only. Group Detail request fan-out may be measured and documented during
N1 but its behavioral optimization belongs to the later detail slice unless a
small frontend-only fix is necessary to make Home navigation usable.

