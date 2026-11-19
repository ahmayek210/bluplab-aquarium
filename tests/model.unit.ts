import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aquariumSchema, exampleAquarium, forViewer, now, revise, stage, unlockedAnimations } from '../src/model';

test('draft memories are illustrative and private histories are excluded from viewer data',()=>{
  const a=exampleAquarium();
  assert.equal(a.fish.length,6);
  assert.ok(a.fish.every(f=>f.illustrative && !f.date));
  a.fish[1].visibility='private';
  assert.ok(!forViewer(a).fish.find(f=>f.id===a.fish[1].id));
  assert.ok(a.fish.find(f=>f.id===a.fish[1].id));
  assert.ok(!aquariumSchema.safeParse({...a, fish:[a.fish[0],a.fish[0]]}).success);
  assert.ok(!aquariumSchema.safeParse({...a,fish:[{...a.fish[0],link:'javascript:void(0)'}]}).success);
});

test('ongoing progress requires recorded milestones and unlocks survive visual stage changes',()=>{
  const a=exampleAquarium(), fish=a.fish[0];
  assert.equal(stage({...fish,date:'1994-03-01'}),0);
  fish.milestones[0].confirmedAt=now();
  let next=revise(a);
  assert.equal(stage(fish),1);
  assert.equal(unlockedAnimations(fish).length,2);
  assert.deepEqual(next.unlocks,['anchor']);
  for(const stop of fish.milestones) stop.confirmedAt=now();
  next=revise(a,next);
  assert.equal(stage(fish),2);
  assert.deepEqual(next.unlocks,['anchor','treasure']);
  assert.equal(next.activity.filter(item=>item.type==='unlocked').length,2);
  fish.milestones[1].confirmedAt=null;
  assert.equal(stage(fish),1);
  assert.deepEqual(revise(a,next).unlocks,['anchor','treasure']);
});

test('one-time memories gain cosmetic age and decorated scenes retain action history',()=>{
  const a=exampleAquarium();
  const fish={...a.fish[1],illustrative:false,date:'2023-01-01'};
  assert.equal(stage(fish,Date.parse('2023-01-02')),0);
  assert.equal(stage(fish,Date.parse('2023-06-02')),1);
  assert.equal(stage(fish,Date.parse('2025-01-02')),2);
  const [first,second,...others]=a.props;
  const changed=revise({...a,props:[{...first,x:first.x+.01},...others]},a);
  assert.deepEqual(changed.activity.slice(-2).map(item=>item.type),['prop-moved','prop-removed']);
});
