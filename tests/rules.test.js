import {test} from 'node:test';
import assert from 'node:assert/strict';
import {limit,speeds,order,move,windAfterRoll,windSweep,sailingPlan,sternPivot,turnAtStern,CELL_PX,SEA_WIDTH,SEA_HEIGHT} from '../rules.js';
test('船首・横・船尾と回転した船の上限',()=>{assert.deepEqual([0,90,180,270].map(w=>limit(0,w)),[0,2,3,2]);assert.equal(limit(90,90),0)});
test('境界の寄せは船首の微小回転として判定し、風変更後も保存できる',()=>{assert.equal(limit(45,0,'cw'),2);assert.equal(limit(45,0,'ccw'),0);assert.equal(limit(45,180,'cw'),2);assert.equal(limit(45,180,'ccw'),3)});
test('風の上限は変更前だけを判定する',()=>{
 assert.deepEqual(speeds(2,2),[1,2,3]);
 assert.deepEqual(speeds(3,0),[]);
 assert.deepEqual(speeds(3,0,true),[2,3]);
 assert.deepEqual(speeds(0,0),[0,1]);
});
test('4方角の風上順と同位置の安定順',()=>{const s=[{id:1,x:0,y:0},{id:2,x:10,y:20}];assert.deepEqual(order(s,0),[1,2]);assert.deepEqual(order(s,90),[2,1]);assert.deepEqual(order(s,180),[2,1]);assert.deepEqual(order(s,270),[1,2]);assert.deepEqual(order([{id:1,x:0,y:0},{id:2,x:0,y:0}],0),[1,2])});
test('各レベルの直進回数と停帆維持・テスト失敗の例外',()=>{
 assert.deepEqual([0,1,2,3].map(v=>sailingPlan(1,v).legs),[1,1,2,3]);
 assert.equal(sailingPlan(1,0).distance,8);
 assert.deepEqual(sailingPlan(0,0),{free:true,legs:1,distance:0});
 assert.deepEqual(sailingPlan(3,0,true),{free:false,legs:1,distance:0});
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
