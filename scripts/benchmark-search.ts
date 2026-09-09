import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { embed } from '../src/search/embedding';
import { rank, lexicalScore } from '../src/search/rank';
import type { Report } from '../src/lib/types';
const catalogue:Report[]=JSON.parse(await readFile('public/catalog.json','utf8'));
const bytes=await readFile('public/search/vectors.bin');
const vectors=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
// Fixed editorial targets selected from catalogue descriptions before retrieval.
const cases=[
 ['interlocking optical blue and white shapes','daytonhudsontargetannualreports__dayton1967'],
 ['oversized colorful overlapping numbers','paulrand-cummins-1966'],
 ['concentric bright circular wedges','generalelectriccompanyannualreports__generalelectric1972'],
 ['orange numerals cropped into abstract shapes','McGillLibrary-633092-42460'],
 ['repeating circles and bars on a dark blue grid','McGillLibrary-638502-31519'],
 ['silvery coils in monochrome industrial photography','McGillLibrary-637328-32323'],
 ['architectural office photography beside a dark strip','McGillLibrary-630610-30787'],
 ['sculpture with a golden ball on white','generalelectriccompanyannualreports__generalelectric1965'],
 ['paint rollers arranged like abstract rectangles','McGillLibrary-635085-40246'],
 ['orbital lines connecting photographic spheres','generalelectriccompanyannualreports__generalelectric1951'],
];
await embed('warmup',true);
const developmentCount=cases.length;
cases.push(...JSON.parse(await readFile("benchmarks/held-out.json","utf8")));
const results=[];
for(const [query,target] of cases){const start=performance.now();const vector=await embed(query,true);const hits=rank(query,vector,catalogue,vectors);const latencyMs=performance.now()-start;const baseline=catalogue.map(r=>({id:r.id,score:lexicalScore(query,r)})).sort((a,b)=>b.score-a.score);results.push({query,target,rank:hits.findIndex(h=>h.id===target)+1,lexicalRank:baseline.findIndex(h=>h.id===target)+1,latencyMs,top5:hits.slice(0,5).map(h=>h.id)});}
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const metrics={hybridMRR10:mean(results.map(r=>r.rank<=10?1/r.rank:0)),lexicalMRR10:mean(results.map(r=>r.lexicalRank<=10?1/r.lexicalRank:0)),hybridRecall10:mean(results.map(r=>Number(r.rank<=10))),lexicalRecall10:mean(results.map(r=>Number(r.lexicalRank<=10))),meanWarmLatencyMs:mean(results.map(r=>r.latencyMs))};
const heldOut=results.slice(developmentCount);
const heldOutMetrics={MRR10:mean(heldOut.map(r=>r.rank<=10?1/r.rank:0)),Recall10:mean(heldOut.map(r=>Number(r.rank<=10))),lexicalMRR10:mean(heldOut.map(r=>r.lexicalRank<=10?1/r.lexicalRank:0))};
await mkdir('benchmarks',{recursive:true});await mkdir('outputs',{recursive:true});await writeFile('benchmarks/results.json',JSON.stringify({scope:'20 editorial known-item paraphrases (10 development + 10 held out); not a comprehensive human relevance evaluation. Warm CPU latency excludes model loading.',metrics,heldOutMetrics,results},null,2));
await writeFile('outputs/search-benchmark.md',`# Search benchmark\n\nTwenty fixed known-item description paraphrases (ten held out from tuning) across all 3,002 reports. Text embeddings; no image encoder. This small editorial test measures retrieval of an intended artifact, not broad style relevance. Warm CPU latency excludes model loading.\n\n|Metric|Hybrid|Lexical|\n|---|---:|---:|\n|MRR@10|${metrics.hybridMRR10.toFixed(3)}|${metrics.lexicalMRR10.toFixed(3)}|\n|Recall@10|${metrics.hybridRecall10.toFixed(3)}|${metrics.lexicalRecall10.toFixed(3)}|\n\nMean warm query latency: ${metrics.meanWarmLatencyMs.toFixed(0)} ms.\n\n|Query|Hybrid rank|Lexical rank|\n|---|---:|---:|\n${results.map(r=>`|${r.query}|${r.rank}|${r.lexicalRank}|`).join('\n')}\n`);console.log({metrics,heldOutMetrics});
if(process.argv.includes("--check")&&(heldOutMetrics.MRR10<.65||heldOutMetrics.Recall10<.8))process.exitCode=1;
