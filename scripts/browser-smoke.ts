import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const run=promisify(execFile),session='annual-smoke',base=process.env.TEST_URL||'http://localhost:3000';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function browser(...args:string[]){return (await run('agent-browser',['--session',session,...args],{timeout:60000,maxBuffer:2e6})).stdout.trim();}
async function evaluate(expression:string){const result=JSON.parse(await browser('eval',`JSON.stringify(${expression})`));return typeof result==='string'?JSON.parse(result):result;}
async function until(expression:string,timeout=45000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(150);}throw new Error('Timed out: '+expression);}
const checks:string[]=[];
try{
 await browser('set','viewport','1440','1000');await browser('open',base);
 await until(`!document.querySelector('#app-splash')`);
 assert.ok(await evaluate(`[...document.querySelectorAll('.artifact img')].filter(i=>i.complete&&i.naturalWidth).length`));checks.push('Splash reveals loaded artwork');
 await browser('eval',`document.querySelector('#grid-view').click()`);await delay(90);await browser('eval',`document.querySelector('#canvas-view').click()`);
 await until(`document.querySelectorAll('.layout-cover').length===0`,6000);assert.equal(await evaluate(`getComputedStyle(document.querySelector('#gallery')).opacity`),'1');checks.push('Interrupted canvas/grid transition cleans up');
 await browser('press','Meta+k');assert.equal(await evaluate(`document.activeElement.id`),'search-input');checks.push('Command-K focuses search');await browser('press','Escape');
 await browser('open',base+'/#report=paulrand-cummins-1966');
 await until(`document.querySelector('#reader').open&&!document.querySelector('#reader .splash')&&[...document.querySelectorAll('#page-canvas img')].some(i=>i.naturalWidth>0)`);checks.push('Report reveals real decoded pages');
 await browser('screenshot','outputs/refined-reader.png');await browser('eval',`document.querySelector('#close-reader').click()`);
 await until(`!document.querySelector('#reader').open`,6000);assert.equal(await evaluate(`document.querySelectorAll('.transition-cover').length`),0);assert.ok(await evaluate(`document.querySelectorAll('#gallery img').length`));checks.push('Close restores populated archive without orphaned layers');
 await writeFile('outputs/browser-checks.json',JSON.stringify({checks,passed:checks.length},null,2));console.log(checks);
}finally{await browser('close');}
