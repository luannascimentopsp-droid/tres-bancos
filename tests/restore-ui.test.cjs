const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../core.js'),Planner=require('../planner.js'),WebStore=require('../web-store.js');

function fixture(){
 const state=Core.initial();state.setup=true;state.accounts[0].opening=100000;
 state.planning={...Planner.settings(state),configured:true};return state;
}
function ui(saved,{native=false}={}){
 const elements=new Map(),listeners=new Map(),data=new Map([[WebStore.KEY,JSON.stringify(saved)]]);
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',style:{},addEventListener(event,fn){listeners.set(id+':'+event,fn);},classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
 const window={localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},addEventListener(){},scrollTo(){}};
 const context={Core,Planner,WebStore,window,document:{getElementById:element,addEventListener(event,fn){const previous=listeners.get(event);listeners.set(event,e=>{previous?.(e);fn(e);});},querySelectorAll(){return[];}},AuthUI:{start(){}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true};
 if(native)context.Android={load:()=>JSON.stringify({state:saved,queue:[]}),save:value=>{data.set(WebStore.KEY,value);return '';} };
 vm.createContext(context);
 for(const file of ['app.js','goals-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 const run=code=>vm.runInContext(code,context);run('boot()');
 return {element,listeners,data,window,run};
}
test('backup dates are limited to completed movements while future bill references remain valid',()=>{
 const future=Planner.shift(Core.today(),1),state=fixture();
 assert.throws(()=>Core.validate({...state,startDate:future}),/saldo inicial/);
 for(const kind of ['income','expense','transfer','adjust']){
  const transaction={id:'future',kind,account:'c6',to:kind==='transfer'?'nu':undefined,cents:100,date:future};
  assert.throws(()=>Core.validate({...state,transactions:[transaction]}),/posteriores a hoje/);
 }
 const valid=Core.add(state,{id:'paid',kind:'expense',account:'c6',cents:100,date:Core.today(),bill:'rent',billMonth:Planner.shift(Core.today(),32).slice(0,7)});
 assert.equal(Core.validate(valid),valid);assert.doesNotThrow(()=>Planner.monthPlan(valid));
});
for(const native of [false,true])test(`invalid restore preserves existing state and saved data (${native?'Android':'web'} callback)`,()=>{
 const state=fixture(),app=ui(state,{native}),original=app.data.get(WebStore.KEY);
 for(const bad of [{...state,startDate:Planner.shift(Core.today(),1)},{...state,transactions:[{id:'future',kind:'income',account:'c6',cents:500,date:Planner.shift(Core.today(),1)}]}]){
  app.window.restoreBackup(JSON.stringify(bad));
  assert.equal(app.data.get(WebStore.KEY),original);
  assert.equal(app.run('JSON.stringify(state)'),original);
  assert.match(app.element('toast').textContent,/Cópia não restaurada/);
 }
});
test('file restore rejects future dates before replacing saved records and accepts a valid backup',async()=>{
 const original=fixture(),app=ui(original),raw=app.data.get(WebStore.KEY);
 const restore=state=>app.listeners.get('backup-file:change')({target:{files:[{size:100,text:async()=>JSON.stringify(state)}],value:'backup.json'}});
 await restore({...original,startDate:Planner.shift(Core.today(),1)});
 assert.equal(app.data.get(WebStore.KEY),raw);
 assert.match(app.element('toast').textContent,/Cópia não restaurada/);
 const valid=fixture();valid.accounts[0].opening=200000;valid.capture=true;
 await restore(valid);
 const restored=JSON.parse(app.data.get(WebStore.KEY));assert.equal(restored.accounts[0].opening,200000);assert.equal(restored.capture,false);
 assert.match(app.element('toast').textContent,/Cópia restaurada/);
});
test('bills month selection does not change home or history totals; home shortcut opens the current month',()=>{
 const state=fixture(),currentMonth=Core.today().slice(0,7),previous=Planner.shift(currentMonth+'-01',-1).slice(0,7);
 state.bills[0].amount=10000;
 state.transactions=[{id:'rent_paid',kind:'expense',account:'c6',cents:10000,date:Core.today(),bill:'rent',billMonth:currentMonth}];
 const app=ui(state),home=app.element('app').innerHTML;
 app.listeners.get('change')({target:{id:'month',value:previous}});
 assert.match(app.element('app').innerHTML,new RegExp(`value="${previous}"`));
 assert.ok(app.element('app').innerHTML.includes(Core.money(10000)));
 app.run('renderHome()');assert.equal(app.element('app').innerHTML,home);
 app.run('history()');assert.ok(app.element('modal-body').innerHTML.includes(currentMonth.split('-').reverse().join('/')+' · Entradas'));
 assert.ok(app.element('modal-body').innerHTML.includes('Despesas '+Core.money(10000)));
 app.listeners.get('click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'show-bills'}}:null}});
 assert.match(app.element('app').innerHTML,new RegExp(`value="${currentMonth}"`));
});
