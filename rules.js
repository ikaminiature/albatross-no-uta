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
export function speeds(speed, cap, success=false) {
  return [speed-1,speed,speed+1].filter(s=>s>=0 && s<=3 && (success || s<=cap));
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
export function move(ship, speed) {
  const a=ship.heading*Math.PI/180;
  return {...ship,x:ship.x+Math.sin(a)*speed*CELL_PX,y:ship.y-Math.cos(a)*speed*CELL_PX};
}
