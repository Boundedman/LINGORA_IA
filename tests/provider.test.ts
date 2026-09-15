import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GeminiProvider} from '../server/ai';
import handler from '../netlify/functions/ai';
test('provider enforces token budget and does not return internal thought parts',async()=>{
 const original=globalThis.fetch;
 let body:Record<string,any>={};
 globalThis.fetch=async(_url,options)=>{body=JSON.parse(options?.body as string);return new Response(JSON.stringify({candidates:[{content:{parts:[{thought:true,text:'internal'},{text:'Try: I am 18 years old.'}]}}],usageMetadata:{promptTokenCount:40,candidatesTokenCount:12}}));};
 try{const p=new GeminiProvider('test-only-key','test-model');const result=await p.generate({system:'test policy',prompt:'example',maxTokens:250});assert.equal(body.generationConfig.maxOutputTokens,250);assert.equal(result.inputTokens,40);assert.equal(result.text,'Try: I am 18 years old.');}finally{globalThis.fetch=original;}
});
test('provider failure is surfaced rather than fabricated as a tutor response',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});try{await assert.rejects(()=>new GeminiProvider('test-only-key','test-model').generate({system:'test',prompt:'hello',maxTokens:50}),/PROVIDER_503/);}finally{globalThis.fetch=original;}});
test('API rejects unsupported methods without invoking a provider',async()=>{const response=await handler(new Request('http://localhost/api/ai',{method:'GET'}));assert.equal(response.status,405);});
