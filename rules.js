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
export function sailingPlan(startSpeed, nextSpeed, failed=false) {
  const free = !failed && startSpeed === 0 && nextSpeed === 0;
  return {free, legs:Math.max(1,nextSpeed), distance:free||failed?0:LEG_CM};
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
