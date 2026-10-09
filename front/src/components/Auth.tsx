import {useRef,useState} from 'react';
import {requireDb} from '../lib/db';
import {PhotoPicker} from './PhotoPicker';
import {useDialog} from '../lib/useDialog';
export function Auth({close}:{close:()=>void}){
 const dialog=useRef<HTMLElement>(null);useDialog(dialog,true,close);
 const [name,setName]=useState(''),[photo,setPhoto]=useState<string|null>(null),[reading,setReading]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState<'login'|'signup'|'reset'>('login'),[adult,setAdult]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{
  const client=requireDb();
  const result=mode==='login'?await client.auth.signInWithPassword({email,password}):mode==='signup'?await client.auth.signUp({display_name:name.trim(),email,password,avatar_data:photo}):await client.auth.resetPasswordForEmail(email);
  if(result.error)throw result.error;
  if(mode!=='reset')close();else setMessage('Si la cuenta existe, recibirás un enlace para cambiar la contraseña.');
 }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="close" aria-label="Cerrar" onClick={close}>×</button><span className="eyebrow">TU ESPACIO DE APRENDIZAJE</span><h2 id="auth-title">{mode==='login'?'Qué gusto verte de nuevo':mode==='signup'?'Empieza tu camino':'Recupera tu acceso'}</h2><p>Una cuenta, todos tus dispositivos. Piloto para adultos invitados.</p><form onSubmit={submit}>{mode==='signup'&&<label>Nombre<input autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>}<label>Correo electrónico<input autoFocus type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>{mode!=='reset'&&<label>Contraseña<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==='login'?'current-password':'new-password'}/></label>}{mode==='signup'&&<PhotoPicker value={photo} onChange={setPhoto} disabled={busy||reading} onReading={setReading}/>}
{mode==='signup'&&<label className="check"><input type="checkbox" required checked={adult} onChange={e=>setAdult(e.target.checked)}/>Confirmo que soy mayor de edad y participo en el piloto.</label>}<button className="primary" disabled={busy||reading||(mode==='signup'&&!name.trim())}>{busy?'Un momento…':mode==='login'?'Entrar':mode==='signup'?'Crear cuenta':'Enviar enlace'}</button></form>{message&&<p role="status" className="notice">{message}</p>}<div className="row wrap"><button className="text-button" onClick={()=>setMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Ya tengo cuenta':'Crear cuenta'}</button><button className="text-button" onClick={()=>setMode('reset')}>Olvidé mi contraseña</button></div></section></div>;
}
