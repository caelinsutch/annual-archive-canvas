import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolveExternalReport } from '../src/lib/source-adapters';
import type { Report } from '../src/lib/types';
const catalog:Report[]=JSON.parse(await readFile('public/catalog.json','utf8'));
await mkdir('public/source-manifests',{recursive:true});
let resolved=0;const unavailable:{id:string;reason:string}[]=[];
const reports=catalog.filter(r=>new URL(r.s).hostname!=='archive.org');
for(let start=0;start<reports.length;start+=3){await Promise.all(reports.slice(start,start+3).map(async report=>{try{const manifest=await resolveExternalReport(report);if(manifest){await writeFile(`public/source-manifests/${report.id}.json`,JSON.stringify(manifest));resolved++;}else unavailable.push({id:report.id,reason:'No supported public page source'});}catch(error){unavailable.push({id:report.id,reason:String(error)});}}));console.log(`Resolved ${resolved}/${reports.length} external records`);}
await writeFile('benchmarks/source-coverage.json',JSON.stringify({resolved,total:reports.length,unavailable},null,2));
