const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../auth-ui.js'),'utf8');
test('static web redirects to authenticated service without opening the panel',async()=>{
 let booted=false,redirect;const elements={app:{hidden:false},nav:{hidden:false},modal:{close(){}}};
 const context={window:{BankConfig:{enabled:false}},document:{getElementById:id=>elements[id]},location:{replace:url=>redirect=url}};
 vm.createContext(context);vm.runInContext(source,context);
 await context.window.AuthUI.start(()=>booted=true);
 assert.equal(booted,false);assert.equal(elements.app.hidden,true);assert.equal(elements.nav.hidden,true);
 assert.equal(redirect,'https://facilitador-financeiro-nsex.onrender.com/');
});
test('private web rejects missing session before opening the panel',async()=>{
 let booted=false,redirect;const elements={app:{hidden:false},nav:{hidden:false},modal:{close(){}}};
 const context={window:{BankConfig:{enabled:true}},document:{getElementById:id=>elements[id]},location:{replace:url=>redirect=url},fetch:async()=>({ok:false,status:401}),AbortSignal};
 vm.createContext(context);vm.runInContext(source,context);
 await context.window.AuthUI.start(()=>booted=true);
 assert.equal(booted,false);assert.equal(elements.app.hidden,true);assert.equal(redirect,'/login');
});
