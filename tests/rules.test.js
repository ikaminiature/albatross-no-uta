import {test} from 'node:test';
import assert from 'node:assert/strict';
import {limit,speeds,order,move,windAfterRoll,windSweep,sailingPlan,sternPivot,turnAtStern,turnAtCentre,minimumWindTurn,resolveWindTest,CELL_PX,SEA_WIDTH,SEA_HEIGHT} from '../rules.js';
test('船首・横・船尾と回転した船の上限',()=>{assert.deepEqual([0,90,180,270].map(w=>limit(0,w)),[0,2,3,2]);assert.equal(limit(90,90),0)});
test('境界の寄せは船首の微小回転として判定し、風変更後も保存できる',()=>{assert.equal(limit(45,0,'cw'),2);assert.equal(limit(45,0,'ccw'),0);assert.equal(limit(45,180,'cw'),2);assert.equal(limit(45,180,'ccw'),3)});
test('風の上限は変更前だけを判定する',()=>{
 assert.deepEqual(speeds(2,2),[1,2,3]);
 assert.deepEqual(speeds(3,0),[]);
 assert.deepEqual(speeds(3,0,true),[2,3]);
 assert.deepEqual(speeds(0,0),[0,1]);
});
test('4方角の風上順と同位置の安定順',()=>{const s=[{id:1,x:0,y:0},{id:2,x:10,y:20}];assert.deepEqual(order(s,0),[1,2]);assert.deepEqual(order(s,90),[2,1]);assert.deepEqual(order(s,180),[2,1]);assert.deepEqual(order(s,270),[1,2]);assert.deepEqual(order([{id:1,x:0,y:0},{id:2,x:0,y:0}],0),[1,2])});
test('各レベルの直進回数と停帆維持の例外',()=>{
 assert.deepEqual([0,1,2,3].map(v=>sailingPlan(1,v).legs),[1,1,2,3]);
 assert.equal(sailingPlan(1,0).distance,8);
 assert.deepEqual(sailingPlan(0,0),{free:true,legs:1,distance:0});
 const s={x:10,y:300,heading:0};
 assert.equal(move(s,8).y,108);
 assert.equal(move(s,0).y,300);
});
test('左右の船尾角は回頭前後で同じ座標に残る',()=>{
 for(const heading of [0,70,180])for(const angle of [-45,45,135]){
  const before={x:200,y:300,heading};
  const after=turnAtStern(before,angle);
  const p=sternPivot(before,angle),q=sternPivot(after,angle);
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-8);
  assert.notEqual(after.x,before.x);
 }
});
test('海図は80×60マスで1cmを24単位とする',()=>{
 assert.deepEqual([CELL_PX,SEA_WIDTH,SEA_HEIGHT],[24,1920,1440]);
});
test('d6の全出目を直前の風から時計回りに適用する',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(d=>windAfterRoll(0,d)),[90,90,180,180,270,270]);
 assert.equal(windAfterRoll(270,1),0);
 assert.equal(windAfterRoll(windAfterRoll(0,3),5),90);
 assert.throws(()=>windAfterRoll(0,0),RangeError);
});

test('走査線は全4方向で風上から風下へ進む',()=>{
 assert.deepEqual([0,90,180,270].map(w=>{
   const {horizontal,reversed,length}=windSweep([],w);
   return [horizontal,reversed,length];
 }),[[false,false,1440],[true,true,1920],[false,true,1440],[true,false,1920]]);
});
test('中心より船体の先に触れる順で採番し、同時なら船番号順',()=>{
 const ships=[{id:2,x:100,y:106,heading:0},{id:1,x:200,y:100,heading:90}];
 assert.deepEqual(windSweep(ships,0).hits.map(h=>h.distance),[82,88]);
 assert.deepEqual(order(ships,0),[2,1]);
 ships[0].y=112;
 assert.deepEqual(order(ships,0),[1,2]);
});

test('停帆維持の自由回頭では船の中心座標が変わらない',()=>{
 assert.deepEqual(turnAtCentre({x:150,y:280,heading:300},150),{x:150,y:280,heading:90});
});
test('成功時は最小回頭で現在の速力を許容し、次の速力を選べる',()=>{
 for(const wind of [0,90,180,270])for(const speed of [1,2,3]){
  for(let heading=0;heading<360;heading++){
   const ship={x:500,y:500,heading,speed,bias:'cw'};
   if(speed<=limit(heading,wind,ship.bias))continue;
   const result=resolveWindTest(ship,wind,3);
   const next=result.ship;
   assert.equal(next.speed,speed);
   assert.ok(limit(next.heading,wind,next.bias)>=speed);
   for(let d=0;d<Math.abs(result.angle);d++)for(const sign of [-1,1])for(const side of ['cw','ccw'])
    assert.ok(limit(heading+sign*d,wind,side)<speed);
  }
 }
 assert.equal(minimumWindTurn({heading:0,speed:3},0).angle,135);
});
test('1・2は元の船首方向へ8cm直進してLv0、3以上で成功',()=>{
 const ship={x:500,y:500,heading:0,speed:3,bias:'cw'};
 for(const die of [1,2]) assert.deepEqual(resolveWindTest(ship,0,die),
  {success:false,angle:0,ship:{...ship,y:308,speed:0}});
 for(const die of [3,4,5,6]) assert.equal(resolveWindTest(ship,0,die).success,true);
});

test('直進は船体の先端が境界に触れた時点で止まる',async()=>{
 const {straightToEdge,reenterSea}=await import('../rules.js');
 const ship={x:300,y:50,heading:0,speed:2};
 const result=straightToEdge(ship,8);
 assert.equal(result.hit,true);
 assert.equal(result.ship.y,24);
 assert.equal(result.ship.speed,2);
 assert.equal(straightToEdge(ship,1).hit,false);
 const returned=reenterSea(result.ship,180);
 assert.equal(returned.speed,2);
 assert.ok(returned.y>=24);
 assert.equal(straightToEdge(returned,8).hit,false);
});
test('回頭中に船体が触れた場合も最初の接触で止まる',async()=>{
 const {turnToEdge}=await import('../rules.js');
 const ship={x:300,y:25,heading:0,speed:0};
 const result=turnToEdge(ship,180,true);
 assert.equal(result.hit,true);
 assert.ok(result.ship.heading>0&&result.ship.heading<45);
 assert.equal(result.ship.y,25);
 assert.equal(turnToEdge({...ship,y:100},45).hit,false);
});
