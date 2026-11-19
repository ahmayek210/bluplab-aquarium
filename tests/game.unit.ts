import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exampleAquarium, newId } from '../src/model';
import { World } from '../src/game/world';
import { tintPixels } from '../src/game/shade';

function advance(w:World,seconds:number){
  for(let i=0;i<seconds*60;i++) w.step(1/60);
}
function setup(random=()=>.17){
  const w=new World(random);
  w.resize(844,390);w.sync(exampleAquarium());
  return w;
}
test('independent fish move and eat specific falling pellets, with a hard food cap',()=>{
  const w=setup();
  const first=w.fish[0];
  const original=first.x;
  for(let i=0;i<20;i++) w.addFood({x:first.x+60,y:first.y});
  assert.equal(w.foods.length,30);
  const before=w.foods[0].y;
  advance(w,.4);
  assert.ok(w.foods[0].y>before);
  assert.ok(w.fish.some(f=>f.state==='food'));
  advance(w,5);
  assert.ok(w.counts.eaten>1);
  assert.ok(first.x!==original);
  assert.ok(w.foods.length<30);
  advance(w,20);
  assert.equal(w.foods.length,0);
});

test('playful fish pop an interactive bubble and react to a tap',()=>{
  const w=setup();
  const fish=w.fish[1];
  fish.socialCool=0;
  w.addBubbles({x:fish.x+26,y:fish.y},1);
  advance(w,2);
  assert.equal(w.counts.popped,1);
  w.touch(fish,fish);
  assert.equal(fish.state,'react');
  assert.ok(w.bubbles.some(b=>!b.interactive));
});

test('autonomous social decisions, rare moves and interactions have distinct priorities',()=>{
  const w=setup(()=>.03);
  const [f,n]=w.fish;
  f.x=430;f.y=183;n.x=468;n.y=191;f.until=0;f.next=0;f.socialCool=0;
  w.step(1/60);
  assert.equal(f.state,'social');
  assert.ok(f.partner);
  assert.equal(w.counts.social,1);
  w.triggerSpecial(f,'loop');
  assert.equal(f.state,'special');
  assert.equal(w.counts.special,1);
  assert.ok(f.cool>w.time+30);
  w.addFood({x:f.x+75,y:f.y});
  advance(w,.4);
  assert.equal(f.state,'special');
  advance(w,4);
  assert.notEqual(f.state,'special');
});

test('twenty-four fish survive resize and stay inside the swimming area',()=>{
  let seed=131;
  const w=setup(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});
  const a=exampleAquarium();
  a.fish=Array.from({length:24},(_,i)=>({...a.fish[i%6],id:newId(),species:i%10}));
  w.sync(a);
  advance(w,12);
  w.resize(667,375);
  advance(w,10);
  assert.equal(w.fish.length,24);
  assert.ok(w.fish.every(f=>f.x>=0&&f.x<=667&&f.y>=0&&f.y<=375));
  assert.ok(w.counts.social>0);
});

test('fallback color treatments preserve transparency and give each shade distinct colors',()=>{
  const original=[251,202,82,229,45,55,67,0];
  const shades=(['original','sun','lagoon','dusk'] as const).map(shade=>{
    const pixels=new Uint8ClampedArray(original);
    tintPixels(pixels,shade);
    assert.deepEqual([...pixels.slice(3)],[229,45,55,67,0]);
    return String(pixels.slice(0,3));
  });
  assert.equal(new Set(shades).size,4);
});
