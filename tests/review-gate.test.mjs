import test from 'node:test';
import assert from 'node:assert/strict';
import { createReview, moveReview, revisePdf, canUpload, REVIEW_STATES } from '../automation/review-gate.mjs';

const digest = 'a'.repeat(64);
const now = '2026-11-21T00:00:00+03:00';
const draft = () => createReview({id:'review1',localDocumentId:'doc1',revision:1,pdfSha256:digest,createdAt:now});
const pending = () => moveReview(draft(), REVIEW_STATES.REVIEW, {at:now});
const approved = () => moveReview(pending(), REVIEW_STATES.APPROVED, {at:now,approverId:'local-user',folderId:'selected-folder',currentPdfSha256:digest});

test('no upload is allowed before explicit approval', () => {
  assert.equal(canUpload(draft(),digest), false);
  assert.equal(canUpload(pending(),digest), false);
  assert.throws(() => moveReview(pending(),REVIEW_STATES.UPLOADING,{at:now}));
  assert.throws(() => moveReview(pending(),REVIEW_STATES.APPROVED,{at:now,approverId:'u',folderId:'f',currentPdfSha256:'b'.repeat(64)}));
});

test('the reviewed PDF hash must match the uploaded PDF', () => {
  const a=approved();
  assert.equal(canUpload(a,digest),true);
  assert.equal(canUpload(a,'b'.repeat(64)),false);
  assert.throws(()=>moveReview(a,REVIEW_STATES.UPLOADING,{at:now,currentPdfSha256:'b'.repeat(64)}));
});

test('changes invalidate approval and require renewed review', () => {
  const request=moveReview(pending(),REVIEW_STATES.CHANGES,{at:now,comment:'أضف التوقيع'});
  const revised=revisePdf(request,{revision:2,pdfSha256:'b'.repeat(64),at:now});
  assert.equal(revised.status,REVIEW_STATES.DRAFT);
  assert.equal(canUpload(revised,'b'.repeat(64)),false);
});

test('success requires a verified Drive file identifier', () => {
  const uploading=moveReview(approved(),REVIEW_STATES.UPLOADING,{at:now,currentPdfSha256:digest});
  assert.throws(()=>moveReview(uploading,REVIEW_STATES.SAVED,{at:now}));
  const saved=moveReview(uploading,REVIEW_STATES.SAVED,{at:now,driveFileId:'drive-id'});
  assert.equal(saved.driveFileId,'drive-id');
  assert.equal(saved.status,REVIEW_STATES.SAVED);
  assert.equal(canUpload(saved,digest),false);
});

test('failure permits retry without losing local PDF', () => {
  const uploading=moveReview(approved(),REVIEW_STATES.UPLOADING,{at:now,currentPdfSha256:digest});
  const failed=moveReview(uploading,REVIEW_STATES.FAILED,{at:now,errorCode:'CONNECTION_LOST'});
  assert.equal(canUpload(failed,digest),true);
  const retry=moveReview(failed,REVIEW_STATES.UPLOADING,{at:now,currentPdfSha256:digest});
  assert.equal(retry.status,REVIEW_STATES.UPLOADING);
});
