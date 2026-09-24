import QRCode from 'qrcode';import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';import {Game,questions} from './game.mjs';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');const game=new Game();const admin=randomUUID();const streams=new Map();const port=Number(process.env.PORT||3780);const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const broadcast=()=>{for(const [res,token] of streams)res.write('data: '+JSON.stringify(game.state(token))+'\n\n');};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/photo/')){const p=game.players.find(p=>p.id===u.pathname.slice(11));if(!p?.photo)return json(res,{error:'照片已清除'},404);const [meta,data]=p.photo.split(',');res.writeHead(200,{'Content-Type':meta.slice(5).split(';')[0],'Cache-Control':'private, max-age=3600'});return res.end(Buffer.from(data,'base64'));}
 if(u.pathname==='/healthz')return json(res,{ok:true});
 if(u.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});const token=u.searchParams.get('token')||'';streams.set(res,token);try{game.player(token).connected=true;}catch{}res.write('data: '+JSON.stringify(game.state(token))+'\n\n');req.on('close',()=>{streams.delete(res);if(![...streams.values()].includes(token))try{game.player(token).connected=false;}catch{}});return;}
 if(u.pathname==='/api/state'){if(u.searchParams.get('poll')==='1')try{const p=game.player(u.searchParams.get('token'));p.connected=true;p.lastPoll=Date.now();}catch{}return json(res,game.state(u.searchParams.get('token')));}
 if(u.pathname==='/api/config'){
 const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`http://${x.address}:${port}/play`);
 const hostname=u.hostname;const host=req.headers.host||`localhost:${port}`;
 const requested=new URL(`http://${host}`);
 const local=['localhost','127.0.0.1','[::1]'].includes(requested.hostname);
 const join=process.env.PUBLIC_BASE_URL?new URL('/play',process.env.PUBLIC_BASE_URL).href:local?(addresses[0]||`http://localhost:${port}/play`):new URL('/play',requested).href;
 return json(res,{join,addresses,qr:await QRCode.toDataURL(join,{width:440,margin:4,errorCorrectionLevel:'M',color:{dark:'#14233D',light:'#FFFFFF'}})});
 }
 if(req.method==='POST'&&u.pathname==='/api/action'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>350000)throw Error('照片太大，請重拍');}const d=JSON.parse(raw||'{}');
 let result={ok:true};
 if(d.action==='join'){if(d.photo&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo))throw Error('照片格式不符');const p=game.join(d.name,d.photo||'',d.mode);result={token:p.token,id:p.id};}
 else if(d.action==='ready'){if(game.phase!=='lobby')throw Error('本輪已開始');game.player(d.token).ready=true;}
 else if(d.action==='move')game.move(d.token);
 else if(d.action==='answer')game.answer(d.token,d.choice);
 else {if(d.admin!==admin)throw Error('控台連結無效，請使用啟動時顯示的連結');
 if(d.action==='start')game.start();
 else if(d.action==='test-start')game.start({testMode:true});
 else if(d.action==='pause'){if(!['race','countdown'].includes(game.phase))throw Error('目前無法暫停');game.paused=!game.paused;}
 else if(d.action==='reset')game.reset();
 else if(d.action==='remove'){if(game.phase!=='lobby')throw Error('僅能在開賽前移除玩家');game.players=game.players.filter(p=>p.id!==d.id);}
 else if(d.action==='demo'){if(game.phase!=='lobby'||game.players.length)throw Error('請先重開空白的一輪');game.demo=true;['美玲','阿宏','雅雯','建國','淑芬'].forEach(n=>{const p=game.join(n);p.ready=true;});game.start();}
 else throw Error('未知操作');}
 broadcast();return json(res,result);
 }
 let f=['/','/play','/host','/display'].includes(u.pathname)?'/index.html':u.pathname;const full=path.resolve(root,'.'+decodeURIComponent(f));if(!full.startsWith(root+path.sep))return json(res,{error:'不存在'},404);
 const buf=await fs.readFile(full);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(full)]||'application/octet-stream','Cache-Control':f.startsWith('/assets/')?'public, max-age=3600':'no-store'});res.end(buf);
 }catch(e){json(res,{error:e.code==='ENOENT'?'找不到頁面':e.message},e.code==='ENOENT'?404:400);}});
let last=Date.now(),lastSend=0;
setInterval(()=>{const now=Date.now();for(const p of game.players){if(p.lastPoll&&now-p.lastPoll>8000&&![...streams.values()].includes(p.token))p.connected=false;}game.advance(now-last);last=now;
 if(game.demo&&game.phase==='race'&&!game.paused)for(const p of game.players){if(p.status==='run'&&Math.random()>.35)game.move(p.token);else if(p.status==='question'&&game.elapsed-p.questionStart>1800+game.players.indexOf(p)*310){game.answer(p.token,p.order[p.stage].indexOf(questions[p.stage].correct));}}
 if(now-lastSend>150){broadcast();lastSend=now;}
},50);
server.listen(port,'0.0.0.0',()=>{console.log(`大屏 http://localhost:${port}/display\n手机 http://localhost:${port}/play\n控台 http://localhost:${port}/host?key=${admin}`);for(const n of Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal))console.log(`同網路手機 http://${n.address}:${port}/play`);});
