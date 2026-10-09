export type ThemePreference='light'|'dark'|'system';
export const themeKey='lingora-theme';
export function validTheme(value:unknown):value is ThemePreference{return value==='light'||value==='dark'||value==='system';}
export function readTheme():ThemePreference{
 try{const saved=window.localStorage.getItem(themeKey);if(validTheme(saved))return saved;}catch{/* Continue without persistent storage. */}
 return 'system';
}
export function applyTheme(preference:ThemePreference){
 const dark=preference==='dark'||(preference==='system'&&Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.documentElement.dataset.themePreference=preference;
 document.documentElement.style.colorScheme=dark?'dark':'light';
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111726':'#f7f8fc');
}
export function saveTheme(preference:ThemePreference){
 try{window.localStorage.setItem(themeKey,preference);}catch{/* The choice still applies to this visit. */}
 applyTheme(preference);
}
