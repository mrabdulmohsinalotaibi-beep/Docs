-- Proposed additive migration. Do not apply to production before review.
CREATE TABLE IF NOT EXISTS docs_guidance_surveys (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 public_token TEXT NOT NULL UNIQUE,
 template_version INTEGER NOT NULL DEFAULT 1,
 title TEXT NOT NULL,
 questions_json TEXT NOT NULL,
 reverse_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1))
);
CREATE INDEX IF NOT EXISTS docs_guidance_surveys_owner ON docs_guidance_surveys(owner_id,created_at);
CREATE TABLE IF NOT EXISTS docs_guidance_survey_responses (
 survey_id TEXT NOT NULL REFERENCES docs_guidance_surveys(id) ON DELETE CASCADE,
 browser_claim TEXT NOT NULL,
 answers_json TEXT NOT NULL,
 submitted_at INTEGER NOT NULL,
 PRIMARY KEY(survey_id,browser_claim)
);
-- The application must derive a survey-scoped hash from a random browser token.
-- Do not store names, student identifiers, IP addresses or raw browser tokens.
-- One browser is not proof of one person. Responses must require explicit consent.
