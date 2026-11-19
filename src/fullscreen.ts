export class Fullscreen {
  constructor(private readonly changed:(active:boolean)=>void,private readonly notify:(message:string)=>void){
    document.addEventListener('fullscreenchange',this.refresh);
    window.addEventListener('resize',this.refresh,{passive:true});
    this.refresh();
  }
  private refresh=()=>this.changed(Boolean(document.fullscreenElement));
  async toggle(){
    if(document.fullscreenElement){
      try{ await document.exitFullscreen(); screen.orientation?.unlock?.(); }
      catch { this.notify('Tarayıcı tam ekrandan çıkamadı.'); }
      return;
    }
    if(typeof document.documentElement.requestFullscreen!=='function' || !document.fullscreenEnabled){
      this.notify('Tarayıcı tam ekranı desteklemiyor. Telefonu yana çevir veya ana ekrana ekleyerek aç.');
      return;
    }
    try { await document.documentElement.requestFullscreen(); }
    catch { this.notify('Tarayıcı tam ekrana geçişe izin vermedi. Telefonu yana çevirebilirsin.'); return; }
    const orientation=screen.orientation as ScreenOrientation & {lock?:(mode:string)=>Promise<void>};
    try {
      if(typeof orientation?.lock==='function') await orientation.lock('landscape');
      else if(innerHeight>innerWidth) this.notify('Yatay görünüm için telefonu yana çevir.');
    } catch {
      if(innerHeight>innerWidth) this.notify('Yatay görünüm için telefonu yana çevir.');
    }
    this.refresh();
  }
}
