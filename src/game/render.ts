import { decorations, species, type Decoration, type Fish } from '../model';
import { colorFilters, tintPixels } from './shade';
import { clamp, type Creature, type Point, type World } from './world';

type Art = Record<string,HTMLImageElement|null>;
const frames=8;
export class Renderer {
  readonly context:CanvasRenderingContext2D;
  private bg?:HTMLCanvasElement;
  private sprites=new Map<string,HTMLCanvasElement[]>();
  private ratio=1;
  private w=0;private h=0;
  private readonly props=new Map<number,HTMLImageElement>();
  constructor(readonly canvas:HTMLCanvasElement,private art:Art,private world:World) {
    const context=canvas.getContext('2d',{alpha:false});
    if(!context) throw Error('2D canvas unavailable');
    this.context=context;
    for(let i=0;i<decorations.length;i++){
      const img=art['decor-'+i];
      if(img) this.props.set(i,img);
    }
  }

  resize(){
    const box=this.canvas.getBoundingClientRect();
    if(box.width<1 || box.height<1) return;
    const ratio=Math.min(window.devicePixelRatio||1,this.world.low?1.15:1.8,Math.sqrt(2_700_000/(box.width*box.height)));
    if(this.w===box.width && this.h===box.height && this.ratio===ratio) return;
    this.w=box.width;this.h=box.height;this.ratio=ratio;
    this.canvas.width=Math.round(this.w*ratio);this.canvas.height=Math.round(this.h*ratio);
    this.world.resize(this.w,this.h);
    this.makeBackground();
  }

  rect=(p:Decoration)=>this.world.propRect(p,this.props.get(p.type));

  private makeBackground(){
    const bg=document.createElement('canvas');
    bg.width=this.canvas.width;bg.height=this.canvas.height;
    const ctx=bg.getContext('2d');
    if(!ctx) return;
    const side=Math.round(Math.min(bg.width*.28,bg.height*334/1024));
    const west=this.art.west, east=this.art.east, water=this.art.water;
    ctx.fillStyle='#8acff8';ctx.fillRect(0,0,bg.width,bg.height);
    if(west) ctx.drawImage(west,0,0,side,bg.height);
    if(east) ctx.drawImage(east,bg.width-side,0,side,bg.height);
    if(water) ctx.drawImage(water,side,0,bg.width-side*2,bg.height);
    this.bg=bg;
  }

  private animated(f:Fish){
    const key=f.species+':'+f.shade;
    const cached=this.sprites.get(key);
    if(cached) return cached;
    const img=this.art['fish-'+f.species];
    if(!img) return [];
    const scale=Math.min(1,190/Math.max(img.width,img.height));
    const iw=Math.round(img.width*scale), ih=Math.round(img.height*scale);
    const tinted=document.createElement('canvas');
    tinted.width=iw;tinted.height=ih;
    const tint=tinted.getContext('2d')!;
    const nativeFilter=typeof tint.filter==='string';
    if(nativeFilter) tint.filter=colorFilters[f.shade];
    tint.drawImage(img,0,0,iw,ih);
    if(!nativeFilter && f.shade!=='original'){
      const pixels=tint.getImageData(0,0,iw,ih);
      tintPixels(pixels.data,f.shade);
      tint.putImageData(pixels,0,0);
    }
    const result=Array.from({length:frames},(_,step)=>{
      const frame=document.createElement('canvas');
      frame.width=iw;frame.height=ih+14;
      const c=frame.getContext('2d')!;
      const bend=Math.sin(step*Math.PI*2/frames);
      const tailEnd=Math.round(iw*.58);
      const strips=14;
      // Generated silhouette stays intact. Only the tail-side strips bend.
      for(let i=0;i<strips;i++){
        const from=Math.floor(tailEnd*i/strips),to=Math.floor(tailEnd*(i+1)/strips);
        const weight=Math.pow(1-(i+.5)/strips,2.3);
        c.drawImage(tinted,from,0,to-from,ih,from,7+bend*weight*6,to-from,ih);
      }
      c.drawImage(tinted,tailEnd,0,iw-tailEnd,ih,tailEnd,7,iw-tailEnd,ih);
      return frame;
    });
    if(this.sprites.size>=32) this.sprites.delete(this.sprites.keys().next().value!);
    this.sprites.set(key,result);
    return result;
  }

  private drawFish(f:Creature) {
    const ctx=this.context,w=this.world.fishWidth(f),t=this.world.time,u=this.world.unit;
    const imgs=this.animated(f.data);
    if(!imgs.length) {
      ctx.fillStyle='#315b8c';ctx.font='700 13px Nunito, sans-serif';ctx.textAlign='center';ctx.fillText(f.data.name,f.x,f.y);
      return;
    }
    const swimming=clamp(Math.hypot(f.vx,f.vy)/(45*u),.32,1.8);
    const phase=t*(this.world.reduced?.7:1)*species[f.data.species].fin+f.phase*.7;
    const frame=imgs[Math.floor((phase*(f.state==='rest'?.55:1)*8+Math.sin(t*2)*swimming+2000)%frames)];
    const h=w*frame.height/frame.width;
    const reaction=clamp(1-(t-f.reactedAt)/.85,0,1);
    const blink=clamp(1-Math.abs(t-f.blinkAt-.08)/.08,0,1);
    const bounce=Math.sin(t*2.3+f.phase)*(this.world.reduced?1:2.8)*u;
    let x=f.x,y=f.y+bounce,rot=clamp(f.vy/170,-.23,.23)+reaction*.11*Math.sin(t*24),sx=1+reaction*.075,sy=1-reaction*.06-blink*.042;
    if(f.state==='special' && !this.world.reduced){
      const p=clamp((t-f.specialStart)/(f.until-f.specialStart),0,1);
      const pulse=Math.sin(p*Math.PI);
      if(f.special==='loop') {
        x+=Math.sin(p*Math.PI*2)*22*u*f.dir;y-=(1-Math.cos(p*Math.PI*2))*18*u;rot-=Math.sin(p*Math.PI*2)*.52*f.dir;
      } else if(f.special==='spin') rot+=p*Math.PI*2*f.dir;
      else if(f.special==='puff'){sx+=pulse*.22;sy+=pulse*.24;}
      else if(f.special==='peek'){ctx.globalAlpha=1-pulse*.68;sy-=pulse*.15;}
      else if(f.special==='snooze'){y-=pulse*7*u;rot+=pulse*.18;}
      else if(f.special==='shine'){sx+=pulse*.09;sy+=pulse*.08;}
    }
    if(f.state==='eat'){sx+=reaction*.12;sy-=reaction*.08;}
    const facing=Math.abs(f.facing)<.17?.17*Math.sign(f.facing||f.dir):f.facing;
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(sx*facing,sy);
    ctx.drawImage(frame,-w/2,-h/2,w,h);
    this.marking(ctx,f.data.marking,w,h);
    if(f.growth){
      // A tiny fin pin and a second spark appear as confirmed memories accrue.
      this.star(-w*.065,-h*.33,w*(f.growth===2?.079:.047),'#ffd444','#315b8c');
      if(f.growth===2) this.star(-w*.14,-h*.24,w*.030,'#fff9d8');
    }
    ctx.restore();ctx.globalAlpha=1;
    if(this.world.selected===f.data.id){
      ctx.strokeStyle='#fff9d8';ctx.lineWidth=1.4;
      ctx.setLineDash([3,5]);ctx.beginPath();ctx.ellipse(x,y,w*.57,h*.56,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
  }

  private star(x:number,y:number,r:number,color:string,stroke?:string) {
    const c=this.context;
    c.beginPath();
    c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.2,y-r*.15,x+r,y);
    c.quadraticCurveTo(x+r*.2,y+r*.22,x,y+r);
    c.quadraticCurveTo(x-r*.22,y+r*.2,x-r,y);
    c.quadraticCurveTo(x-r*.17,y-r*.21,x,y-r);
    c.fillStyle=color;c.fill();
    if(stroke){c.lineWidth=Math.max(1,r*.21);c.strokeStyle=stroke;c.stroke();}
  }

  private marking(c:CanvasRenderingContext2D, name:Fish['marking'],w:number,h:number){
    c.fillStyle='#fff0ab';
    if(name==='dots') {
      for(const [x,y,r] of [[-.075,.015,.020],[-.013,-.082,.027],[.036,.033,.017]]){
        c.beginPath();c.ellipse(w*x,h*y,w*r,w*r*.76,0,0,Math.PI*2);c.fill();
      }
    }
    if(name==='stripes'){
      c.lineWidth=w*.029;c.lineCap='round';c.strokeStyle='#fff3ba';
      for(const x of [-.07,-.015]){
        c.beginPath();c.moveTo(w*x,h*-.15);c.quadraticCurveTo(w*(x+.04),0,w*x,h*.105);c.stroke();
      }
    }
    if(name==='star') this.star(w*-.026,h*.006,w*.049,'#fff0ab','#315b8c');
  }

  private drawProp(prop:Decoration, preview=false){
    const img=this.props.get(prop.type);
    if(!img) return;
    const c=this.context,b=this.rect(prop);
    c.save();c.translate(b.x+b.w/2,b.y+b.h);
    if(decorations[prop.type].plant && !this.world.reduced) c.rotate(Math.sin(this.world.time*1.6+prop.x*15)*.047);
    if(preview) c.globalAlpha=.77;
    c.drawImage(img,-b.w/2,-b.h,b.w,b.h);c.restore();
  }

  draw() {
    const c=this.context,r=this.ratio,t=this.world.time;
    c.setTransform(1,0,0,1,0,0);
    if(this.bg)c.drawImage(this.bg,0,0);
    c.setTransform(r,0,0,r,0,0);
    if(!this.world.low && !this.world.reduced){
      c.strokeStyle='rgba(210,251,255,.33)';c.lineWidth=1.6;c.lineCap='round';
      for(let i=0;i<4;i++){
        const x=this.w*(.17+i*.22)+Math.sin(t*.27+i)*16;
        const y=this.h*(.12+(i%2)*.29)+Math.sin(t*.42+i)*6;
        c.beginPath();c.moveTo(x-16,y);c.quadraticCurveTo(x,y+3,x+16,y-1);c.stroke();
      }
    }
    for(const b of this.world.bubbles){
      const opacity=clamp((b.expires-t)*2,0,1)*clamp((t-b.born)*5,0,1);
      c.globalAlpha=opacity*(b.interactive?.85:.52);
      c.fillStyle=b.interactive?'#afefff48':'#bffaff35';c.strokeStyle='#e9fdff';
      c.lineWidth=b.interactive?1.7:1.2;
      c.beginPath();c.ellipse(b.x,b.y,b.size*.93,b.size,-.13,0,Math.PI*2);c.fill();c.stroke();
      c.beginPath();c.arc(b.x-b.size*.26,b.y-b.size*.35,b.size*.23,Math.PI,Math.PI*1.66);c.stroke();
    }
    c.globalAlpha=1;
    for(const f of this.world.fish) this.drawFish(f);
    for(const p of this.world.props){
      if(this.world.preview?.id!==p.id) this.drawProp(p);
    }
    if(this.world.preview){
      const p=this.world.preview,b=this.rect(p);
      c.setLineDash([4,5]);c.lineWidth=1.5;c.strokeStyle='#fff9d8';
      c.beginPath();c.ellipse(p.x*this.w,p.y*this.h,b.w*.62,Math.min(10,b.h*.21),0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      this.drawProp(p,true);
    }
    c.lineWidth=1;
    for(const p of this.world.foods){
      c.fillStyle='#b76435';c.strokeStyle='#fff1b2';c.beginPath();
      c.ellipse(p.x,p.y,3.5,2.8,Math.sin(t+p.id),0,Math.PI*2);c.fill();c.stroke();
    }
    if(!this.world.reduced) for(const p of this.world.sparks){
      c.globalAlpha=clamp(p.expires-t,0,.75);
      this.star(p.x,p.y,3+Math.sin((t-p.born)*5)*1.4,p.color);
    }
    c.globalAlpha=1;
  }
}
