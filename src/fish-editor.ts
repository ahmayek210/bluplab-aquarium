import { blankFish, newId, now, type Fish, type Milestone } from './model';
import { milestoneFields, portrait } from './ui';

export class FishEditor {
  readonly data:Fish;
  readonly definitions:Map<string,Milestone>;
  constructor(f?:Fish){
    this.data=f??blankFish();
    this.definitions=new Map(this.data.milestones.map(m=>[m.id,m]));
  }
  preview(form:HTMLFormElement,root:HTMLElement,species?:number){
    const required=<T extends HTMLInputElement|HTMLSelectElement>(name:string)=>form.elements.namedItem(name) as T;
    if(species!==undefined){
      required('species').value=String(species);
      for(const button of root.querySelectorAll('[data-action="species"]')) button.setAttribute('aria-pressed',String(Number((button as HTMLElement).dataset.id)===species));
    }
    const target=root.querySelector('#fishPreview');
    if(target) target.innerHTML=portrait({...this.data,species:Number(required('species').value),
      marking:required('marking').value as Fish['marking'],shade:required('shade').value as Fish['shade']});
    const section=root.querySelector<HTMLElement>('#definitionSection');
    if(section) section.hidden=required('kind').value==='moment';
  }
  append(form:HTMLFormElement){
    const list=form.querySelector('#milestoneDefinitions')!;
    if(list.children.length>=24) return;
    const milestone:Milestone={id:newId(),label:'',definedAt:now(),confirmedAt:null};
    this.definitions.set(milestone.id,milestone);
    list.insertAdjacentHTML('beforeend',milestoneFields(milestone));
    list.lastElementChild?.querySelector('input')?.focus();
  }
  value(form:HTMLFormElement):Fish{
    const fd=new FormData(form);
    const value=(name:string)=>String(fd.get(name)??'').trim();
    const kind=value('kind') as Fish['kind'];
    const milestones=kind==='ongoing'?[...form.querySelectorAll<HTMLElement>('[data-milestone]')].flatMap(row=>{
      const m=this.definitions.get(row.dataset.milestone??'');
      const label=row.querySelector('input')!.value.trim();
      return m&&label?[{...m,label}]:[];
    }):[];
    const name=value('name'), title=value('title'), description=value('description');
    if(!name || !title || !description) throw Error('Balığın adını, hatıranın başlığını ve açıklamasını yaz.');
    const link=value('link');
    if(link){
      try {if(!['https:','http:'].includes(new URL(link).protocol)) throw Error();}
      catch {throw Error('Bağlantı http:// veya https:// ile başlamalı.');}
    }
    return {...this.data,updatedAt:now(),name,title,description,kind,milestones,link,
      species:Number(value('species')),marking:value('marking') as Fish['marking'],
      shade:value('shade') as Fish['shade'],personality:value('personality') as Fish['personality'],
      category:value('category') as Fish['category'], date:value('date')||null,notes:value('notes'),
      visibility:value('visibility') as Fish['visibility'],illustrative:this.data.illustrative&&fd.get('makeReal')!== 'on',
    };
  }
}
