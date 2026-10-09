const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite'),{StateStore}=require('../server/state-store.cjs'),Core=require('../core.js');
test('Postgres state persists by account and compare-and-swap protects concurrent devices',async t=>{
 const database=new PGlite();t.after(()=>database.close());
 const store=new StateStore(database),state=Core.initial();state.setup=true;
 assert.deepEqual(await store.read('alice'),{revision:0,state:null});
 assert.deepEqual(await store.write('alice',0,state),{revision:1});
 const recovered=new StateStore(database);assert.deepEqual((await recovered.read('alice')).state,state);
 assert.deepEqual(await recovered.read('bob'),{revision:0,state:null});
 const a=structuredClone(state),b=structuredClone(state);a.bills[0].amount=35000;b.bills[0].amount=40000;
 const results=await Promise.allSettled([store.write('alice',1,a),recovered.write('alice',1,b)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await store.read('alice')).revision,2);
 await assert.rejects(()=>store.write('alice',0,b),{status:409});
 await assert.rejects(()=>store.write('alice',2,{...state,startDate:'2999-01-01'}),{status:400});
 assert.equal((await store.read('alice')).revision,2);
});
