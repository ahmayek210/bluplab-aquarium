import { icon } from './icons';
import { button, e } from './ui';

export function settings(options:{sound:boolean;reduced:boolean;motionLocked:boolean;cloud:boolean;signed:boolean;owner:boolean;role?:string;viewerLink?:string;error?:string}) {
  const {sound,reduced,motionLocked,cloud,signed,owner,role,viewerLink,error}=options;
  const toggle=(name:string,action:string,on:boolean,locked=false)=>`<button type="button" class="switch" aria-label="${name}" role="switch" aria-checked="${on}" data-action="${action}"${locked?' title="Cihazın hareket ayarı etkin" disabled':''}><span></span></button>`;
  return `<div class="setting-row">${icon('sound',21)}<strong>Sesler</strong>${toggle('Sesler','sound',sound)}</div>
  <div class="setting-row">${icon('moon',21)}<strong>Az hareket</strong>${toggle('Az hareket','motion',reduced,motionLocked)}</div>
  <section class="cloud"><div class="section-title"><h3>${icon('cloud',24)} Kayıt ve paylaşım</h3></div>
  ${error?`<p class="form-error">${e(error)}</p>`:''}
  ${signed?`<p>${role==='owner'?'Çevrimiçi · Akvaryum sahibi':role==='viewer'?'Çevrimiçi · Ziyaretçi':'Bağlantı bekleniyor'}</p>
    <div class="row wrap">
    ${owner?button('Sahip bağlantısını kopyala','owner-link',{icon:'link',cls:'secondary mini'}):''}
    ${owner?button('Ziyaretçi bağlantısı oluştur','invite',{icon:'link',cls:'primary mini'}):''}
    ${owner?button('Ziyaretçi erişimini kapat','revoke',{cls:'secondary mini'}):''}
    ${button('Yenile','refresh',{cls:'secondary mini'})}
    ${button('Bu cihazdan çık','signout',{cls:'secondary mini'})}
    </div>
    ${viewerLink?`<label class="share-label">Ziyaretçi bağlantısı<input readonly id="visitor-url" value="${e(viewerLink)}"></label>${button('Kopyala','copy-viewer',{cls:'secondary mini'})}`:''}
    ${owner?`<p class="faint">Sahip bağlantısı düzenleme yetkisi verir. Ziyaretçiler yalnızca paylaşılan hatıraları görür.</p>`:''}`:
    `<p>Değişiklikler bu tarayıcıda saklanıyor.</p>
    ${cloud?`${button('Cihazlar arası kaydı aç','enable-cloud',{icon:'cloud',cls:'primary'})}
    <p class="faint">Akvaryumuna başka bir cihazdan erişmek için sahip bağlantısını sakla.</p>`:
    '<p class="faint">Bu kurulumda çevrimiçi kayıt kapalı.</p>'}`}
  </section>
  ${owner?`<section class="cloud"><h3>Yedek</h3><div class="row wrap">
    ${button('Dışa aktar','export',{cls:'secondary mini'})}${button('Yedeği içe aktar','import',{cls:'secondary mini'})}
    <input id="importFile" type="file" accept=".json,application/json" hidden></div></section>`:''}`;
}
