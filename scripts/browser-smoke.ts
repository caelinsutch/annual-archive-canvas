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
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('#canvas-view')).backgroundColor`),'rgba(0, 0, 0, 0)');
 assert.ok(await evaluate(`[...document.querySelectorAll('.artifact img')].filter(i=>i.complete&&i.naturalWidth).length`));checks.push('Splash reveals loaded artwork');
 await browser('eval',`window.archiveNodes=[...document.querySelectorAll('#gallery .artifact')];window.archiveImages=window.archiveNodes.map(n=>n.querySelector('img'));document.querySelector('#grid-view').click()`);
 await delay(650);
 assert.equal(await evaluate(`window.archiveNodes.every((node,index)=>node.isConnected&&node.querySelector('img')===window.archiveImages[index])`),true);
 assert.equal(await evaluate(`document.querySelectorAll('#grid,.layout-cover').length`),0);
 assert.equal(await evaluate(`document.querySelector('#gallery').dataset.layout`),'grid');
 assert.equal(await evaluate(`new Set([...document.querySelectorAll('#gallery .artifact')].map(n=>n.dataset.tile)).size`),await evaluate(`document.querySelectorAll('#gallery .artifact').length`));
 await browser('eval',`document.querySelector('#canvas-view').click()`);await delay(90);await browser('eval',`document.querySelector('#grid-view').click()`);await delay(90);await browser('eval',`document.querySelector('#canvas-view').click()`);
 await delay(650);
 assert.equal(await evaluate(`window.archiveNodes.every((node,index)=>node.isConnected&&node.querySelector('img')===window.archiveImages[index])`),true);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('#gallery')).opacity`),'1');checks.push('Canvas and Grid retain the exact same report and image nodes through interrupted transitions, with no duplicate grid or ghosts');
 assert.equal(await evaluate(`[...document.querySelectorAll('.dock .view-switch button')].every(b=>b.scrollWidth<=b.clientWidth)`),true);checks.push('Archive toggle labels fit within their segments');
 await browser('press','Meta+k');assert.equal(await evaluate(`document.activeElement.id`),'search-input');await until(`getComputedStyle(document.querySelector('#search-dialog'),'::backdrop').backdropFilter==='blur(18px)'`);checks.push('Command-K focuses search and blurs the background');await browser('press','Escape');await until(`!document.querySelector('#search-dialog').open`);
 await browser('eval',`[...document.querySelectorAll('#gallery button')].find(button=>button.getAttribute('aria-label')==='Open Cummins, 1966').click()`);
 assert.ok(await evaluate(`document.querySelector('.report-hero')!==null`));checks.push('Report opening carries the selected cover into the reader');
 await until(`document.querySelector('#reader').open&&!document.querySelector('#reader .splash')&&!document.querySelector('#reader.opening-report')&&[...document.querySelectorAll('#page-canvas img')].some(i=>i.naturalWidth>0)`);checks.push('Report reveals real decoded pages');
 await browser('hover','#read-mode');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('#read-mode')).backgroundColor`),'rgba(0, 0, 0, 0)');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('#read-mode')).backdropFilter`),'none');
 checks.push('Segment buttons have no second hover fill or glass blur over the sliding highlight');
 await browser('eval',`window.initialDockWidth=document.querySelector('.reader-dock').getBoundingClientRect().width;window.retainedPage=document.querySelector('#page-canvas button');window.retainedImage=window.retainedPage.querySelector('img');document.querySelector('#strip-mode').click()`);
 await until(`document.querySelector('#page-canvas').dataset.layout==='strip'`);
 await delay(500);
 assert.ok(await evaluate(`document.querySelector('.reader-dock').getBoundingClientRect().width<window.initialDockWidth-40`));
 assert.equal(await evaluate(`Math.round(document.querySelector('.reader-dock .dock-selection').getBoundingClientRect().width)`),await evaluate(`document.querySelector('#strip-mode').offsetWidth`));
 checks.push('Dock shrinks for Scroll and the shared active pill follows its selected segment');
 await browser('eval',`document.querySelector('#pages-mode').click()`);
 await browser('eval',`window.retainedPage.click()`);
 await until(`document.querySelector('#reader.reading-page')&&document.querySelector('#page-canvas .focused-page')`);
 assert.equal(await evaluate(`window.retainedPage.isConnected&&window.retainedPage.querySelector('img')===window.retainedImage`),true);
 assert.equal(await evaluate(`document.querySelectorAll('#page-reader img,#page-strip img').length`),0);
 await delay(600);
 assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#page-canvas .webgl')).filter`),'none');
 assert.ok(await evaluate(`document.querySelector('#page-canvas .focused-page').getBoundingClientRect().height<=innerHeight-100`));checks.push('Scroll, grid, and Read retain the same page nodes while moving and focusing artwork');
 await browser('screenshot','outputs/refined-page-focus.png');await browser('press','Escape');
 await until(`!document.querySelector('#reader.reading-page')`);assert.equal(await evaluate(`document.querySelector('#reader').open`),true);
 assert.equal(await evaluate(`window.retainedPage.isConnected&&window.retainedPage.querySelector('img')===window.retainedImage`),true);checks.push('Escape returns the same image to its canvas');
 await browser('press','Tab');await browser('eval',`document.querySelector('#pages-mode').focus()`);assert.equal(await evaluate(`getComputedStyle(document.querySelector('#pages-mode')).outlineStyle`),'solid');assert.equal(await evaluate(`getComputedStyle(document.querySelector('#pages-mode')).height`),'40px');checks.push('Keyboard focus uses the shared control ring and size');
 await browser('screenshot','outputs/refined-reader.png');await browser('eval',`document.querySelector('#close-reader').click()`);
 await until(`!document.querySelector('#reader').open`,6000);assert.equal(await evaluate(`document.querySelectorAll('.transition-cover').length`),0);assert.ok(await evaluate(`document.querySelectorAll('#gallery img').length`));checks.push('Close restores populated archive without orphaned layers');
 await writeFile('outputs/browser-checks.json',JSON.stringify({checks,passed:checks.length},null,2));console.log(checks);
}finally{await browser('close');}
