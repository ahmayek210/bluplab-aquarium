import { z } from 'zod';

export const species = [
  { name:'Ponpon', speed:42, depth:.49, size:1.03, fin:1.08, special:'puff' },
  { name:'Yelpaze', speed:58, depth:.34, size:1.18, fin:1.25, special:'loop' },
  { name:'Uykucu', speed:29, depth:.63, size:1.05, fin:.66, special:'snooze' },
  { name:'Mercan', speed:38, depth:.55, size:1.04, fin:.94, special:'puff' },
  { name:'Çizgili', speed:69, depth:.27, size:1.18, fin:1.32, special:'dart' },
  { name:'Filiz', speed:52, depth:.43, size:.91, fin:1.5, special:'loop' },
  { name:'Kelebek', speed:43, depth:.38, size:.99, fin:.86, special:'spin' },
  { name:'Bıyık', speed:32, depth:.68, size:1.14, fin:.72, special:'peek' },
  { name:'Gülkuyruk', speed:47, depth:.53, size:1.14, fin:1.1, special:'spin' },
  { name:'Altınkanat', speed:64, depth:.32, size:.79, fin:1.38, special:'dart' },
] as const;

export const personalities = {
  curious:{ name:'Meraklı', description:'Suyun içindeki her yeni şeyi yakından inceler.', speed:1, curiosity:.92, social:.55, play:.54, reactive:.66, rest:.2, nook:.24 },
  shy:{ name:'Çekingen', description:'Kalabalıktan uzaklaşıp bitkilerin arasına sığınır.', speed:.95, curiosity:.15, social:.16, play:.29, reactive:.95, rest:.49, nook:.14 },
  playful:{ name:'Oyuncu', description:'Kabarcık peşinde koşturur, arada bir takla atar.', speed:1.2, curiosity:.8, social:.6, play:.96, reactive:.5, rest:.12, nook:.7 },
  sleepy:{ name:'Uykucu', description:'Yosunların yanında kestirmeye bayılır.', speed:.68, curiosity:.27, social:.29, play:.14, reactive:.3, rest:.9, nook:.83 },
  social:{ name:'Arkadaş canlısı', description:'Başka bir balıkla yan yana yüzmeyi sever.', speed:1.05, curiosity:.55, social:.97, play:.7, reactive:.55, rest:.26, nook:.65 },
} as const;

export const categories = { personal:'Kişisel', music:'Müzik', learning:'Öğrenme', people:'Birlikte', creative:'Yaratıcılık', other:'Diğer' } as const;
export const markings = { plain:'Sade', dots:'Benekli', stripes:'Çizgili', star:'Yıldızlı' } as const;
export const shades = { original:'Özgün', sun:'Gün ışığı', lagoon:'Lagün', dusk:'Gün batımı' } as const;
export const decorations = [
  {name:'Kurdele yosunu', size:1.6, plant:true},
  {name:'Yelpaze otu', size:1.35, plant:true},
  {name:'Dal mercan', size:1.23, plant:false},
  {name:'Kızıl mercan', size:1.21, plant:false},
  {name:'Çakıl taşları', size:.72, plant:false},
  {name:'Mavi kaya', size:1.03, plant:false},
  {name:'Deniz kabuğu', size:.61, plant:false},
  {name:'Kabuk ev', size:1.48, plant:false},
  {name:'Hazine sandığı', size:1.18, plant:false},
  {name:'Minik çapa', size:1.03, plant:false},
] as const;
export const MAX_FISH = 80;
export const MAX_DECOR = 40;
const id = z.uuid();
const short = (max: number) => z.string().trim().min(1).max(max);
const timestamp = z.iso.datetime({ offset: true });
const date = z.iso.date();
const url = z.string().max(600).refine(value => {
  if (!value) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Geçerli bir web bağlantısı gir.');
const milestoneSchema = z.object({
  id, label:short(80), definedAt:timestamp, confirmedAt:timestamp.nullable(),
});
const fishSchema = z.object({
  id, name:short(32), species:z.number().int().min(0).max(9),
  marking:z.enum(['plain','dots','stripes','star']),
  shade:z.enum(['original','sun','lagoon','dusk']),
  personality:z.enum(['curious','shy','playful','sleepy','social']),
  title:short(80), description:short(500), date:date.nullable(),
  category:z.enum(['personal','music','learning','people','creative','other']),
  kind:z.enum(['moment','ongoing']), link:url, notes:z.string().trim().max(400),
  visibility:z.enum(['shared','private']), illustrative:z.boolean(),
  milestones:z.array(milestoneSchema).max(24).refine(items => unique(items.map(item=>item.id))),
  createdAt:timestamp, updatedAt:timestamp,
}).refine(fish => fish.kind === 'ongoing' || fish.milestones.length === 0);
const propSchema = z.object({
  id, type:z.number().int().min(0).max(9), x:z.number().min(.04).max(.96),
  y:z.number().min(.47).max(.95), createdAt:timestamp, updatedAt:timestamp,
});
const activitySchema=z.object({
  id, at:timestamp, item:z.number().int().min(0).max(9),
  type:z.enum(['prop-added','prop-moved','prop-removed','unlocked']),
});
function unique(values:string[]) { return new Set(values).size === values.length; }
export const aquariumSchema = z.object({
  version:z.literal(1), name:short(40), fish:z.array(fishSchema).max(MAX_FISH),
  props:z.array(propSchema).max(MAX_DECOR), unlocks:z.array(z.enum(['anchor','treasure'])).max(2),
  activity:z.array(activitySchema).max(220).default([]),
}).refine(a => unique(a.fish.map(f=>f.id)) && unique(a.props.map(f=>f.id)) && unique(a.unlocks));
export type Aquarium = z.infer<typeof aquariumSchema>;
export type Fish = z.infer<typeof fishSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Decoration = z.infer<typeof propSchema>;
export type Role = 'owner'|'viewer';
export const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const confirmed = (fish:Fish) => fish.milestones.filter(m=>m.confirmedAt !== null);
export const available = (type:number,a:Aquarium) => type===8 ? a.unlocks.includes('treasure') : type===9 ? a.unlocks.includes('anchor') : true;
export function earn(a:Aquarium):Aquarium {
  const count = a.fish.reduce((sum,f)=>sum+confirmed(f).length,0);
  const unlocks = new Set(a.unlocks);
  if(count>=1) unlocks.add('anchor');
  if(count>=3) unlocks.add('treasure');
  return {...a,unlocks:[...unlocks]};
}
export function revise(next:Aquarium, previous?:Aquarium):Aquarium {
  const candidate=earn({...next,unlocks:previous?.unlocks??next.unlocks});
  const props=new Map(previous?.props.map(p=>[p.id,p]));
  const updated: Aquarium['activity']=[...(previous?.activity??next.activity??[])];
  const add=(type:Aquarium['activity'][number]['type'],item:number,at=now())=>updated.push({id:newId(),type,item,at});
  for(const item of candidate.props){
    const old=props.get(item.id);
    if(!old){
      if(previous || !next.activity.length) add('prop-added',item.type,item.createdAt);
    } else if(old.x!==item.x || old.y!==item.y) add('prop-moved',item.type,item.updatedAt);
    props.delete(item.id);
  }
  for(const old of props.values()) add('prop-removed',old.type);
  for(const unlock of candidate.unlocks){
    if(!previous?.unlocks.includes(unlock) && !updated.some(item=>item.type==='unlocked' && item.item===(unlock==='anchor'?9:8))) add('unlocked',unlock==='anchor'?9:8);
  }
  return {...candidate,activity:updated.slice(-220)};
}
export function stage(fish:Fish, today=Date.now()) {
  if(fish.kind==='ongoing'){
    const count=confirmed(fish).length;
    return count>=3 ? 2 : count>=1 ? 1 : 0;
  }
  if(fish.illustrative || !fish.date) return 0;
  const age=(today-Date.parse(fish.date))/86_400_000;
  return age>=365 ? 2 : age>=90 ? 1 : 0;
}
export const stageNames=['Minik','Serpilmiş','Işıltılı'] as const;
export function unlockedAnimations(fish:Fish) {
  return stage(fish)
    ? [species[fish.species].special, 'Hatıra ışıltısı']
    : [species[fish.species].special];
}
export function blankFish():Fish {
  return {id:newId(),name:'',species:0,marking:'plain',shade:'original',personality:'curious',
    title:'',description:'',category:'personal',date:null,kind:'moment',link:'',notes:'',
    visibility:'private',illustrative:false,milestones:[],createdAt:now(),updatedAt:now()};
}
export function exampleAquarium():Aquarium {
  const fish: Array<Partial<Fish> & Pick<Fish,'name'|'title'|'description'>> = [
    {species:0,name:'Pofuduk',title:'İlk hafta',description:'Küçük bir alışkanlığı değiştirdiğin ilk haftayı bir balıkla kutladığını düşün.',kind:'ongoing',personality:'curious'},
    {species:1,name:'Maviş',title:'Bir şarkı önerisi',description:'Bir arkadaşının gönderdiği, gün boyu aklında kalan bir şarkı için.',personality:'playful',category:'music'},
    {species:2,name:'Mayış',title:'Bir konuyu çözmek',description:'Defalarca baktığın bir konunun bir anda yerine oturduğu an için.',personality:'sleepy',category:'learning'},
    {species:3,name:'Şeftali',title:'Yarım kalan şaka',description:'Gülmekten sonunu getiremediğin bir şaka için.',personality:'social',category:'people'},
    {species:5,name:'Filiz',title:'Küçük bir eskiz',description:'Defterin kenarına çizip bir daha unutmadığın o desen için.',personality:'shy',category:'creative'},
    {species:6,name:'Çizgi',title:'Yağmurdan sonra',description:'Kısa bir yürüyüşte duyduğun yağmur sonrası sessizliği için.',personality:'curious',category:'other'},
  ];
  return revise({
    version:1,name:'Little Aquarium',unlocks:[],activity:[],
    fish:fish.map(data=>({...blankFish(), ...data, illustrative:true, visibility:'shared',
      milestones:data.kind==='ongoing' ? ['İlk hafta','İkinci hafta','İlk ay'].map(label=>({id:newId(),label,definedAt:now(),confirmedAt:null})) : []})),
    props:[{type:7,x:.826,y:.924},{type:6,x:.71,y:.950},{type:0,x:.161,y:.925},{type:4,x:.226,y:.928}].map(prop=>({...prop,id:newId(),createdAt:now(),updatedAt:now()})),
  });
}
export function forViewer(a:Aquarium):Aquarium {
  return {...a,fish:a.fish.filter(f=>f.visibility==='shared')};
}
