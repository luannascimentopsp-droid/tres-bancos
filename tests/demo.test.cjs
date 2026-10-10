'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Core=require('../core.js');
function demo(){
 const context={window:{},Core,structuredClone,document:{getElementById:()=>({addEventListener(){}})},location:{reload(){}}};
 Object.defineProperty(context.window,'localStorage',{get(){throw Error('Demo must never access real browser data');}});
 context.fetch=()=>{throw Error('Demo must never request account data');};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../demo.js'),'utf8'),context);
 return {context,store:new context.window.WebStore(()=>context.window.localStorage,Core.validate)};
}
test('demo starts with valid fictional records and isolates edits from real storage and other visitors',()=>{
 const a=demo(),b=demo(),original=a.store.load();
 assert.equal(original.setup,true);assert.equal(original.transactions.length,4);assert.equal(original.bills.reduce((n,v)=>n+v.amount,0),129000);
 assert.doesNotThrow(()=>Core.validate(original));assert.equal(a.context.window.AuthUI.username,undefined);
 const edited=Core.add(original,{id:'try_expense',kind:'expense',account:'c6',cents:1000,date:Core.today(),note:'Teste'});a.store.save(edited);
 assert.equal(Core.balances(a.store.load()).c6,Core.balances(b.store.load()).c6-1000);
 edited.accounts[0].opening=0;assert.equal(a.store.load().accounts[0].opening,45000);
 const loaded=a.store.load();loaded.bills[0].amount=0;assert.equal(a.store.load().bills[0].amount,80000);
 assert.equal(demo().store.load().transactions.length,4);
});
