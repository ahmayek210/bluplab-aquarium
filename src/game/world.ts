import { decorations, personalities, species, stage, type Aquarium, type Decoration, type Fish } from '../model';

export type Point = {x:number;y:number};
export type Rect = Point & {w:number;h:number};
type State = 'idle'|'cruise'|'explore'|'rest'|'food'|'eat'|'bubble'|'follow'|'react'|'social'|'avoid'|'inspect'|'special'|'welcome';
export type Special = typeof species[number]['special']|'shine';
export type Creature = Point & {
  data:Fish; vx:number; vy:number; target:Point; home:Point; dir:number; facing:number;
  state:State; until:number; next:number; phase:number; cool:number; socialCool:number;
  partner?:string; company?:'follow'|'alongside'|'circle'; food?:number; bubble?:number; special?:Special; specialStart:number;
  reactedAt:number; size:number; depth:number; growth:number; blinkAt:number;
};
type Food = Point & {id:number; expires:number; floor:number; vx:number; speed:number; owner?:string};
type Bubble = Point & {id:number; born:number; expires:number; size:number; interactive:boolean; phase:number};
type Spark = Point & {born:number; expires:number; vx:number; vy:number; color:string};
type Counts = {eaten:number;popped:number;social:number;special:number};
const slots = [[.36,.32],[.61,.44],[.42,.61],[.74,.64],[.25,.49],[.70,.26]];
export const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const fixed=(a:Point,x:number,y:number)=>{a.x=x;a.y=y;};
function nearRect(p:Point,b:Rect,pad:number) {
  return p.x>b.x-pad && p.x<b.x+b.w+pad && p.y>b.y-pad && p.y<b.y+b.h+pad;
}

class Neighborhood {
  private buckets=new Map<number,Creature[]>();
  private cell=120;
  refresh(fish:Creature[], size:number) {
    this.cell=120*size;
    this.buckets.clear();
    for(const f of fish){
      const key=this.key(Math.floor(f.x/this.cell),Math.floor(f.y/this.cell));
      const list=this.buckets.get(key);
      if(list) list.push(f); else this.buckets.set(key,[f]);
    }
  }
  private key(x:number,y:number){return x+8192*y;}
  around(f:Creature, radius:number) {
    const items:Creature[]=[];
    for(let y=Math.floor((f.y-radius)/this.cell);y<=Math.floor((f.y+radius)/this.cell);y++)
      for(let x=Math.floor((f.x-radius)/this.cell);x<=Math.floor((f.x+radius)/this.cell);x++){
        const bucket=this.buckets.get(this.key(x,y));
        if(bucket) items.push(...bucket);
      }
    return items;
  }
}

export class World {
  w=1; h=1; unit=1; time=0;
  fish:Creature[]=[]; props:Decoration[]=[];
  foods:Food[]=[]; bubbles:Bubble[]=[]; sparks:Spark[]=[];
  blockers:Rect[]=[]; pointer?:Point & { expires:number };
  selected?:string; preview?:Decoration; reduced=false; low=false;
  readonly counts:Counts={eaten:0,popped:0,social:0,special:0};
  onEvent?:(event:'pop'|'fish')=>void;
  private grid=new Neighborhood();
  private nextGrid=0;
  private sequence=0;
  private nextAmbient=0;
  private aiRefresh=0;
  private awakeAt=0;

  constructor(private random=Math.random){}

  resize(w:number,h:number) {
    if(w<1 || h<1 || (w===this.w && h===this.h)) return;
    const sx=w/this.w, sy=h/this.h;
    for(const f of this.fish){
      f.x*=sx; f.y*=sy; f.target.x*=sx; f.target.y*=sy;
      f.home.x*=sx; f.home.y*=sy;
    }
    for(const p of [...this.foods,...this.bubbles,...this.sparks]) { p.x*=sx; p.y*=sy; }
    for(const p of this.foods) p.floor*=sy;
    this.w=w; this.h=h; this.unit=clamp(h/460,.62,1.85);
    this.nextGrid=0;
  }

  sync(a:Aquarium,welcome?:string) {
    const current=new Map(this.fish.map(f=>[f.data.id,f]));
    this.props=[...a.props].sort((a,b)=>a.y-b.y);
    this.fish=a.fish.map((data,i)=>{
      const existing=current.get(data.id);
      if(existing){existing.data=data; existing.growth=stage(data);return existing;}
      const x=(slots[i]?.[0]??.15+this.random()*.7)*this.w;
      const y=(slots[i]?.[1]??.25+this.random()*.40)*this.h;
      const arriving=welcome===data.id;
      const speciesDef=species[data.species];
      const behavior=personalities[data.personality];
      const fish:Creature={
        data,x:arriving?-55*this.unit:x,y,vx:(arriving||i%2===0?1:-1)*speciesDef.speed*.42,vy:0,dir:arriving||i%2===0?1:-1,
        facing:arriving||i%2===0?1:-1,target:{x:arriving?this.w*.35:x+(i%2===0?1:-1)*this.w*.15,y:y+(this.random()-.5)*40*this.unit},
        home:{x:this.w*behavior.nook,y:this.h*.75},state:arriving?'welcome':'cruise',until:this.time+(arriving?2.4:2+this.random()*4),
        next:this.time+this.random()*.19,phase:this.random()*Math.PI*2,cool:this.time+12+this.random()*62,socialCool:this.time+4+this.random()*9,
        specialStart:0,reactedAt:-10,depth:clamp(speciesDef.depth+(this.random()-.5)*.16,.25,.68),
        size:speciesDef.size*(.96+this.random()*.1),growth:stage(data),blinkAt:this.time+2+this.random()*6,
      };
      if(arriving){
        this.addBubbles({x:this.w*.12,y},4,false);
        for(const neighbor of this.fish){
          if(distance(neighbor,{x:0,y})<this.w*.32 && ['idle','cruise','explore'].includes(neighbor.state)){
            neighbor.target={x:this.w*.20,y};
            neighbor.until=this.time+1.5;
            neighbor.state='inspect';
          }
        }
      }
      return fish;
    });
    const active=new Set(this.fish.map(f=>f.data.id));
    for(const food of this.foods) if(food.owner && !active.has(food.owner)) food.owner=undefined;
    this.nextGrid=0;
  }

  addFood(p:Point) {
    if(this.foods.length>=30) return;
    const count=Math.min(4,30-this.foods.length);
    for(let i=0;i<count;i++){
      this.foods.push({x:clamp(p.x+(this.random()-.5)*27*this.unit,8,this.w-8),y:p.y+(this.random()-.5)*10,
        id:++this.sequence,expires:this.time+14,floor:Math.max(p.y,this.h*(.85+this.random()*.04)),
        speed:(15+this.random()*19)*this.unit,vx:(this.random()-.5)*9*this.unit});
    }
  }

  addBubbles(p:Point, count=3, interactive=true) {
    for(let i=0;i<count && this.bubbles.length<(this.low?22:50);i++){
      const life=interactive?5+this.random()*2:3+this.random()*6;
      this.bubbles.push({...p,x:p.x+(this.random()-.5)*23*this.unit,y:p.y+(this.random()-.5)*15*this.unit,id:++this.sequence,
        born:this.time,expires:this.time+life,size:(3+this.random()*9)*this.unit,interactive,phase:this.random()*6});
    }
  }

  shimmer(p:Point,color='#fff0a2',number=6) {
    for(let i=0;i<number && this.sparks.length<48;i++){
      const angle=this.random()*Math.PI*2, speed=15+this.random()*32;
      this.sparks.push({...p,born:this.time,expires:this.time+.45+this.random()*.55,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color});
    }
  }

  touch(f:Creature,p:Point) {
    const trait=personalities[f.data.personality];
    this.release(f);
    f.state='react';
    f.reactedAt=this.time;
    f.until=this.time+1.12;
    f.target={x:f.x+(f.x>=p.x?1:-1)*(18+trait.reactive*42)*this.unit,y:f.y-21*this.unit};
    this.addBubbles({x:f.x,y:f.y-18*this.unit},2,false);
    this.onEvent?.('fish');
  }

  track(p?:Point) { this.pointer=p?{...p,expires:this.time+.53}:undefined; }

  triggerSpecial(f:Creature,special:Special=species[f.data.species].special) {
    this.release(f);
    f.state='special';
    f.special=special;
    f.specialStart=this.time;
    f.cool=this.time+35+this.random()*90;
    f.until=this.time+(special==='snooze'?3:1.65);
    f.target={x:f.x+(special==='dart'?f.dir*85:0)*this.unit,y:f.y};
    if(special==='peek'){
      const plant=this.props.find(p=>decorations[p.type].plant && Math.abs(p.x*this.w-f.x)<105*this.unit);
      if(plant) f.target={x:plant.x*this.w,y:plant.y*this.h-39*this.unit};
    }
    if(special==='snooze'||special==='peek') this.addBubbles({x:f.x,y:f.y-13*this.unit},2,false);
    else this.shimmer(f,special==='shine'?'#f4eb6c':'#fff9d8',special==='shine'?8:4);
    this.counts.special++;
  }

  startSocial(f:Creature,other:Creature) {
    if(f===other) return;
    this.release(f);
    f.state='social'; f.partner=other.data.id;
    const style=this.random();
    f.company=style<.38?'follow':style<.71?'alongside':'circle';
    f.until=this.time+2.3+this.random()*3;
    f.socialCool=this.time+12+this.random()*15;
    this.counts.social++;
  }

  propRect(p:Decoration,img?:{width:number;height:number}) {
    const max=53*decorations[p.type].size*this.unit;
    const ratio=img?img.width/img.height:1;
    const w=ratio>=1?max:max*ratio, h=ratio>=1?max/ratio:max;
    return {x:p.x*this.w-w/2,y:p.y*this.h-h,w,h};
  }

  pickFish(p:Point) {
    return [...this.fish].reverse().find(f=>{
      const width=this.fishWidth(f);
      return Math.abs(p.x-f.x)<Math.max(22,width*.45) && Math.abs(p.y-f.y)<Math.max(22,width*.33);
    });
  }
  fishWidth(f:Creature){return 91*f.size*this.unit*(1+f.growth*.065);}
  pickProp(p:Point, size:(p:Decoration)=>Rect) {
    return [...this.props].reverse().find(prop=>nearRect(p,size(prop),9));
  }
  private release(f:Creature) {
    const food=this.foods.find(item=>item.id===f.food && item.owner===f.data.id);
    if(food) food.owner=undefined;
    f.food=undefined;
    f.partner=undefined;
    f.bubble=undefined;
  }
  private wander(f:Creature, state:'cruise'|'explore'|'idle'='cruise') {
    this.release(f);
    f.state=state;
    f.until=this.time+2.5+this.random()*4.5;
    const advance=f.dir*(.14+this.random()*.4)*this.w;
    const x=f.x+advance;
    f.target={x:state==='idle'?f.x:clamp(x<this.w*.13||x>this.w*.87?f.x-advance:x,this.w*.14,this.w*.86),
      y:state==='idle'?f.y:clamp(this.h*(f.depth+(this.random()-.5)*(state==='explore'?.52:.23)),this.h*.23,this.h*.77)};
  }

  private decide(f:Creature) {
    const trait=personalities[f.data.personality];
    const busy=(f.state==='welcome'||f.state==='react'||f.state==='eat'||f.state==='special') && this.time<f.until;
    if(busy) return;
    if(f.state==='food'){
      const pellet=this.foods.find(p=>p.id===f.food && p.owner===f.data.id);
      if(pellet && this.time<f.until){f.target={x:pellet.x,y:pellet.y+2};return;}
      this.wander(f);
    }

    let food:Food|undefined, foodDist=Math.min(this.w*.65, (210+105*trait.curiosity)*this.unit);
    for(const item of this.foods){
      if(item.owner || item.expires-this.time<.5 || this.blockers.some(rect=>nearRect(item,rect,5))) continue;
      const gap=distance(f,item);
      if(gap<foodDist){food=item;foodDist=gap;}
    }
    if(food){
      this.release(f); f.state='food'; food.owner=f.data.id; f.food=food.id; f.target={x:food.x,y:food.y+3};
      f.until=this.time+Math.min(7,foodDist/(species[f.data.species].speed*this.unit)+2.5);
      return;
    }

    if(trait.curiosity>.6 && this.pointer && this.pointer.expires>this.time && distance(f,this.pointer)<160*this.unit){
      f.state='follow'; f.target={...this.pointer}; f.until=this.time+.72; return;
    }
    if(f.state==='bubble' && this.time<f.until){
      const active=this.bubbles.find(b=>b.id===f.bubble);
      if(active){f.target={x:active.x,y:active.y-7};return;}
    }
    if(trait.play>.45 && this.time>f.socialCool-7){
      const bubble=this.bubbles.find(b=>b.interactive && distance(f,b)<(95+87*trait.play)*this.unit
        && !this.fish.some(other=>other!==f && other.bubble===b.id));
      if(bubble){
        this.release(f); f.state='bubble'; f.bubble=bubble.id; f.target={x:bubble.x,y:bubble.y-7}; f.until=this.time+2.9; return;
      }
    }
    if(f.state==='social' && this.time<f.until){
      const other=this.fish.find(near=>near.data.id===f.partner);
      if(other && other.state!=='food' && other.state!=='react' && distance(f,other)<190*this.unit){
        const beat=this.time*1.9+f.phase;
        if(f.company==='circle') f.target={x:other.x+Math.cos(beat)*65*this.unit,y:other.y+Math.sin(beat)*37*this.unit};
        else if(f.company==='alongside') f.target={x:other.x+other.vx*.38,y:other.y+(f.depth>.5?44:-44)*this.unit};
        else f.target={x:other.x-other.dir*58*this.unit,y:other.y+Math.sin(beat)*14*this.unit};
        return;
      }
      this.wander(f);
      return;
    }
    if(this.time<f.until && distance(f,f.target)>15*this.unit) return;
    if(this.time<f.until && (f.state==='idle'||f.state==='rest'||f.state==='inspect')) return;
    if(this.time>f.cool && this.random()<.19){
      this.triggerSpecial(f,f.growth>0&&this.random()<.35?'shine':species[f.data.species].special); return;
    }
    if(this.time>f.socialCool){
      const nearby=this.grid.around(f,150*this.unit).filter(n=>n!==f && distance(n,f)<150*this.unit && n.state!=='food' && n.state!=='social');
      const neighbor=nearby[Math.floor(this.random()*nearby.length)];
      if(neighbor && trait.reactive>.85 && personalities[neighbor.data.personality].play>.7){
        f.state='avoid'; f.target={x:clamp(f.x+(f.x-neighbor.x)*1.4,this.w*.13,this.w*.87),y:clamp(f.y+35*this.unit,this.h*.28,this.h*.77)};
        f.until=this.time+1.3; f.socialCool=this.time+7; return;
      }
      if(neighbor && this.random()<trait.social*.56){this.startSocial(f,neighbor);return;}
      f.socialCool=this.time+2+this.random()*6;
    }
    const choice=this.random();
    if(choice<trait.rest*.38){
      f.state='rest'; f.target={...f.home}; f.until=this.time+4+trait.rest*7; return;
    }
    if(choice>.86 && this.props.length){
      const prop=this.props[Math.floor(this.random()*this.props.length)];
      f.state='inspect'; f.target={x:prop.x*this.w,y:prop.y*this.h-71*this.unit}; f.until=this.time+3.6; return;
    }
    this.wander(f,choice>.76?'idle':choice>.48?'explore':'cruise');
  }

  private move(f:Creature,dt:number) {
    const def=species[f.data.species], trait=personalities[f.data.personality], u=this.unit;
    const margin=Math.min(this.w*.19,this.fishWidth(f)*.58+4), top=Math.min(94*u,this.h*.24), bottom=this.h*.84;
    const tx=clamp(f.target.x,margin,this.w-margin), ty=clamp(f.target.y,top,Math.max(top,bottom));
    const dx=tx-f.x,dy=ty-f.y,gap=Math.hypot(dx,dy)||1;
    const dart=f.state==='special' && f.special==='dart';
    const factor=f.state==='welcome'?2.1:f.state==='food'?2.25:dart?2.5:f.state==='bubble'||f.state==='avoid'?1.53:f.state==='rest'?.62:f.state==='idle'||f.state==='eat'?.27:1;
    const speed=def.speed*trait.speed*u*factor*(this.reduced?.60:1);
    const arrive=Math.min(1,gap/(20*u));
    let vx=dx/gap*speed*arrive,vy=dy/gap*speed*arrive;
    for(const n of this.grid.around(f,86*u)){
      if(n===f) continue;
      const ax=f.x-n.x,ay=f.y-n.y,d=Math.hypot(ax,ay)||1;
      const threshold=(f.state==='food'?38:62)*u;
      if(d<threshold){
        const push=(1-d/threshold)*42*u;
        vx+=ax/d*push; vy+=ay/d*push;
      }
    }
    for(const p of this.props){
      if(![5,7,8].includes(p.type)) continue;
      const b=this.propRect(p), mid={x:b.x+b.w*.5,y:b.y+b.h*.53};
      const dx=f.x-mid.x,dy=f.y-mid.y,d=Math.hypot(dx,dy)||1;
      const reach=b.w*.51+23*u;
      if(d<reach){vx+=dx/d*(1-d/reach)*104*u;vy+=dy/d*(1-d/reach)*104*u;}
    }
    for(const blocker of this.blockers){
      const projected={x:f.x+vx*.45,y:f.y+vy*.45};
      const pad=Math.min(38*u,this.fishWidth(f)*.42);
      if(!nearRect(projected,blocker,pad)) continue;
      const left=f.x-(blocker.x-pad), right=blocker.x+blocker.w+pad-f.x;
      const up=f.y-(blocker.y-pad), down=blocker.y+blocker.h+pad-f.y;
      const edges=[left,right,up,down], edge=edges.indexOf(Math.min(...edges));
      if(edge===0) vx=-Math.max(35*u,Math.abs(vx));
      else if(edge===1) vx=Math.max(35*u,Math.abs(vx));
      else if(edge===2) vy=-Math.max(32*u,Math.abs(vy));
      else vy=Math.max(32*u,Math.abs(vy));
    }
    const ease=1-Math.exp(-dt*3.4);
    f.vx+=(vx-f.vx)*ease; f.vy+=(vy-f.vy)*ease;
    f.x=clamp(f.x+f.vx*dt,f.state==='welcome'?-70*u:margin,this.w-margin);
    f.y=clamp(f.y+f.vy*dt,top,Math.max(top,bottom));
    if(Math.abs(f.vx)>7*u) f.dir=Math.sign(f.vx);
    f.facing+=(f.dir-f.facing)*(1-Math.exp(-dt*9));
    if(f.blinkAt+.16<this.time) f.blinkAt=this.time+2.5+this.random()*7;
    if(f.state==='food'){
      const item=this.foods.find(p=>p.id===f.food && p.owner===f.data.id);
      if(item && distance(f,item)<36*u){
        this.foods=this.foods.filter(p=>p!==item);this.release(f);
        f.state='eat';f.until=this.time+.64;f.reactedAt=this.time;f.target={x:f.x,y:f.y};
        this.shimmer(item,'#ffd444',4); this.counts.eaten++; this.onEvent?.('pop');
      }
    }
    if(f.state==='bubble'){
      const bubble=this.bubbles.find(b=>b.id===f.bubble);
      if(bubble && distance(f,bubble)<31*u){
        this.bubbles=this.bubbles.filter(b=>b!==bubble);this.release(f);
        f.state='react';f.until=this.time+.52;f.reactedAt=this.time;
        this.shimmer(bubble,'#effaff',5);this.counts.popped++;this.onEvent?.('pop');
      }
    }
  }

  step(dt:number) {
    this.time+=dt;
    if(this.time>=this.nextGrid){this.grid.refresh(this.fish,this.unit);this.nextGrid=this.time+.13;}
    if(this.time>=this.nextAmbient){
      this.nextAmbient=this.time+(this.low||this.reduced?1.8:.82)+this.random()*.9;
      const x=(this.random()<.5?.13+.19*this.random():.68+.19*this.random())*this.w;
      this.addBubbles({x,y:this.h*(.66+this.random()*.22)},this.low||this.reduced?1:2,false);
    }
    if(this.time>this.aiRefresh){
      this.aiRefresh=this.time+1;
      if(this.time>this.awakeAt){this.awakeAt=this.time+900;for(const f of this.fish) f.growth=stage(f.data);}
      this.foods=this.foods.filter(p=>p.expires>this.time);
      this.sparks=this.sparks.filter(p=>p.expires>this.time);
      this.bubbles=this.bubbles.filter(p=>p.expires>this.time && p.y>-20);
    }
    for(const f of this.fish){
      if(this.time>=f.next){
        f.next=this.time+(this.low?.26:.15)+this.random()*.07;
        this.decide(f);
      }
      this.move(f,dt);
    }
    for(const p of this.foods){p.y=Math.min(p.floor,p.y+p.speed*dt);p.x=clamp(p.x+p.vx*dt,4,this.w-4);}
    for(const b of this.bubbles){b.y-=(b.interactive?31:17)*this.unit*dt;b.x+=Math.sin(this.time*2+b.phase)*8*dt*this.unit;}
    for(const p of this.sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;}
  }
}
