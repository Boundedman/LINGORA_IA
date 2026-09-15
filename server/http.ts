import { createClient } from '@supabase/supabase-js';
export function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
export async function authenticate(request:Request){
 const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!service)throw new Error('SETUP');
 const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new Error('AUTH');
 const db=createClient(url,anon,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data,error}=await db.auth.getUser(token);
 if(error||!data.user)throw new Error('AUTH');
 return {user:data.user,db,admin:createClient(url,service,{auth:{persistSession:false}})};
}
export function failure(error:unknown){
 const message=error instanceof Error?error.message:'UNKNOWN';
 if(message==='AUTH')return json({error:'Inicia sesión nuevamente.'},401);
 if(message==='SETUP')return json({error:'Este servicio todavía no está configurado.'},503);
 return json({error:'No pudimos completar la solicitud. Tu progreso guardado sigue disponible.'},503);
}
