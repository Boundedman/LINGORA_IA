import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {VoiceAudio} from '../src/lib/voiceAudio';

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
