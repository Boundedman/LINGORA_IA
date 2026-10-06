import {useEffect,useRef,useState} from 'react';
import {VoiceAudio} from './voiceAudio';
import {emptySummary,type VoiceState,type VoiceOptions,type VoiceTurn,type VoiceSummary} from './voiceTypes';

export function useVoiceSession(){
  const [state,setState]=useState<VoiceState>('ready'),[error,setError]=useState('');
  const [muted,setMuted]=useState(false),[seconds,setSeconds]=useState(0),[turns,setTurns]=useState<VoiceTurn[]>([]);
  const [summary,setSummary]=useState<VoiceSummary|null>(null),[saved,setSaved]=useState(false);
  const [levels,setLevels]=useState({input:0,output:0,speaking:false});
  const [waiting,setWaiting]=useState(false),[gentleHint,setGentleHint]=useState(false);
  const socket=useRef<WebSocket|null>(null),audio=useRef<VoiceAudio|null>(null),generation=useRef(0);
  const current=useRef<VoiceState>('ready'),started=useRef(0),lastTurn=useRef(-1),ignored=useRef(-1);
  const deadline=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const alive=useRef(true);
  const lastActivity=useRef(0),hinted=useRef(false);
  function change(next:VoiceState){current.current=next;if(alive.current)setState(next);}
  function cleanupAudio(){audio.current?.close();audio.current=null;if(alive.current)setLevels({input:0,output:0,speaking:false});}
  function disconnect(){clearTimeout(deadline.current);const ws=socket.current;socket.current=null;if(ws){ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.onopen=null;ws.close();}}
  function elapsed(){return started.current?(performance.now()-started.current)/1000:0;}
  function localEnd(message=''){
    cleanupAudio();disconnect();++generation.current;
    if(!alive.current)return;
    setSeconds(Math.floor(elapsed()));setSummary(emptySummary(elapsed()));setError(message);change(message?'error':'finished');
  }
  function finish(){
    if(['ready','finished','error','finishing'].includes(current.current))return;
    cleanupAudio();
    if(socket.current?.readyState===WebSocket.OPEN&&['active','reconnecting'].includes(current.current)){
      change('finishing');socket.current.send(JSON.stringify({type:'finish'}));
      clearTimeout(deadline.current);deadline.current=setTimeout(()=>localEnd('El resumen no estuvo disponible. El micrófono ya está apagado.'),22000);
    }else localEnd();
  }
  function mute(value:boolean){
    audio.current?.mute(value);setMuted(value);
    if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'mute',muted:value}));
  }
  function stopSpeaker(){ignored.current=lastTurn.current;audio.current?.stopSpeaker();setLevels(l=>({...l,output:0,speaking:false}));}
  async function start(options:VoiceOptions){
    if(!['ready','finished','error'].includes(current.current))return;
    if(!options.consent)return;
    disconnect();cleanupAudio();const token=++generation.current;
    setError('');setSummary(null);setTurns([]);setSaved(false);setMuted(false);setSeconds(0);setWaiting(false);setGentleHint(false);hinted.current=false;lastActivity.current=performance.now();
    started.current=0;ignored.current=-1;lastTurn.current=-1;
    change('permission');
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.AudioContext||!window.AudioWorkletNode)throw new Error('Tu navegador no permite audio en tiempo real. Usa HTTPS y un navegador compatible.');
      const engine=new VoiceAudio();audio.current=engine;
      const opened=await engine.open(data=>{
        const ws=socket.current;
        if(token!==generation.current||current.current!=='active'||ws?.readyState!==WebSocket.OPEN)return;
        if(ws.bufferedAmount>64000){localEnd('La red no alcanza a enviar el audio. Vuelve a intentarlo.');return;}
        ws.send(data);
      },()=>localEnd('El micrófono se desconectó. Revisa el dispositivo e inicia otra práctica.'));
      if(token!==generation.current||!opened){engine.close();return;}
      engine.mute(true); // Capture permission is granted; transmit only after setup.
      change('connecting');
      const url=new URL('/api/voice/live',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const ws=new WebSocket(url);socket.current=ws;
      deadline.current=setTimeout(()=>localEnd('No pudimos conectar a tiempo. El micrófono está apagado; vuelve a intentarlo.'),40000);
      ws.onopen=()=>{if(token===generation.current)ws.send(JSON.stringify(options));};
      ws.onmessage=event=>{
        if(token!==generation.current)return;
        try{
          const message=JSON.parse(event.data);
          if(message.type==='ready'){
            if(current.current==='finishing')return;
            clearTimeout(deadline.current);if(!started.current)started.current=performance.now();
            change('active');const pause=Boolean(message.resumed)||document.hidden;engine.mute(pause);setMuted(pause);
            ws.send(JSON.stringify({type:'mute',muted:pause}));
          }else if(message.type==='reconnecting'){
            if(current.current==='finishing')return;
            change('reconnecting');engine.mute(true);engine.stopSpeaker();setMuted(true);
          }else if(message.type==='audio'&&current.current==='active'){
            setWaiting(false);lastActivity.current=performance.now();lastTurn.current=message.turn;if(message.turn!==ignored.current)engine.play(message.data);
          }else if(message.type==='interrupted'){
            ignored.current=message.turn;engine.stopSpeaker();
          }else if(message.type==='transcript'){
            if(message.role==='user'&&!message.final)setWaiting(true);
            setTurns(previous=>{const turn={id:message.id,role:message.role,text:message.text,final:message.final} as VoiceTurn;return [...previous.filter(t=>t.id!==turn.id),turn].slice(-120);});
          }else if(message.type==='turn_complete'){
            setWaiting(false);
          }else if(message.type==='finishing'){
            cleanupAudio();change('finishing');clearTimeout(deadline.current);
            deadline.current=setTimeout(()=>localEnd('No se pudo recibir el resumen.'),22000);
          }else if(message.type==='summary'){
            cleanupAudio();disconnect();setSummary(message.summary);setSaved(message.saved);setSeconds(message.summary.duration_seconds);change('finished');
          }else if(message.type==='error'){localEnd(message.message);}
          else if(message.type==='notice')setError(message.message);
        }catch{localEnd('No pudimos reproducir la respuesta. Inicia otra práctica.');}
      };
      ws.onerror=()=>localEnd('No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.');
      ws.onclose=()=>{if(token===generation.current&&current.current!=='finished')localEnd('La conexión se cerró. El micrófono está apagado.');};
    }catch(e){
      if(token!==generation.current)return;
      const name=(e as Error).name;
      localEnd(name==='NotAllowedError'?'Permiso de micrófono denegado. Puedes habilitarlo en tu navegador.':name==='NotFoundError'?'No encontramos un micrófono. Conecta uno y vuelve a intentarlo.':name==='NotReadableError'?'El micrófono está ocupado o no está disponible.':(e as Error).message);
    }
  }
  useEffect(()=>{
    alive.current=true;
    const timer=setInterval(()=>{
      if(!['active','reconnecting'].includes(current.current))return;
      setSeconds(Math.floor(elapsed()));
      if(document.hidden)return;
      const measured=audio.current?.levels()??{input:0,output:0,speaking:false};setLevels(measured);
      if(measured.speaking||measured.input>.04){lastActivity.current=performance.now();setGentleHint(false);}
      else if(!hinted.current&&current.current==='active'&&performance.now()-lastActivity.current>30000){hinted.current=true;setGentleHint(true);}
    },100);
    const hide=()=>{document.documentElement.dataset.voiceHidden=String(document.hidden);if(document.hidden&&['active','reconnecting'].includes(current.current)){mute(true);audio.current?.stopSpeaker();setLevels({input:0,output:0,speaking:false});}};
    const leave=()=>{cleanupAudio();disconnect();++generation.current;setSummary(emptySummary(elapsed()));change('finished');};
    document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',leave);
    return()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);delete document.documentElement.dataset.voiceHidden;++generation.current;cleanupAudio();disconnect();};
  },[]);
  return {state,error,muted,seconds,turns,summary,saved,levels,waiting,gentleHint,start,finish,mute,stopSpeaker};
}
