import {useEffect,useRef,type RefObject} from 'react';

// Native buttons/fields remain in the tab order; the dialog traps focus only while open.
export function useDialog(ref:RefObject<HTMLElement|null>,open:boolean,close:()=>void){
 const closer=useRef(close);closer.current=close;
 useEffect(()=>{
  if(!open||!ref.current)return;
  const panel=ref.current,previous=document.activeElement as HTMLElement|null;
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const focusable=()=>Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]'));
  (panel.querySelector<HTMLElement>('input:not(:disabled)')??focusable()[0]??panel).focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closer.current();}
   if(event.key==='Tab'){
    const items=focusable(),first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();panel.focus();}
    else if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus();};
 },[open,ref]);
}
