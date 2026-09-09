import {readFile,writeFile} from 'node:fs/promises';
import {embedVisualText} from '../src/search/visual';
import {dot,type IndexedPage} from '../src/search/taxonomy';
const index=JSON.parse(await readFile('public/search/pages/index.json','utf8')) as {pages:IndexedPage[];vectors:string;dimensions:number};
const bytes=Buffer.from(index.vectors,'base64');const all=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
// Independently labeled by inspecting all 24 original Cummins 1966 scans; page numbers are one based.
const cases:[string,number[]][]=[['financial table',[4]],['bar charts showing growth',[24]],['letter to shareholders',[5,6]],['colorful oversized numbers on a cover',[1]],['table of contents',[2]],['product photograph of an engine on green',[3]],['photograph of a bridge over water',[10,11]],['factory production line photograph',[15]],['aerial industrial campus photograph',[20]],['multiple columns of editorial text',[5,6,14,16,22,23]]];
const candidates=index.pages.map((p,i)=>({...p,offset:i*index.dimensions})).filter(p=>p.reportId==='paulrand-cummins-1966');
const rows=[];
for(const [query,gold] of cases){const start=performance.now();const vector=await embedVisualText([`A printed annual report page with ${query}.`]);const hits=candidates.map(p=>({...p,score:dot(vector,all,p.offset)})).sort((a,b)=>b.score-a.score);const relevant=hits.map((p,i)=>gold.includes(p.pageIndex+1)?i+1:0).filter(Boolean);rows.push({query,gold,firstRelevantRank:Math.min(...relevant),recall5:relevant.filter(r=>r<=5).length/gold.length,latencyMs:performance.now()-start,top5: hits.slice(0,5).map(p=>p.pageIndex+1)});}
const metrics={MRR10:rows.reduce((s,r)=>s+(r.firstRelevantRank<=10?1/r.firstRelevantRank:0),0)/rows.length,Recall5:rows.reduce((s,r)=>s+r.recall5,0)/rows.length};
await writeFile('benchmarks/page-results.json',JSON.stringify({scope:'10 manually inspected queries within one 24-page report. Provisional visual-model evaluation; no broad taxonomy accuracy claim.',metrics,rows},null,2));
console.log(metrics);
if(process.argv.includes('--check')&&(metrics.MRR10<.65||metrics.Recall5<.7))process.exitCode=1;
