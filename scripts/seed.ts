import { createClient } from '@supabase/supabase-js';
import { curriculum } from '../src/data/curriculum';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env'); } catch { /* Environment variables also work in CI. */ }
if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {error}=await db.from('lessons').upsert(curriculum.map(l=>({id:l.id,level:l.level,skill:l.skill,payload:l,active:true})));
if(error)throw error;
console.log(`Importadas ${curriculum.length} lecciones originales A1–B2.`);
