-- Dashboard query mapping for Itinerary Overview
-- Target DB: PostgreSQL (Prisma schema in apps/backend/prisma/schema.prisma)
-- Notes:
-- 1) Active group is defined as Group.tone = 'ACTIVE' (matches app behavior).
-- 2) Weekly window uses Monday-Sunday (`date_trunc('week', CURRENT_DATE)`).

-- =========================================================
-- 1) KPI CARDS (single-row result)
-- =========================================================
WITH week_window AS (
  SELECT
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 day')::date AS week_end
),
active_groups AS (
  SELECT g.id, g.pax
  FROM "Group" g
  WHERE g.tone = 'ACTIVE'
),
trips_this_week AS (
  SELECT COUNT(*) AS total
  FROM "ItineraryItem" i
  JOIN "Group" g
    ON g.id = i."groupId"
  CROSS JOIN week_window w
  WHERE g.tone = 'ACTIVE'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date BETWEEN w.week_start AND w.week_end
),
peak_trip_day AS (
  SELECT
    i."isoDate"::date AS trip_date,
    COUNT(*) AS trip_count
  FROM "ItineraryItem" i
  JOIN "Group" g
    ON g.id = i."groupId"
  CROSS JOIN week_window w
  WHERE g.tone = 'ACTIVE'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date BETWEEN w.week_start AND w.week_end
  GROUP BY i."isoDate"::date
  ORDER BY trip_count DESC, trip_date ASC
  LIMIT 1
)
SELECT
  COALESCE((SELECT SUM(ag.pax) FROM active_groups ag), 0) AS active_pilgrims,
  COALESCE((SELECT tw.total FROM trips_this_week tw), 0) AS trips_this_week,
  COALESCE((SELECT ptd.trip_count FROM peak_trip_day ptd), 0) AS peak_trip_day_trips,
  (SELECT ptd.trip_date FROM peak_trip_day ptd) AS peak_trip_date;


-- =========================================================
-- 2) WEEKLY SUMMARY (groups arriving this week + H-1 completion)
-- =========================================================
WITH week_window AS (
  SELECT
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 day')::date AS week_end
),
groups_arriving_this_week AS (
  SELECT COUNT(DISTINCT i."groupId") AS total
  FROM "ItineraryItem" i
  JOIN "Group" g
    ON g.id = i."groupId"
  CROSS JOIN week_window w
  WHERE g.tone = 'ACTIVE'
    AND COALESCE(i."categoryKey", '') = 'arrival'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date BETWEEN w.week_start AND w.week_end
),
next_departure AS (
  SELECT
    g.id AS group_id,
    MIN(i."isoDate"::date) AS departure_date
  FROM "Group" g
  JOIN "ItineraryItem" i
    ON i."groupId" = g.id
  WHERE g.tone = 'ACTIVE'
    AND COALESCE(i."categoryKey", '') = 'departure'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date >= CURRENT_DATE
  GROUP BY g.id
),
h1_assignments AS (
  SELECT ca.status
  FROM next_departure nd
  JOIN "ChecklistAssignment" ca
    ON ca."groupId" = nd.group_id
   AND ca."tripDate"::date = (nd.departure_date - INTERVAL '1 day')::date
)
SELECT
  COALESCE((SELECT total FROM groups_arriving_this_week), 0) AS groups_arriving_this_week,
  COUNT(*) AS h1_total_items,
  COUNT(*) FILTER (WHERE status = 'ASSIGNED') AS h1_completed_items,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'ASSIGNED') / NULLIF(COUNT(*), 0),
    1
  ) AS h1_completion_pct
FROM h1_assignments;


-- =========================================================
-- 3) CHART: Weekly Trip Volume
--    Fokus: total trip minggu ini (tanpa warning threshold).
-- =========================================================
WITH week_window AS (
  SELECT
    date_trunc('week', CURRENT_DATE)::date AS week_start,
    (date_trunc('week', CURRENT_DATE)::date + INTERVAL '6 day')::date AS week_end
),
trips_this_week AS (
  SELECT
    i."isoDate"::date AS trip_date,
    COUNT(*) AS trip_count
  FROM "ItineraryItem" i
  JOIN "Group" g
    ON g.id = i."groupId"
  CROSS JOIN week_window w
  WHERE g.tone = 'ACTIVE'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date BETWEEN w.week_start AND w.week_end
  GROUP BY i."isoDate"::date
),
group_day AS (
  SELECT DISTINCT
    i."isoDate"::date AS trip_date,
    g.id AS group_id,
    g.pax
  FROM "ItineraryItem" i
  JOIN "Group" g
    ON g.id = i."groupId"
  CROSS JOIN week_window w
  WHERE g.tone = 'ACTIVE'
    AND i."isoDate" IS NOT NULL
    AND i."isoDate"::date BETWEEN w.week_start AND w.week_end
),
weekly_totals AS (
  SELECT
    COALESCE((SELECT SUM(tw.trip_count) FROM trips_this_week tw), 0) AS total_trips_this_week,
    COALESCE((SELECT COUNT(DISTINCT gd.group_id) FROM group_day gd), 0) AS active_groups_with_trip_this_week,
    COALESCE((
      SELECT SUM(group_pax.pax)
      FROM (
        SELECT gd.group_id, MAX(gd.pax) AS pax
        FROM group_day gd
        GROUP BY gd.group_id
      ) AS group_pax
    ), 0) AS active_pilgrims_with_trip_this_week
),
peak_trip_day AS (
  SELECT
    tw.trip_date,
    tw.trip_count
  FROM trips_this_week tw
  ORDER BY tw.trip_count DESC, tw.trip_date ASC
  LIMIT 1
)
SELECT
  wt.total_trips_this_week,
  wt.active_groups_with_trip_this_week,
  wt.active_pilgrims_with_trip_this_week,
  COALESCE((SELECT ptd.trip_count FROM peak_trip_day ptd), 0) AS peak_trip_day_trips,
  (SELECT ptd.trip_date FROM peak_trip_day ptd) AS peak_trip_date,
  ww.week_start,
  ww.week_end
FROM weekly_totals wt
CROSS JOIN week_window ww;
