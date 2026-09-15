import { curriculum } from './curriculum';
import type { Level, Skill } from '../domain/types';
export type Question = {id:string;skill:Skill;level:Level;prompt:string;choices?:string[];answer?:string;passage?:string;audio?:string};
export const questionBank:Question[] = curriculum.flatMap(l=>{
 if(!['vocabulary','grammar','reading','listening'].includes(l.skill))return [];
 const e=l.exercises[0];
 return [{id:l.id,skill:l.skill,level:l.level,prompt:e.prompt,choices:e.choices,answer:e.answer,passage:l.skill==='reading'?l.explanation:undefined,audio:e.transcript}];
});
export const diagnosticSkills:Skill[] = ['vocabulary','grammar','reading','listening'];
// A short orientation sample, not a standardized CEFR examination.
export function chooseQuestion(answers:Record<string,string>):Question|undefined {
 for(const skill of diagnosticSkills){
  const completed=questionBank.filter(q=>q.skill===skill && q.id in answers);
  if(completed.length>=2)continue;
  const first=completed[0];
  const correct=first && answers[first.id].trim().toLowerCase()===first.answer?.toLowerCase();
  const level:Level=first?(correct?'B2':'A1'):'A2';
  return questionBank.find(q=>q.skill===skill && q.level===level);
 }
 return undefined;
}
