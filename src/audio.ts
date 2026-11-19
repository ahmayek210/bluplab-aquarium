export class Sounds {
  private context?:AudioContext;
  enabled=false;
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if(this.context.state !== 'running') void this.context.resume().catch(()=>{});
    } catch { /* Audio is optional. */ }
  }
  play(kind:'pop'|'food'|'fish'|'new'|'milestone'|'place') {
    const context=this.context;
    if(!this.enabled || !context || context.state!=='running') return;
    const start=context.currentTime;
    const notes={pop:[480],food:[330],fish:[410],new:[349,466,587],milestone:[440,554,659],place:[270]}[kind];
    notes.forEach((frequency,i)=>{
      const t=start+i*.09;
      const note=context.createOscillator();
      const gain=context.createGain();
      note.type='sine';
      note.frequency.setValueAtTime(frequency,t);
      note.frequency.exponentialRampToValueAtTime(frequency*(kind==='pop'?.62:1.07),t+.12);
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(.038,t+.022);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.19);
      note.connect(gain).connect(context.destination);
      note.start(t);
      note.stop(t+.20);
    });
  }
}
