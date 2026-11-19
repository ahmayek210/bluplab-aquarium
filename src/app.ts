import { Sounds } from './audio';
import { DecorEditor } from './decor-editor';
import { FishEditor } from './fish-editor';
import { Fullscreen } from './fullscreen';
import { startGame } from './game/loop';
import { World, type Point, type Rect } from './game/world';
import { icon } from './icons';
import { available, MAX_FISH, now, type Aquarium, type Fish } from './model';
import { settings } from './settings';
import { flag, parseAquarium, setFlag, Storage, StorageError } from './storage';
import { button, decorActions, decorPanel, fishForm, memoryCard, memoryList, panel, shell, type MemoryView } from './ui';

type Page = 'fish'|'new'|'edit'|'memories'|'decor'|'settings'|null;
type Mode = 'feed'|'bubbles'|null;

export class App {
  private readonly box:HTMLElement;
  private readonly canvas:HTMLCanvasElement;
  private readonly panels:HTMLElement;
  private readonly toast:HTMLElement;
  private readonly world=new World();
  private readonly storage=new Storage();
  private readonly sounds=new Sounds();
  private readonly fullscreen:Fullscreen;
  private readonly motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private a:Aquarium;
  private game?:Awaited<ReturnType<typeof startGame>>;
  private ready=false;
  private page:Page=null;
  private mode:Mode=null;
  private fishId?:string;
  private editor?:FishEditor;
  private decor?:DecorEditor;
  private previous:'memories'|null=null;
  private memories:MemoryView={category:'',order:'new'};
  private settle?:number;
  private cloudError?:string;
  private visitorLink?:string;
  private saving=false;
  private refreshing=false;
  private portraitAllowed=false;
  private openingFocus?:HTMLElement;
  private input?:{id:number;origin:Point;kind:'decor'|'water'|'outside';moved:boolean};
  private lastPoint?:Point & {t:number};
  private reduced=flag('motion');

  constructor(private root:HTMLElement) {
    root.innerHTML=shell();
    this.box=root.querySelector('#aquarium')!;
    this.canvas=root.querySelector('#tank')!;
    this.panels=root.querySelector('#panelRoot')!;
    this.toast=root.querySelector('#toast')!;
    this.a=this.storage.token?this.empty():this.storage.local;
    this.sounds.enabled=flag('sound');
    this.applyMotion();
    this.world.onEvent=kind=>this.sounds.play(kind);
    this.fullscreen=new Fullscreen(active=>{
      const control=this.root.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')!;
      const label=active?'Tam ekrandan çık':'Tam ekran';
      control.title=label;control.setAttribute('aria-label',label);
      control.innerHTML=icon(active?'smaller':'fullscreen',20);
    },this.notice);
    this.syncPortrait();
    this.wire();
    void this.init();
  }

  private empty(){ return {...this.storage.local,fish:[],props:[],unlocks:[],activity:[]}; }
  private get owner(){return this.storage.token?this.storage.session?.role==='owner':true;}
  private get selected(){return this.a.fish.find(f=>f.id===this.fishId);}
  private get form(){return this.panels.querySelector<HTMLFormElement>('#fishForm');}

  private async init(){
    try {
      this.game=await startGame(this.canvas,this.world,this.blockers,n=>{
        this.notice(`${n} çizim yüklenemedi. Sayfayı yenileyerek tekrar dene.`);
      });
      this.ready=true;
      this.update();
      if(this.storage.configured || this.storage.token) await this.refresh(false);
      if(!this.storage.token && !flag('hint')) {
        this.notice('Bir balığa dokun, hatırasını aç.',3800);
        setFlag('hint',true);
      }
      if(import.meta.env.VITE_TEST_HOOK==='1') Object.assign(window,{__bluplab:this.world});
    } catch {
      const loader=this.root.querySelector('#loader')!;
      loader.innerHTML=`<div>Akvaryum açılamadı. ${button('Tekrar dene','reload',{cls:'primary'})}</div>`;
      this.box.classList.add('engine-error');
      return;
    }
    this.root.querySelector<HTMLElement>('#loader')!.hidden=true;
  }

  private wire(){
    this.root.addEventListener('click',event=>{
      if(!(event.target instanceof Element)) return;
      const control=event.target.closest<HTMLElement>('[data-action]');
      if(!control || (control instanceof HTMLButtonElement && control.disabled)) return;
      this.sounds.unlock();
      void this.act(control.dataset.action!,control.dataset.id,control).catch(this.failure);
    });
    this.root.addEventListener('change',event=>{
      const el=event.target;
      if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      if(this.form?.contains(el)) this.editor?.preview(this.form,this.panels);
      if(el.id==='categoryFilter' || el.id==='orderFilter'){
        if(el.id==='categoryFilter') this.memories.category=el.value; else this.memories.order=el.value;
        this.render(false);
        this.panels.querySelector<HTMLElement>('#'+el.id)?.focus();
      }
      if(el instanceof HTMLInputElement && el.id==='importFile' && el.files?.[0])
        void this.restore(el.files[0]).catch(this.failure);
    });
    this.root.addEventListener('submit',event=>{
      if(event.target!==this.form) return;
      event.preventDefault();
      void this.saveFish(this.form!).catch(this.failure);
    });
    this.canvas.addEventListener('pointerdown',this.pointerDown);
    this.canvas.addEventListener('pointermove',this.pointerMove);
    this.canvas.addEventListener('pointerup',this.pointerUp);
    this.canvas.addEventListener('pointercancel',this.pointerCancel);
    this.canvas.addEventListener('pointerleave',()=>{this.lastPoint=undefined;this.world.track();});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && !this.saving && !(this.root.querySelector<HTMLDialogElement>('#confirm')?.open)){
        if(this.page) {event.preventDefault();void this.close().catch(this.failure);}
        else if(this.mode) this.setMode(null);
      }
      if(this.page==='decor' && this.decor?.preview && !(event.target instanceof HTMLInputElement)){
        const key=['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'].indexOf(event.key);
        if(key>=0){event.preventDefault();this.decor.nudge(key);this.syncDecor();}
      }
    });
    window.addEventListener('resize',this.syncPortrait,{passive:true});
    window.addEventListener('orientationchange',this.syncPortrait,{passive:true});
    this.motion.addEventListener('change',this.applyMotion);
    window.addEventListener('online',()=>{if(this.storage.token && !this.saving) void this.refresh(false);});
    window.addEventListener('focus',()=>{
      if(this.storage.token && !this.saving && !this.page) void this.refresh(false);
    });
  }

  private syncPortrait=()=>{
    const {innerWidth:width,innerHeight:height}=window;
    const layout=document.documentElement;
    const portrait=width<=900 && width<height;
    // On some WebKit rotations the viewport dimensions update before the CSS layout viewport.
    const waitingForLayout=(width<height)!==(layout.clientWidth<layout.clientHeight);
    if(waitingForLayout){
      this.root.style.setProperty('--viewport-width',width+'px');
      this.root.style.setProperty('--viewport-height',height+'px');
    }else{
      this.root.style.removeProperty('--viewport-width');
      this.root.style.removeProperty('--viewport-height');
    }
    const turn=portrait&&!this.portraitAllowed;
    this.box.inert=turn;
    this.root.classList.toggle('portrait-bypass',portrait&&this.portraitAllowed);
    this.root.classList.toggle('portrait-on',turn);
  };
  private applyMotion=()=>{
    this.world.reduced=this.reduced||this.motion.matches;
    this.root.classList.toggle('reduce-motion',this.world.reduced);
  };

  private blockers=():Rect[]=>{
    const box=this.canvas.getBoundingClientRect();
    const matches=this.root.querySelectorAll<HTMLElement>('.panel,.dock,.top-tools,.brand,.aquarium-count');
    return Array.from(matches,node=>{
      const b=node.getBoundingClientRect();
      return {x:b.x-box.x,y:b.y-box.y,w:b.width,h:b.height};
    }).filter(rect=>rect.w>0&&rect.h>0);
  };

  private update(welcome?:string){
    if(this.ready) this.world.sync(this.a,welcome);
    if(this.decor) this.syncDecor();
    const count=this.root.querySelector('#fishCount');
    if(count) count.textContent=`${this.a.fish.length} balık`;
    this.root.classList.toggle('viewer',!this.owner);
    for(const key of ['new','decor']) {
      const control=this.root.querySelector<HTMLButtonElement>(`.dock [data-action="${key}"]`)!;
      control.hidden=!this.owner;
    }
    if(this.selected && this.page==='fish') this.world.selected=this.selected.id; else this.world.selected=undefined;
    this.world.blockers=this.blockers();
  }

  private render(focus=true){
    const scroll=this.panels.querySelector('.panel-scroll')?.scrollTop??0;
    const selected=this.selected;
    const panels:Record<Exclude<Page,null>,()=>string>={
      fish:()=>selected?panel('Balığın hatırası','fish',memoryCard(selected,this.owner),this.previous?'memories':undefined):'',
      new:()=>this.editor&&this.owner?panel('Yeni balık','new',fishForm(this.editor.data,false)):'',
      edit:()=>this.editor&&this.owner?panel('Hatırayı düzenle','edit',fishForm(this.editor.data,true),'back-fish'):'',
      memories:()=>panel('Hatıralar','book',memoryList(this.a,this.memories,this.owner)),
      decor:()=>this.decor&&this.owner?panel('Akvaryumu süsle','decor',decorPanel({...this.a,props:this.decor.draft},this.decor.type,this.decor.changed,this.decor.existing)):'',
      settings:()=>panel('Ayarlar','settings',settings({
        sound:this.sounds.enabled,reduced:this.world.reduced,motionLocked:this.motion.matches,cloud:this.storage.configured,signed:!!this.storage.token,
        owner:this.owner,role:this.storage.session?.role,viewerLink:this.visitorLink,error:this.cloudError,
      })),
    };
    this.panels.innerHTML=this.page?panels[this.page]():'';
    this.root.dataset.panel=this.page??'';
    if(!focus && this.panels.querySelector('.panel-scroll')) this.panels.querySelector('.panel-scroll')!.scrollTop=scroll;
    if(focus) this.panels.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});
    this.update();
    requestAnimationFrame(()=>{this.world.blockers=this.blockers();});
  }

  private async leaveDecor(){
    if(this.decor?.changed && !(await this.ask('Süslemeyi bırak?', 'Kaydedilmemiş değişiklikler bu akvaryuma eklenmeyecek.','Bırak'))) return false;
    this.decor=undefined;this.world.preview=undefined;
    return true;
  }
  private async close(){
    if(this.decor && !await this.leaveDecor()) return;
    this.page=null;this.editor=undefined;this.fishId=undefined;this.previous=null;
    this.render();
    this.openingFocus?.focus({preventScroll:true});
    this.openingFocus=undefined;
  }
  private async show(page:Exclude<Page,null>,source?:HTMLElement){
    if(this.page==='decor' && page!=='decor' && !await this.leaveDecor()) return false;
    if(!this.page && source) this.openingFocus=source;
    this.setMode(null);
    this.page=page;
    return true;
  }
  private async inspect(id:string,fromMemory=false){
    if(!this.a.fish.some(f=>f.id===id) || !await this.show('fish')) return;
    this.previous=fromMemory?'memories':null;
    this.fishId=id;
    this.render();
  }

  private setMode(mode:Mode){
    this.mode=mode;
    this.canvas.dataset.mode=mode??'';
    this.world.track();
    const hint=this.root.querySelector<HTMLElement>('#hint')!;
    hint.hidden=!mode;
    hint.querySelector('span')!.textContent=mode==='feed'?'Yem bırakmak için suya dokun.':'Kabarcık çıkarmak için suya dokun.';
    for(const name of ['feed','bubbles']) {
      this.root.querySelector(`[data-action="${name}"]`)?.setAttribute('aria-pressed',String(mode===name));
    }
  }

  private point(event:PointerEvent){
    const rect=this.canvas.getBoundingClientRect();
    return {x:event.clientX-rect.x,y:event.clientY-rect.y};
  }
  private pointerDown=(event:PointerEvent)=>{
    if(!this.ready || !event.isPrimary || event.button!==0 || this.saving) return;
    this.sounds.unlock();
    const point=this.point(event);
    const kind=this.decor?'decor':this.page?'outside':'water';
    this.input={id:event.pointerId,origin:point,kind,moved:false};
    if(kind==='decor'){
      const editor=this.decor!;
      if(!editor.preview){
        const prop=this.world.pickProp(point,this.game!.renderer.rect);
        if(prop) editor.select(prop.id);
      } else editor.position(point);
      this.syncDecor();this.renderDecorActions();
    }
    try { this.canvas.setPointerCapture(event.pointerId); } catch { /* Pointer already ended. */ }
  };
  private pointerMove=(event:PointerEvent)=>{
    if(!event.isPrimary || !this.ready) return;
    const point=this.point(event);
    const start=this.input;
    if(start && Math.hypot(point.x-start.origin.x,point.y-start.origin.y)>7) start.moved=true;
    if(start?.kind==='decor' && this.decor?.preview){
      this.decor.position(point);
      this.syncDecor();
      return;
    }
    if(this.page || this.mode || (event.pointerType!=='mouse'&&!start?.moved)) return;
    const last=this.lastPoint, t=performance.now();
    this.lastPoint={...point,t};
    if(last && t-last.t<260 && Math.hypot(point.x-last.x,point.y-last.y)<Math.max(9,(t-last.t)*.55)) this.world.track(point);
    else this.world.track();
  };
  private pointerUp=(event:PointerEvent)=>{
    const input=this.input;
    if(!input||input.id!==event.pointerId) return;
    const p=this.point(event);
    this.pointerCancel();
    if(input.kind==='decor'){
      if(this.decor?.preview && (input.moved || !this.decor.existing)){
        this.decor.position(p);this.commitDecor();
      }
      return;
    }
    if(input.moved) return;
    if(input.kind==='outside') { void this.close().catch(this.failure); return; }
    if(this.mode==='feed'){this.world.addFood(p);this.sounds.play('food');return;}
    if(this.mode==='bubbles'){this.world.addBubbles(p,4);this.sounds.play('pop');return;}
    const f=this.world.pickFish(p);
    if(f){this.world.touch(f,p);void this.inspect(f.data.id).catch(this.failure);}
  };
  private pointerCancel=()=>{this.input=undefined;this.lastPoint=undefined;this.world.track();};

  private syncDecor(){
    if(!this.decor) return;
    this.world.preview=this.decor.preview;
    this.world.props=[...this.decor.draft].sort((a,b)=>a.y-b.y);
  }
  private renderDecorActions(){
    if(!this.decor) return;
    const root=this.panels.querySelector('#decorDraft');
    if(root) root.innerHTML=decorActions(this.decor.changed,this.decor.existing,!!this.decor.preview);
    for(const control of this.panels.querySelectorAll<HTMLElement>('[data-action="decor-type"]')) {
      control.setAttribute('aria-pressed',String(Number(control.dataset.id)===this.decor.type));
    }
  }
  private commitDecor(){
    if(!this.decor?.preview) return;
    this.decor.commit();this.sounds.play('place');this.render(false);
  }

  private async act(action:string,id:string|undefined,control:HTMLElement){
    if(action==='fullscreen'){await this.fullscreen.toggle();return;}
    if(this.saving) return;
    if(action==='portrait'){this.portraitAllowed=true;this.syncPortrait();this.root.querySelector<HTMLElement>('[data-action="settings"]')?.focus();return;}
    if(action==='reload'){location.reload();return;}
    if(action==='close'){await this.close();return;}
    if(action==='cancel-mode'){this.setMode(null);return;}
    if(action==='feed'||action==='bubbles'){
      if(!this.ready) return;
      if(this.page && this.page!=='decor') await this.close();
      if(this.page==='decor' && !await this.leaveDecor()) return;
      if(this.page==='decor'){this.page=null;this.render();}
      this.setMode(this.mode===action?null:action);return;
    }
    if(action==='settings'||action==='memories'){
      if(await this.show(action,control)) this.render();
      return;
    }
    if(action==='inspect' && id){await this.inspect(id,true);return;}
    if(action==='back-fish'){this.editor=undefined;this.page='fish';this.render();return;}
    if(action==='sound'||action==='motion'){
      if(action==='sound'){
        this.sounds.enabled=!this.sounds.enabled;setFlag('sound',this.sounds.enabled);this.sounds.unlock();this.sounds.play('pop');
      }else {this.reduced=!this.reduced;this.applyMotion();setFlag('motion',this.reduced);}
      this.render(false);this.panels.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus();return;
    }
    if(action==='refresh'){await this.refresh(true);return;}
    if(action==='enable-cloud'){await this.enableCloud();return;}
    if(action==='signout'){
      if(await this.ask('Bu cihazdan çık?', 'Çevrimiçi akvaryumu yeniden açmak için erişim bağlantın gerekir.','Çık')){
        this.a=this.storage.disconnect();this.cloudError=undefined;this.visitorLink=undefined;this.render(false);
      }
      return;
    }
    if(!this.owner) return;

    if(action==='new'){
      if(this.a.fish.length>=MAX_FISH){this.notice('Akvaryumdaki balık sınırına ulaşıldı.');return;}
      if(await this.show('new',control)){this.editor=new FishEditor();this.render();}
      return;
    }
    if(action==='edit'||action==='milestone-add'){
      const f=this.selected;
      if(!f) return;
      if(await this.show('edit')){
        this.editor=new FishEditor(f);this.render();
        if(action==='milestone-add' && this.form) this.editor.append(this.form);
      }
      return;
    }
    if(action==='delete'){await this.deleteFish();return;}
    if((action==='milestone'||action==='milestone-undo') && id){await this.milestone(id,action==='milestone-undo');return;}
    if(this.editor && this.form){
      if(action==='species') this.editor.preview(this.form,this.panels,Number(id));
      if(action==='definition-add') this.editor.append(this.form);
      if(action==='definition-remove') control.closest('[data-milestone]')?.remove();
    }
    if(action==='decor'){
      if(await this.show('decor',control)){
        this.decor??=new DecorEditor(this.a.props,this.world);
        this.render();
      }
      return;
    }
    if(action.startsWith('decor-')){await this.decorAction(action,id);return;}
    if(action==='owner-link'){await this.copy(this.storage.link(),'Sahip bağlantısı kopyalandı.');return;}
    if(action==='invite'||action==='revoke'){
      const revoke=action==='revoke';
      if(revoke && !await this.ask('Ziyaretçi erişimi kapatılsın mı?','Daha önce verdiğin ziyaretçi bağlantısı çalışmayı bırakacak.','Erişimi kapat')) return;
      await this.busy(control,async()=>{
        const token=await this.storage.invite(revoke);
        this.visitorLink=token?this.storage.link(token):undefined;
        this.render(false);
        this.notice(token?'Ziyaretçi bağlantısı hazır. Eski bağlantılar kapandı.':'Ziyaretçi erişimi kapatıldı.');
      });
      return;
    }
    if(action==='copy-viewer' && this.visitorLink){await this.copy(this.visitorLink,'Ziyaretçi bağlantısı kopyalandı.');return;}
    if(action==='export'){this.storage.export(this.a);return;}
    if(action==='import') this.panels.querySelector<HTMLInputElement>('#importFile')?.click();
  }

  private async decorAction(action:string,id?:string){
    if(!this.decor) return;
    const editor=this.decor,n=Number(id);
    if(action==='decor-locked'){this.notice(n===9?'Minik çapa ilk onaylı duraktan sonra açılır.':'Hazine sandığı üç onaylı duraktan sonra açılır.');return;}
    if(action==='decor-type' && available(n,this.a)){
      if(!editor.choose(n)) this.notice('Akvaryumda yeni bir süs için yer kalmadı.');
    }
    if(action==='decor-select' && id) editor.select(id);
    if(action==='decor-nudge') editor.nudge(n);
    if(action==='decor-remove') {editor.remove();this.render(false);return;}
    if(action==='decor-commit'){this.commitDecor();return;}
    if(action==='decor-save'){
      if(!editor.changed) return;
      const props=editor.merge(this.a.props);
      await this.save({...this.a,props});
      this.decor=new DecorEditor(this.a.props,this.world);
      this.render(false);
      this.notice('Süsler kaydedildi.');
      return;
    }
    this.syncDecor();this.renderDecorActions();
  }

  private async saveFish(form:HTMLFormElement){
    if(!this.owner || this.saving || !this.editor) return;
    const edit=this.page==='edit';
    const error=form.querySelector<HTMLElement>('.form-error')!;
    error.hidden=true;
    try{
      const fish=this.editor.value(form);
      const earlier=this.a.fish.find(item=>item.id===fish.id);
      if(edit && !earlier) throw Error('Bu balık başka bir cihazda kaldırılmış.');
      if(edit && earlier && earlier.updatedAt!==this.editor.data.updatedAt && !await this.ask(
        'Bu balık başka bir cihazda düzenlendi.','Bu formdaki bilgileri kaydetmek diğer düzenlemelerin yerine geçer.','Bu sürümü kaydet')) return;
      if(earlier?.milestones.some(m=>m.confirmedAt&&!fish.milestones.some(s=>s.id===m.id)) && !await this.ask(
        'Onaylı duraklar kaldırılsın mı?','Kaldırılan duraklar bu hatıranın geçmişinden silinir.','Kaydet')) return;
      const list=edit?this.a.fish.map(f=>f.id===fish.id?fish:f):[...this.a.fish,fish];
      await this.busy(form.querySelector('button[type="submit"]')!,async()=>this.save({...this.a,fish:list},edit?undefined:fish.id));
      this.editor=undefined;this.fishId=fish.id;
      if(edit){this.page='fish';this.render();}
      else {await this.close();this.sounds.play('new');this.notice(`${fish.name} akvaryuma katıldı!`);}
    }catch(err){
      error.hidden=false;error.textContent=err instanceof Error?err.message:'Balık kaydedilemedi.';
    }
  }

  private async deleteFish(){
    const fish=this.selected;
    if(!fish || !await this.ask('Balık akvaryumdan ayrılsın mı?',`${fish.name} ve ona ait hatıra ile duraklar kaldırılacak.`,'Balığı sil')) return;
    await this.save({...this.a,fish:this.a.fish.filter(f=>f.id!==fish.id)});
    await this.close();this.notice('Balık akvaryumdan ayrıldı.');
  }

  private async milestone(id:string,undo:boolean){
    const fish=this.selected;
    const m=fish?.milestones.find(m=>m.id===id);
    if(!fish||!m || Boolean(m.confirmedAt)===!undo) return;
    if(!await this.ask(undo?'Durak onayı geri alınsın mı?':'Bu durağı onayla',m.label,undo?'Onayı geri al':'Onayla')) return;
    const copy:Fish={...fish,updatedAt:now(), milestones:fish.milestones.map(m=>m.id===id?{...m,confirmedAt:undo?null:now()}:m)};
    const before=this.a.unlocks.length;
    await this.save({...this.a,fish:this.a.fish.map(f=>f.id===fish.id?copy:f)});
    this.render(false);
    if(!undo){
      const f=this.world.fish.find(f=>f.data.id===fish.id);
      if(f) this.world.triggerSpecial(f,'shine');
      this.sounds.play('milestone');
      this.notice(this.a.unlocks.length>before?'Durak kaydedildi. Yeni bir süs açıldı!':'Durak hatıraya eklendi.');
    }else this.notice('Durak onayı geri alındı.');
  }

  private async save(value:Aquarium,welcome?:string){
    if(this.saving || !this.owner) throw new Error('Kayıt zaten sürüyor veya düzenleme yetkin yok.');
    this.saving=true;
    try{
      this.a=await this.storage.save(value);
      this.cloudError=undefined;
      this.update(welcome);
    }catch(error){
      if(error instanceof StorageError && error.status===409){
        await this.refresh(false,true);
      }
      throw error;
    }finally { this.saving=false; }
  }

  private async restore(file:File){
    if(file.size>900_000) throw new Error('Yedek dosyası çok büyük.');
    let aquarium:Aquarium;
    try {aquarium=parseAquarium(JSON.parse(await file.text()));}
    catch {throw new Error('Bu dosya geçerli bir BlupLab yedeği değil.');}
    if(!await this.ask('Yedeği içe aktar?', 'Yedek bu akvaryumdaki mevcut balıkların ve süslerin yerine geçecek.','Yedeği yükle')) return;
    await this.save(aquarium);
    this.render(false);this.notice('Yedek yüklendi.');
  }

  private async refresh(manual:boolean,duringSave=false){
    if(this.refreshing || (this.saving&&!duringSave)) return;
    this.refreshing=true;
    try{
      const old=this.storage.session?.revision;
      const session=await this.storage.open();
      if(session){
        this.a=session.aquarium;this.cloudError=undefined;this.update();
        if(this.page==='fish' && !this.selected){this.page='memories';this.render(false);}
        else if(this.page==='settings'||this.page==='memories'||(this.page==='fish'&&old!==session.revision)) this.render(false);
      }
      if(manual) this.notice('Akvaryum güncel.');
    }catch(error){
      this.cloudError=error instanceof Error?error.message:'Çevrimiçi akvaryum yüklenemedi.';
      if(error instanceof StorageError && error.status===401){
        this.a=this.empty();this.storage.session=undefined;this.page='settings';this.update();
      }
      if(this.storage.token && !this.storage.session){this.page='settings';this.render();}
      else if(this.page==='settings') this.render(false);
      this.notice(this.cloudError);
    }finally {this.refreshing=false;}
  }

  private async enableCloud(){
    if(this.saving || this.storage.token || !this.storage.configured) return;
    this.saving=true;
    this.cloudError=undefined;
    const control=this.panels.querySelector<HTMLElement>('[data-action="enable-cloud"]');
    try{
      if(control) control.setAttribute('disabled','');
      const session=await this.storage.enable();
      this.a=session.aquarium;this.render(false);
      this.notice('Çevrimiçi kayıt açıldı. Sahip bağlantını sakla.');
    }catch(error){
      this.cloudError=error instanceof Error?error.message:'Çevrimiçi kayıt açılamadı.';
      this.render(false);
    }finally {this.saving=false;}
  }

  private async busy(control:HTMLElement,job:()=>Promise<unknown>){
    control.setAttribute('disabled','');
    try {await job();} finally {control.removeAttribute('disabled');}
  }
  private async copy(value:string,message:string){
    try {await navigator.clipboard.writeText(value);this.notice(message);}
    catch {
      const visitor=this.panels.querySelector<HTMLInputElement>('#visitor-url');
      if(visitor?.value===value) visitor.select();
      else window.prompt('Bağlantıyı kopyala',value);
    }
  }
  private ask(title:string,detail:string,accept:string):Promise<boolean>{
    const el=this.root.querySelector<HTMLDialogElement>('#confirm')!;
    if(el.open) return Promise.resolve(false);
    el.querySelector('#confirm-title')!.textContent=title;
    el.querySelector('#confirm-text')!.textContent=detail;
    el.querySelector('#confirm-ok')!.textContent=accept;
    el.returnValue='';
    el.showModal();
    return new Promise(resolve=>el.addEventListener('close',()=>resolve(el.returnValue==='yes'),{once:true}));
  }
  private notice=(message:string,time=3600)=>{
    window.clearTimeout(this.settle);
    this.toast.textContent=message;this.toast.hidden=false;
    this.settle=window.setTimeout(()=>{this.toast.hidden=true;},time);
  };
  private failure=(error:unknown)=>this.notice(error instanceof Error?error.message:'İşlem tamamlanamadı.');
}
