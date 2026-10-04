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
