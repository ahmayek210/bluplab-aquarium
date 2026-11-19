const root=self.registration.scope;
const cacheName='bluplab-v1:'+root;
const art=[...Array.from({length:10},(_,i)=>'fish-'+i+'.webp'),...Array.from({length:10},(_,i)=>'decor-'+i+'.webp'),'west.webp','water.webp','east.webp','icon-192.png','icon-512.png'].map(f=>'art/'+f);
const absolute=(f)=>new URL(f,root).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  const response=await fetch(root,{cache:'reload'});
  if(!response.ok) throw Error('Shell unavailable');
  const html=await response.clone().text();
  const entrypoints=[...html.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+|assets\/[^"]+)"/g)].map(match=>match[1]);
  await cache.addAll([...new Set(['aquarium.webmanifest',...art,...entrypoints])].map(absolute));
  for(const path of entrypoints.filter(path=>path.endsWith('.css'))){
    const style=absolute(path);
    const css=await (await cache.match(style)).text();
    const fonts=Array.from(css.matchAll(/url\(([^)]+\.woff2)\)/g),match=>new URL(match[1].replace(/["']/g,''),style).href);
    await cache.addAll([...new Set(fonts)]);
  }
  await cache.put(root,response);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(key=>key.startsWith('bluplab-')&&key.endsWith(':'+root)&&key!==cacheName).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const {request}=event;
  const url=new URL(request.url);
  if(request.method!=='GET'||!url.href.startsWith(root)||request.headers.has('authorization')) return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    if(request.mode==='navigate'){
      try { return await fetch(request); } catch { return await cache.match(root,{ignoreVary:true}) || Response.error(); }
    }
    // Vite and Pages can vary public files by Origin. Cors and navigation request modes share these bytes.
    const cached=await cache.match(url.href,{ignoreVary:true});
    if(cached) return cached;
    const response=await fetch(request);
    if(response.ok && url.pathname.includes('/assets/')) await cache.put(request,response.clone());
    return response;
  })());
});
