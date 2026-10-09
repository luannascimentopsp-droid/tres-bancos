const test=require('node:test'),assert=require('node:assert/strict');
const CloudStore=require('../cloud-store.js'),Core=require('../core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function backend(){let row={revision:0,state:null},online=true,loseResponse=false;return {
 request:async(url,options={})=>{
  if(!online)throw Error('offline');
  if(options.method==='POST'){
   const {revision,state}=JSON.parse(options.body);if(revision!==row.revision)return {ok:false,status:409};
   row={revision:revision+1,state:clone(state)};if(loseResponse){loseResponse=false;throw Error('response lost');}
   return {ok:true,status:200,json:async()=>({configured:true,revision:row.revision})};
  }
  return {ok:true,status:200,json:async()=>({configured:true,...clone(row)})};
 },set online(value){online=value;},set loseResponse(value){loseResponse=value;},get row(){return clone(row);}
};}
function device(server,storage=new Map(),username='alice',extra={}){
 const messages=[],received=[];const client=new CloudStore({username,storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},validate:Core.validate,request:server.request,onStatus:s=>messages.push(s),onRemote:s=>received.push(s),...extra});return {client,storage,messages,received};
}
function initial(){const state=Core.initial();state.setup=true;return state;}
test('first device uploads existing records; another device and a reload receive the same records',async()=>{
 const server=backend(),a=device(server),b=device(server),state=initial();state.bills[3].amount=13500;
 await a.client.open(state,Core.initial());await b.client.open(null,Core.initial());
 assert.deepEqual(b.client.load(),state);assert.equal(server.row.revision,1);
 const updated=clone(state);updated.weekly.daily=18000;a.client.save(updated);await a.client.sync();await b.client.sync();
 assert.deepEqual(b.received.at(-1),updated);assert.deepEqual(await device(server,a.storage).client.open(null,Core.initial()),updated);
});
test('offline changes survive reload and upload on reconnect; lost acknowledgements are idempotent',async()=>{
 const server=backend(),a=device(server);await a.client.open(initial(),Core.initial());
 server.online=false;const updated=a.client.load();updated.weekly.daily=18000;a.client.save(updated);await a.client.sync();
 const reload=device(server,a.storage);assert.deepEqual(await reload.client.open(null,Core.initial()),updated);
 server.online=true;server.loseResponse=true;await reload.client.sync();assert.equal(server.row.revision,2);
 await reload.client.sync();assert.equal(server.row.revision,2);assert.equal(reload.client.data.pending,false);
});
test('simultaneous divergent edits preserve both versions until explicit resolution',async()=>{
 const server=backend(),a=device(server),b=device(server);await a.client.open(initial(),Core.initial());await b.client.open(null,Core.initial());
 const aState=a.client.load(),bState=b.client.load();aState.bills[0].amount=35000;bState.bills[0].amount=40000;
 a.client.save(aState);await a.client.sync();b.client.save(bState);await b.client.sync();
 assert.equal(b.client.data.conflict,true);assert.equal(server.row.state.bills[0].amount,35000);assert.equal(b.client.load().bills[0].amount,40000);
 await b.client.resolve('remote');assert.equal(b.client.load().bills[0].amount,35000);assert.ok([...b.storage.keys()].some(k=>k.includes('.backup.')));
});
test('changes arriving during a request are sent after the first revision without being lost',async()=>{
 const server=backend(),a=device(server);await a.client.open(initial(),Core.initial());
 let release;const real=a.client.request;let pause=true;
 a.client.request=async(...args)=>{if(args[1]?.method==='POST'&&pause){pause=false;await new Promise(r=>release=r);}return real(...args);};
 const first=a.client.load();first.weekly.daily=10000;a.client.save(first);
 const second=a.client.load();second.weekly.daily=18000;a.client.save(second);release();await a.client.sync();
 assert.equal(server.row.state.weekly.daily,18000);assert.equal(a.client.data.pending,false);
});
test('local cache is separated by login and corrupted cache is never overwritten',async()=>{
 const server=backend(),a=device(server),b=device(server,a.storage,'bob');await a.client.open(initial(),Core.initial());assert.notEqual(a.client.key,b.client.key);
 a.storage.set(a.client.key,'broken');await assert.rejects(()=>device(server,a.storage).client.open(null,Core.initial()));assert.equal(a.storage.get(a.client.key),'broken');
});
