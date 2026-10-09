import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
import {applyTheme,readTheme,saveTheme,themeKey,validTheme,type ThemePreference} from '../lib/theme';

export function ThemeSelect(){
 const [preference,setPreference]=useState<ThemePreference>(readTheme);
 useEffect(()=>{
  applyTheme(preference);
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const update=()=>applyTheme(preference);
  const storage=(event:StorageEvent)=>{if(event.key===themeKey||event.key===null)setPreference(validTheme(event.newValue)?event.newValue:'system');};
  media?.addEventListener('change',update);window.addEventListener('storage',storage);
  return()=>{media?.removeEventListener('change',update);window.removeEventListener('storage',storage);};
 },[preference]);
 const Icon=preference==='dark'?Moon:preference==='light'?Sun:Monitor;
 return <label className="theme-control"><Icon size={17} aria-hidden="true"/><span className="sr-only">Tema de la aplicación</span><select aria-label="Tema de la aplicación" value={preference} onChange={e=>{const next=e.target.value as ThemePreference;saveTheme(next);setPreference(next);}}><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Sistema</option></select></label>;
}
