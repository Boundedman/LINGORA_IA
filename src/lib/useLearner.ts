import {useCallback,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db,requireDb} from './db';
import type {Profile,Progress,Review,Diagnostic,Lesson} from '../domain/types';
import {curriculum} from '../data/curriculum';
export function useLearner(){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const [progress,setProgress]=useState<Progress[]>([]),[reviews,setReviews]=useState<Review[]>([]),[diagnostic,setDiagnostic]=useState<Diagnostic|null>(null),[lessons,setLessons]=useState<Lesson[]>(curriculum);
 const [error,setError]=useState(''),[loading,setLoading]=useState(Boolean(db));
 useEffect(()=>{if(!db)return;db.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(data.session);setLoading(false);});const {data}=db.auth.onAuthStateChange((_event,s)=>{setSession(s);});return()=>data.subscription.unsubscribe();},[]);
 const refresh=useCallback(async()=>{
  if(!session||!db){setProfile(null);setProgress([]);setReviews([]);setDiagnostic(null);return;}
  const responses=await Promise.all([db.from('profiles').select('*').eq('id',session.user.id).single(),db.from('lesson_progress').select('*'),db.from('reviews').select('*').order('next_review'),db.from('diagnostics').select('*').maybeSingle(),db.from('lessons').select('payload').eq('active',true)]);
  const failed=responses.find(r=>r.error);if(failed?.error)throw new Error('No se pudo sincronizar. Comprueba la conexión y la configuración de la base de datos.');
  setProfile(responses[0].data as Profile);setProgress(responses[1].data as Progress[]);setReviews(responses[2].data as Review[]);setDiagnostic(responses[3].data as Diagnostic|null);
  const stored=responses[4].data as {payload:Lesson}[];if(stored.length)setLessons(stored.map(x=>x.payload));else setError('El catálogo aún no está cargado en la base de datos. Puedes leer el contenido local, pero no guardar ejercicios hasta importar las lecciones.');
 },[session]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 useEffect(()=>{const sync=()=>{if(document.visibilityState==='visible')void refresh().catch(e=>setError(e.message));};window.addEventListener('focus',sync);return()=>window.removeEventListener('focus',sync);},[refresh]);
 async function updateProfile(values:Partial<Profile>){if(!session)throw new Error('Inicia sesión.');const {error}=await requireDb().from('profiles').update(values).eq('id',session.user.id);if(error)throw error;await refresh();}
 return {session,profile,progress,reviews,diagnostic,lessons,error,setError,loading,refresh,updateProfile,setDiagnostic};
}
export type Learner=ReturnType<typeof useLearner>;
