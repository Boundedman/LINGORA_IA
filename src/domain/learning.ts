import type { Lesson, Progress, Level, Skill } from './types';
import { levels } from './types';
export function normalize(value:string) { return value.trim().toLocaleLowerCase('en').replace(/[’‘]/g,"'").replace(/[.!?]+$/g,'').replace(/\s+/g,' '); }
export function isCorrect(answer:string, expected:string) { return normalize(answer) === normalize(expected); }
export function nextLesson(lessons:Lesson[], progress:Progress[], level:Level):Lesson|undefined {
  const done = new Set(progress.filter(p=>p.completed).map(p=>p.lesson_id));
  const resume = progress.find(p=>!p.completed && p.step>0);
  if (resume) return lessons.find(l=>l.id===resume.lesson_id);
  return lessons.find(l=>l.level===level && !done.has(l.id) && (!l.prerequisite || done.has(l.prerequisite))) ?? lessons.find(l=>l.level===level && !done.has(l.id));
}
// SM-2 is an explicit, inexpensive baseline. Do not label it FSRS.
export function scheduleReview(repetitions:number, interval:number, ease:number, quality:0|3|4|5) {
  const nextEase = Math.max(1.3,ease + 0.1-(5-quality)*(0.08+(5-quality)*0.02));
  if(quality<3) return {repetitions:0, interval_days:1, ease:nextEase};
  return {repetitions:repetitions+1, interval_days:repetitions===0?1:repetitions===1?6:Math.max(1,Math.round(interval*ease)), ease:nextEase};
}
export function estimateSkill(items:{level:Level;correct:boolean}[]): {level:Level|null;confidence:'insufficient'|'initial'} {
  if(items.length<2) return {level:null,confidence:'insufficient'};
  const passed=items.filter(i=>i.correct).map(i=>levels.indexOf(i.level));
  if(!passed.length) return {level:'A1',confidence:'initial'};
  return {level:levels[Math.max(...passed)],confidence:'initial'};
}
export function diagnosticNextLevel(previous:Level, correct:boolean):Level { return levels[Math.min(3,Math.max(0,levels.indexOf(previous)+(correct?1:-1)))]; }
export function remainingSeconds(elapsed:number){ return Math.max(0,900-Math.max(0,elapsed)); }
export function skillEvidence(lessons:Lesson[],progress:Progress[],skill:Skill){const ids=new Set(lessons.filter(l=>l.skill===skill).map(l=>l.id));return progress.filter(p=>ids.has(p.lesson_id)).reduce((a,p)=>({correct:a.correct+p.correct,attempts:a.attempts+p.attempts,completed:a.completed+Number(p.completed)}),{correct:0,attempts:0,completed:0});}
