-- Earlier checks treated "unreachable from our servers" as "refuses framing". Reset those verdicts so
-- browsers try the live view again; a later re-check stores the corrected value.
UPDATE "Project" SET "websiteEmbeddable" = NULL WHERE "websiteEmbeddable" = false;
UPDATE "Preview" SET "embeddable" = NULL WHERE "embeddable" = false;
