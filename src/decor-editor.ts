import { clamp, type Point, type World } from './game/world';
import { decorations, MAX_DECOR, newId, now, type Decoration } from './model';

export class DecorEditor {
  draft:Decoration[];
  private baseline:Map<string,Decoration>;
  preview?:Decoration;
  constructor(items:Decoration[], private world:World) {
    this.draft=items.map(p=>({...p}));
    this.baseline=new Map(items.map(p=>[p.id,p]));
  }
  get existing(){return !!this.preview && this.draft.some(p=>p.id===this.preview!.id);}
  get changed(){
    return this.draft.length!==this.baseline.size || this.draft.some(p=>this.changedProp(p));
  }
  private changedProp(p:Decoration) {
    const initial=this.baseline.get(p.id);
    return !initial || initial.x!==p.x || initial.y!==p.y;
  }
  get type(){return this.preview?.type??null;}
  choose(type:number){
    if(this.draft.length>=MAX_DECOR) return false;
    this.preview={id:newId(),type,x:.42,y:.88,createdAt:now(),updatedAt:now()};
    return true;
  }
  select(id:string){
    const item=this.draft.find(p=>p.id===id);
    if(item) this.preview={...item};
  }
  position(point:Point){
    const p=this.preview;
    if(!p) return;
    const edge=Math.max(.04,Math.min(.25,decorations[p.type].size*25*this.world.unit/this.world.w));
    p.x=clamp(point.x/this.world.w,edge,1-edge);
    p.y=clamp(point.y/this.world.h,.47,.95);
  }
  nudge(direction:number){
    const p=this.preview;
    if(!p) return;
    const offsets=[[-12,0],[0,-9],[0,9],[12,0]];
    const [dx,dy]=offsets[direction];
    this.position({x:p.x*this.world.w+dx,y:p.y*this.world.h+dy});
  }
  commit(){
    if(!this.preview) return;
    const p={...this.preview,updatedAt:now()};
    const i=this.draft.findIndex(item=>item.id===p.id);
    if(i<0 && this.draft.length<MAX_DECOR) this.draft.push(p);
    else if(i>=0) this.draft[i]=p;
    this.preview=undefined;
  }
  remove(){
    if(!this.preview) return;
    this.draft=this.draft.filter(p=>p.id!==this.preview!.id);
    this.preview=undefined;
  }
  merge(current:Decoration[]){
    const currentMap=new Map(current.map(p=>[p.id,p]));
    const original=new Set(this.draft.map(p=>p.id));
    for(const [id,baseline] of this.baseline){
      if(original.has(id)) continue;
      const current=currentMap.get(id);
      if(current && current.updatedAt!==baseline.updatedAt) throw new Error('Kaldırmak istediğin süs başka bir cihazda taşınmış.');
      currentMap.delete(id);
    }
    for(const item of this.draft){
      if(!this.changedProp(item)) continue;
      const baseline=this.baseline.get(item.id);
      if(baseline && currentMap.get(item.id)?.updatedAt!==baseline.updatedAt) throw new Error('Taşımak istediğin süs başka bir cihazda değişmiş.');
      currentMap.set(item.id,item);
    }
    if(currentMap.size>MAX_DECOR) throw new Error('Süs sınırına ulaşıldı.');
    return [...currentMap.values()];
  }
}
