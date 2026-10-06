/* PCM16 mono, 16kHz. The input rate is the actual AudioContext sampleRate.
   Weighted box resampling preserves fractional positions across render quanta. */
class LingoraPCM extends AudioWorkletProcessor {
  constructor(){super();this.sum=0;this.weight=0;this.ratio=sampleRate/16000;this.chunk=new Int16Array(320);this.index=0;this.muted=false;this.port.onmessage=event=>{this.muted=event.data.muted;this.sum=0;this.weight=0;this.index=0;};}
  process(inputs){
    const input=inputs[0]?.[0];
    if(!input||this.muted)return true;
    for(const value of input){
      let remaining=1;
      while(remaining>1e-8){
        const take=Math.min(remaining,this.ratio-this.weight);
        this.sum+=value*take;this.weight+=take;remaining-=take;
        if(this.weight>=this.ratio-1e-8){
          const sample=Math.max(-1,Math.min(1,this.sum/this.ratio));
          this.chunk[this.index++]=Math.round(sample*(sample<0?32768:32767));
          this.sum=0;this.weight=0;
          if(this.index===320){
            const buffer=new ArrayBuffer(640),view=new DataView(buffer);
            for(let i=0;i<320;i++)view.setInt16(i*2,this.chunk[i],true);
            this.port.postMessage(buffer,[buffer]);this.index=0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('lingora-pcm',LingoraPCM);
