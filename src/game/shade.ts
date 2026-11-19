import type { Fish } from '../model';

type Color = [number,number,number];
type Matrix = [Color,Color,Color];

export const colorFilters:Record<Fish['shade'],string>={
  original:'none',sun:'sepia(.21) saturate(1.29) hue-rotate(-13deg)',
  lagoon:'hue-rotate(31deg) saturate(.97)',dusk:'hue-rotate(-24deg) saturate(1.16)',
};

const weight:Color=[.213,.715,.072];
const sepia:Matrix=[[.393,.769,.189],[.349,.686,.168],[.272,.534,.131]];
const hueCos:Matrix=[[.787,-.715,-.072],[-.213,.285,-.072],[-.213,-.715,.928]];
const hueSin:Matrix=[[-.213,-.715,.928],[.143,.140,-.283],[-.787,.715,.072]];
const axes=[0,1,2] as const;

function hue(degrees:number):Matrix {
  const radians=degrees*Math.PI/180;
  const cos=Math.cos(radians),sin=Math.sin(radians);
  return axes.map(i=>axes.map(j=>weight[j]+cos*hueCos[i][j]+sin*hueSin[i][j])) as Matrix;
}
function saturate(amount:number):Matrix {
  return axes.map(i=>axes.map(j=>weight[j]*(1-amount)+(i===j?amount:0))) as Matrix;
}
function warm(amount:number):Matrix {
  return axes.map(i=>axes.map(j=>sepia[i][j]*amount+(i===j?1-amount:0))) as Matrix;
}

const adjust={
  sun:[warm(.21),saturate(1.29),hue(-13)],
  lagoon:[hue(31),saturate(.97)],
  dusk:[hue(-24),saturate(1.16)],
};

export function tintPixels(data:Uint8ClampedArray,shade:Fish['shade']){
  if(shade==='original') return;
  const matrices=adjust[shade];
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3]) continue;
    for(const m of matrices){
      const r=data[i],g=data[i+1],b=data[i+2];
      data[i]=r*m[0][0]+g*m[0][1]+b*m[0][2];
      data[i+1]=r*m[1][0]+g*m[1][1]+b*m[1][2];
      data[i+2]=r*m[2][0]+g*m[2][1]+b*m[2][2];
    }
  }
}
