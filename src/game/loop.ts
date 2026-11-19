import { loadArt } from '../assets';
import { Renderer } from './render';
import { World, type Rect } from './world';

export async function startGame(canvas:HTMLCanvasElement, world:World, blockers:()=>Rect[], missing:(count:number)=>void) {
  const art=await loadArt();
  const failed=Object.values(art).filter(img=>!img).length;
  if(failed) missing(failed);
  const renderer=new Renderer(canvas,art,world);
  renderer.resize();
  const observer=new ResizeObserver(()=>{
    renderer.resize();
    world.blockers=blockers();
  });
  observer.observe(canvas);
  let frame=0,last=0, elapsed=0, samples=0, qualityWindow=0;
  function draw(time:number) {
    const dt=last?Math.min(.064,(time-last)/1000):0;
    const raw=last?(time-last)/1000:0;
    last=time;
    if(dt>0){
      world.step(dt);
      if(raw && raw<.18){
        elapsed+=raw;samples++;qualityWindow+=raw;
        if(qualityWindow>5){
          if(!world.low && elapsed/samples>.030){world.low=true;renderer.resize();}
          elapsed=0;samples=0;qualityWindow=0;
        }
      }
    }
    renderer.draw();
    frame=requestAnimationFrame(draw);
  }
  function visibility(){
    cancelAnimationFrame(frame);last=0;
    if(!document.hidden) frame=requestAnimationFrame(draw);
  }
  document.addEventListener('visibilitychange',visibility);
  visibility();
  return {renderer,dispose(){cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);}};
}
