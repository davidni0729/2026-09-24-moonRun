const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';import {questions} from '../game.mjs';
const key=process.env.HOST_KEY;assert(key);const origin=process.env.TEST_BASE_URL||'http://localhost:3780';
const action=async(action,data={})=>{const r=await fetch(origin+'/api/action',{method:'POST',body:JSON.stringify({action,admin:key,...data})});assert(r.ok,await r.clone().text());return r.json();};
await action('reset');const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const errors=[];
const display=await browser.newPage({viewport:{width:1440,height:900}});display.on('pageerror',e=>errors.push(e.message));await display.goto(origin+'/display');
const players=[];
for(let i=0;i<5;i++){const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/play');await page.locator('#name').fill('測試社友'+(i+1));await page.waitForFunction(()=>document.querySelector('#camera-video')?.videoWidth>0);await page.locator('#capture').click();await page.locator('#motion-mode').click();await page.locator('#join').click();await page.locator('#ready').click();players.push(page);}
await display.screenshot({path:'artifacts/lobby.png'});await players[0].screenshot({path:'artifacts/mobile-ready.png'});
const sixth=await fetch(origin+'/api/action',{method:'POST',body:JSON.stringify({action:'join',name:'第六人'})});assert.equal(sixth.status,400);
const denied=await fetch(origin+'/api/action',{method:'POST',body:JSON.stringify({action:'start'})});assert.equal(denied.status,400);
await action('start');await players[0].waitForFunction(()=>JSON.parse(render_game_to_text()).me?.status==='run');
await action('pause');const t=(await (await fetch(origin+'/api/state')).json()).elapsed;await new Promise(r=>setTimeout(r,500));assert.equal((await (await fetch(origin+'/api/state')).json()).elapsed,t);await action('pause');
let shot=false;const deadline=Date.now()+110000;
while(Date.now()<deadline){const s=await(await fetch(origin+'/api/state')).json();if(s.phase==='results')break;
for(const page of players){const st=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));if(st.me.status==='run'){await page.evaluate(()=>{for(const x of [-6,6])window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x,y:0,z:0}}));});}else if(st.me.status==='question'){if(!shot){await page.screenshot({path:'artifacts/mobile-question.png'});await display.screenshot({path:'artifacts/race.png'});shot=true;}const answer=questions[st.me.stage].options[questions[st.me.stage].correct];await page.getByRole('button',{name:new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();}}
await new Promise(r=>setTimeout(r,345));}
const final=await(await fetch(origin+'/api/state')).json();assert.equal(final.phase,'results');assert(final.players.every(p=>p.stage===5&&p.correct===5&&p.steps===0));await display.waitForTimeout(300);await display.screenshot({path:'artifacts/results.png'});await players[0].screenshot({path:'artifacts/mobile-results.png'});
await action('reset');await players[0].waitForSelector('#join');assert.deepEqual(errors,[]);console.log('PASS: five browsers joined, selfie uploaded, ready/start, rate-limited input, five questions each, pause, results, reset; no page errors');await browser.close();
