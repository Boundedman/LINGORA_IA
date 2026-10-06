export type VoiceState='ready'|'permission'|'connecting'|'active'|'reconnecting'|'finishing'|'finished'|'error';
export type VoiceOptions={mode:'fluency'|'coaching';level:string;topic:string;scenario:'free'|'coffee'|'debate'|'interview';goal:string;voice:string;consent:boolean;save_summary:boolean};
export type VoiceConfig={enabled:boolean;model:string|null;voices:string[];max_seconds:number;retention_days:number};
export type VoiceTurn={id:string;role:'user'|'assistant';text:string;final:boolean};
export type VoiceSummary={strengths:{turn_id:string;excerpt:string;explanation_es:string}[];improvements:{turn_id:string;category:string;original_excerpt:string;suggested_alternative:string;explanation_es:string;confidence:string;is_optional_improvement:boolean}[];practice:string;insufficient_evidence:boolean;partial:boolean;duration_seconds:number;participation:null;evaluation_status:string};
export type SavedVoiceSummary=VoiceSummary&{id:string;created_at:number};
export function emptySummary(seconds:number):VoiceSummary{return {strengths:[],improvements:[],practice:'Practica una presentación breve: quién eres, qué te gusta y por qué.',insufficient_evidence:true,partial:true,duration_seconds:Math.round(seconds),participation:null,evaluation_status:'unavailable'};}
