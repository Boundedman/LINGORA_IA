import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SilenceGate} from '../src/lib/silenceGate';

function frame(value:number){const data=new ArrayBuffer(640),view=new DataView(data);for(let i=0;i<320;i++)view.setInt16(i*2,value,true);return data;}
test('long silence sends no audio; speech preserves pre-roll, pauses and restarts automatically',()=>{
 const sent:ArrayBuffer[]=[];let ends=0;
 const gate=new SilenceGate(data=>sent.push(data),()=>ends++);
 for(let i=0;i<250;i++)gate.push(frame(0));
 assert.equal(sent.length,0);assert.equal(ends,0);
 const first=frame(70);gate.push(first); // Quiet speech above conservative threshold.
 assert.equal(sent.length,10);assert.equal(sent.at(-1),first);
 for(let i=0;i<40;i++)gate.push(frame(0));
 gate.push(frame(100));assert.equal(ends,0); // 800 ms hesitation must not end stream.
 for(let i=0;i<60;i++)gate.push(frame(0));
 assert.equal(ends,1);
 const count=sent.length;for(let i=0;i<250;i++)gate.push(frame(0));
 assert.equal(sent.length,count);assert.equal(ends,1);
 gate.push(frame(90));assert.equal(sent.length,count+10);
 gate.reset();for(let i=0;i<100;i++)gate.push(frame(0));
 assert.equal(ends,1);
});

test('mute reset discards buffered audio rather than replaying it in another session',()=>{
 const sent:ArrayBuffer[]=[];const gate=new SilenceGate(data=>sent.push(data),()=>{});
 const old=frame(10);gate.push(old);gate.reset();const speech=frame(100);gate.push(speech);
 assert.deepEqual(sent,[speech]);
});
