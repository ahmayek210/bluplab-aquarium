import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['iPhone 13 landscape'], viewport:{width:844,height:390} });

test('iPhone viewport rotates in both directions and touch opens the same aquarium',async({page,context})=>{
  const errors:string[]=[];
  page.on('pageerror',err=>errors.push(err.message));
  await context.addInitScript(()=>localStorage.setItem('bluplab.hint','yes'));
  const response=await page.goto('./');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#loader')).toBeHidden();
  const tank=await page.locator('#tank').boundingBox();
  expect(tank?.width).toBe(844);
  expect(tank?.height).toBe(390);
  await page.touchscreen.tap(tank!.x+tank!.width*.36,tank!.y+tank!.height*.32);
  await expect(page.getByRole('heading',{name:'Pofuduk'})).toBeVisible();
  await page.getByRole('button',{name:'Kapat',exact:true}).tap();

  const rotation=page.getByRole('heading',{name:'Telefonu yan çevir!'});
  await page.setViewportSize({width:390,height:844});
  await expect(rotation).toBeVisible();
  await expect.poll(async()=>(await page.locator('#rotate').boundingBox())?.width).toBe(390);
  await page.setViewportSize({width:844,height:390});
  await expect(rotation).toBeHidden();
  await expect(page.locator('#fishCount')).toHaveText('6 balık');

  await page.getByRole('button',{name:'Hatıralar'}).tap();
  await page.getByRole('button',{name:/İlk hafta/}).tap();
  await page.getByRole('button',{name:'Düzenle',exact:true}).tap();
  await page.getByLabel('Renk').selectOption('lagoon');
  await page.getByRole('button',{name:'Kaydet',exact:true}).tap();
  await expect(page.locator('.fish-hero .portrait')).toHaveClass(/shade-lagoon/);
  expect(errors).toEqual([]);
});
