import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FileReader:dom.window.FileReader,location:dom.window.location,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
dom.window.scrollTo=()=>{};
const guestFetch=(async()=>new Response(JSON.stringify({session:null}),{headers:{'Content-Type':'application/json'}})) as typeof fetch;
globalThis.fetch=guestFetch;
const {render,screen,fireEvent,cleanup,waitFor}=await import('@testing-library/react');
afterEach(()=>{cleanup();globalThis.fetch=guestFetch;});

test('voice preparation allows one-action start after sign-in without opening a microphone',async()=>{
 const {VoiceTutor}=await import('../src/components/VoiceTutor');
 const paths:string[]=[];
 globalThis.fetch=(async url=>{paths.push(String(url));return new Response(JSON.stringify({enabled:true,voices:['Kore'],max_seconds:300,retention_days:30}));}) as typeof fetch;
 const learner={session:null,profile:null} as unknown as import('../src/lib/useLearner').Learner;
 const view=render(React.createElement(VoiceTutor,{learner,login:()=>{}}));
 await waitFor(()=>assert.equal(paths.length,1));
 await waitFor(()=>assert.equal(screen.queryByText('Comprobando disponibilidad…'),null));
 assert.equal((screen.getByRole('button',{name:'Comenzar'}) as HTMLButtonElement).disabled,true);
 view.rerender(React.createElement(VoiceTutor,{learner:{...learner,session:{user:{id:'ana',email:'ana@example.com'}}},login:()=>{}}));
 assert.equal((screen.getByRole('button',{name:'Comenzar'}) as HTMLButtonElement).disabled,false);
 assert.ok(screen.getAllByText(/Al comenzar, aceptas enviar tu audio/));
 fireEvent.click(screen.getByRole('button',{name:'Mostrar transcripción'}));
 assert.ok(screen.getByRole('region',{name:'Transcripción de la práctica'}));
 assert.deepEqual(paths,['/api/voice/config']);
});

test('one-action controls prevent duplicate sessions, distinguish errors and cancel pending permission',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const {act}=await import('@testing-library/react');
 const {VoiceTutor}=await import('../src/components/VoiceTutor');
 const {VoiceAudio}=await import('../src/lib/voiceAudio');
 const restore:(()=>void)[]=[];
 function property(target:object,key:string,value:unknown){const old=Object.getOwnPropertyDescriptor(target,key);Object.defineProperty(target,key,{configurable:true,value});restore.push(()=>old?Object.defineProperty(target,key,old):Reflect.deleteProperty(target,key));}
 class Socket{
  static OPEN=1;static instances:Socket[]=[];readyState=0;bufferedAmount=0;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
  constructor(){Socket.instances.push(this);}send(){}close(){this.readyState=3;}event(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 }
 class Context{destination={};createAnalyser(){return {connect(){}};}}
 property(globalThis,'AudioContext',Context);property(window,'AudioContext',Context);property(window,'AudioWorkletNode',class{});property(globalThis,'WebSocket',Socket);property(navigator,'mediaDevices',{getUserMedia(){}});
 t.after(()=>restore.reverse().forEach(fn=>fn()));
 let opens=0,closes=0,deny=false,pending=false,grant!:()=>void;
 t.mock.method(VoiceAudio.prototype,'open',async()=>{opens++;if(deny)throw Object.assign(new Error(),{name:'NotAllowedError'});if(pending)await new Promise<void>(r=>{grant=r;});return true;});
 t.mock.method(VoiceAudio.prototype,'close',()=>{closes++;});
 t.mock.method(VoiceAudio.prototype,'mute',()=>{});
 t.mock.method(VoiceAudio.prototype,'levels',()=>({input:0,output:0,speaking:false}));
 globalThis.fetch=(async()=>new Response(JSON.stringify({enabled:true,voices:['Kore'],max_seconds:null}))) as typeof fetch;
 const learner={session:{user:{id:'ana',email:'ana@example.com'}},profile:null} as unknown as import('../src/lib/useLearner').Learner;
 render(React.createElement(VoiceTutor,{learner,login:()=>{}}));
 await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Comenzar'}) as HTMLButtonElement).disabled,false));
 const begin=screen.getByRole('button',{name:'Comenzar'});
 await act(async()=>{begin.click();begin.click();});assert.equal(opens,1);assert.equal(Socket.instances.length,1);
 const first=Socket.instances[0];await act(()=>{first.readyState=1;first.onopen?.();first.event({type:'ready'});});
 assert.ok(screen.getAllByText('Te escucho'));assert.ok(screen.getByRole('button',{name:'Finalizar conversación'}));
 await act(()=>t.mock.timers.tick(60000));
 assert.ok(screen.getByRole('button',{name:'Finalizar conversación'}));
 for(let turn=0;turn<3;turn++){
  await act(()=>first.event({type:'transcript',id:`${turn}-user`,role:'user',text:'Hello',final:true}));
  assert.ok(screen.getAllByText('Preparando una respuesta'));
  await act(()=>first.event({type:'turn_complete',turn}));assert.ok(screen.getAllByText('Te escucho'));
 }
 fireEvent.click(screen.getByRole('button',{name:'Finalizar conversación'}));
 assert.equal(first.readyState,3);assert.equal(closes,1);assert.ok(screen.getByRole('button',{name:'Comenzar'}));
 await act(async()=>{screen.getByRole('button',{name:'Comenzar'}).click();});
 const second=Socket.instances[1];await act(()=>second.onerror?.());
 assert.ok(screen.getByRole('alert'));assert.ok(screen.getAllByText('La conversación se interrumpió'));assert.ok(screen.getByRole('button',{name:'Reintentar'}));
 deny=true;await act(async()=>{screen.getByRole('button',{name:'Reintentar'}).click();});
 assert.match(screen.getByRole('alert').textContent??'',/Permiso de micrófono denegado/);
 deny=false;pending=true;await act(async()=>{screen.getByRole('button',{name:'Reintentar'}).click();});
 assert.ok(screen.getAllByText('Permite el acceso al micrófono'));
 fireEvent.click(screen.getByRole('button',{name:'Finalizar conversación'}));
 await act(async()=>{grant();});assert.equal(Socket.instances.length,2);assert.ok(screen.getByRole('button',{name:'Comenzar'}));
});

test('voice lifecycle mutes input, discards interrupted audio and releases resources on immediate stop and allows a new session',async t=>{
 const {renderHook,act}=await import('@testing-library/react');
 const {useVoiceSession}=await import('../src/lib/useVoiceSession');
 const {VoiceAudio}=await import('../src/lib/voiceAudio');

 let closed=0,played=0,stopped=0;
 const muted:boolean[]=[];
 class Context{destination={};createAnalyser(){return {connect(){}};}}
 class Socket{
  static OPEN=1;static instance:Socket;readyState=0;bufferedAmount=0;onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;sent:string[]=[];
  constructor(){Socket.instance=this;}send(value:string){this.sent.push(value);}close(){this.readyState=3;}event(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 }
 const restore: (()=>void)[]=[];
 function property(target:object,key:string,value:unknown){const old=Object.getOwnPropertyDescriptor(target,key);Object.defineProperty(target,key,{configurable:true,value});restore.push(()=>old?Object.defineProperty(target,key,old):Reflect.deleteProperty(target,key));}
 property(globalThis,'AudioContext',Context);property(window,'AudioContext',Context);property(window,'AudioWorkletNode',class{});property(globalThis,'WebSocket',Socket);property(navigator,'mediaDevices',{getUserMedia(){}});
 t.after(()=>restore.reverse().forEach(fn=>fn()));
 t.mock.method(VoiceAudio.prototype,'open',async()=>true);
 t.mock.method(VoiceAudio.prototype,'close',()=>{closed++;});
 t.mock.method(VoiceAudio.prototype,'mute',(value:boolean)=>{muted.push(value);});
 t.mock.method(VoiceAudio.prototype,'play',()=>{played++;});
 t.mock.method(VoiceAudio.prototype,'stopSpeaker',()=>{stopped++;});
 t.mock.method(VoiceAudio.prototype,'levels',()=>({input:0,output:0,speaking:false}));
 const {result,unmount}=renderHook(()=>useVoiceSession());
 await act(()=>result.current.start({mode:'fluency',level:'unknown',topic:'Travel',scenario:'free',goal:'',voice:'Kore',consent:true,save_summary:false}));
 const ws=Socket.instance;await act(()=>{ws.readyState=1;ws.onopen?.();ws.event({type:'ready',resumed:false});});
 assert.equal(result.current.state,'active');
 await act(()=>result.current.mute(true));assert.equal(muted.at(-1),true);
 await act(()=>ws.event({type:'audio',turn:0,data:'AAA='}));assert.equal(played,1);
 await act(()=>ws.event({type:'interrupted',turn:0}));
 await act(()=>ws.event({type:'audio',turn:0,data:'AAA='}));assert.equal(played,1);assert.ok(stopped);
 await act(()=>ws.event({type:'audio',turn:1,data:'AAA='}));assert.equal(played,2);
 await act(()=>{ws.event({type:'turn_complete',turn:1});ws.event({type:'transcript',id:'2-user',role:'user',text:'Another turn',final:true});});
 assert.equal(result.current.state,'active');assert.equal(result.current.waiting,true);
 await act(()=>{ws.event({type:'turn_complete',turn:2});ws.event({type:'reconnecting'});ws.event({type:'ready',resumed:true});});
 // Explicit mute survives reconnection; the default session remains hands-free.
 assert.equal(result.current.muted,true);await act(()=>result.current.mute(false));
 await act(()=>{ws.event({type:'reconnecting'});ws.event({type:'ready',resumed:true});});assert.equal(result.current.muted,false);
 await act(()=>result.current.finish());assert.equal(closed,1);assert.equal(result.current.state,'ready');assert.equal(ws.readyState,3);assert.ok(ws.sent.includes(JSON.stringify({type:'stop'})));
 await act(()=>ws.event({type:'audio',turn:2,data:'AAA='}));assert.equal(played,2);
 await act(()=>result.current.start({mode:'fluency',level:'unknown',topic:'',scenario:'free',goal:'',voice:'Kore',consent:true,save_summary:false}));
 assert.notEqual(Socket.instance,ws);await act(()=>result.current.finish());assert.equal(closed,2);
 unmount();assert.equal(closed,2);
});

