import {useEffect,useState,type CSSProperties} from 'react';
import {Mic,MicOff,Square,Sparkles,SlidersHorizontal,RotateCcw} from 'lucide-react';
import {api} from '../lib/db';
import type {Learner} from '../lib/useLearner';
import {useVoiceSession} from '../lib/useVoiceSession';
import type {VoiceConfig,VoiceOptions} from '../lib/voiceTypes';

const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

export function VoiceTutor({learner,login}:{learner:Learner;login:()=>void}){
 const voice=useVoiceSession();
 const [config,setConfig]=useState<VoiceConfig|null>(null),[configError,setConfigError]=useState('');
 const [configAttempt,setConfigAttempt]=useState(0),[configBusy,setConfigBusy]=useState(true);
 const [options,setOptions]=useState<VoiceOptions>({mode:'fluency',level:learner.profile?.level??'unknown',topic:'',scenario:'free',goal:'',voice:'Kore',consent:true,save_summary:false});
 const [showTranscript,setShowTranscript]=useState(false);
 useEffect(()=>{let active=true;setConfigBusy(true);setConfigError('');api<VoiceConfig>('voice/config').then(value=>{if(active)setConfig(value);}).catch(()=>{if(active)setConfigError('No pudimos comprobar la disponibilidad de voz. Revisa tu conexión y vuelve a intentarlo.');}).finally(()=>{if(active)setConfigBusy(false);});return()=>{active=false;};},[configAttempt]);
 const busy=['permission','connecting','active','reconnecting','finishing'].includes(voice.state);
 const active=voice.state==='active';
 const phase=voice.state==='permission'?'permission':voice.state==='connecting'||voice.state==='reconnecting'?'connecting':active?(voice.muted?'muted':voice.levels.speaking?'speaking':voice.waiting?'processing':'listening'):voice.state==='error'?'error':'ready';
 const labels={ready:'Un espacio para tu voz',permission:'Permite el acceso al micrófono',connecting:voice.state==='reconnecting'?'Estamos recuperando la conexión':'Conectando con Lingora',listening:'Te escucho',processing:'Preparando una respuesta',speaking:'Lingora está hablando',muted:'Micrófono en pausa',error:'La conversación se interrumpió'};
 const hints={ready:'Habla, piensa y vuelve a intentarlo. A tu ritmo.',permission:'Confirma el permiso en tu navegador para conversar.',connecting:'Un momento, estamos preparando tu conversación.',listening:'Puedes hablar con naturalidad o tomarte una pausa.',processing:'Sigue aquí. Tu conversación continúa abierta.',speaking:'Puedes intervenir cuando quieras.',muted:document.hidden?'El micrófono volverá al regresar a esta pestaña.':'Activa el micrófono cuando quieras continuar.',error:'El micrófono y el altavoz están apagados.'};
 function update<K extends keyof VoiceOptions>(key:K,value:VoiceOptions[K]){setOptions(previous=>({...previous,[key]:value}));}
 return <section className="voice-layout" data-session={busy?'open':'closed'} aria-label="Tutor por voz">
  <div className="voice-main panel">
   <header className="voice-header"><div><span className="eyebrow">LINGORA · CONVERSACIONES QUE CONECTAN</span><h2>Tu voz, tu ritmo.</h2></div><span className="voice-session-tag">{busy?<><span aria-hidden="true"/>En conversación <time aria-label="Duración de la conversación">{clock(voice.seconds)}</time></>:'Tutor de inglés por voz'}</span></header>
   <div className="voice-stage" data-state={phase}>
    <div className="voice-presence" aria-hidden="true" style={{'--voice-level':voice.levels.speaking?voice.levels.output:voice.levels.input} as CSSProperties}>
     <span className="voice-orbit voice-orbit-one"/><span className="voice-orbit voice-orbit-two"/>
     <div className="voice-orb"><Sparkles size={46} strokeWidth={1.4}/><span className="voice-orb-light"/></div>
     <div className="voice-wave">{[0,1,2,3,4].map(i=><i key={i} style={{'--bar':i} as CSSProperties}/>)}</div>
    </div>
    <div className="voice-status" role="status" aria-live="polite" aria-atomic="true"><h3>{labels[phase]}</h3><p>{hints[phase]}</p></div>
    {voice.gentleHint&&phase==='listening'&&<p className="voice-gentle">Puedes empezar con “I would like to talk about…”</p>}
   </div>
   <div className="voice-action-zone">
    {busy&&<p className="voice-control-status" aria-hidden="true">{labels[phase]}</p>}
    <div className="voice-primary-slot">
     <button className={busy?'voice-primary voice-end':'voice-primary'} disabled={!busy&&(!learner.session||!config?.enabled||configBusy)} onClick={()=>busy?voice.finish():void voice.start(options,config?.filter_silence??true)}>
      {busy?<Square size={18}/>:voice.state==='error'?<RotateCcw size={20}/>:<Mic size={20}/>}{busy?'Finalizar conversación':voice.state==='error'?'Reintentar':'Comenzar'}
     </button>
    </div>
    <div className="voice-secondary-slot">{active&&<button className="text-button" onClick={()=>voice.mute(!voice.muted)}>{voice.muted?<Mic size={17}/>:<MicOff size={17}/>} {voice.muted?'Activar micrófono':'Silenciar micrófono'}</button>}</div>
    {!busy&&<p className="voice-privacy">Al comenzar, aceptas enviar tu audio a Google Gemini para conversar. Lingora no guarda el audio ni la transcripción completa.</p>}
    {!learner.session&&<div className="voice-notice"><p>Inicia sesión para conversar con tu tutor.</p><button className="secondary" onClick={login}>Iniciar sesión</button></div>}
    {configBusy&&!busy&&<p className="voice-notice" role="status">Comprobando disponibilidad…</p>}
    {config&&!config.enabled&&!configError&&<p className="voice-notice">La conversación por voz aún no está habilitada. Puedes continuar con el tutor por texto.</p>}
    {(configError||voice.error)&&<div className="voice-error" role="alert"><p>{configError||voice.error}</p>{configError&&<button className="secondary" disabled={configBusy} onClick={()=>setConfigAttempt(a=>a+1)}><RotateCcw size={16}/>Reintentar disponibilidad</button>}</div>}
   </div>
  <div className="voice-extras">
   <details className="voice-settings"><summary><SlidersHorizontal size={17}/>Personaliza tu conversación<span>{options.mode==='fluency'?'Conversación fluida':'Tutor activo'} · {options.level==='unknown'?'A tu nivel':options.level}</span></summary>
    <fieldset disabled={busy} className="voice-options"><legend>Prepara tu conversación</legend>
     <label>Modo<select value={options.mode} onChange={e=>update('mode',e.target.value as VoiceOptions['mode'])}><option value="fluency">Conversación fluida</option><option value="coaching">Tutor activo</option></select></label>
     <label>Mi nivel declarado<select value={options.level} onChange={e=>update('level',e.target.value)}><option value="unknown">No lo sé</option>{['A1','A2','B1','B2','C1','C2'].map(level=><option key={level}>{level}</option>)}</select></label>
     <label>Escenario<select value={options.scenario} onChange={e=>update('scenario',e.target.value as VoiceOptions['scenario'])}><option value="free">Conversación libre</option><option value="coffee">Café y networking</option><option value="debate">Debate amistoso</option><option value="interview">Entrevista laboral</option></select></label>
     <label>Voz<select value={options.voice} onChange={e=>update('voice',e.target.value)}>{(config?.voices??['Kore']).map(name=><option key={name}>{name}</option>)}</select></label>
     <label>Tema o puesto de trabajo<input value={options.topic} maxLength={300} placeholder="Viajes, tecnología, una entrevista…" onChange={e=>update('topic',e.target.value)}/></label>
     <label>Quiero practicar<input value={options.goal} maxLength={200} placeholder="Presentarme y explicar lo que hago" onChange={e=>update('goal',e.target.value)}/></label>
    </fieldset><p className="voice-setting-note">{options.mode==='fluency'?'Las correcciones no interrumpen tu conversación.':'El tutor puede ofrecerte una corrección breve cuando sea útil.'} Para cambiar las opciones, finaliza primero.</p>
   </details>
   <button className="text-button voice-transcript-toggle" aria-expanded={showTranscript} aria-controls="voice-transcript" onClick={()=>setShowTranscript(!showTranscript)}>{showTranscript?'Ocultar':'Mostrar'} transcripción</button>
   {showTranscript&&<section id="voice-transcript" className="voice-transcript panel" aria-label="Transcripción de la práctica"><h3>Tu conversación</h3><small>Transcripción automática. Puede contener errores y se descarta al finalizar.</small>{voice.turns.length===0&&<p>Tus frases aparecerán al comenzar.</p>}{voice.turns.map(turn=><article key={turn.id}><strong>{turn.role==='user'?'Tú':'Lingora'}{!turn.final?' · en curso':''}</strong><p>{turn.text}</p></article>)}</section>}
  </div>
  </div>
 </section>;
}
