import fs from 'node:fs/promises';
import { embed,MODEL,DIMENSIONS } from '../src/search/embedding';
import { documentText } from '../src/search/rank';
import type {Report} from '../src/lib/types';
const catalog:Report[]=JSON.parse(await fs.readFile('public/catalog.json','utf8'));
const vectors=new Float32Array(catalog.length*DIMENSIONS);
for(let start=0;start<catalog.length;start+=32){
 const batch=catalog.slice(start,start+32);
 const output=await embed(batch.map(documentText));vectors.set(output,start*DIMENSIONS);
 if(start%320===0)console.log(`Embedded ${start+batch.length}/${catalog.length}`);
}
await fs.mkdir('public/search',{recursive:true});
await fs.writeFile('public/search/vectors.bin',Buffer.from(vectors.buffer));
await fs.writeFile('public/search/manifest.json',JSON.stringify({model:MODEL,dimensions:DIMENSIONS,count:catalog.length,ids:catalog.map(r=>r.id),pooling:'cls',normalized:true,precision:'float32',encoderPrecision:'q8',createdAt:new Date().toISOString()}));
console.log(`Embedded all ${catalog.length} reports into ${vectors.byteLength} bytes.`);
