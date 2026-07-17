-- Backfill only unambiguous legacy assignments. Ambiguous rows remain NULL and must
-- be reviewed manually before the runtime identity contract can include them.
BEGIN;

UPDATE "VisaHotelAgreement" AS agreement
SET "sourceDraftId" = candidate.id
FROM "HotelAgreementDraft" AS candidate
WHERE agreement."sourceDraftId" IS NULL
  AND agreement."agreementNumber" = candidate."agreementNumber"
  AND agreement.city = candidate.city
  AND 1 = (
    SELECT COUNT(*)
    FROM "HotelAgreementDraft" AS matches
    WHERE matches."agreementNumber" = agreement."agreementNumber"
      AND matches.city = agreement.city
  );

CREATE UNIQUE INDEX "VisaHotelAgreement_sourceDraftId_visaSetupId_key"
ON "VisaHotelAgreement"("sourceDraftId", "visaSetupId");

COMMIT;
