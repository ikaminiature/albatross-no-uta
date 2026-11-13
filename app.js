import {norm,limit,speeds,order,move,CELL_PX,SEA_WIDTH,SEA_HEIGHT,INITIAL_WIND,windAfterRoll} from './rules.js';
const $=s=>document.querySelector(s), names=['北','東','南','西'];
const seaTiles = []; // {col: 0, row: 0, src: './tiles/example.png'}
let ships,wind=INITIAL_WIND,die=null,turn=0,queue=[],index=0,phase='wind',cap=0,success=false,leg=1,angle=0,bias=null,free=false,logs=[],paths=[];
function reset(){ships=[{id:1,x:18*CELL_PX,y:22*CELL_PX,heading:90,speed:0,bias:'cw'},{id:2,x:31*CELL_PX,y:35*CELL_PX,heading:0,speed:1,bias:'cw'}];wind=INITIAL_WIND;die=null;turn=0;phase='wind';queue=[];logs=[];paths=[];render()}
function log(s){logs.unshift(s)}
function active(){return ships.find(s=>s.id===queue[index])}
function begin(){
 const previous=wind;
 die=1+Math.floor(Math.random()*6);
 wind=windAfterRoll(wind,die);
 turn++;queue=order(ships,wind);index=0;
 log(`第${turn}ターン：d6=${die} ／ ${names[previous/90]}風 → ${names[wind/90]}風 ／ ${queue.map(n=>'船'+n).join(' → ')}`);
 beginShip()
}
function beginShip(){const s=active();cap=limit(s.heading,wind,s.bias);success=false;phase=s.speed>cap?'test':'speed';render()}
function chooseSpeed(v,failed=false){const s=active();free=!failed&&s.speed===0&&v===0;s.speed=v;leg=1;phase='turn';angle=0;bias=null;render()}
function finishShip(){if(++index>=queue.length){phase='wind';log(`第${turn}ターン終了`);render()}else beginShip()}
function boundary(h){return [45,135,225,315].includes(norm(h))}
function commit(){const s=active(),h=norm(s.heading+angle);if(angle!==0&&boundary(h)&&!bias)return;
 const before={...s};if(!free)Object.assign(s,move(s,s.speed));s.heading=h;if(bias)s.bias=bias;
 paths.push({x:before.x,y:before.y,tx:s.x,ty:s.y});log(`船${s.id} ${free?'自由回頭':leg+'回目'}：速力${s.speed}・船首${s.heading}°${bias?'・'+(bias==='cw'?'時計回り':'反時計回り')+'寄せ':''}`);
 if(free||leg===2)finishShip();else{leg=2;angle=0;bias=null;render()}}
function draw(){
 const w=SEA_WIDTH,h=SEA_HEIGHT,c=CELL_PX;
 const art=seaTiles.map(({col,row,src})=>
   `<image href="${encodeURI(src)}" x="${col*c}" y="${row*c}" width="${c}" height="${c}"/>`).join('');
 let svg=`<defs><pattern id="grid" width="${c}" height="${c}" patternUnits="userSpaceOnUse"><path d="M${c} 0H0V${c}" fill="none" stroke="#8dafa4" stroke-width="1"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#54786c"/></marker></defs><rect width="${w}" height="${h}" fill="#d7e9e4"/><g id="sea-art" aria-hidden="true">${art}</g><rect width="${w}" height="${h}" fill="url(#grid)"/>`;
 svg+=paths.slice(-30).map(p=>`<path d="M${p.x} ${p.y}L${p.tx} ${p.ty}" stroke="#7e998b" stroke-dasharray="4 6" fill="none"/>`).join('');
 ships.forEach(s=>{const current=phase!=='wind'&&active()?.id===s.id;svg+=`<g transform="translate(${s.x} ${s.y})"><g transform="rotate(${s.heading})">${current?'<path d="M-12 -24l-80 -80M12 -24l80 -80M-12 24l-80 80M12 24l80 80" stroke="#b08b45" stroke-dasharray="5 6" fill="none"/>':''}<rect x="-12" y="-24" width="24" height="48" rx="3" fill="${current?'#c79544':'#3c6b62'}" stroke="#f8f7e9" stroke-width="3"/><path d="M-7 -10L0 -19L7 -10" fill="none" stroke="#fff9e5" stroke-width="3"/></g><text y="46" text-anchor="middle" font-size="23" fill="#203b3c">船${s.id} · ${s.speed}</text></g>`});
 if(phase==='turn'){const s=active(),p=free?s:move(s,s.speed);svg+=`<path d="M${s.x} ${s.y}L${p.x} ${p.y}" stroke="#b07927" stroke-width="3"/><g transform="translate(${p.x} ${p.y}) rotate(${norm(s.heading+angle)})"><rect x="-12" y="-24" width="24" height="48" fill="#d8b36a" fill-opacity=".3" stroke="#9c6c29" stroke-dasharray="5 4"/><path d="M0 0V-30" stroke="#9c6c29" marker-end="url(#arrow)"/></g>`}
 $('#map').innerHTML=svg;
}
function render(){
 $('#windlabel').textContent=`${names[wind/90]}から${names[(wind/90+2)%4]}へ`;
 $('#vane-arrow').setAttribute('transform',`rotate(${wind} 44 44)`);
 $('#windroll').textContent=die===null?'開始前の風向き':`第${turn}ターン · d6 ${die} · 時計回りに${Math.ceil(die/2)*90}°`;
 let html='';if(phase==='wind'){html=`<button class="primary" id="begin">${turn?'次のターンを開始':'ゲーム開始'}</button>`}
 else {const s=active();html=`<span class="badge">ACTION ${index+1} / ${ships.length}</span><h2>船${s.id} の行動</h2><p>船首 ${s.heading}° ／ 現在の速力 ${s.speed}<br>行動開始時の風による上限 <b>${cap}</b></p>`;
 if(phase==='test')html+='<p class="note">現在の速力が上限を超えています。スキルテストを手動判定してください。</p><div class="row"><button id="pass">成功</button><button id="fail">失敗 → 停止</button></div>';
 if(phase==='speed')html+=`<p>速力を選ぶ${success?'（テスト成功：上限を超えて選択可）':''}</p><div class="row">${speeds(s.speed,cap,success).map(v=>`<button data-speed="${v}">${['停帆','巡航','快走','最高速'][v]}<br>${v} ${v===s.speed?'維持':v>s.speed?'↑':'↓'}</button>`).join('')}</div>`;
 if(phase==='turn'){html+=`<p class="note">${free?'停帆維持：移動せず自由に回頭':`${leg} / 2：速力${s.speed}で直進し、回頭`}</p><label for="angle">回頭：${angle<0?'左':angle>0?'右':''} ${Math.abs(angle)}°</label><input id="angle" type="range" min="${free?-180:-45}" max="${free?180:45}" step="1" value="${angle}"><div class="row">${(free?[-180,-90,0,90,180]:[-45,0,45]).map(a=>`<button data-angle="${a}">${a===0?'直進':(a<0?'左':'右')+Math.abs(a)+'°'}</button>`).join('')}</div>`;
 if(angle!==0&&boundary(s.heading+angle))html+=`<p>境界上です。船首を寄せる側を記録：</p><div class="row"><button data-bias="ccw" class="${bias==='ccw'?'selected':''}">反時計回り</button><button data-bias="cw" class="${bias==='cw'?'selected':''}">時計回り</button></div>`;
 html+=`<button id="commit" class="primary" ${angle!==0&&boundary(s.heading+angle)&&!bias?'disabled':''}>${free?'回頭して行動終了':leg===1?'1回目を実行':'2回目を実行して行動終了'}</button>`}}
 $('#panel').innerHTML=html;$('#fleet').innerHTML=ships.map(s=>`<p>船${s.id}　速力 ${s.speed} ／ 船首 ${s.heading}°<br><small>境界記録：${s.bias==='cw'?'時計回り':'反時計回り'}寄せ</small></p>`).join('');$('#add').disabled=phase!=='wind'||ships.length>=6;$('#log').textContent='';logs.slice(0,30).forEach(l=>{const d=document.createElement('div');d.textContent=l;$('#log').append(d)});draw();
}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.id==='begin')begin();if(b.id==='pass'){success=true;phase='speed';render()}if(b.id==='fail')chooseSpeed(0,true);if(b.dataset.speed!==undefined)chooseSpeed(+b.dataset.speed);if(b.dataset.angle!==undefined){angle=+b.dataset.angle;bias=null;render()}if(b.dataset.bias){bias=b.dataset.bias;render()}if(b.id==='commit')commit()});
$('#panel').addEventListener('input',e=>{if(e.target.id==='angle'){angle=+e.target.value;bias=null;document.querySelector('label[for=angle]').textContent=`回頭：${angle<0?'左':angle>0?'右':''} ${Math.abs(angle)}°`;draw()}});
$('#panel').addEventListener('change',e=>{if(e.target.id==='angle')render()});
$('#add').onclick=()=>{const id=ships.length+1;ships.push({id,x:(10+id*7)*CELL_PX,y:(24+id*5)*CELL_PX,heading:0,speed:0,bias:'cw'});render()};$('#reset').onclick=()=>{if(confirm('航行を最初からやり直しますか？'))reset()};reset();
