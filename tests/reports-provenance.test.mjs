import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const worker=await readFile(new URL('../worker.js',import.meta.url),'utf8');
const page=JSON.parse(worker.match(/^const PAGE=("(?:\\.|[^"\\])*");/)[1]);

test('reports expose provenance, coverage and sample context',()=>{
 assert.match(page,/id="reportsProvenance"/);
 assert.match(page,/function reportsRenderProvenance\(rows\)/);
 assert.match(page,/حجم العينة\/الفهرس/);
 assert.match(page,/البيانات غير المتاحة لا تُحتسب صفرًا/);
 assert.match(page,/حجم العينة بعد الفلاتر/);
 assert.match(page,/حالة مصدر الأعمال/);
 assert.match(page,/غير متاح/);
 assert.match(page,/طلاب لهم سجلات متابعة مرتبطة.*Object\.keys\(reportsInsights/);
});

test('reports count equivalent original dates across imported and local formats',()=>{
 const section=(start,end)=>page.slice(page.indexOf(start),page.indexOf(end));
 const controls={
  reportsYear:{value:'1448'},reportsStatus:{value:'all'},
  reportsOfficialType:{value:'monthly'},reportsOfficialPeriod:{value:'١٤٤٨/٥'}
 };
 const originals=[
  {id:'import-arabic',date_text:'١٤٤٨/٠٥/٠٧',accountSourceTable:'programs'},
  {id:'import-persian',date_hijri:'۱۴۴۸-۵-۷'},
  {id:'local',hijriDate:'1448/5/7',accountSourceTable:'local',kind:'برامج الوزارة'},
  {id:'local-day-first',hijriDate:'٠٧/٠٥/١٤٤٨ هـ'},
  {id:'import-gregorian',date_text:'2026-10-18'},
  {id:'local-created',created:'2026-10-18T12:00:00.000Z'},
  {id:'month-only',date_hijri:'١٤٤٨/٠٥'},
  {id:'outside-month',date_hijri:'1448/6/7'},
  {id:'year-only',date_hijri:'١٤٤٨ هـ'},
  {id:'other-year',date_hijri:'1447/5/7'},
  {id:'undated'},
  {id:'invalid-date',date_hijri:'1448/5/31'}
 ];
 const originalDates=originals.map(row=>row.date_text||row.date_hijri||row.hijriDate||row.created);
 const script=[
  section('function docsDisplayHijri(', 'function docsDisplayTitle('),
  section('function docsLatinDigits(', 'const docsPortfolioStyle='),
  section('const reportLocalTypes=', 'function openReportTab('),
  section('function reportsRows(', 'function reportsMakeMetric('),
  section('function reportsOfficialOverview(', 'function reportsDraftContent('),
  '({year: reportsRows(), month: reportsOfficialOverview()})'
 ].join('\n');
 const result=runInNewContext(script,{
  $:id=>controls[id],docsAccountOriginals:()=>originals,reportLabels:{programs:'البرامج'}
 });
 assert.deepEqual(Array.from(result.year,row=>row.id),originals.slice(0,9).map(row=>row.id));
 assert.deepEqual(Array.from(result.month.rows,row=>row.id),originals.slice(0,7).map(row=>row.id));
 assert.equal(result.month.programs,2);
 assert.equal(result.month.outsideMonth,2);
 assert.equal(result.month.unknownMonth,3);
 assert.deepEqual(originals.map(row=>row.date_text||row.date_hijri||row.hijriDate||row.created),originalDates);
});
