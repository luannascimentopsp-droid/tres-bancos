'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../core.js'),B=require('../bank-sync.js'),P=require('../planner.js');
function base(){const s=C.initial();s.setup=true;s.accounts[0].opening=10000;s.bills[0].amount=100000;return s;}
function snapshot(cents=25000,version='a'.repeat(64),updatedAt=new Date().toISOString()){return {accounts:[{id:'bank-account-1',version,cents,currency:'BRL',type:'BANK',updatedAt}]};}
test('bank balance reconciliation changes goal without inventing income or paying bills',()=>{
 const before=base(),s=B.apply(before,snapshot(),{c6:'bank-account-1'});
 assert.equal(C.balances(s).c6,25000);assert.equal(C.totals(s,C.today().slice(0,7)).income,0);
 assert.equal(C.paid(s,'rent',C.today().slice(0,7)),0);assert.equal(P.monthPlan(before).needed-P.monthPlan(s).needed,15000);
 assert.equal(before.transactions.length,0);assert.deepEqual(C.validate(JSON.parse(JSON.stringify(s))),s);
});
test('same provider snapshot never resets later manual transactions or creates duplicates',()=>{
 const snap=snapshot();let s=B.apply(base(),snap,{c6:'bank-account-1'});
 s=C.add(s,{id:'manual-income',kind:'income',account:'c6',date:C.today(),cents:1000});
 const again=B.apply(s,snap,{c6:'bank-account-1'});assert.equal(C.balances(again).c6,26000);assert.equal(again.transactions.length,2);
});
test('zero difference records synchronization metadata with no zero-value transaction',()=>{
 const s=B.apply(base(),snapshot(10000),{c6:'bank-account-1'});assert.equal(s.transactions.length,0);assert.ok(s.bankSync.c6);
});
test('new snapshot can reflect a negative balance but never credit limits or foreign currency',()=>{
 const s=B.apply(base(),snapshot(-1234),{c6:'bank-account-1'});assert.equal(C.balances(s).c6,-1234);
 for(const change of [{type:'CREDIT'},{currency:'USD'},{cents:null},{cents:NaN},{cents:0.1},{version:'invalid'},{updatedAt:'invalid'}]){
  const snap=snapshot();Object.assign(snap.accounts[0],change);assert.throws(()=>B.apply(base(),snap,{c6:'bank-account-1'}));
 }
});
test('source account cannot feed two local banks, including previously saved mappings',()=>{
 assert.throws(()=>B.apply(base(),snapshot(),{c6:'bank-account-1',nu:'bank-account-1'}));
 const s=B.apply(base(),snapshot(),{c6:'bank-account-1'});assert.throws(()=>B.apply(s,snapshot(),{nu:'bank-account-1'}));
});
test('old snapshot and unknown or duplicate accounts fail without changing state',()=>{
 const snap=snapshot(),s=B.apply(base(),snap,{c6:'bank-account-1'}),serialized=JSON.stringify(s);
 assert.throws(()=>B.apply(s,snapshot(30000,'b'.repeat(64),'2020-01-01T00:00:00Z'),{c6:'bank-account-1'}));
 assert.throws(()=>B.apply(s,snap,{c6:'missing'}));assert.throws(()=>B.apply(s,{accounts:[...snap.accounts,...snap.accounts]},{c6:'bank-account-1'}));
 assert.equal(JSON.stringify(s),serialized);
});
test('malformed synchronization metadata is rejected on backup restore',()=>{
 const s=base();for(const value of [null,[],{fake:{}},{c6:{sourceId:'../secret',version:'a'.repeat(64)}}]){s.bankSync=value;assert.throws(()=>C.validate(s));}
});
