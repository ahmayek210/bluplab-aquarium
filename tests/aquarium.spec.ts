import { expect, test, type Page } from '@playwright/test';

const open=async(page:Page,path='./')=>{
  await page.goto(path);
  await expect(page.locator('#loader')).toBeHidden();
};
const action=(page:Page,data:string)=>page.locator(`[data-action="${data}"]`);
const tips=(page:Page)=>page.getByRole('status').filter({hasText:/kaydedildi/});
const dialogYes=(page:Page)=>page.locator('#confirm-ok').click();
const waitForMovement=async(page:Page)=>{
  const before=await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL());
  await expect.poll(()=>page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL()),{timeout:4000}).not.toBe(before);
};

test.beforeEach(async({context})=>{
  await context.addInitScript(()=>localStorage.setItem('bluplab.hint','yes'));
});

test('tank adapts to seven landscape phones, tablet, desktop, and portrait transitions',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,hasTouch:true,isMobile:true,deviceScaleFactor:2,viewport:{width:667,height:375}});
  const page=await context.newPage();
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  await open(page);
  for(const [width,height] of [[667,375],[740,360],[812,375],[844,390],[852,393],[915,412],[932,430],[1024,768],[1440,900]]){
    await page.setViewportSize({width,height});
    await expect(page.locator('.dock')).toBeVisible();
    const bounds=await page.locator('#tank').boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(width-28);
    expect(bounds?.height).toBeGreaterThanOrEqual(height-28);
    await action(page,'memories').click();
    await expect(page.getByRole('heading',{name:'Hatıralar'})).toBeVisible();
    const panel=await page.locator('.panel').boundingBox();
    expect(panel!.x+panel!.width).toBeLessThanOrEqual(width+1);
    expect(panel!.y+panel!.height).toBeLessThanOrEqual(height+1);
    await action(page,'close').click();
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Telefonu yan çevir!'})).toBeVisible();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('heading',{name:'Telefonu yan çevir!'})).toBeHidden();
  await expect(page.locator('#fishCount')).toHaveText('6 balık');
  await waitForMovement(page);
  await page.setViewportSize({width:390,height:844});
  await action(page,'portrait').click();
  await expect(action(page,'memories')).toBeVisible();
  await action(page,'memories').click();
  await expect(page.getByRole('heading',{name:'Hatıralar'})).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('tap a fish, feed, play bubbles, browse stories, and handle fullscreen refusals',async({page})=>{
  await open(page);
  const world=async()=>page.evaluate(()=>Boolean((window as Window & {__bluplab?:unknown}).__bluplab));
  const bounds=await page.locator('#tank').boundingBox();
  if(await world()){
    const fish=await page.evaluate(()=>{
      const tank=(window as any).__bluplab;
      return {x:tank.fish[0].x,y:tank.fish[0].y};
    });
    await page.mouse.click(bounds!.x+fish.x,bounds!.y+fish.y);
    await expect(page.getByRole('heading',{name:'Pofuduk'})).toBeVisible();
  }else{
    await page.mouse.click(bounds!.x+bounds!.width*.36,bounds!.y+bounds!.height*.32);
    await expect(page.getByRole('heading',{name:'Balığın hatırası'})).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel')).toHaveCount(0);
  await action(page,'feed').click();
  await page.mouse.click(bounds!.x+bounds!.width*.45,bounds!.y+bounds!.height*.41);
  await expect(page.locator('#hint')).toContainText('Yem bırakmak');
  if(await world()) await expect.poll(()=>page.evaluate(()=>(window as any).__bluplab.counts.eaten)).toBeGreaterThan(0);
  await action(page,'bubbles').click();
  if(await world()){
    const f=await page.evaluate(()=>{
      const tank=(window as any).__bluplab;
      const playful=tank.fish[1];
      playful.socialCool=0;
      return {x:playful.x,y:playful.y};
    });
    await page.mouse.click(bounds!.x+f.x,bounds!.y+f.y);
    await expect.poll(()=>page.evaluate(()=>(window as any).__bluplab.counts.popped)).toBeGreaterThan(0);
  }else await page.mouse.click(bounds!.x+bounds!.width*.60,bounds!.y+bounds!.height*.50);
  await expect(page.locator('#hint')).toContainText('Kabarcık');
  await action(page,'memories').click();
  await page.locator('#categoryFilter').selectOption('music');
  await expect(page.locator('.timeline-card')).toHaveCount(1);
  await expect(page.locator('.timeline-card')).toContainText('Bir şarkı önerisi');
  await action(page,'close').click();
  await page.evaluate(()=>Object.defineProperty(screen.orientation,'lock',{configurable:true,value:()=>Promise.reject(new DOMException('Unsupported','NotSupportedError'))}));
  await action(page,'fullscreen').click();
  await expect.poll(()=>page.evaluate(()=>Boolean(document.fullscreenElement))).toBe(true);
  await expect(action(page,'fullscreen')).toHaveAccessibleName('Tam ekrandan çık');
  await page.evaluate(()=>document.exitFullscreen());
  await expect(action(page,'fullscreen')).toHaveAccessibleName('Tam ekran');
  await page.evaluate(()=>Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false}));
  await action(page,'fullscreen').click();
  await expect(page.locator('#toast')).toContainText('tarayıcı tam ekranı desteklemiyor',{ignoreCase:true});
});

async function addFish(page:Page,name:string,title:string,share=false,ongoing=false){
  await action(page,'new').click();
  await page.getByLabel('Balığın adı').fill(name);
  await page.getByLabel('Hatıranın başlığı').fill(title);
  await page.getByLabel('Hatıra',{exact:true}).fill('Tarayıcı doğrulaması için örnek bir hatıra.');
  await page.getByRole('button',{name:'Gülkuyruk',exact:true}).click();
  await page.getByLabel('Desen').selectOption('star');
  if(ongoing){
    await page.getByLabel('Hatıra türü').selectOption('ongoing');
    await action(page,'definition-add').click();
    await page.getByLabel('Durak adı').fill('İlk çizim');
  }
  if(share){
    await page.getByText('Ek bilgiler',{exact:true}).click();
    await page.getByLabel('Kimler görebilir?').selectOption('shared');
  }
  await page.getByRole('button',{name:'Akvaryuma ekle'}).click();
  await expect(page.locator('#toast')).toContainText(name+' akvaryuma katıldı');
}
async function findStory(page:Page,title:string){
  await action(page,'memories').click();
  await page.getByRole('button',{name:new RegExp(title)}).first().click();
}
test('create and edit a fish, confirm growth, place and drag decoration, and reload local saves',async({page})=>{
  await open(page);
  await addFish(page,'Misket','Kırmızı Defter',false,true);
  await findStory(page,'Kırmızı Defter');
  await expect(page.getByRole('heading',{name:'Misket'})).toBeVisible();
  await action(page,'edit').click();
  await page.getByLabel('Balığın adı').fill('Misketçik');
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Misketçik'})).toBeVisible();
  await action(page,'milestone').click();
  await dialogYes(page);
  await expect(page.locator('.growth')).toContainText('Serpilmiş');
  await expect(page.locator('.growth')).toContainText('Hatıra ışıltısı');
  await action(page,'decor').click();
  await expect(page.getByRole('button',{name:'Minik çapa',exact:true})).toBeVisible();
  const coral=page.getByRole('button',{name:'Dal mercan',exact:true});
  await coral.click();
  const box=await page.locator('#tank').boundingBox();
  const x=box!.x+box!.width*.39, y=box!.y+box!.height*.79;
  await page.mouse.click(x,y);
  await page.mouse.move(x,y-13);
  await page.mouse.down();
  await page.mouse.move(x+28,y-4,{steps:5});
  await page.mouse.up();
  await action(page,'decor-save').click();
  await expect(tips(page)).toBeVisible();
  await page.reload();
  await expect(page.locator('#loader')).toBeHidden();
  await action(page,'decor').click();
  const details=page.getByText('Yerleştirilen süsler');
  await details.click();
  await expect(page.locator('.placed-list').getByRole('button',{name:'Dal mercan'})).toBeVisible();
  await findStory(page,'İlk çizim');
  await expect(page.getByRole('heading',{name:'Misketçik'})).toBeVisible();
  await expect(page.locator('.growth')).toContainText('Serpilmiş');
  await action(page,'delete').click();
  await dialogYes(page);
  await expect(page.locator('#toast')).toContainText('ayrıldı');
  await action(page,'memories').click();
  await expect(page.getByRole('button',{name:/Kırmızı Defter/})).toHaveCount(0);
});

test('all ten fish designs render in a 24-fish aquarium and the local world reopens offline',async({page,context})=>{
  await open(page);
  await page.evaluate(()=>{
    const key='bluplab.aquarium.v1';
    const aquarium=JSON.parse(localStorage.getItem(key)!);
    aquarium.fish=Array.from({length:24},(_,i)=>({...aquarium.fish[i%6],id:crypto.randomUUID(),species:i%10}));
    localStorage.setItem(key,JSON.stringify(aquarium));
  });
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const art=await page.evaluate(async()=>Promise.all(Array.from({length:10},async(_,i)=>{
    const img=new Image();img.src=new URL('art/fish-'+i+'.webp',location.href).href;
    await img.decode();return img.naturalWidth;
  })));
  expect(art.every(width=>width>100)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#loader')).toBeHidden();
  await expect(page.locator('#fishCount')).toHaveText('24 balık');
  await waitForMovement(page);
  await context.setOffline(false);
});

test('deployed backend synchronizes across two sessions and enforces viewer and revision checks',async({page,browser,baseURL})=>{
  test.setTimeout(85_000);
  await open(page);
  await action(page,'settings').click();
  test.skip(await action(page,'enable-cloud').count()===0,'No cloud endpoint configured for this build');
  const initialized=page.waitForResponse(r=>new URL(r.url()).pathname==='/aquarium' && r.request().method()==='POST');
  await action(page,'enable-cloud').click();
  const initial=await initialized;
  expect(initial.ok()).toBeTruthy();
  const api=initial.url();
  const baseline=await initial.json();
  await expect(page.getByText('Çevrimiçi · Akvaryum sahibi',{exact:true})).toBeVisible();
  await addFish(page,'Bulut','Ortak Gökyüzü',true);
  await addFish(page,'Gölge','Yalnızca Sahip');
  await action(page,'settings').click();
  await action(page,'invite').click();
  const viewerLink=await page.locator('#visitor-url').inputValue();
  const viewerToken=new URLSearchParams(new URL(viewerLink).hash.slice(1)).get('a')!;
  const ownerToken=await page.evaluate(()=>localStorage.getItem('bluplab.key.v1')) as string;
  const guest=await browser.newContext({baseURL});
  try{
    const sameOwner=await guest.newPage();
    const ownerUrl=new URL(viewerLink);
    ownerUrl.hash=new URLSearchParams({a:ownerToken}).toString();
    await open(sameOwner,ownerUrl.href);
    await findStory(sameOwner,'Yalnızca Sahip');
    await expect(sameOwner.getByRole('heading',{name:'Gölge'})).toBeVisible();
    await sameOwner.close();

    const viewer=await guest.newPage();
    await open(viewer,viewerLink);
    await expect(action(viewer,'new')).toBeHidden();
    await expect(action(viewer,'decor')).toBeHidden();
    await findStory(viewer,'Ortak Gökyüzü');
    await expect(viewer.getByRole('heading',{name:'Bulut'})).toBeVisible();
    await expect(action(viewer,'edit')).toHaveCount(0);
    await expect(action(viewer,'delete')).toHaveCount(0);
    await action(viewer,'memories').click();
    await expect(viewer.getByRole('button',{name:/Yalnızca Sahip/})).toHaveCount(0);
    await action(viewer,'feed').click();
    await expect(viewer.locator('#hint')).toContainText('Yem bırakmak');
    const viewerWrite=await viewer.request.put(api,{headers:{Authorization:'Bearer '+viewerToken},data:{aquarium:baseline.aquarium,revision:baseline.revision}});
    expect(viewerWrite.status()).toBe(403);
    const conflict=await page.request.put(api,{headers:{Authorization:'Bearer '+ownerToken},data:{aquarium:baseline.aquarium,revision:baseline.revision}});
    expect(conflict.status()).toBe(409);
    await action(page,'revoke').click();
    await dialogYes(page);
    await expect(page.locator('#toast')).toContainText('erişimi kapatıldı');
    const expired=await viewer.request.get(api,{headers:{Authorization:'Bearer '+viewerToken}});
    expect(expired.status()).toBe(401);
  } finally {
    // The fixture is isolated by its random owner token. Remove test fish using the owner API.
    const current=await page.request.get(api,{headers:{Authorization:'Bearer '+ownerToken}});
    if(current.ok()){
      const saved=await current.json();
      await page.request.put(api,{headers:{Authorization:'Bearer '+ownerToken},data:{aquarium:baseline.aquarium,revision:saved.revision}});
    }
    await guest.close();
  }
});
