import {useState} from 'react';
import {MessageCircle,Mic} from 'lucide-react';
import {Tutor} from './Tutor';
import {VoiceTutor} from './VoiceTutor';
import type {Learner} from '../lib/useLearner';

export function TutorHub(props:{learner:Learner;login:()=>void}){
 const [mode,setMode]=useState<'text'|'voice'>('text');
 return <><div className="row wrap tutor-modes" aria-label="Modalidad del tutor"><button className={mode==='text'?'primary':'secondary'} aria-pressed={mode==='text'} onClick={()=>setMode('text')}><MessageCircle size={18}/>Por texto</button><button className={mode==='voice'?'primary':'secondary'} aria-pressed={mode==='voice'} onClick={()=>setMode('voice')}><Mic size={18}/>Por voz</button></div>{mode==='text'?<Tutor {...props}/>:<VoiceTutor {...props}/>}</>;
}
