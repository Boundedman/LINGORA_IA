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

test('voice preparation requires sign-in and consent without opening a microphone',async()=>{
 const {VoiceTutor}=await import('../src/components/VoiceTutor');
 const paths:string[]=[];
 globalThis.fetch=(async url=>{paths.push(String(url));return new Response(JSON.stringify({enabled:true,voices:['Kore'],max_seconds:300,retention_days:30}));}) as typeof fetch;
 const learner={session:null,profile:null} as unknown as import('../src/lib/useLearner').Learner;
 const view=render(React.createElement(VoiceTutor,{learner,login:()=>{}}));
 await waitFor(()=>assert.equal(paths.length,1));
 assert.equal((screen.getByRole('button',{name:'Iniciar práctica'}) as HTMLButtonElement).disabled,true);
 view.rerender(React.createElement(VoiceTutor,{learner:{...learner,session:{user:{id:'ana',email:'ana@example.com'}}},login:()=>{}}));
 assert.equal((screen.getByRole('button',{name:'Iniciar práctica'}) as HTMLButtonElement).disabled,true);
 fireEvent.click(screen.getByLabelText(/Acepto enviar mi audio/));
 assert.equal((screen.getByRole('button',{name:'Iniciar práctica'}) as HTMLButtonElement).disabled,false);
 assert.equal((screen.getByLabelText(/Guardar mi resumen/) as HTMLInputElement).checked,false);
 fireEvent.click(screen.getByRole('button',{name:'Mostrar transcripción'}));
 assert.ok(screen.getByRole('region',{name:'Transcripción de la práctica'}));
 assert.deepEqual(paths,['/api/voice/config']);
});

test('voice lifecycle mutes input, discards interrupted audio and releases resources before evaluation',async t=>{
 const {renderHook,act}=await import('@testing-library/react');
 const {useVoiceSession}=await import('../src/lib/useVoiceSession');
 const {VoiceAudio}=await import('../src/lib/voiceAudio');
 const {emptySummary}=await import('../src/lib/voiceTypes');
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
 await act(()=>result.current.finish());assert.equal(closed,1);assert.equal(result.current.state,'finishing');
 await act(()=>ws.event({type:'audio',turn:2,data:'AAA='}));assert.equal(played,2);
 await act(()=>ws.event({type:'summary',summary:emptySummary(12),saved:false}));assert.equal(result.current.state,'finished');assert.equal(ws.readyState,3);
 unmount();assert.equal(closed,1);
});

