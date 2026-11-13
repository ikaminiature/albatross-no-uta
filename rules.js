export const CELL_PX = 24;
export const SEA_WIDTH = 80 * CELL_PX;
export const SEA_HEIGHT = 60 * CELL_PX;
export const INITIAL_WIND = 0; // 風が来る方角：北
export const norm = a => (a % 360 + 360) % 360;
export function windAfterRoll(wind, die) {
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new RangeError('d6 must be 1–6');
  return norm(wind + Math.ceil(die / 2) * 90);
}
export function limit(heading, wind, bias = 'cw') {
  let a = norm(wind - heading);
  if ([45,135,225,315].some(b => Math.abs(a-b)<1e-7)) a=norm(a+(bias==='cw'?-0.001:0.001));
  return a<45 || a>315 ? 0 : a>135 && a<225 ? 3 : 2;
}
// The wind checks the incoming level, not the newly chosen level.
export function speeds(speed, cap, success=false) {
  if (!success && speed > cap) return [];
  return [speed-1,speed,speed+1].filter(s=>s>=0 && s<=3);
}
export const LEG_CM = 8;
export function sailingPlan(startSpeed, nextSpeed) {
  const free = startSpeed === 0 && nextSpeed === 0;
  return {free, legs:Math.max(1,nextSpeed), distance:free?0:LEG_CM};
}
// Wind is the source bearing. Progress starts at the corresponding sea edge.
export function windSweep(ships, wind) {
  const from = norm(wind);
  const horizontal = from === 90 || from === 270;
  const length = horizontal ? SEA_WIDTH : SEA_HEIGHT;
  const reversed = from === 90 || from === 180;
  const hits = ships.map(s => {
    const radians = norm((s.heading ?? 0) - from) * Math.PI / 180;
    // Project the rotated 2×1cm hull onto the scan axis, not just its centre.
    const halfHull = CELL_PX * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)) / 2);
    const centre = horizontal ? s.x : s.y;
    return {id:s.id, distance:(reversed ? length - centre : centre) - halfHull};
  }).sort((a,b)=>Math.abs(a.distance-b.distance)<1e-8?a.id-b.id:a.distance-b.distance);
  return {horizontal,length,reversed,hits};
}
export function order(ships, wind) {
  return windSweep(ships,wind).hits.map(({id})=>id);
}
export function move(ship, distanceCm) {
  const a=ship.heading*Math.PI/180;
  return {...ship,x:ship.x+Math.sin(a)*distanceCm*CELL_PX,y:ship.y-Math.cos(a)*distanceCm*CELL_PX};
}

function rotateOffset(x,y,heading) {
  const radians=heading*Math.PI/180;
  return {x:x*Math.cos(radians)-y*Math.sin(radians),y:x*Math.sin(radians)+y*Math.cos(radians)};
}
export function sternPivot(ship, angle) {
  const offset=rotateOffset(Math.sign(angle)*CELL_PX/2,CELL_PX,ship.heading);
  return {x:ship.x+offset.x,y:ship.y+offset.y};
}
export function turnAtStern(ship, angle) {
  if (!angle) return {...ship};
  const pivot=sternPivot(ship,angle);
  const heading=norm(ship.heading+angle);
  const offset=rotateOffset(Math.sign(angle)*CELL_PX/2,CELL_PX,heading);
  return {...ship,x:pivot.x-offset.x,y:pivot.y-offset.y,heading};
}

export function turnAtCentre(ship, angle) {
  return {...ship,heading:norm(ship.heading+angle)};
}
export function minimumWindTurn(ship, wind) {
  if (ship.speed <= limit(ship.heading,wind,ship.bias)) return {angle:0,bias:ship.bias};
  const candidates = [45,135,225,315].flatMap(offset=>{
    const heading = norm(wind + offset);
    const cw = norm(heading-ship.heading);
    return ['cw','ccw'].filter(bias=>limit(heading,wind,bias)>=ship.speed)
      .map(bias=>({angle:cw>180?cw-360:cw,bias}));
  });
  return candidates.sort((a,b)=>Math.abs(a.angle)-Math.abs(b.angle)||b.angle-a.angle)[0];
}
export function resolveWindTest(ship, wind, die) {
  if (!Number.isInteger(die) || die<1 || die>6) throw new RangeError('d6 must be 1–6');
  if (die<3) return {success:false,angle:0,ship:{...move(ship,LEG_CM),speed:0}};
  const {angle,bias}=minimumWindTurn(ship,wind);
  return {success:true,angle,ship:{...turnAtStern(ship,angle),bias}};
}

// Clip movement at the first contact of the rectangular hull with the sea edge.
const EDGE_EPS=1e-7;
function hullHalfExtents(heading){
 const a=heading*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
 return {x:CELL_PX*(c/2+s),y:CELL_PX*(s/2+c)};
}
export function straightToEdge(ship,cm){
 const dest=move(ship,cm),half=hullHalfExtents(ship.heading);
 const times=[];
 for(const [axis,size] of [['x',SEA_WIDTH],['y',SEA_HEIGHT]]){
   const delta=dest[axis]-ship[axis];
   if(delta>EDGE_EPS)times.push((size-half[axis]-ship[axis])/delta);
   else if(delta< -EDGE_EPS)times.push((half[axis]-ship[axis])/delta);
 }
 const t=Math.min(...times);
 if(t>1+EDGE_EPS)return {ship:dest,hit:false};
 return {ship:move(ship,cm*Math.max(0,Math.min(1,t))),hit:true};
}
export function turnToEdge(ship,angle,centre=false){
 const rotate=centre?turnAtCentre:turnAtStern;
 if(!angle)return {ship:{...ship},hit:false};
 const pivot=centre?ship:sternPivot(ship,angle);
 const side=Math.sign(angle),end=Math.abs(angle)*Math.PI/180;
 const start=ship.heading*Math.PI/180;
 let first=Infinity;
 for(const x of [-CELL_PX/2,CELL_PX/2])for(const y of [-CELL_PX,CELL_PX]){
   const u=x-(centre?0:side*CELL_PX/2),v=y-(centre?0:CELL_PX);
   const radius=Math.hypot(u,v);
   if(!radius)continue;
   const offset=Math.atan2(v,u);
   for(const [base,shift,walls] of [[pivot.x,0,[0,SEA_WIDTH]],[pivot.y,-Math.PI/2,[0,SEA_HEIGHT]]]){
     for(const wall of walls){
       const ratio=(wall-base)/radius;
       if(Math.abs(ratio)>1+EDGE_EPS)continue;
       const a=Math.acos(Math.max(-1,Math.min(1,ratio)));
       for(const root of [-a,a]){
         const t=norm(side*(root-start-offset-shift)*180/Math.PI)*Math.PI/180;
         if(t<=end+EDGE_EPS)first=Math.min(first,t);
       }
     }
   }
 }
 return first===Infinity?{ship:rotate(ship,angle),hit:false}:
   {ship:rotate(ship,side*Math.min(first,end)*180/Math.PI),hit:true};
}
export function reenterSea(ship,heading){
 const h=hullHalfExtents(heading),inset=0.001;
 const fit=(n,r,size)=>Math.max(r+inset,Math.min(n,size-r-inset));
 return {...ship,heading,x:fit(ship.x,h.x,SEA_WIDTH),y:fit(ship.y,h.y,SEA_HEIGHT)};
}
