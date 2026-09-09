import fs from 'node:fs/promises';
import { embed,MODEL,DIMENSIONS } from '../src/search/embedding';
import { documentText } from '../src/search/rank';
import type {Report} from '../src/lib/types';
const catalog:Report[]=JSON.parse(await fs.readFile('public/catalog.json','utf8'));
const vectors=new Float32Array(catalog.length*DIMENSIONS);
const previous=JSON.parse(await fs.readFile('public/search/manifest.json','utf8').catch(()=>'null'));
const prior=await fs.readFile('public/search/vectors.bin').catch(()=>null);
const reusable=new Map<string,number>();
if(previous?.model===MODEL&&previous?.dimensions===DIMENSIONS&&prior?.length===previous.ids.length*DIMENSIONS*4&&previous.texts){
 previous.ids.forEach((id:string,index:number)=>reusable.set(id,index));
}
const pending:number[]=[];
for(let i=0;i<catalog.length;i++){
 const old=reusable.get(catalog[i].id);
 if(old!==undefined&&previous.texts[old]===documentText(catalog[i])){
  const bytes=prior!.subarray(old*DIMENSIONS*4,(old+1)*DIMENSIONS*4);
  vectors.set(new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)),i*DIMENSIONS);
 }else pending.push(i);
}
for(let start=0;start<pending.length;start+=32){
 const indexes=pending.slice(start,start+32);
 const output=await embed(indexes.map(i=>documentText(catalog[i])));
 indexes.forEach((index,offset)=>vectors.set(output.subarray(offset*DIMENSIONS,(offset+1)*DIMENSIONS),index*DIMENSIONS));
 if(start%320===0)console.log(`Embedded ${start+indexes.length}/${pending.length}`);
}
await fs.mkdir('public/search',{recursive:true});
await fs.writeFile('public/search/vectors.bin',Buffer.from(vectors.buffer));
await fs.writeFile('public/search/manifest.json',JSON.stringify({model:MODEL,dimensions:DIMENSIONS,count:catalog.length,ids:catalog.map(r=>r.id),texts:catalog.map(documentText),pooling:'cls',normalized:true,precision:'float32',encoderPrecision:'q8',createdAt:new Date().toISOString()}));
console.log(`Embedded all ${catalog.length} reports into ${vectors.byteLength} bytes.`);
