-- Login walls (e.g. Vercel Authentication) and bot checkpoints were read as "refuses framing".
-- Reset those verdicts; the app re-checks unknown sites in the background with the corrected rule.
UPDATE "Project" SET "websiteEmbeddable" = NULL WHERE "websiteEmbeddable" = false;
UPDATE "Preview" SET "embeddable" = NULL WHERE "embeddable" = false;
