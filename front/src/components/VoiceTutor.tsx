import {useEffect,useState,type CSSProperties} from 'react';
import {Mic,MicOff,Square,VolumeX,Sparkles} from 'lucide-react';
import {api} from '../lib/db';
import type {Learner} from '../lib/useLearner';
import {useVoiceSession} from '../lib/useVoiceSession';
import type {VoiceConfig,VoiceOptions,VoiceSummary,SavedVoiceSummary} from '../lib/voiceTypes';

const states={ready:'Listo para practicar',permission:'Esperando permiso del micrófono',connecting:'Conectando con tu tutor',active:'Práctica en curso',reconnecting:'Reconectando · micrófono apagado',finishing:'Micrófono apagado · preparando resumen',finished:'Práctica finalizada',error:'No pudimos continuar'};
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

function Summary({value}:{value:VoiceSummary}){
 return <section className="voice-summary" aria-label="Resumen de práctica"><h3>Tu siguiente paso</h3>
  <p>{value.partial?'Resumen parcial · ':''}{clock(value.duration_seconds)} de sesión · participación oral: no disponible.</p>
  {value.evaluation_status==='unavailable'&&<p>La evaluación no estuvo disponible. Puedes empezar otra práctica.</p>}
  {value.insufficient_evidence&&<p>No hay suficiente evidencia para confirmar mejoras o fortalezas. No es una calificación de tu inglés.</p>}
  {value.strengths.length>0&&<><h4>Lo que hiciste bien</h4><ul>{value.strengths.map((s,i)=><li key={i}><q>{s.excerpt}</q> — {s.explanation_es}</li>)}</ul></>}
  {value.improvements.length>0&&<><h4>Hasta tres cosas para practicar</h4>{value.improvements.map((s,i)=><article key={i} className="voice-observation"><strong>{s.is_optional_improvement?'Otra forma de decirlo':'Para revisar'}{s.confidence==='medium'?' · observación orientativa':''}</strong><p><q>{s.original_excerpt}</q> → <q>{s.suggested_alternative}</q></p><p>{s.explanation_es}</p></article>)}</>}
  <p><strong>Próxima práctica:</strong> {value.practice}</p><small>Observaciones de IA sobre una transcripción que puede contener errores. No certifican un nivel ni evalúan pronunciación desde texto.</small>
 </section>;
}

export function VoiceTutor({learner,login}:{learner:Learner;login:()=>void}){
 const voice=useVoiceSession();
 const [config,setConfig]=useState<VoiceConfig|null>(null),[configError,setConfigError]=useState('');
 const [options,setOptions]=useState<VoiceOptions>({mode:'fluency',level:learner.profile?.level??'unknown',topic:'',scenario:'free',goal:'',voice:'Kore',consent:false,save_summary:false});
 const [showTranscript,setShowTranscript]=useState(false),[history,setHistory]=useState<SavedVoiceSummary[]|null>(null),[historyBusy,setHistoryBusy]=useState(false),[historyError,setHistoryError]=useState('');
 useEffect(()=>{let active=true;api<VoiceConfig>('voice/config').then(value=>{if(active)setConfig(value);}).catch(()=>{if(active)setConfigError('No pudimos consultar la disponibilidad de voz. Vuelve a abrir esta sección.');});return()=>{active=false;};},[]);
 const busy=['permission','connecting','active','reconnecting','finishing'].includes(voice.state);
 const active=voice.state==='active';
 const status=active?(voice.levels.speaking?'Tutor hablando':voice.muted?'El micrófono está apagado':voice.levels.input>0.04?'Escuchando tu audio':voice.waiting?'Esperando respuesta':'Micrófono encendido · puedes hablar'):states[voice.state];
 function update<K extends keyof VoiceOptions>(key:K,value:VoiceOptions[K]){setOptions(previous=>({...previous,[key]:value}));}
 async function loadHistory(){setHistoryBusy(true);setHistoryError('');try{setHistory(await api<SavedVoiceSummary[]>('voice/history'));}catch{setHistoryError('No pudimos cargar tus resúmenes.');}finally{setHistoryBusy(false);}}
 async function remove(id:string){setHistoryBusy(true);setHistoryError('');try{const response=await fetch(`/api/voice/history/${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin'});if(!response.ok)throw new Error();setHistory(h=>h?.filter(s=>s.id!==id)??null);}catch{setHistoryError('No pudimos eliminar el resumen. Inténtalo de nuevo.');}finally{setHistoryBusy(false);}}
 return <section className="voice-layout" aria-label="Tutor por voz"><div className="panel voice-main">
  <header className="row between wrap"><div><span className="eyebrow">UNA CONVERSACIÓN, A TU RITMO</span><h2>Habla con Lingora</h2><span className="badge">Tutor de IA</span></div><time aria-label="Duración de la práctica">{clock(voice.seconds)}</time></header>
  {!learner.session&&<div className="notice"><p>Inicia sesión para practicar por voz y controlar tu consumo.</p><button className="primary" onClick={login}>Iniciar sesión para voz</button></div>}
  {configError&&<p className="error" role="alert">{configError}</p>}
  {config&&!config.enabled&&<p className="notice">La práctica por voz aún no está habilitada. El tutor por texto y las lecciones siguen disponibles.</p>}
  <fieldset disabled={busy} className="voice-options"><legend>Prepara tu conversación</legend>
   <label>Modo<select value={options.mode} onChange={e=>update('mode',e.target.value as VoiceOptions['mode'])}><option value="fluency">Conversación fluida</option><option value="coaching">Tutor activo</option></select></label>
   <label>Mi nivel declarado<select value={options.level} onChange={e=>update('level',e.target.value)}><option value="unknown">No lo sé</option>{['A1','A2','B1','B2','C1','C2'].map(level=><option key={level}>{level}</option>)}</select></label>
   <label>Escenario<select value={options.scenario} onChange={e=>update('scenario',e.target.value as VoiceOptions['scenario'])}><option value="free">Conversación libre</option><option value="coffee">Café y networking</option><option value="debate">Debate amistoso</option><option value="interview">Entrevista laboral</option></select></label>
   <label>Voz<select value={options.voice} onChange={e=>update('voice',e.target.value)}>{(config?.voices??['Kore']).map(name=><option key={name}>{name}</option>)}</select></label>
   <label>Tema o puesto de trabajo<input value={options.topic} maxLength={300} placeholder="Viajes, tecnología, entrevista para diseño…" onChange={e=>update('topic',e.target.value)}/></label>
   <label>Quiero practicar<input value={options.goal} maxLength={200} placeholder="Presentarme y explicar lo que hago" onChange={e=>update('goal',e.target.value)}/></label>
  </fieldset>
  <p className="muted">{options.mode==='fluency'?'Conversamos sin correcciones espontáneas; las observaciones llegan al terminar.':'El tutor puede ayudarte con una corrección breve cuando sea útil.'} Para cambiar de modo o escenario, finaliza e inicia otra práctica.</p>
  <div className="voice-stage" data-state={voice.state}>
   <div className="voice-orb" aria-hidden="true" style={{'--voice-level':voice.levels.speaking?voice.levels.output:voice.levels.input} as CSSProperties}><Sparkles size={44}/></div>
   <span className="sr-only" role="status">{states[voice.state]}{active?(voice.muted?' · micrófono apagado':' · micrófono encendido'):''}</span>
   <p>{status}</p>
   <div className="voice-meter" aria-hidden="true"><span style={{transform:`scaleX(${voice.levels.speaking?voice.levels.output:voice.levels.input})`}}/></div>
   <small>Entrada: {voice.muted||!active?'apagada':'encendida'} · Altavoz: {voice.levels.speaking?'reproduciendo':'en silencio'}</small>
   {active&&!voice.muted&&voice.gentleHint&&<p>Tómate tu tiempo. Puedes empezar con “I would like to talk about…” o pedir ayuda en español.</p>}
  </div>
  {!busy&&<div className="voice-consent">
   <p>Tu audio se envía a Google Gemini para conversar. La transcripción se usa temporalmente para el resumen. Lingora no guarda audio ni la transcripción completa. El tratamiento del proveedor se rige por sus propias condiciones.</p>
   <label><input type="checkbox" checked={options.consent} onChange={e=>update('consent',e.target.checked)}/> Acepto enviar mi audio y transcripción para esta práctica.</label>
   <label><input type="checkbox" checked={options.save_summary} onChange={e=>update('save_summary',e.target.checked)}/> Guardar mi resumen con ejemplos de mis frases, disponible durante 30 días. Podré eliminarlo.</label>
   <small>Máximo {Math.round((config?.max_seconds??300)/60)} minutos por sesión. El permiso del navegador se solicita al iniciar.</small>
  </div>}
  <div className="voice-controls row wrap">
   {!busy&&<button className="primary" disabled={!learner.session||!config?.enabled||!options.consent} onClick={()=>void voice.start(options)}><Mic size={19}/>{voice.summary?'Iniciar nueva práctica':'Iniciar práctica'}</button>}
   {active&&<button className="secondary" onClick={()=>voice.mute(!voice.muted)}>{voice.muted?<Mic size={18}/>:<MicOff size={18}/>} {voice.muted?'Activar micrófono':'Silenciar micrófono'}</button>}
   {active&&<button className="secondary" disabled={!voice.levels.speaking} onClick={voice.stopSpeaker}><VolumeX size={18}/>Detener voz del tutor</button>}
   {busy&&voice.state!=='finishing'&&<button className="danger" onClick={voice.finish}><Square size={17}/>Finalizar</button>}
   <button className="text-button" aria-expanded={showTranscript} aria-controls="voice-transcript" onClick={()=>setShowTranscript(!showTranscript)}>{showTranscript?'Ocultar':'Mostrar'} transcripción</button>
  </div>
  {voice.error&&<p className="error" role="alert">{voice.error}</p>}
  {voice.summary&&<><Summary value={voice.summary}/><p className="muted">{voice.saved?'Resumen guardado en tu cuenta.':'Este resumen no se guardó en tu cuenta. Se descarta al salir.'}</p></>}
 </div><aside className="panel voice-side"><span className="eyebrow">ESPACIO PARA EXPRESARTE</span><h3>No necesitas decirlo perfecto.</h3><p>Piensa un momento, pide ayuda en español o cambia de idea. Usa audífonos para reducir el eco.</p><p>Al cambiar de pestaña se silencia el micrófono. Reactívalo cuando quieras continuar.</p>
  {showTranscript&&<section id="voice-transcript" className="voice-transcript" aria-label="Transcripción de la práctica"><h3>Lo que vamos diciendo</h3><small>Transcripción automática; puede contener errores. Los fragmentos en curso se muestran como parciales.</small>{voice.turns.length===0&&<p>Las frases aparecerán al empezar.</p>}{voice.turns.map(turn=><article key={turn.id}><strong>{turn.role==='user'?'Tú':'Lingora'}{!turn.final?' · parcial':''}</strong><p>{turn.text}</p></article>)}</section>}
  {learner.session&&<><hr/><button className="secondary" disabled={historyBusy} onClick={()=>void loadHistory()}>Ver mis resúmenes guardados</button>{historyError&&<p role="alert" className="error">{historyError}</p>}{history?.length===0&&<p>No tienes resúmenes guardados.</p>}{history?.map(item=><details key={item.id}><summary>Práctica del {new Date(item.created_at*1000).toLocaleDateString('es-MX')}</summary><Summary value={item}/><button className="text-button" disabled={historyBusy} onClick={()=>void remove(item.id)}>Eliminar este resumen</button></details>)}</>}
 </aside></section>;
}
