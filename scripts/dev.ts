import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {loadEnvFile} from 'node:process';
import ai from '../netlify/functions/ai';
import account from '../netlify/functions/account';
try{loadEnvFile('.env');}catch{/* Optional until services are configured. */}
const handlers:Record<string,(request:Request)=>Promise<Response>>={'/api/ai':ai,'/api/account':account};
const server=createServer(async(req,res)=>{
 try{
  const handler=handlers[req.url?.split('?')[0]??''];
  if(!handler){res.writeHead(404);res.end('Not found');return;}
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>3_000_000){res.writeHead(413);res.end('Request too large');return;}chunks.push(Buffer.from(chunk));}
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers)){if(v)headers.set(k,Array.isArray(v)?v.join(','):v);}
  const request=new Request(`http://127.0.0.1:8787${req.url}`,{method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Buffer.concat(chunks)}:{})});
  const result=await handler(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'No se pudo completar la solicitud.'}));}
});
server.listen(8787,'127.0.0.1',()=>console.log('Local API: http://127.0.0.1:8787'));
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
function stop(){vite.kill();server.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);vite.on('exit',()=>server.close());
