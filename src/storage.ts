import { aquariumSchema, exampleAquarium, revise, type Aquarium, type Role } from './model';

export type Session = {role:Role;aquarium:Aquarium;revision:number;id:string};
const API=import.meta.env.VITE_AQUARIUM_API?.replace(/\/$/,'') as string|undefined;
const localKey='bluplab.aquarium.v1';
const key='bluplab.key.v1';
const pendingKey='bluplab.pending.v1';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
export function read(k:string) {
  try { return localStorage.getItem(k); } catch { return null; }
}
export function write(k:string,value:string|null) {
  if(value===null) localStorage.removeItem(k); else localStorage.setItem(k,value);
}
function tryWrite(k:string,value:string|null){try{write(k,value);}catch{/* Some private contexts block disk storage. */}}
export function flag(k:string){return read('bluplab.'+k)==='yes';}
export function setFlag(k:string,value:boolean){tryWrite('bluplab.'+k,value?'yes':null);}
export function makeToken() {
  const binary=String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)));
  return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

export class StorageError extends Error {
  constructor(readonly status:number, message:string){super(message);}
}

async function request(path:string,token:string,method='GET',value?:unknown) {
  if(!API) throw new StorageError(0,'Bu kurulumda çevrimiçi kayıt ayarlanmamış.');
  let response:Response;
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),15000);
  try {
    response=await fetch(API+path,{method,signal:controller.signal,
      headers:{Authorization:'Bearer '+token,...(value?{'content-type':'application/json'}:{})},
      body:value?JSON.stringify(value):undefined,
    });
  } catch { throw new StorageError(0,'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.'); }
  finally { clearTimeout(timeout); }
  if(!response.ok){
    const error:Record<number,string>={
      401:'Bu erişim bağlantısı geçersiz veya kaldırılmış.',
      403:'Bu işlem için sahip bağlantısı gerekli.',
      409:'Akvaryum başka bir cihazda güncellendi. Elindeki değişiklikleri kontrol et.',
      413:'Akvaryum verisi kayıt sınırını aştı.',
      422:'Gönderilen bilgiler doğrulanamadı.',
      429:'Çok fazla akvaryum denemesi yapıldı. Biraz sonra tekrar dene.',
    };
    throw new StorageError(response.status,error[response.status]??'Kayıt tamamlanamadı. Tekrar dene.');
  }
  return response.json();
}
export function parseAquarium(raw:unknown) {
  const parsed=aquariumSchema.safeParse(raw);
  if(!parsed.success) throw new StorageError(422,'Akvaryum biçimi geçerli değil.');
  return parsed.data;
}
export class Storage {
  readonly configured=Boolean(API);
  token:string|null;
  session?:Session;
  local:Aquarium;
  private pending=false;
  constructor(){
    const hash=new URLSearchParams(location.hash.slice(1));
    const incoming=hash.get('a');
    this.token=incoming!==null ? incoming : read(key);
    this.pending=incoming===null && !this.token && Boolean(read(pendingKey));
    const raw=read(localKey);
    try {
      this.local=raw?parseAquarium(JSON.parse(raw)):exampleAquarium();
    } catch { this.local=exampleAquarium(); }
    if(!raw) tryWrite(localKey,JSON.stringify(this.local));
    if(incoming!==null) history.replaceState(null,'',location.pathname+location.search);
  }
  async open():Promise<Session|undefined>{
    if(!this.token && !this.pending) return;
    if(!this.token && this.pending) return this.enable();
    if(!this.token || !tokenPattern.test(this.token)) throw new StorageError(401,'Geçersiz erişim bağlantısı.');
    const token=this.token;
    const session=await request('/aquarium',token) as Session;
    if(this.token!==token) return;
    if(this.session && session.revision<this.session.revision) return this.session;
    session.aquarium=parseAquarium(session.aquarium);
    this.session=session;
    tryWrite(key,token);
    return this.session;
  }
  async enable(){
    // Retain the same creation key so a timeout cannot create a duplicate world.
    const token=read(pendingKey) || makeToken();
    tryWrite(pendingKey,token);
    this.pending=true;
    const session=await request('/aquarium',token,'POST',{aquarium:this.local}) as Session;
    session.aquarium=parseAquarium(session.aquarium);
    if(!this.pending) throw new StorageError(0,'Çevrimiçi oturum kapatıldı.');
    this.token=token;this.session=session;this.pending=false;
    tryWrite(key,token);tryWrite(pendingKey,null);
    return this.session;
  }
  async save(aquarium:Aquarium){
    aquarium=parseAquarium(aquarium);
    if(this.token){
      if(!this.session || this.session.role!=='owner') throw new StorageError(403,'Bu akvaryum salt okunur.');
      const token=this.token;
      const session=await request('/aquarium',token,'PUT',{aquarium,revision:this.session.revision}) as Session;
      if(this.token!==token) throw new StorageError(0,'Çevrimiçi oturum kapatıldı.');
      session.aquarium=parseAquarium(session.aquarium);
      this.session=session;
      return session.aquarium;
    }
    aquarium=revise(aquarium,this.local);
    try { write(localKey,JSON.stringify(aquarium)); }
    catch { throw new StorageError(0,'Tarayıcı bu değişikliği kaydedemedi. Depolama alanını kontrol et.'); }
    this.local=aquarium;
    return aquarium;
  }
  async invite(revoke=false) {
    if(!this.token || this.session?.role!=='owner') throw new StorageError(403,'Sahip bağlantısı gerekli.');
    return (await request('/viewer',this.token,revoke?'DELETE':'POST') as {token:string|null}).token;
  }
  link(token=this.token){
    const url=new URL(location.pathname,location.origin);
    url.hash=new URLSearchParams({a:token??''}).toString();
    return url.href;
  }
  disconnect(){
    this.token=null;this.session=undefined;this.pending=false;
    tryWrite(key,null);tryWrite(pendingKey,null);
    return this.local;
  }
  export(aquarium:Aquarium) {
    const a=document.createElement('a');
    const url=URL.createObjectURL(new Blob([JSON.stringify(aquarium,null,2)],{type:'application/json'}));
    a.href=url;a.download='bluplab-hatiralar.json';a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
}
