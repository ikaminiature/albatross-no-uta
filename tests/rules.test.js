import {test} from 'node:test';
import assert from 'node:assert/strict';
import {limit,speeds,order,move,windAfterRoll,windSweep,CELL_PX,SEA_WIDTH,SEA_HEIGHT} from '../rules.js';
test('船首・横・船尾と回転した船の上限',()=>{assert.deepEqual([0,90,180,270].map(w=>limit(0,w)),[0,2,3,2]);assert.equal(limit(90,90),0)});
test('境界の寄せは船首の微小回転として判定し、風変更後も保存できる',()=>{assert.equal(limit(45,0,'cw'),2);assert.equal(limit(45,0,'ccw'),0);assert.equal(limit(45,180,'cw'),2);assert.equal(limit(45,180,'ccw'),3)});
test('速度の通常上限と成功時の例外、0〜3',()=>{assert.deepEqual(speeds(2,2),[1,2]);assert.deepEqual(speeds(3,0,true),[2,3]);assert.deepEqual(speeds(0,0),[0]);assert.deepEqual(speeds(0,3),[0,1])});
test('4方角の風上順と同位置の安定順',()=>{const s=[{id:1,x:0,y:0},{id:2,x:10,y:20}];assert.deepEqual(order(s,0),[1,2]);assert.deepEqual(order(s,90),[2,1]);assert.deepEqual(order(s,180),[2,1]);assert.deepEqual(order(s,270),[1,2]);assert.deepEqual(order([{id:1,x:0,y:0},{id:2,x:0,y:0}],0),[1,2])});
test('直進は船首方向へ速力ぶん、停止では移動しない',()=>{const s={x:10,y:20,heading:90};assert.equal(move(s,2).x,58);assert.equal(move(s,0).x,10);assert.equal(move({...s,heading:0},1).y,-4)});

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
