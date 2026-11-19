export function registerOffline(){
  if(!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const base=new URL(import.meta.env.BASE_URL,location.href);
  const path=new URL('sw.js',base);
  const register=()=>void navigator.serviceWorker.register(path,{
    scope:base.pathname, updateViaCache:'none',
  }).catch(()=>{});
  if(document.readyState==='complete') register();
  else window.addEventListener('load',register,{once:true});
}
