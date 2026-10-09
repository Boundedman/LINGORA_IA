import {useRef,useState} from 'react';
import {db} from '../lib/db';
import {useDialog} from '../lib/useDialog';
export function ResetPassword({token,close}:{token:string;close:()=>void}){
 const dialog=useRef<HTMLElement>(null);useDialog(dialog,true,close);
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><button className="close" aria-label="Cerrar" onClick={close}>×</button><span className="eyebrow">RECUPERA TU ACCESO</span><h2 id="reset-title">Elige una nueva contraseña</h2><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const result=await db.auth.updateUser({password,token});setBusy(false);if(result.error)setError(result.error.message);else close();}}><label>Nueva contraseña<input type="password" required minLength={10} maxLength={256} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar contraseña'}</button></form>{error&&<p className="error" role="alert">{error}</p>}</section></div>;
}
