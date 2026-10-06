export class VoiceAudio {
  private context:AudioContext;
  private stream?:MediaStream;
  private worklet?:AudioWorkletNode;
  private input?:AnalyserNode;
  private output:AnalyserNode;
  private sources=new Set<AudioBufferSourceNode>();
  private nextTime=0;
  private closed=false;
  private muted=false;
  constructor(){
    this.context=new AudioContext();
    this.output=this.context.createAnalyser();this.output.fftSize=256;
    this.output.connect(this.context.destination);
  }
  async open(send:(data:ArrayBuffer)=>void,lost:()=>void){
    // Called from an explicit click, before any network request.
    await this.context.resume();
    const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(this.closed){stream.getTracks().forEach(track=>track.stop());return false;}
    this.stream=stream;
    stream.getTracks().forEach(track=>{track.onended=()=>{if(!this.closed)lost();};});
    try{
      await this.context.audioWorklet.addModule(new URL('./pcm-worklet.js',import.meta.url));
      if(this.closed)return false;
      const source=this.context.createMediaStreamSource(stream);
      this.input=this.context.createAnalyser();this.input.fftSize=256;
      this.worklet=new AudioWorkletNode(this.context,'lingora-pcm');
      this.worklet.port.onmessage=event=>{if(!this.closed&&!this.muted)send(event.data as ArrayBuffer);};
      const silent=this.context.createGain();silent.gain.value=0;
      source.connect(this.input);source.connect(this.worklet);this.worklet.connect(silent);silent.connect(this.context.destination);
      return true;
    }catch(error){this.close();throw error;}
  }
  mute(value:boolean){
    this.muted=value;this.stream?.getAudioTracks().forEach(track=>{track.enabled=!value;});
    this.worklet?.port.postMessage({muted:value});
  }
  play(encoded:string){
    if(this.closed)return;
    const raw=atob(encoded);
    if(raw.length%2||raw.length>240000)throw new Error('Audio inválido.');
    if(this.nextTime-this.context.currentTime>12)throw new Error('La reproducción se retrasó. Inicia otra práctica.');
    const samples=new Float32Array(raw.length/2);
    for(let i=0;i<samples.length;i++){
      const n=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
      samples[i]=(n>=32768?n-65536:n)/32768;
    }
    const buffer=this.context.createBuffer(1,samples.length,24000);buffer.copyToChannel(samples,0);
    const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.output);
    this.nextTime=Math.max(this.context.currentTime+0.02,this.nextTime);
    source.start(this.nextTime);this.nextTime+=buffer.duration;this.sources.add(source);
    source.onended=()=>{source.disconnect();this.sources.delete(source);};
  }
  stopSpeaker(){for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources.clear();this.nextTime=0;}
  levels(){
    const rms=(analyser?:AnalyserNode)=>{if(!analyser)return 0;const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);return Math.min(1,Math.sqrt(values.reduce((a,b)=>a+b*b,0)/values.length)*5);};
    return {input:this.muted?0:rms(this.input),output:rms(this.output),speaking:!this.closed&&this.context.state==='running'&&this.sources.size>0&&this.context.currentTime<this.nextTime};
  }
  close(){
    if(this.closed)return;this.closed=true;
    this.stream?.getTracks().forEach(track=>{track.onended=null;track.stop();});
    if(this.worklet){this.worklet.port.onmessage=null;this.worklet.disconnect();this.worklet.port.close();}
    this.stopSpeaker();void this.context.close().catch(()=>{});
  }
}
