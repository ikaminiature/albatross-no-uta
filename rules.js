export const CELL_PX = 24;
export const SEA_WIDTH = 60 * CELL_PX;
export const SEA_HEIGHT = 80 * CELL_PX;
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
export function order(ships, wind) {
  const a=wind*Math.PI/180;
  return [...ships].sort((s,t)=>{const d=(t.x-s.x)*Math.sin(a)-(t.y-s.y)*Math.cos(a);return Math.abs(d)<1e-8?s.id-t.id:d}).map(s=>s.id);
}
export function move(ship, speed) {
  const a=ship.heading*Math.PI/180;
  return {...ship,x:ship.x+Math.sin(a)*speed*CELL_PX,y:ship.y-Math.cos(a)*speed*CELL_PX};
}
