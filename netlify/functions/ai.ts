import { createHash } from 'node:crypto';
import { requestSchema,budgets,buildContext,GeminiProvider,tutorPolicy } from '../../server/ai';
import { authenticate,json,failure } from '../../server/http';
export default async function handler(request:Request){
 if(request.method!=='POST')return json({error:'Método no permitido'},405);
 let reservation:string|undefined;
 let admin:Awaited<ReturnType<typeof authenticate>>['admin']|undefined;
 const start=Date.now();
 try{
  const auth=await authenticate(request);admin=auth.admin;
  if(process.env.AI_ENABLED!=='true'||!process.env.AI_API_KEY||!process.env.AI_MODEL)return json({error:'El tutor IA aún no está habilitado. Las lecciones y los repasos siguen disponibles.'},503);
  if(process.env.AI_PROVIDER!=='gemini')return json({error:'El proveedor configurado no está implementado.'},503);
  if(Number(request.headers.get('content-length')??0)>3_000_000)return json({error:'Archivo demasiado grande.'},413);
  const raw=await request.text();if(raw.length>3_000_000)return json({error:'Solicitud demasiado grande.'},413);
  const parsed=requestSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Revisa el mensaje o el audio enviado.'},400);
  const input=parsed.data;
  if(input.operation==='audio'&&!input.audio)return json({error:'Falta la grabación.'},400);
  if(input.operation!=='audio'&&input.audio)return json({error:'Audio no permitido para esta operación.'},400);
  const limit=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isInteger(n)&&n>=0?n:fallback;};
  const quota=await admin.rpc('reserve_ai',{p_user:auth.user.id,p_operation:input.operation,p_user_limit:limit('AI_DAILY_CALLS_PER_USER',20),p_global_limit:limit('AI_DAILY_CALLS_GLOBAL',100),p_minute_limit:limit('AI_MAX_CALLS_PER_MINUTE',4)});
  if(quota.error)return json({error:'Llegaste al límite temporal de IA. Continúa con lecciones y repasos e inténtalo más tarde.'},429);
  reservation=quota.data;
  const [profile,history,errors]=await Promise.all([auth.db.from('profiles').select('*').eq('id',auth.user.id).single(),auth.db.from('messages').select('role,content').order('id',{ascending:false}).limit(6),auth.db.from('user_errors').select('original,correction,explanation').order('last_occurrence',{ascending:false}).limit(3)]);
  if(profile.error||history.error||errors.error)throw new Error('CONTEXT');
  const context=buildContext(profile.data,input.message,input.lessonId,errors.data??[],[...(history.data??[])].reverse());
  const cacheKey=createHash('sha256').update(`${auth.user.id}:${process.env.AI_MODEL}:v1:${input.message}:${input.lessonId}:${profile.data.level}`).digest('hex');
  if(input.operation==='explain'){
   const cached=await admin.from('ai_cache').select('response').eq('cache_key',cacheKey).gt('expires_at',new Date().toISOString()).maybeSingle();
   if(cached.data){await admin.from('ai_requests').update({status:'cache_hit',latency_ms:Date.now()-start,input_tokens:0,output_tokens:0}).eq('id',reservation);return json({text:cached.data.response,cached:true});}
  }
  const provider=new GeminiProvider(process.env.AI_API_KEY,process.env.AI_MODEL);
  const result=await provider.generate({system:tutorPolicy,prompt:JSON.stringify({operation:input.operation,context:JSON.parse(context),request:input.message}),maxTokens:budgets[input.operation],audio:input.audio});
  const cost=process.env.AI_PRICE_CONFIGURED==='true'?(result.inputTokens*Number(process.env.AI_INPUT_COST_PER_MILLION??0)+result.outputTokens*Number(process.env.AI_OUTPUT_COST_PER_MILLION??0))/1e6:null;
  const audit=await admin.from('ai_requests').update({status:'success',model:process.env.AI_MODEL,input_tokens:result.inputTokens,output_tokens:result.outputTokens,latency_ms:Date.now()-start,estimated_cost:cost}).eq('id',reservation);
  if(audit.error)throw new Error('AUDIT');
  if(input.operation==='tutor'){
   const saved=await admin.from('messages').insert([{user_id:auth.user.id,role:'user',content:input.message},{user_id:auth.user.id,role:'assistant',content:result.text}]);
   if(saved.error)throw new Error('HISTORY');
  }
  if(input.operation==='explain')await admin.from('ai_cache').upsert({cache_key:cacheKey,user_id:auth.user.id,response:result.text,expires_at:new Date(Date.now()+7*86400000).toISOString()});
  console.info(JSON.stringify({event:'ai_request',id:reservation,status:'success',latency_ms:Date.now()-start}));
  return json({text:result.text,cached:false});
 }catch(error){
  if(admin&&reservation)await admin.from('ai_requests').update({status:'error',latency_ms:Date.now()-start}).eq('id',reservation);
  if(error instanceof SyntaxError)return json({error:'Solicitud inválida.'},400);
  return failure(error);
 }
}
