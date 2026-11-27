-- سجل تدقيق مستقل لاعتماد سجلات التوجيه بعد مراجعة بشرية.
-- لا يحذف الأصل ولا يستبدله؛ يسجل الحالة السابقة والجديدة وهوية المراجع ووقت العملية.
CREATE TABLE IF NOT EXISTS docs_guidance_review_audit (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  action TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  previous_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method TEXT NOT NULL DEFAULT 'manual-review'
);
CREATE INDEX IF NOT EXISTS idx_guidance_review_audit_user_time
  ON docs_guidance_review_audit(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_guidance_review_audit_record
  ON docs_guidance_review_audit(user_id, source_table, source_record_id);
