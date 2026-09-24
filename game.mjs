import {randomUUID} from 'node:crypto';
export const questions=[
 {text:'今年清溪的年度主題是什麼？',options:['創造持衡的影響力','創造持久的業績'],correct:0},
 {text:'今年清溪的三大支柱是？',options:['Service、Fellowship、Leadership','吃飯、打球、唱歌'],correct:0},
 {text:'今年社長訂的 KPI 之一是？',options:['每個月的例會都有新朋友來','每個月都換一家飯店開會'],correct:0},
 {text:'社長 Kate 今年是幾歲？',options:['28 歲','18 歲'],correct:1},
 {text:'今年參加清溪例會，最值得帶誰一起來？',options:['還不認識扶輪的新朋友','只帶自己的手機來'],correct:0}
];
export class Game {
 constructor(){this.reset();}
 reset(){this.round=randomUUID();this.phase='lobby';this.players=[];this.elapsed=0;this.countdown=0;this.paused=false;this.demo=false;this.testMode=false;}
 join(name,photo='',mode='motion'){
  if(this.phase!=='lobby')throw Error('本輪已開始，請等下一輪');
  if(this.players.length>=5)throw Error('本輪已滿五人，請等下一輪');
  name=String(name||'').trim().slice(0,12);if(!name)throw Error('請填寫暱稱');
  const player={id:randomUUID(),token:randomUUID(),name,photo,mode:'motion',ready:false,connected:true,stage:0,steps:0,correct:0,answerTime:0,status:'waiting',lastMove:-1000,deadline:0,finished:null,order:questions.map(()=>Math.random()<.5?[0,1]:[1,0])};
  this.players.push(player);return player;
 }
 player(token){const p=this.players.find(p=>p.token===token);if(!p)throw Error('請重新加入本輪');return p;}
 start({testMode=false}={}){if(this.phase!=='lobby')throw Error('比賽已開始，請先重開下一輪');if(testMode){if(!this.players.length||!this.players.some(p=>p.connected))throw Error('請先用手機加入至少一位玩家');this.players.forEach(p=>p.ready=true);}else if(this.players.length!==5||this.players.some(p=>!p.ready))throw Error('五位玩家都準備好後才能開始');this.testMode=testMode;this.phase='countdown';this.countdown=3000;}
 advance(ms){if(this.paused)return; if(this.phase==='countdown'){this.countdown-=ms;if(this.countdown<=0){this.phase='race';this.players.forEach(p=>p.status='run');}return;}if(this.phase!=='race')return;
 this.elapsed+=ms;
 for(const p of this.players){
  if(p.status==='question'&&this.elapsed>=p.deadline)this.answer(p.token,-1,true);
  if(['feedback','stunned'].includes(p.status)&&this.elapsed>=p.deadline){p.stage++;if(p.stage===5){p.status='finished';p.steps=0;p.finished=this.elapsed;}else{p.status='run';p.steps=p.lastCorrect?20:0;}}
 }
 if(this.elapsed>=150000||this.players.every(p=>p.status==='finished')){this.phase='results';}
 }
 move(token){const p=this.player(token);if(this.phase!=='race'||this.paused||p.status!=='run'||!p.connected)return;
 if(this.elapsed-p.lastMove<333)return;p.lastMove=this.elapsed;p.steps=Math.min(100,p.steps+4);
 if(p.steps===100){p.status='question';p.questionStart=this.elapsed;p.deadline=this.elapsed+12000;}
 }
 answer(token,choice,timedOut=false){const p=this.player(token);if(this.phase!=='race'||this.paused||p.status!=='question')return;
 if(!timedOut&&this.elapsed>=p.deadline){return this.answer(token,-1,true);}
 if(!timedOut&&choice!==0&&choice!==1)throw Error('請選擇其中一個答案');
 p.lastCorrect=!timedOut&&p.order[p.stage][choice]===questions[p.stage].correct;
 p.correct+=p.lastCorrect?1:0;p.answerTime+=Math.min(12000,this.elapsed-p.questionStart);
 p.status=p.lastCorrect?'feedback':'stunned';p.deadline=this.elapsed+2000;
 }
 rankings(){const list=[...this.players].sort((a,b)=>this.compare(a,b));return list.map((p,i)=>({id:p.id,name:p.name,rank:i&&this.compare(list[i-1],p)===0?null:i+1,finished:p.finished,correct:p.correct,stage:p.stage,steps:p.steps})).map((x,i,a)=>({...x,rank:x.rank??a.slice(0,i).reverse().find(y=>y.rank!==null)?.rank??1}));}
 compare(a,b){if(a.finished!==null&&b.finished===null)return -1;if(b.finished!==null&&a.finished===null)return 1;if(a.finished!==null)return Math.floor(a.finished/100)-Math.floor(b.finished/100)||b.correct-a.correct||a.answerTime-b.answerTime;return b.stage-a.stage||b.steps-a.steps||b.correct-a.correct;}
 state(token){const me=this.players.find(p=>p.token===token);return {round:this.round,phase:this.phase,paused:this.paused,demo:this.demo,testMode:this.testMode,elapsed:this.elapsed,countdown:this.countdown,remaining:Math.max(0,150000-this.elapsed),players:this.players.map(p=>({id:p.id,name:p.name,photo:p.photo,mode:p.mode,ready:p.ready,connected:p.connected,stage:p.stage,steps:p.steps,status:p.status,stunRemaining:p.status==='stunned'?Math.max(0,p.deadline-this.elapsed):0,correct:p.correct,finished:p.finished})),rankings:this.rankings(),me:me?{id:me.id,status:me.status,stage:me.stage,steps:me.steps,ready:me.ready,mode:me.mode,correct:me.correct,remaining:Math.max(0,me.deadline-this.elapsed),question:me.status==='question'?{text:questions[me.stage].text,options:me.order[me.stage].map(i=>questions[me.stage].options[i])}:null,feedback:['feedback','stunned'].includes(me.status)?{correct:me.lastCorrect,answer:questions[me.stage].options[questions[me.stage].correct]}:null}:null};}
}
