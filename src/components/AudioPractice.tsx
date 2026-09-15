import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2} from 'lucide-react';
export function Listen({text}:{text:string}){
 const [error,setError]=useState('');
 function speak(){if(!('speechSynthesis'in window)){setError('Este navegador no tiene reproducción de voz. Prueba otro navegador o consulta la transcripción.');return;}const speech=new SpeechSynthesisUtterance(text);speech.lang='en-US';speech.rate=0.85;speech.onerror=()=>setError('No se pudo reproducir el audio. Revisa el sonido del dispositivo.');window.speechSynthesis.cancel();window.speechSynthesis.speak(speech);}
 useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
 return <><button className="secondary" onClick={speak}><Volume2 size={18}/> Escuchar en inglés</button>{error&&<p role="alert">{error}</p>}</>;
}
export function AudioPractice({onAudio}:{onAudio?:(blob:Blob)=>void}){
 const [recording,setRecording]=useState(false),[url,setUrl]=useState(''),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 async function start(){try{setError('');stream.current=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(stream.current);recorder.current=r;const chunks:Blob[]=[];r.ondataavailable=e=>chunks.push(e.data);r.onstop=()=>{const blob=new Blob(chunks,{type:r.mimeType});setUrl(URL.createObjectURL(blob));onAudio?.(blob);setRecording(false);stream.current?.getTracks().forEach(t=>t.stop());if(timer.current)clearTimeout(timer.current);};r.start();setRecording(true);timer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},40000);}catch{setError('No se pudo acceder al micrófono. Revisa los permisos o realiza la práctica sin grabar.');}}
 return <div className="audio-practice"><button className="secondary" onClick={()=>recording?recorder.current?.stop():void start()}>{recording?<Square size={18}/>:<Mic size={18}/>} {recording?'Detener':'Grabar práctica (máx. 40 s)'}</button>{recording&&<span role="status">Grabando…</span>}{url&&<audio controls src={url}/>}<small>La grabación permanece en este dispositivo, salvo que elijas enviarla para recibir feedback. Se descarta al salir.</small>{error&&<p role="alert">{error}</p>}</div>;
}
