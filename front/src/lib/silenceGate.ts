// Energy gate, not a speech recognizer. Keep quiet speech and a short pre-roll.
// 20 ms PCM16 frames; stream end is sent once after 1.2 s of low energy.
export class SilenceGate {
  private preRoll:ArrayBuffer[]=[];
  private active=false;
  private quietFrames=0;
  constructor(private send:(data:ArrayBuffer)=>void,private end:()=>void){}
  push(data:ArrayBuffer){
    const view=new DataView(data);let energy=0;
    for(let i=0;i<view.byteLength;i+=2){const value=view.getInt16(i,true)/32768;energy+=value*value;}
    const audible=Math.sqrt(energy/(view.byteLength/2))>=0.0015;
    if(!this.active){
      this.preRoll.push(data);if(this.preRoll.length>10)this.preRoll.shift();
      if(!audible)return;
      this.active=true;this.quietFrames=0;
      for(const frame of this.preRoll)this.send(frame);this.preRoll=[];
      return;
    }
    this.send(data);this.quietFrames=audible?0:this.quietFrames+1;
    if(this.quietFrames>=60){this.active=false;this.quietFrames=0;this.end();}
  }
  reset(){this.preRoll=[];this.active=false;this.quietFrames=0;}
}
