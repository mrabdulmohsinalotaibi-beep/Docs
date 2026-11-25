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

 // Accept the existing Docs status vocabulary without inferring completion.
export function classifyDocsWorkStatus(value){
 const status=String(value??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\s_-]+/g,' ').trim().toLowerCase();
 if(/^(مسوده|مطلوب|مطلوبه|قيد الانتظار|بانتظار التنفيذ|لم يبدا|لم يتم البدء|pending|draft|required|not started)$/.test(status))return 'required';
 if(/^(جار التنفيذ|جاري التنفيذ|قيد التنفيذ|قيد العمل|جاري العمل|جار العمل|قيد الانجاز|قيد المتابعه|in progress|active|ongoing)$/.test(status))return 'active';
 if(/^(مكتمل|مكتمله|تم التنفيذ|منجز|منجزه|تم الانجاز|انجز|completed|done|finished)$/.test(status))return 'done';
 if(/^(معتمد|معتمده|approved)$/.test(status))return 'approved';
 if(/^(متاخر|متاخره|overdue)$/.test(status))return 'overdue';
 if(/^(مؤرشف|مؤرشفه|archived)$/.test(status))return 'archived';
 return 'unknown';
}
export function summarizeDocsOriginals(rows, {signedIn=false,indexReady=false}={}){
 const counts={required:0,active:0,done:0,approved:0,overdue:0,archived:0,unknown:0};
 if(!signedIn)return {counts:null,coverage:'unavailable',students:[],unlinked:0};
 const students=new Map();let unlinked=0;
 for(const row of rows){
  const status=classifyDocsWorkStatus(row.status);counts[status]++;
  const key=row.student_key??row.studentKey;
  if(typeof key!=='string'||!key.trim()){unlinked++;continue;}
  if(!students.has(key))students.set(key,{studentKey:key,required:0,active:0,done:0,approved:0,overdue:0,archived:0,unknown:0});
  students.get(key)[status]++;
 }
 return {counts,coverage:indexReady?'indexed':'partial',students:[...students.values()],unlinked};
}
