import {useCallback,useEffect,useRef,useState} from 'react';
import {db,api,type Session} from './db';
import type {Profile,Progress,Review,Diagnostic,Lesson} from '../domain/types';
import {curriculum} from '../data/curriculum';
type State={profile:Profile;avatar_data:string|null;progress:Progress[];reviews:Review[];diagnostic:Diagnostic|null;lessons:Lesson[]};
export function useLearner(){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const [progress,setProgress]=useState<Progress[]>([]),[reviews,setReviews]=useState<Review[]>([]),[diagnostic,setDiagnostic]=useState<Diagnostic|null>(null),[lessons,setLessons]=useState<Lesson[]>(curriculum);
 const [avatar,setAvatar]=useState<string|null>(null);
 const sessionId=useRef<string|null>(null),version=useRef(0);
 const pending=useRef(0),lastFocusSync=useRef(0);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let mounted=true;
  const accept=(s:Session|null)=>{++version.current;sessionId.current=s?.user.id??null;setSession(s);setProfile(null);setAvatar(null);setProgress([]);setReviews([]);setDiagnostic(null);setError('');};
  const initial=version.current;
  db.auth.getSession().then(({data,error})=>{if(!mounted||initial!==version.current)return;accept(data.session);if(error)setError(error.message);setLoading(false);});
  const {data}=db.auth.onAuthStateChange((_event,s)=>{if(mounted){accept(s);setLoading(false);}});
  return()=>{mounted=false;++version.current;data.subscription.unsubscribe();};
 },[]);
 const refresh=useCallback(async()=>{
  if(!session){return;}
  const id=session.user.id;if(sessionId.current!==id)return;
  const request=++version.current;
  ++pending.current;
  let data:State;
  try{data=await api<State>('learner');}finally{--pending.current;}
  if(request!==version.current||sessionId.current!==id)return;
  setAvatar(data.avatar_data??null);
  setProfile(data.profile);setProgress(data.progress);setReviews(data.reviews);setDiagnostic(data.diagnostic);setLessons(data.lessons);
 },[session]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 useEffect(()=>{lastFocusSync.current=0;const sync=()=>{if(document.visibilityState!=='visible'||pending.current||Date.now()-lastFocusSync.current<15000)return;lastFocusSync.current=Date.now();void refresh().catch(e=>setError(e.message));};window.addEventListener('focus',sync);return()=>window.removeEventListener('focus',sync);},[refresh]);
 async function updateProfile(values:Partial<Profile>){const id=sessionId.current;const data=await api<Profile>('profile',values);if(id!==sessionId.current)return;++version.current;setProfile(data);}
 async function updateAvatar(avatar_data:string|null){const id=sessionId.current;const data=await api<{avatar_data:string|null}>('account/avatar',{avatar_data});if(id!==sessionId.current)return;++version.current;setAvatar(data.avatar_data);}
 return {session,profile,avatar,updateAvatar,progress,reviews,diagnostic,lessons,error,setError,loading,refresh,updateProfile,setDiagnostic};
}
export type Learner=ReturnType<typeof useLearner>;
