import { art } from './assets';
import { icon, type IconName } from './icons';
import { available, categories, confirmed, decorations, markings, personalities, shades, species, stage, stageNames, type Aquarium, type Fish, type Milestone } from './model';

export const e=(a:string|number)=>String(a).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const dateFormat=new Intl.DateTimeFormat('tr-TR',{dateStyle:'long'});
const relativeFormat=new Intl.RelativeTimeFormat('tr-TR',{numeric:'auto'});
export const dateText=(d:string)=>dateFormat.format(new Date(d.length===10?`${d}T12:00:00`:d));
const relative=(d:string)=>{
  const days=Math.round((Date.parse(d+'T12:00:00')-Date.now())/86400000);
  if(Math.abs(days)<31) return relativeFormat.format(days,'day');
  if(Math.abs(days)<365) return relativeFormat.format(Math.round(days/30),'month');
  return relativeFormat.format(Math.round(days/365),'year');
};
export const button=(label:string,action:string,opts:{icon?:IconName; cls?:string;id?:string;disabled?:boolean}={})=>
  `<button type="button" class="button ${opts.cls??''}" data-action="${action}"${opts.id?` data-id="${e(opts.id)}"`:''}${opts.disabled?' disabled':''}>${opts.icon?icon(opts.icon,18):''}<span>${label}</span></button>`;
export const iconButton=(label:string,action:string,name:IconName,id?:string)=>
  `<button class="icon-button" type="button" data-action="${action}"${id?` data-id="${e(id)}"`:''} title="${label}" aria-label="${label}">${icon(name,20)}</button>`;
const textOption=(values:Record<string,string>,value:string)=>Object.entries(values).map(([k,label])=>`<option value="${k}" ${k===value?'selected':''}>${label}</option>`).join('');
const decoImage=(n:number)=>`<img src="${art('decor-'+n)}" alt="" aria-hidden="true" draggable="false">`;

export function shell() {
  return `<section id="aquarium" aria-label="BlupLab akvaryumu">
    <canvas id="tank" aria-label="Yüzen balıklar ve akvaryum. Balıkları klavyeyle açmak için Hatıralar düğmesini kullan."></canvas>
    <header class="topbar">
      <div class="brand" aria-label="BlupLab Little Aquarium">
        <div class="brand-name">BlupLab<span>.</span></div>
        <div class="brand-tag">LITTLE AQUARIUM</div>
      </div>
      <div class="top-tools">
        ${iconButton('Ayarlar','settings','settings')}
        ${iconButton('Tam ekran','fullscreen','fullscreen')}
      </div>
    </header>
    <div class="aquarium-count" aria-live="polite">${icon('fish',17)}<span id="fishCount"></span></div>
    <div id="hint" class="hint" hidden><span></span>${iconButton('Aracı bırak','cancel-mode','cross')}</div>
    <nav class="dock" aria-label="Akvaryum araçları">
      ${[['feed','Yem Ver','feed'],['bubbles','Oyna','bubbles'],['new','Yeni Balık','new'],['decor','Süsle','decor'],['memories','Hatıralar','book']].map(([action,label,name])=>
        `<button class="dock-button ${action==='new'?'dock-new':''}" type="button" data-action="${action}"><span class="dock-icon">${icon(name as IconName,24)}</span><span>${label}</span></button>`).join('')}
    </nav>
    <div id="panelRoot"></div>
    <div id="toast" role="status" aria-live="polite" hidden></div>
    <div id="loader" class="loader"><img src="${art('fish-0')}" alt=""><span>Akvaryum uyanıyor…</span></div>
  </section>
  <section id="rotate" class="rotate" aria-labelledby="rotate-title">
    <div class="rotate-card">${icon('phone',94)}
      <h1 id="rotate-title">Telefonu yan çevir!</h1>
      <p>Balıklara yüzebilecekleri biraz daha yer aç.</p>
      ${button('Bu görünümde devam et','portrait',{cls:'secondary'})}
    </div>
  </section>
  <dialog id="confirm" aria-labelledby="confirm-title"><div class="confirm-card">
    <h2 id="confirm-title"></h2><p id="confirm-text"></p>
    <form method="dialog" class="row"><button class="button secondary" value="cancel" autofocus>Vazgeç</button><button class="button danger" id="confirm-ok" value="yes">Onayla</button></form>
  </div></dialog>`;
}
export function panel(name:string,label:IconName,content:string, back?:string) {
  return `<aside class="panel" aria-label="${name}">
    <header class="panel-head">${back?iconButton('Geri',back,'back'):`<span class="panel-emblem">${icon(label,22)}</span>`}
    <h1 tabindex="-1">${name}</h1>${iconButton('Kapat','close','cross')}</header>
    <div class="panel-scroll">${content}</div>
  </aside>`;
}

export const portrait=(f:Fish,small=false)=>`<span class="portrait ${small?'portrait-sm':''} shade-${f.shade}" aria-hidden="true">
  <img src="${art('fish-'+f.species)}" alt="" draggable="false">
  ${f.marking!=='plain'?`<i class="mark-${f.marking}"></i>`:''}
  ${stage(f)?`<span class="portrait-pin">${icon('star',21)}</span>`:''}</span>`;

export function memoryCard(f:Fish,owner:boolean){
  const fulfilled=confirmed(f);
  const growth=stage(f);
  const metadata=[
    categories[f.category],
    f.illustrative?'Örnek hatıra':null,
    owner && f.visibility==='private'?'Gizli':null,
  ].filter(Boolean);
  const link=f.link?new URL(f.link):null;
  const milestone=f.kind==='ongoing'? `<section class="milestones"><div class="section-title"><h3>Duraklar</h3><small>${fulfilled.length} / ${f.milestones.length} kayıtlı</small></div>
    ${f.milestones.length?`<ul class="milestone-list">${f.milestones.map(m=>`<li>
        <span class="milestone-dot ${m.confirmedAt?'earned':''}">${m.confirmedAt?icon('check',13):''}</span>
        <span class="milestone-name">${e(m.label)}${m.confirmedAt?`<small>${dateText(m.confirmedAt)}</small>`:''}</span>
        ${owner?m.confirmedAt?iconButton('Durak onayını geri al','milestone-undo','back',m.id):button('Onayla','milestone',{id:m.id,cls:'mini secondary'}):''}
      </li>`).join('')}</ul>`:`<p class="faint">Henüz bir durak kaydedilmedi.</p>`}
    ${owner?button('Durak ekle','milestone-add',{cls:'secondary mini'}):''}</section>`:'';
  return `<div class="fish-hero">
    ${portrait(f)}
    <div><div class="pills">${metadata.map(text=>`<span>${text}</span>`).join('')}</div>
    <h2>${e(f.name)}</h2><p>${species[f.species].name} · ${personalities[f.personality].name}</p></div>
    </div>
    <article class="story"><h3>${e(f.title)}</h3><p>${e(f.description)}</p>
    ${f.date?`<p class="date-line">${dateText(f.date)} · ${relative(f.date)}</p>`:''}
    ${f.notes?`<p class="note">${e(f.notes)}</p>`:''}
    ${link?`<a class="story-link" href="${e(link.href)}" target="_blank" rel="noopener noreferrer">${icon('link',17)} ${e(link.hostname||'Bağlantıyı aç')}</a>`:''}
    </article>
    <div class="growth"><span class="growth-icon">${icon('star',22)}</span><div><strong>${stageNames[growth]}</strong><small>${personalities[f.personality].description}${growth?' Hatıra ışıltısı açıldı.':''}</small></div></div>
    ${milestone}
    ${owner?`<div class="row card-actions">${button('Düzenle','edit',{icon:'edit',cls:'primary'})}${iconButton('Balığı sil','delete','trash')}</div>`:''}`;
}

export function milestoneFields(m:Milestone){
  const confirmedTitle=m.confirmedAt?` title="Onaylandı: ${dateText(m.confirmedAt)}"`:'';
  return `<li data-milestone="${m.id}"><input name="milestone-label" maxlength="80" aria-label="Durak adı" placeholder="Örn. Bir ay" value="${e(m.label)}"${confirmedTitle}>${iconButton('Bu durağı kaldır','definition-remove','cross',m.id)}</li>`;
}

export function fishForm(f:Fish,editing:boolean){
  return `<form id="fishForm">
    <div class="builder-species">
      <div id="fishPreview">${portrait(f)}</div>
      <fieldset class="species-field"><legend>Balık türü</legend>
        <div class="species-pick">${species.map((s,i)=>`<button type="button" data-action="species" data-id="${i}" aria-label="${s.name}" title="${s.name}" aria-pressed="${i===f.species}">
          <img src="${art('fish-'+i)}" alt="" draggable="false"></button>`).join('')}</div>
        <input type="hidden" name="species" value="${f.species}">
      </fieldset>
    </div>
    <div class="fields"><label>Balığın adı<input name="name" required maxlength="32" value="${e(f.name)}" placeholder="Örn. Pofuduk"></label>
    <label>Hatıranın başlığı<input name="title" required maxlength="80" value="${e(f.title)}"></label>
    <label class="wide">Hatıra<textarea name="description" required maxlength="500" rows="3" placeholder="Bu balık sana neyi hatırlatsın?">${e(f.description)}</textarea></label>
    <label>Kategori<select name="category">${textOption(categories,f.category)}</select></label>
    <label>Olay tarihi<input name="date" type="date" value="${e(f.date??'')}"></label>
    <label>Hatıra türü<select name="kind">${textOption({moment:'Tek bir an',ongoing:'Devam eden hedef'},f.kind)}</select></label>
    <label>Kişilik<select name="personality">${textOption(Object.fromEntries(Object.entries(personalities).map(([k,v])=>[k,v.name])),f.personality)}</select></label>
    <label>Renk<select name="shade">${textOption(shades,f.shade)}</select></label>
    <label>Desen<select name="marking">${textOption(markings,f.marking)}</select></label>
    </div>
    <section id="definitionSection" class="milestones" ${f.kind==='moment'?'hidden':''}><h3>Duraklar</h3>
      <ol id="milestoneDefinitions" class="definition-list">${f.milestones.map(milestoneFields).join('')}</ol>
      ${button('Durak ekle','definition-add',{cls:'mini secondary'})}</section>
    <details class="extras"${f.notes||f.link?' open':''}><summary>Ek bilgiler</summary>
      <div class="fields"><label class="wide">Bağlantı<input name="link" type="url" maxlength="600" value="${e(f.link)}" placeholder="https://…"></label>
      <label class="wide">Not<textarea name="notes" maxlength="400" rows="2">${e(f.notes)}</textarea></label>
      <label class="wide">Kimler görebilir?<select name="visibility">${textOption({private:'Yalnızca ben',shared:'Bağlantısı olan ziyaretçiler'},f.visibility)}</select></label>
      ${f.illustrative?`<label class="wide check-label"><input name="makeReal" type="checkbox"> Bu artık gerçek bir hatıra</label>`:''}</div>
    </details>
    <div class="form-error" role="status" hidden></div>
    <div class="row form-actions"><button class="button primary" type="submit">${icon('check',18)}${editing?'Kaydet':'Akvaryuma ekle'}</button>
    ${button('Vazgeç',editing?'back-fish':'close',{cls:'secondary'})}</div>
  </form>`;
}

export type MemoryView = {category:string; order:string};
export function memoryList(a:Aquarium,view:MemoryView,owner:boolean){
  const sorted=[...a.fish].filter(f=>!view.category||f.category===view.category).sort((left,right)=>{
    const date=(f:Fish)=>view.order==='added'?f.createdAt:f.date??f.createdAt;
    return view.order==='old'?date(left).localeCompare(date(right)):date(right).localeCompare(date(left));
  });
  const history=sorted.flatMap(f=>[
    {f,label:f.title, when:f.date??f.createdAt, kind:f.date?'Olay':'Akvaryuma eklendi',detail:stageNames[stage(f)]},
    ...(f.date?[{f,label:f.name,when:f.createdAt,kind:'Akvaryuma eklendi',detail:''}]:[]),
    ...confirmed(f).sort((l,r)=>l.confirmedAt!.localeCompare(r.confirmedAt!)).map((m,i)=>({f,label:m.label,when:m.confirmedAt!,kind:'Durak',detail:i===0?'Hatıra ışıltısı açıldı':i===2?'Işıltılı görünüm açıldı':'Onaylandı'}))
  ]).sort((l,r)=>view.order==='old'?l.when.localeCompare(r.when):r.when.localeCompare(l.when));
  const visibleHistory=view.order==='added'?history.filter(record=>record.kind==='Akvaryuma eklendi'):history;
  const activity=a.activity.length?[...a.activity].sort((l,r)=>r.at.localeCompare(l.at)):a.props.map(p=>({item:p.type,at:p.updatedAt,type:p.updatedAt===p.createdAt?'prop-added':'prop-moved'}));
  const activityLabels:Record<string,string>={ 'prop-added':'Yerleştirildi','prop-moved':'Taşındı','prop-removed':'Kaldırıldı',unlocked:'Kullanıma açıldı' };
  return `<div class="fields memory-filters">
    <label>Kategori<select id="categoryFilter">${textOption({'':'Tümü',...categories},view.category)}</select></label>
    <label>Sırala<select id="orderFilter">${textOption({new:'En yeni',old:'En eski',added:'Eklenme tarihi'},view.order)}</select></label>
  </div>
  ${visibleHistory.length?`<ol class="timeline">${visibleHistory.map(({f,label,when,kind,detail})=>`<li><button class="timeline-card" data-action="inspect" data-id="${f.id}">
    ${portrait(f,true)}<span><small>${e(kind)} · ${dateText(when)}</small><strong>${e(label)}</strong>
    <span>${e(f.name)}${detail?' · '+e(detail):''}${f.illustrative?' · Örnek':''}</span></span>${icon('next',17)}</button>
    </li>`).join('')}</ol>`:`<div class="empty"><img src="${art('decor-6')}" alt=""><p>Burada henüz hatıra yok.</p>
    ${owner&&!view.category?button('Yeni balık ekle','new',{icon:'new',cls:'primary'}):''}</div>`}
    ${!view.category&&(a.unlocks.length||activity.length)?`<details class="extras"><summary>Akvaryumdaki değişiklikler</summary>
    <ul class="decor-history">${activity.map(p=>`<li>${decoImage(p.item)}<span>${decorations[p.item].name}<small>${dateText(p.at)} · ${activityLabels[p.type]}</small></span></li>`).join('')}
    ${a.unlocks.length?`<li>${icon('star',28)} <span>Açılan süsler<small>${a.unlocks.map(item=>item==='anchor'?'Minik çapa':'Hazine sandığı').join(', ')}</small></span></li>`:''}</ul></details>`:''}`;
}

export function decorPanel(a:Aquarium,active:number|null,changed:boolean,canRemove:boolean){
  return `<div class="decor-tools">
    <p class="faint">Bir süs seç ya da akvaryumdaki bir süsü sürükle.</p>
    <div class="decor-pick">${decorations.map((d,i)=>{
      const unlocked=available(i,a);
      const title=unlocked?d.name:`${d.name} · ${i===9?'1':'3'} onaylı durakla açılır`;
      return `<button type="button" data-action="${unlocked?'decor-type':'decor-locked'}" data-id="${i}" aria-pressed="${active===i}" aria-label="${title}" title="${title}">
        ${decoImage(i)}<span>${d.name}</span>${unlocked?'':`<i>${icon('lock',13)}</i>`}</button>`;
    }).join('')}</div>
    <div id="decorDraft">${decorActions(changed,canRemove,active!==null)}</div>
    ${a.props.length?`<details class="extras"><summary>Yerleştirilen süsler</summary>
      <div class="placed-list">${[...a.props].sort((l,r)=>l.x-r.x).map(p=>button(decorations[p.type].name,'decor-select',{cls:'secondary mini',id:p.id})).join('')}</div></details>`:''}
  </div>`;
}
export function decorActions(changed:boolean,canRemove:boolean,hasPreview:boolean){
  return `<div class="row decor-actions">${button('Kaydet','decor-save',{cls:'primary',icon:'check',disabled:!changed})}
    ${hasPreview?button('Bırak','decor-commit',{cls:'secondary mini'}):''}
    ${canRemove?iconButton('Bu süsü kaldır','decor-remove','trash'):''}</div>
    ${hasPreview?`<div class="nudge" aria-label="Süsü kaydır">${(['back','up','down','next'] as const).map((name,i)=>iconButton(['Sola','Yukarı','Aşağı','Sağa'][i],'decor-nudge',name,String(i))).join('')}</div>`:''}`;
}
