export function art(name:string) {
  return new URL(`art/${name}.webp`, new URL(import.meta.env.BASE_URL, location.href)).href;
}

export async function loadArt() {
  const keys = [...Array.from({length:10},(_,i)=>`fish-${i}`),
    ...Array.from({length:10},(_,i)=>`decor-${i}`),'west','water','east'];
  const entries = await Promise.all(keys.map(async key=>{
    const img=new Image();
    img.src=art(key);
    try { await img.decode(); } catch { return [key,null] as const; }
    return [key,img] as const;
  }));
  return Object.fromEntries(entries);
}
