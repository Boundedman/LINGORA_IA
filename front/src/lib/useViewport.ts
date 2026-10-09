import {useEffect,useState} from 'react';
export const compactNavigationQuery='(max-width: 850px), (max-height: 500px) and (max-width: 1100px)';
export function useCompactNavigation(){
 const [compact,setCompact]=useState(()=>Boolean(window.matchMedia?.(compactNavigationQuery).matches));
 useEffect(()=>{const media=window.matchMedia?.(compactNavigationQuery);const update=()=>setCompact(Boolean(media?.matches));media?.addEventListener('change',update);return()=>media?.removeEventListener('change',update);},[]);
 return compact;
}
export function useViewport(){
 useEffect(()=>{
  const viewport=window.visualViewport;let frame=0;
  const update=()=>{
   document.documentElement.style.setProperty('--viewport-height',`${viewport?.height??window.innerHeight}px`);
   document.documentElement.style.setProperty('--viewport-top',`${viewport?.offsetTop??0}px`);
   if(viewport&&viewport.height<window.innerHeight-120){
    window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(()=>{const active=document.activeElement;if(active instanceof HTMLElement&&active.matches('input,textarea,select'))active.scrollIntoView?.({block:'nearest',inline:'nearest'});});
   }
  };
  update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
  return()=>{window.cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
 },[]);
}
