import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {VoiceAudio} from '../src/lib/voiceAudio';

test('microphone integrates silence filtering, continuous fallback and immediate cleanup',async()=>{
 for(const filter of [true,false]){
  let port:any,stops=0;const sent:ArrayBuffer[]=[];let ends=0;
  class Context{state='running';destination={};audioWorklet={addModule:async()=>{}};resume(){return Promise.resolve();}close(){return Promise.resolve();}createAnalyser(){return {connect(){}};}createMediaStreamSource(){return {connect(){}};}createGain(){return {gain:{value:0},connect(){}};}}
  class Worklet{port={onmessage:null as any,postMessage(){},close(){}};constructor(){port=this.port;}connect(){}disconnect(){}}
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
  Object.defineProperty(globalThis,'AudioWorkletNode',{configurable:true,value:Worklet});
  const tracks=[{stop(){stops++;},enabled:true,onended:null}];
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>tracks,getAudioTracks:()=>tracks})}}});
  const engine=new VoiceAudio();assert.ok(await engine.open(data=>sent.push(data),()=>{},()=>ends++,filter));
  for(let i=0;i<100;i++)port.onmessage({data:new ArrayBuffer(640)});
  assert.equal(sent.length,filter?0:100);
  const speech=new ArrayBuffer(640);new Int16Array(speech).fill(100);
  port.onmessage({data:speech});
  for(let i=0;i<100;i++)port.onmessage({data:new ArrayBuffer(640)});
  assert.equal(ends,filter?1:0);
  const count=sent.length;engine.mute(true);port.onmessage({data:speech});assert.equal(sent.length,count);
  engine.mute(false);port.onmessage({data:speech});assert.equal(sent.length,count+1);
  const late=port.onmessage;engine.close();late({data:speech});assert.equal(sent.length,count+1);assert.equal(stops,1);
 }
});

test('AudioWorklet converts actual rates to bounded little-endian PCM and stops sending when muted',()=>{
 for(const rate of [16000,24000,44100,48000]){
  const chunks:ArrayBuffer[]=[];let Processor:any;
  const scope={sampleRate:rate,AudioWorkletProcessor:class{port={postMessage:(b:ArrayBuffer)=>chunks.push(b),onmessage:(_e:unknown)=>{}};},registerProcessor:(_name:string,value:any)=>{Processor=value;}};
  vm.runInNewContext(readFileSync(new URL('../src/lib/pcm-worklet.js',import.meta.url),'utf8'),scope);
  const processor=new Processor();
  // One second split into variable-sized render quanta, not whole-file resampling.
  for(let offset=0;offset<rate;offset+=128)processor.process([[new Float32Array(Math.min(128,rate-offset)).fill(.5)]]);
  assert.equal(chunks.length,50,`rate ${rate}`);assert.equal(chunks[0].byteLength,640);
  assert.equal(new DataView(chunks[0]).getInt16(0,true),16384);
  processor.port.onmessage({data:{muted:true}});processor.process([[new Float32Array(128).fill(1)]]);assert.equal(chunks.length,50);
 }
});

test('closing while microphone permission is pending stops late tracks',async t=>{
 let grant!:(stream:MediaStream)=>void;let stops=0,closed=0;
 class Context{state='running';currentTime=0;destination={};createAnalyser(){return {fftSize:256,connect(){},getFloatTimeDomainData(){}};}resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}}});
 const engine=new VoiceAudio();const opening=engine.open(()=>assert.fail('No audio expected'),()=>{});
 await Promise.resolve();engine.close();
 grant({getTracks:()=>[{stop(){stops++;}}]} as unknown as MediaStream);
 assert.equal(await opening,false);assert.equal(stops,1);assert.equal(closed,1);
});

test('speaker schedules PCM without overlap and stop clears all queued sources',t=>{
 const starts:number[]=[],stops:number[]=[];let closed=0;
 class Context{state='running';currentTime=1;destination={};createAnalyser(){return {fftSize:256,connect(){},getFloatTimeDomainData(){}};}createBuffer(_channels:number,count:number,rate:number){return {duration:count/rate,copyToChannel(){}};}createBufferSource(){const index=starts.length;return {buffer:null,connect(){},disconnect(){},start(time:number){starts.push(time);},stop(){stops.push(index);},onended:null};}close(){closed++;return Promise.resolve();}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:Context});
 const engine=new VoiceAudio();const encoded=Buffer.alloc(4800).toString('base64');engine.play(encoded);engine.play(encoded);
 assert.equal(starts.length,2);assert.ok(starts[1]>=starts[0]+.1);
 engine.stopSpeaker();assert.equal(stops.length,2);assert.equal(engine.levels().speaking,false);
 engine.close();engine.close();assert.equal(closed,1);
});
