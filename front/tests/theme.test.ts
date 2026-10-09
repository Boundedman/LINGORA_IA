import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import React from 'react';
const dom=new JSDOM('<!doctype html><html><head><meta name="theme-color"></head><body></body></html>',{url:'https://lingora.test/',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.scrollTo=()=>{};
let dark=false,compact=false;
const queries=new Map<string,Set<()=>void>>();
Object.defineProperty(window,'matchMedia',{configurable:true,value:(query:string)=>({get matches(){return query.includes('prefers-color')?dark:compact;},addEventListener(_event:string,callback:()=>void){if(!queries.has(query))queries.set(query,new Set());queries.get(query)!.add(callback);},removeEventListener(_event:string,callback:()=>void){queries.get(query)?.delete(callback);}})});
const {render,screen,fireEvent,cleanup,waitFor,act}=await import('@testing-library/react');
const {ThemeSelect}=await import('../src/components/ThemeSelect');
const {readTheme,themeKey}=await import('../src/lib/theme');
afterEach(()=>{cleanup();window.localStorage.clear();dark=false;compact=false;queries.clear();});

test('startup resolves stored and system themes before the React application loads',()=>{
 const script=readFileSync(new URL('../public/theme-init.js',import.meta.url),'utf8');
 for(const [saved,system,expected] of [['light',true,'light'],['dark',false,'dark'],['system',true,'dark'],['invalid',false,'light']] as const){
  const attrs:Record<string,string>={};const root={dataset:{} as Record<string,string>,style:{colorScheme:''}};
  vm.runInNewContext(script,{localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:system})},document:{documentElement:root,querySelector:()=>({setAttribute:(key:string,value:string)=>attrs[key]=value})}});
  assert.equal(root.dataset.theme,expected);assert.equal(root.style.colorScheme,expected);
  assert.equal(attrs.content,expected==='dark'?'#111726':'#f7f8fc');
 }
 const root={dataset:{} as Record<string,string>,style:{colorScheme:''}};
 vm.runInNewContext(script,{localStorage:{getItem(){throw new Error('Blocked');}},window:{matchMedia:()=>({matches:true})},document:{documentElement:root,querySelector:()=>null}});
 assert.equal(root.dataset.theme,'dark');
});

test('theme selector persists, follows live system changes and synchronizes tabs',async()=>{
 render(React.createElement(ThemeSelect));
 const select=screen.getByRole('combobox',{name:'Tema de la aplicación'});
 assert.equal((select as HTMLSelectElement).value,'system');
 await act(()=>{dark=true;queries.get('(prefers-color-scheme: dark)')?.forEach(fn=>fn());});
 assert.equal(document.documentElement.dataset.theme,'dark');
 fireEvent.change(select,{target:{value:'light'}});assert.equal(readTheme(),'light');
 await act(()=>{dark=true;queries.get('(prefers-color-scheme: dark)')?.forEach(fn=>fn());});
 assert.equal(document.documentElement.dataset.theme,'light');
 fireEvent.change(select,{target:{value:'dark'}});assert.equal(window.localStorage.getItem(themeKey),'dark');
 cleanup();render(React.createElement(ThemeSelect));assert.equal((screen.getByRole('combobox') as HTMLSelectElement).value,'dark');
 await act(()=>window.dispatchEvent(new dom.window.StorageEvent('storage',{key:themeKey,newValue:'system'})));
 assert.equal(document.documentElement.dataset.themePreference,'system');assert.equal(document.documentElement.dataset.theme,'dark');
});

test('mobile navigation exposes every destination and dialogs preserve keyboard focus',async()=>{
 const {default:App}=await import('../src/App');
 const {curriculum}=await import('../src/data/curriculum');
 globalThis.fetch=(async url=>new Response(JSON.stringify(String(url).endsWith('/learner')?{lessons:curriculum,progress:[],reviews:[]}:{session:null}))) as typeof fetch;
 compact=true;
 render(React.createElement(App));
 for(const width of [320,360,390,430]){
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
  for(const height of [800,320]){
   Object.defineProperty(window,'innerHeight',{configurable:true,value:height});
   fireEvent(window,new dom.window.Event('resize'));
   const opener=screen.getByRole('button',{name:'Abrir menú de navegación'});
   fireEvent.click(opener);assert.equal(opener.getAttribute('aria-expanded'),'true');
   const dialog=screen.getByRole('dialog',{name:'Menú de Lingora'});
   assert.equal(dialog.getAttribute('aria-modal'),'true');
   const nav=screen.getByRole('navigation',{name:'Navegación principal'});
   assert.equal(nav.querySelectorAll('button').length,7);
   fireEvent.keyDown(document,{key:'Tab',shiftKey:true});
   assert.ok(document.activeElement===screen.getByRole('button',{name:'Configuración de cuenta'}),'Shift+Tab wraps to the last menu action');
   fireEvent.keyDown(document,{key:'Escape'});assert.equal(screen.queryByRole('dialog'),null);assert.ok(document.activeElement===opener,'Escape restores focus to the menu opener');
  }
 }
 fireEvent.click(screen.getByRole('button',{name:'Iniciar sesión'}));
 assert.ok(screen.getByRole('dialog'));assert.ok(document.activeElement===screen.getByLabelText('Correo electrónico'),'Auth focuses the email field');
 fireEvent.keyDown(document,{key:'Escape'});assert.equal(screen.queryByRole('dialog'),null);
 await waitFor(()=>assert.equal(document.body.style.overflow,''));
});

test('semantic text, buttons and status colors have sufficient contrast in both palettes',()=>{
 const css=readFileSync(new URL('../src/theme.css',import.meta.url),'utf8');
 const palettes=[css.slice(css.indexOf(':root'),css.indexOf('[data-theme=dark]')),css.slice(css.indexOf('[data-theme=dark]'),css.indexOf('body{'))];
 const lum=(hex:string)=>{const rgb=hex.length===3?hex.split('').map(x=>x+x).join(''):hex;return [0,2,4].map(i=>parseInt(rgb.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);};
 for(const palette of palettes){
  const colors=Object.fromEntries([...palette.matchAll(/--([\w-]+):#([\da-f]{3,6})(?=;)/gi)].map(m=>[m[1],m[2]]));
  for(const [text,bg] of [['ink','surface'],['muted','surface'],['muted','surface-soft'],['violet','accent-soft'],['on-primary','primary'],['danger-ink','danger-bg'],['success-ink','success-bg'],['disabled-ink','disabled-bg']]){
   const values=[lum(colors[text]),lum(colors[bg])].sort((a,b)=>a-b);
   assert.ok((values[1]+.05)/(values[0]+.05)>=4.5,`${text} on ${bg}`);
  }
  const border=[lum(colors['control-line']),lum(colors.surface)].sort((a,b)=>a-b);
  assert.ok((border[1]+.05)/(border[0]+.05)>=3,'Field boundary contrast');
 }
});

test('viewport resize bounds dialogs and brings an active form field into view',async t=>{
 const {useViewport}=await import('../src/lib/useViewport');
 const viewport=Object.assign(new dom.window.EventTarget(),{height:800,offsetTop:0});
 const previous=Object.getOwnPropertyDescriptor(window,'visualViewport');
 const previousHeight=Object.getOwnPropertyDescriptor(window,'innerHeight');
 Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
 Object.defineProperty(window,'innerHeight',{configurable:true,value:800});
 t.after(()=>{if(previous)Object.defineProperty(window,'visualViewport',previous);else Reflect.deleteProperty(window,'visualViewport');if(previousHeight)Object.defineProperty(window,'innerHeight',previousHeight);});
 function Form(){useViewport();return React.createElement('input',{'aria-label':'Campo activo'});}
 render(React.createElement(Form));
 const input=screen.getByRole('textbox',{name:'Campo activo'});let scrolls=0;
 input.scrollIntoView=()=>{scrolls++;};input.focus();
 viewport.height=360;viewport.offsetTop=20;
 await act(()=>viewport.dispatchEvent(new dom.window.Event('resize')));
 assert.equal(document.documentElement.style.getPropertyValue('--viewport-height'),'360px');
 assert.equal(document.documentElement.style.getPropertyValue('--viewport-top'),'20px');
 await waitFor(()=>assert.ok(scrolls>0));
 cleanup();viewport.height=800;viewport.dispatchEvent(new dom.window.Event('resize'));
 assert.equal(document.documentElement.style.getPropertyValue('--viewport-height'),'360px','Viewport listener is removed when unmounted');
});
