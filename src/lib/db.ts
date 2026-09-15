import { createClient } from '@supabase/supabase-js';
const url=import.meta.env?.VITE_SUPABASE_URL;
const key=import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const db=url&&key?createClient(url,key):null;
export function requireDb(){if(!db)throw new Error('Las cuentas aún no están habilitadas. Puedes explorar las lecciones.');return db;}
export async function api<T>(name:string,body:unknown):Promise<T>{
 const {data}=await requireDb().auth.getSession();
 if(!data.session)throw new Error('Inicia sesión para continuar.');
 const response=await fetch(`/api/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body)});
 let result;try{result=await response.json();}catch{throw new Error('El servidor no está disponible. Usa el entorno completo de Netlify para las funciones.');}
 if(!response.ok)throw new Error(result.error??'No se pudo completar la solicitud.');
 return result as T;
}
