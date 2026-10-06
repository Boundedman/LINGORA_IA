import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('WebSocket upgrade is returned intact with cookies and origin',async t=>{
  const upgraded={status:101,webSocket:{marker:true}};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),'https://backend.example/api/voice/live');
    assert.equal(options.headers.get('upgrade'),'websocket');
    assert.equal(options.headers.get('cookie'),'lingora_session=test');
    assert.equal(options.headers.get('origin'),'https://app.example');
    return upgraded;
  });
  const result=await worker.fetch(new Request('https://app.example/api/voice/live',{headers:{Upgrade:'websocket',Cookie:'lingora_session=test',Origin:'https://app.example'}}),{BACKEND_URL:'https://backend.example'});
  assert.equal(result,upgraded);
});

test('static pages use assets and API without configuration returns JSON', async () => {
  const env = {ASSETS:{fetch:async()=>new Response('page')}};
  assert.equal(await (await worker.fetch(new Request('https://app.example/'),env)).text(),'page');
  for (const path of ['/api','/api/auth/session']) {
    const result = await worker.fetch(new Request('https://app.example'+path),env);
    assert.equal(result.status,503);
    assert.match((await result.json()).error,/backend/);
  }
});

test('API proxy preserves query, body, session and origin without caching', async t => {
  t.mock.method(globalThis,'fetch',async (url, options) => {
    assert.equal(String(url),'https://backend.example/api/profile?check=1');
    assert.equal(options.method,'POST');
    assert.equal(options.headers.get('cookie'),'lingora_session=test');
    assert.equal(options.headers.get('origin'),'https://app.example');
    assert.equal(options.redirect,'manual');
    assert.equal(await new Response(options.body).text(),'{"display_name":"Ana"}');
    return new Response('{"ok":true}',{headers:{'Set-Cookie':'lingora_session=new; HttpOnly; Secure; SameSite=Strict'}});
  });
  const request = new Request('https://app.example/api/profile?check=1',{
    method:'POST', body:'{"display_name":"Ana"}',
    headers:{Cookie:'lingora_session=test',Origin:'https://app.example'}
  });
  const result = await worker.fetch(request,{BACKEND_URL:'https://backend.example'});
  assert.match(result.headers.get('set-cookie'),/lingora_session=new/);
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual(await result.json(),{ok:true});
});

test('invalid destinations and upstream outages return explicit errors', async t => {
  const request = new Request('https://app.example/api/health');
  for (const url of ['http://backend.example','https://app.example','https://backend.example/api','https://user:secret@backend.example']) {
    assert.equal((await worker.fetch(request,{BACKEND_URL:url})).status,503);
  }
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
  assert.equal((await worker.fetch(request,{BACKEND_URL:'https://backend.example'})).status,502);
});
