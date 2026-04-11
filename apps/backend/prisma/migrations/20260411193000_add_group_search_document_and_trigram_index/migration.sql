CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Group"
ADD COLUMN "searchDocument" TEXT NOT NULL DEFAULT '';

UPDATE "Group"
SET "searchDocument" = trim(
  concat_ws(
    ' ',
    regexp_replace(lower(coalesce("code", '')), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(lower(coalesce("code", '')), '[^a-z0-9]+', '', 'g'),
    regexp_replace(lower(coalesce("name", '')), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(lower(coalesce("status", '')), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(lower(coalesce("packageName", '')), '[^a-z0-9]+', ' ', 'g'),
    regexp_replace(lower(coalesce("packageName", '')), '[^a-z0-9]+', '', 'g')
  )
);

CREATE INDEX "Group_searchDocument_trgm_idx"
ON "Group"
USING GIN ("searchDocument" gin_trgm_ops);
