'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const {Pluggy,cents}=require('../server/pluggy.cjs'),{createApp}=require('../server/server.cjs');
const itemId='11111111-1111-4111-8111-111111111111',accountId='22222222-2222-4222-8222-222222222222';
function mock({status='UPDATED',balance=12.34,total=1,totalPages=1}={}){
 const calls=[];return {calls,fetchImpl:async(url,options)=>{
  calls.push({url,options});let data;
  if(url.endsWith('/auth'))data={apiKey:'provider-private-key'};
  else if(url.includes('/items/'))data={id:itemId,status,lastUpdatedAt:'2026-10-04T12:00:00Z',connector:{name:'Banco Teste'}};
  else data={total,totalPages,results:[{id:accountId,itemId,type:'BANK',currencyCode:'BRL',balance,number:'12345-6',name:'Conta',owner:'not-to-expose',taxNumber:'not-to-expose'}]};
  return {ok:true,json:async()=>data};
 }};
}
function provider(options={}){return new Pluggy({clientId:'client',clientSecret:'secret',itemIds:[itemId],...options});}
test('provider keeps secrets server-side and emits only normalized necessary account data',async()=>{
 const m=mock(),p=provider(m);const s=await p.snapshot();assert.equal(s.accounts[0].cents,1234);assert.equal(s.accounts[0].last4,'3456');
 assert.ok(!JSON.stringify(s).includes('not-to-expose'));assert.ok(!JSON.stringify(s).includes('provider-private-key'));
 assert.equal(m.calls[0].url,'https://api.pluggy.ai/auth');assert.equal(m.calls[1].options.headers['X-API-KEY'],'provider-private-key');
 await p.snapshot();assert.equal(m.calls.filter(c=>c.url.endsWith('/auth')).length,1);
});
test('provider refreshes expired API key and redacts upstream errors',async()=>{
 let now=0;const m=mock(),p=provider({...m,now:()=>now});await p.snapshot();now=101*60000;await p.snapshot();assert.equal(m.calls.filter(c=>c.url.endsWith('/auth')).length,2);
 const bad=provider({fetchImpl:async()=>({ok:false,status:403,json:async()=>({secret:'secret'})})});await assert.rejects(()=>bad.snapshot(),/Acesso ao provedor recusado/);
});
test('pending and revoked connections never return applicable balances',async()=>{
 for(const status of ['UPDATING','WAITING_USER_INPUT','LOGIN_ERROR','OUTDATED']){const s=await provider(mock({status})).snapshot();assert.equal(s.accounts.length,0);assert.equal(s.issues.length,1);}
});
test('missing balances, incomplete lists and invalid item identifiers fail closed',async()=>{
 for(const balance of [null,undefined,NaN,'10',Infinity])assert.throws(()=>cents(balance));
 await assert.rejects(()=>provider(mock({balance:null})).snapshot());
 await assert.rejects(()=>provider(mock({total:2})).snapshot());
 await assert.rejects(()=>provider(mock({totalPages:2})).snapshot());
 assert.throws(()=>provider({itemIds:['../../secret']}));
});
test('read-only private server requires access key, rejects foreign origins and never serves private files',async t=>{
 // Reserve an ephemeral port to construct the strict expected origin.
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const origin=`http://127.0.0.1:${port}`,key='x'.repeat(40);let calls=0;
 const server=createApp({accessKey:key,origin,provider:{snapshot:async()=>{calls++;return {accounts:[],issues:[]};}}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const headers={Authorization:'Bearer '+key};
 assert.equal((await fetch(origin+'/api/bank/snapshot')).status,401);
 assert.equal((await fetch(origin+'/api/bank/snapshot',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 const badHost=await new Promise((resolve,reject)=>{require('node:http').get(origin+'/api/bank/snapshot',{headers:{...headers,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(badHost,403);
 assert.equal((await fetch(origin+'/api/bank/snapshot',{method:'POST',headers})).status,405);
 for(const name of ['.env','server/config.example','server/server.cjs','.git/config'])assert.equal((await fetch(origin+'/'+name)).status,404);
 const first=await fetch(origin+'/api/bank/snapshot',{headers});assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-store');assert.equal(first.headers.get('access-control-allow-origin'),null);
 await fetch(origin+'/api/bank/snapshot',{headers});assert.equal(calls,1);
 assert.match(await (await fetch(origin+'/bank-config.js')).text(),/enabled:true/);
});
test('private service refuses short keys and non-HTTPS public origins',()=>{
 assert.throws(()=>createApp({accessKey:'short',origin:'http://127.0.0.1:8787'}));
 assert.throws(()=>createApp({accessKey:'x'.repeat(32),origin:'http://public.example'}));
});
