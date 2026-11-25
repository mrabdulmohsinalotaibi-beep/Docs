// Pure, read-only guidance workflow. No persistence, network or student-name matching.
export function reviewGuidanceWork(records, today) {
  if (!Array.isArray(records) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new TypeError('Invalid review inputs');
  const groups = new Map(), conflicts = new Set(), unlinked = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const {source, sourceId, studentId} = record;
    if (![source,sourceId].every(v=>typeof v==='string' && v.trim())) { unlinked.push(record); continue; }
    const key=JSON.stringify([source,sourceId]);
    const normalized={source,sourceId,studentId:typeof studentId==='string' && studentId.trim()?studentId:null,status:record.status??null,due:record.due??null};
    if(groups.has(key) && JSON.stringify(groups.get(key))!==JSON.stringify(normalized)) conflicts.add(key);
    else groups.set(key,normalized);
  }
  const result={due:[],pending:[],approved:[],unknown:[],conflicts:[],unlinkedCount:unlinked.length};
  for(const [key,record] of groups){
    if(conflicts.has(key)){result.conflicts.push({source:record.source,sourceId:record.sourceId});continue;}
    if(record.status==='approved'){result.approved.push(record);continue;}
    if(!['draft','pending','in_progress'].includes(record.status)){result.unknown.push(record);continue;}
    result.pending.push(record);
    if(typeof record.due==='string' && /^\d{4}-\d{2}-\d{2}$/.test(record.due) && record.due<=today) result.due.push(record);
  }
  return result;
}
