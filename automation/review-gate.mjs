/**
 * Local-first approval gate for ATHAT Docs.
 * No network or Drive access is performed by this module.
 * Callers must persist the returned record in their own account-scoped IndexedDB.
 */
export const REVIEW_STATES = Object.freeze({
  DRAFT: 'draft',
  REVIEW: 'pending_review',
  CHANGES: 'changes_requested',
  APPROVED: 'approved',
  UPLOADING: 'uploading',
  SAVED: 'saved_to_drive',
  FAILED: 'upload_failed',
});

const transitions = Object.freeze({
  draft: ['pending_review'],
  pending_review: ['changes_requested', 'approved'],
  changes_requested: ['pending_review'],
  approved: ['uploading'],
  uploading: ['saved_to_drive', 'upload_failed'],
  upload_failed: ['uploading'],
  saved_to_drive: [],
});

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

/**
 * Any edited PDF is a new revision and must go through review again.
 * The immutable approved revision digest is checked before upload.
 */
export function createReview({id, localDocumentId, revision, pdfSha256, createdAt}) {
  assert(nonempty(id) && nonempty(localDocumentId), 'Local review and document IDs are required');
  assert(Number.isSafeInteger(revision) && revision > 0, 'Positive revision required');
  assert(/^[a-f0-9]{64}$/i.test(pdfSha256 || ''), 'SHA-256 of locally generated PDF required');
  assert(nonempty(createdAt), 'Timestamp required');
  return {
    id, localDocumentId, revision, pdfSha256: pdfSha256.toLowerCase(),
    status: REVIEW_STATES.DRAFT, approvedDigest: null,
    approvedAt: null, approvedBy: null, driveFolderId: null,
    driveFileId: null, uploadedAt: null, errorCode: null,
    events: [{status: REVIEW_STATES.DRAFT, at: createdAt}],
  };
}

export function moveReview(review, next, metadata = {}) {
  assert(review && transitions[review.status], 'Unknown review state');
  assert(transitions[review.status].includes(next), 'Invalid review state transition');
  assert(nonempty(metadata.at), 'Event timestamp required');
  const result = clone(review);
  if (next === REVIEW_STATES.CHANGES) {
    assert(nonempty(metadata.comment), 'Modification request required');
    result.approvedBy = null;
    result.approvedAt = null;
    result.approvedDigest = null;
    result.events.push({status: next, at: metadata.at, comment: metadata.comment});
  } else if (next === REVIEW_STATES.APPROVED) {
    assert(nonempty(metadata.approverId), 'Authenticated approver ID required');
    assert(nonempty(metadata.folderId), 'User-selected Drive folder required');
    assert(/^[a-f0-9]{64}$/i.test(metadata.currentPdfSha256 || ''), 'Final PDF digest required');
    assert(metadata.currentPdfSha256.toLowerCase() === result.pdfSha256, 'PDF changed since review');
    result.approvedBy = metadata.approverId;
    result.approvedAt = metadata.at;
    result.approvedDigest = result.pdfSha256;
    result.driveFolderId = metadata.folderId;
    result.events.push({status: next, at: metadata.at});
  } else if (next === REVIEW_STATES.UPLOADING) {
    assert(result.approvedDigest === result.pdfSha256 && nonempty(result.driveFolderId), 'Approval and folder required');
    assert(metadata.currentPdfSha256 === result.approvedDigest, 'PDF revision differs from approved PDF');
    result.errorCode = null;
    result.events.push({status: next, at: metadata.at});
  } else if (next === REVIEW_STATES.SAVED) {
    assert(nonempty(metadata.driveFileId), 'Drive file ID required');
    result.driveFileId = metadata.driveFileId;
    result.uploadedAt = metadata.at;
    result.events.push({status: next, at: metadata.at});
  } else {
    if (next === REVIEW_STATES.FAILED) {
      result.errorCode = nonempty(metadata.errorCode) ? metadata.errorCode : 'UPLOAD_FAILED';
    }
    result.events.push({status: next, at: metadata.at});
  }
  result.status = next;
  return result;
}

/** A change to bytes, content or signature invalidates approval and starts a new review. */
export function revisePdf(review, {revision, pdfSha256, at}) {
  assert(review.status !== REVIEW_STATES.UPLOADING, 'Cannot replace PDF while uploading');
  assert(review.status !== REVIEW_STATES.SAVED, 'Archived PDF is immutable; create a separate document');
  assert(Number.isSafeInteger(revision) && revision > review.revision, 'Revision must increase');
  const fresh = createReview({
    id: review.id, localDocumentId: review.localDocumentId, revision, pdfSha256, createdAt: at,
  });
  return {...fresh, events: [...review.events, {status: 'new_revision', at, revision}]};
}

/** Only return upload eligibility, never upload by itself. */
export function canUpload(review, digest) {
  return (review.status === REVIEW_STATES.APPROVED || review.status === REVIEW_STATES.FAILED)
    && review.approvedDigest === digest && review.pdfSha256 === digest
    && nonempty(review.approvedBy) && nonempty(review.driveFolderId);
}
