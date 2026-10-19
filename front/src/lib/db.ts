export type Session={user:{id:string;email:string}};
type Result<T>={data:T|null;error:Error|null};
export async function api<T>(name:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/${name}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let result;try{result=await response.json();}catch{throw new Error('El servidor FastAPI no está disponible.');}
 if(!response.ok)throw new Error(result.error??'No se pudo completar la solicitud.');
 return result as T;
}
async function result<T>(work:()=>Promise<T>):Promise<Result<T>>{try{return {data:await work(),error:null};}catch(error){return {data:null,error:error instanceof Error?error:new Error('No se pudo conectar con FastAPI.')};}}
const listeners=new Set<(event:string,session:Session|null)=>void>();
async function notify(){const data=await api<{session:Session|null}>('auth/session');listeners.forEach(fn=>fn('SESSION_CHANGED',data.session));return data;}
export const db={
 auth:{
  async getSession(){try{return {data:await api<{session:Session|null}>('auth/session'),error:null};}catch(error){return {data:{session:null},error:error as Error};}},
  onAuthStateChange(fn:(event:string,session:Session|null)=>void){listeners.add(fn);return {data:{subscription:{unsubscribe(){listeners.delete(fn);}}}};},
  signInWithPassword(values:{email:string;password:string}){return result(async()=>{await api('auth/login',values);return notify();});},
  signUp(values:{display_name:string;email:string;password:string}){return result(async()=>{await api('auth/signup',values);return notify();});},
  resetPasswordForEmail(email:string){return result(()=>api('auth/reset',{email}));},
  updateUser(values:{password:string;token?:string}){return result(async()=>{await api('auth/password',values);return notify();});},
  async signOut(){await api('auth/logout',{});listeners.forEach(fn=>fn('SIGNED_OUT',null));}
 },
 rpc(name:string,body:unknown){return result(()=>api(`rpc/${name}`,body));}
};
export function requireDb(){return db;}
