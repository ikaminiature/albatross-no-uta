import {norm,limit,speeds,windSweep,CELL_PX,SEA_WIDTH,SEA_HEIGHT,INITIAL_WIND,windAfterRoll,sailingPlan,sternPivot,resolveWindTest,straightToEdge,turnToEdge,reenterSea,LEG_CM} from './rules.js';
const $=s=>document.querySelector(s), names=['北','東','南','西'];
const seaTiles = []; // {col: 0, row: 0, src: './tiles/example.png'}
let scan=null, scanFrame=null, ranks=new Map();
let ships,wind=INITIAL_WIND,die=null,turn=0,queue=[],index=0,phase='wind',cap=0,returning=false,testNotice='',leg=1,angle=0,bias=null,plan=null,logs=[],paths=[];
function reset(){if(scanFrame!==null)cancelAnimationFrame(scanFrame);scanFrame=null;scan=null;ranks.clear();ships=[{id:1,x:18*CELL_PX,y:22*CELL_PX,heading:90,speed:0,bias:'cw'},{id:2,x:31*CELL_PX,y:35*CELL_PX,heading:0,speed:1,bias:'cw'}];wind=INITIAL_WIND;die=null;turn=0;phase='wind';queue=[];logs=[];paths=[];render()}
function log(s){logs.unshift(s)}
function active(){return ships.find(s=>s.id===queue[index])}
function begin(){
 paths=[]; // Keep the completed turn visible until the next one starts.
 const previous=wind;
 die=1+Math.floor(Math.random()*6);
 wind=windAfterRoll(wind,die);
 turn++;
 // Rank returning ships at their saved departure pose before choosing a new heading.
 for(const s of ships)if(s.returnTurn===turn){s.reentering=true;log(`船${s.id} が海域に復帰（Lv${s.speed}）`);}
 scan={...windSweep(ships.filter(s=>!s.returnTurn||s.reentering),wind),position:0,next:0};
 ranks.clear();queue=[];index=0;phase='scan';
 log(`第${turn}ターン：d6=${die} ／ ${names[previous/90]}風 → ${names[wind/90]}風`);
 render();
 let start;
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?250:1850;
 function advance(now){
   start??=now;
   const progress=Math.min(1,(now-start)/duration);
   scan.position=progress*scan.length;
   while(scan.next<scan.hits.length && (progress===1||scan.hits[scan.next].distance<=scan.position)){
     const {id}=scan.hits[scan.next++];
     queue.push(id);ranks.set(id,queue.length);
   }
   draw();
   if(progress<1){scanFrame=requestAnimationFrame(advance);return;}
   scanFrame=null;scan=null;
   log(`行動順：${queue.map(n=>'船'+n).join(' → ')}`);
   if(queue.length)beginShip();else endTurn('行動できる船がありません。');
 }
 scanFrame=requestAnimationFrame(advance);
}
function beginShip(){
 const s=active();
 returning=!!s.reentering;
 cap=returning?3:limit(s.heading,wind,s.bias);
 testNotice='';angle=0;bias=null;
 phase=returning?'return':s.speed>cap?'test':'speed';render();
}
function returnShip(){
 const s=active(),h=norm(s.heading+angle);
 if(boundary(h)&&!bias)return;
 Object.assign(s,reenterSea(s,h));
 if(bias)s.bias=bias;
 delete s.returnTurn;delete s.reentering;
 phase='speed';render();
}
function leaveSea(s){
 s.returnTurn=turn+2;
 log(`船${s.id} が境界に接触。第${turn+1}ターンを休み、第${s.returnTurn}ターンにLv${s.speed}で復帰。`);
 finishShip();
}
function addTrail(s,p){if(s.x!==p.x||s.y!==p.y)paths.push({x:s.x,y:s.y,tx:p.x,ty:p.y});}
function chooseSpeed(v){
 const s=active();
 plan=sailingPlan(s.speed,v);
 s.speed=v;leg=1;phase=plan.distance?'straight':'turn';angle=0;bias=null;render();
}
function rollSkill(){
 const s=active(),roll=1+Math.floor(Math.random()*6);
 const result=resolveWindTest(s,wind,roll);
 const motion=result.success?turnToEdge(s,result.angle):straightToEdge(s,LEG_CM);
 if(!result.success)addTrail(s,motion.ship);
 if(motion.hit){
   Object.assign(s,motion.ship);
   log(`船${s.id} スキルテスト：d6 ${roll}・${result.success?'成功':'失敗'}`);
   leaveSea(s);return;
 }
 Object.assign(s,result.ship);
 if(result.success){
   cap=limit(s.heading,wind,s.bias);
   const direction=result.angle<0?'左':'右';
   testNotice=`スキルテスト：d6 ${roll}・成功。 ${result.angle?direction+Math.abs(result.angle)+'°に自動回頭。':'境界の風を受けられる側を採用。'}速力を選んでください。`;
   phase='speed';
 } else {
   testNotice=`スキルテスト：d6 ${roll}・失敗。8cm直進してLv0になりました。回頭してください。`;
   plan={free:false,legs:1,distance:0};leg=1;angle=0;bias=null;phase='turn';
 }
 log(`船${s.id} ${testNotice}`);render();
}
function endTurn(note=''){phase='wind';log(`第${turn}ターン終了`);testNotice=note;render();}
function finishShip(){if(++index>=queue.length)endTurn();else beginShip()}
function boundary(h){return [45,135,225,315].includes(norm(h))}
function sailStraight(){
 const s=active(),motion=straightToEdge(s,plan.distance);
 addTrail(s,motion.ship);Object.assign(s,motion.ship);
 if(motion.hit){leaveSea(s);return;}
 phase='turn';render();
}
function commit(){
 const s=active(),h=norm(s.heading+angle);
 if(angle!==0&&boundary(h)&&!bias)return;
 const motion=turnToEdge(s,angle,plan.free);
 Object.assign(s,motion.ship);
 if(motion.hit){leaveSea(s);return;}
 if(bias)s.bias=bias;
 log(`船${s.id} ${plan.free?'自由回頭':leg+'回目'}：速力${s.speed}・船首${s.heading}°${bias?'・'+(bias==='cw'?'時計回り':'反時計回り')+'寄せ':''}`);
 if(leg===plan.legs)finishShip();
 else{leg++;phase=plan.distance?'straight':'turn';angle=0;bias=null;render();}
}
function draw(){
 const w=SEA_WIDTH,h=SEA_HEIGHT,c=CELL_PX;
 const art=seaTiles.map(({col,row,src})=>
   `<image href="${encodeURI(src)}" x="${col*c}" y="${row*c}" width="${c}" height="${c}"/>`).join('');
 let svg=`<defs><pattern id="grid" width="${c}" height="${c}" patternUnits="userSpaceOnUse"><path d="M${c} 0H0V${c}" fill="none" stroke="#8dafa4" stroke-width="1"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#54786c"/></marker></defs><rect width="${w}" height="${h}" fill="#d7e9e4"/><g id="sea-art" aria-hidden="true">${art}</g><rect width="${w}" height="${h}" fill="url(#grid)"/>`;
 svg+=paths.map(p=>`<path class="movement-trail" d="M${p.x} ${p.y}L${p.tx} ${p.ty}" stroke="#537d74" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-dasharray="4 6" fill="none"/>`).join('');
 if(scan){
   const p=scan.reversed?scan.length-scan.position:scan.position;
   const line=scan.horizontal?`M${p} 0V${h}`:`M0 ${p}H${w}`;
   svg+=`<path class="scan-line" d="${line}" fill="none"/>`;
 }
 ships.filter(s=>!s.returnTurn||s.reentering).forEach(s=>{const current=phase!=='wind'&&phase!=='scan'&&active()?.id===s.id;svg+=`<g transform="translate(${s.x} ${s.y})"><g transform="rotate(${s.heading})">${current?'<path d="M-12 -24l-80 -80M12 -24l80 -80M-12 24l-80 80M12 24l80 80" stroke="#b08b45" stroke-dasharray="5 6" fill="none"/>':''}<rect x="-12" y="-24" width="24" height="48" rx="3" fill="${current?'#c79544':'#3c6b62'}" stroke="#f8f7e9" stroke-width="3"/><path d="M-7 -10L0 -19L7 -10" fill="none" stroke="#fff9e5" stroke-width="3"/></g><text y="46" text-anchor="middle" font-size="23" fill="#203b3c">船${s.id} · ${s.speed}</text>${ranks.has(s.id)?`<g class="order-marker" data-ship="${s.id}" transform="translate(40 -32)"><circle r="21"/><text text-anchor="middle" dominant-baseline="central">${ranks.get(s.id)}</text></g>`:''}</g>`});
 if(phase==='straight'||phase==='turn'||phase==='return'){
 const s=active(),straight=phase==='straight',p=straight?straightToEdge(s,plan.distance).ship:phase==='return'?reenterSea(s,norm(s.heading+angle)):turnToEdge(s,angle,plan.free).ship;
 if(straight)svg+=`<path d="M${s.x} ${s.y}L${p.x} ${p.y}" stroke="#b07927" stroke-width="3"/>`;
 else if(phase==='turn'&&angle){const pivot=plan.free?s:sternPivot(s,angle);svg+=`<circle class="turn-pivot" cx="${pivot.x}" cy="${pivot.y}" r="7" fill="#b07927" stroke="#fff9e5" stroke-width="2"/>`;}
 svg+=`<g transform="translate(${p.x} ${p.y}) rotate(${p.heading})">`+ `<rect x="-12" y="-24" width="24" height="48" fill="#d8b36a" fill-opacity=".3" stroke="#9c6c29" stroke-dasharray="5 4"/><path d="M0 0V-30" stroke="#9c6c29" marker-end="url(#arrow)"/></g>`}
 $('#map').innerHTML=svg;
}
function render(){
 $('#windlabel').textContent=`${names[wind/90]}から${names[(wind/90+2)%4]}へ`;
 $('#wind-arrow').setAttribute('transform',`rotate(${wind} 44 44)`);
 $('#windroll').textContent=die===null?'開始前の風向き':`第${turn}ターン · d6 ${die} · 時計回りに${Math.ceil(die/2)*90}°`;
 let html='';if(phase==='wind'){html=`<button class="primary" id="begin">${turn?'次のターンを開始':'ゲーム開始'}</button>${turn&&testNotice?`<p role="status">${testNotice}</p>`:''}`}
 else if(phase==='scan'){html='<p role="status" class="note">風上から行動順を決めています…</p>'}
 else {const s=active();html=`<span class="badge">ACTION ${index+1} / ${queue.length}</span><h2>船${s.id} の${phase==='return'?'復帰・回頭':'行動'}</h2><p>船首 ${s.heading}° ／ 現在の速力 ${s.speed}<br>${returning?'復帰時は風チェックなし':phase==='speed'||phase==='test'?`風チェックの上限 <b>${cap}</b>`:'この行動中は風による再チェックなし'}</p>`;
 if(testNotice)html+=`<p class="note" role="status">${testNotice}</p>`;
 if(phase==='test')html+='<p class="note"><strong>スキルテスト</strong><br>3〜6で成功、1・2で失敗。</p><button class="primary" id="skill-roll">d6を振る</button>';
 if(phase==='speed')html+=`<p>速力を選ぶ</p><div class="row">${speeds(s.speed,cap).map(v=>`<button data-speed="${v}">${['停帆','巡航','快走','最高速'][v]}<br>${v} ${v===s.speed?'維持':v>s.speed?'↑':'↓'}</button>`).join('')}</div>`;
 if(phase==='straight')html+=`<p class="note">${leg} / ${plan.legs}：船首方向に ${plan.distance}cm 直進してから回頭</p><button id="straight" class="primary">${plan.distance}cm 直進</button>`;
 if(phase==='return'){
 const h=norm(s.heading+angle);
 html+=`<p class="note">行動順は復帰地点で確定済みです。まず船首の向きを自由に決めてください。そのあと、引き継いだLv${s.speed}から速力を選びます。</p><label for="angle">船首：${h}°</label><input id="angle" type="range" min="-180" max="180" step="1" value="${angle}">`;
 if(boundary(h))html+=`<div class="row"><button data-bias="ccw" class="${bias==='ccw'?'selected':''}">反時計回り側</button><button data-bias="cw" class="${bias==='cw'?'selected':''}">時計回り側</button></div>`;
 html+=`<button id="return-ship" class="primary" ${boundary(h)&&!bias?'disabled':''}>向きを確定して速力を選ぶ</button>`;
 }
 if(phase==='turn'){html+=`<p class="note">${plan.free?'停帆維持：船の中心で自由に回頭':`${leg} / ${plan.legs}：${plan.distance?'直進後の回頭':'停止した位置で回頭'}`}</p><label for="angle">回頭：${angle<0?'左':angle>0?'右':''} ${Math.abs(angle)}°</label><input id="angle" type="range" min="${plan.free?-180:-45}" max="${plan.free?180:45}" step="1" value="${angle}"><div class="row">${(plan.free?[-180,-90,0,90,180]:[-45,0,45]).map(a=>`<button data-angle="${a}">${a===0?'回頭なし':(a<0?'左':'右')+Math.abs(a)+'°'}</button>`).join('')}</div>`;
 if(angle!==0&&boundary(s.heading+angle))html+=`<p>境界上です。船首を寄せる側を記録：</p><div class="row"><button data-bias="ccw" class="${bias==='ccw'?'selected':''}">反時計回り</button><button data-bias="cw" class="${bias==='cw'?'selected':''}">時計回り</button></div>`;
 html+=`<button id="commit" class="primary" ${angle!==0&&boundary(s.heading+angle)&&!bias?'disabled':''}>${plan.free?'回頭して行動終了':leg===plan.legs?'回頭を確定して行動終了':'回頭を確定'}</button>`}}
 $('#panel').innerHTML=html;$('#fleet').innerHTML=ships.map(s=>`<p>船${s.id}　速力 ${s.speed} ／ ${s.reentering?'復帰':s.returnTurn?`第${s.returnTurn}ターンに復帰`:`船首 ${s.heading}°`}<br><small>境界記録：${s.bias==='cw'?'時計回り':'反時計回り'}寄せ</small></p>`).join('');$('#add').disabled=phase!=='wind'||ships.length>=6;$('#log').textContent='';logs.slice(0,30).forEach(l=>{const d=document.createElement('div');d.textContent=l;$('#log').append(d)});draw();
}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.id==='begin'&&phase==='wind')begin();if(b.id==='skill-roll'&&phase==='test')rollSkill();if(b.dataset.speed!==undefined&&phase==='speed')chooseSpeed(+b.dataset.speed);if(b.dataset.angle!==undefined){angle=+b.dataset.angle;bias=null;render()}if(b.dataset.bias){bias=b.dataset.bias;render()}if(b.id==='return-ship'&&phase==='return')returnShip();if(b.id==='straight'&&phase==='straight')sailStraight();if(b.id==='commit'&&phase==='turn')commit()});
$('#panel').addEventListener('input',e=>{if(e.target.id==='angle'){angle=+e.target.value;bias=null;document.querySelector('label[for=angle]').textContent=phase==='return'?`船首：${norm(active().heading+angle)}°`:`回頭：${angle<0?'左':angle>0?'右':''} ${Math.abs(angle)}°`;draw()}});
$('#panel').addEventListener('change',e=>{if(e.target.id==='angle')render()});
$('#add').onclick=()=>{const id=ships.length+1;ships.push({id,x:(10+id*7)*CELL_PX,y:(24+id*5)*CELL_PX,heading:0,speed:0,bias:'cw'});render()};$('#reset').onclick=()=>{if(confirm('航行を最初からやり直しますか？'))reset()};reset();
