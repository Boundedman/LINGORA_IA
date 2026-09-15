import { authenticate,json,failure } from '../../server/http';
export default async function handler(request:Request){
 if(request.method!=='POST')return json({error:'Método no permitido'},405);
 try{
  const {user,admin,db}=await authenticate(request);
  const body=await request.json();
  if(body.action==='delete'&&body.confirmation==='ELIMINAR'){
   const result=await admin.auth.admin.deleteUser(user.id);if(result.error)throw result.error;
   return json({deleted:true});
  }
  if(body.action==='clear-history'){
   const result=await admin.from('messages').delete().eq('user_id',user.id);if(result.error)throw result.error;
   return json({deleted:true});
  }
  if(body.action==='export'){
   const tables=['profiles','lesson_progress','reviews','diagnostics','user_errors','messages','exercise_attempts'];
   const result:Record<string,unknown>={};
   for(const table of tables){const query=await db.from(table).select('*').eq(table==='profiles'?'id':'user_id',user.id).limit(10000);if(query.error)throw query.error;result[table]=query.data;}
   return json(result);
  }
  return json({error:'Acción inválida'},400);
 }catch(error){return failure(error);}
}
