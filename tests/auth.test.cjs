'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const {hashPassword,verifyPassword}=require('../server/password.cjs'),{Auth,IDLE_MS,MAX_MS}=require('../server/auth.cjs'),{createApp}=require('../server/server.cjs');
const password='Test-only-long-password-2026',username='test-user';let passwordHash;
test.before(async()=>{passwordHash=await hashPassword(password);});
const req=(cookie='',ip='test')=>({headers:{cookie},socket:{remoteAddress:ip}});
test('password hashing uses random salts, validates password and refuses invalid configuration',async()=>{
 assert.notEqual(await hashPassword(password),passwordHash);assert.ok(!passwordHash.includes(password));assert.equal(await verifyPassword(password,passwordHash),true);assert.equal(await verifyPassword('incorrect',passwordHash),false);await assert.rejects(()=>hashPassword('short'));assert.throws(()=>new Auth({username,passwordHash:'plain'}));
});
test('sessions expire after idle time or absolute lifetime; rotation and logout revoke old cookie',async()=>{
 let time=1000;const auth=new Auth({username,passwordHash,secure:true,now:()=>time});const a=await auth.login(req(),username,password),cookie=auth.cookie(a.token);assert.match(cookie,/__Host-fac-session=/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/; Secure/);
 const r=req(cookie);assert.ok(auth.session(r));assert.ok(!JSON.stringify(auth.info(a.session)).includes(a.token));assert.equal(auth.csrf({...r,headers:{...r.headers,'x-csrf-token':a.session.csrf}},a.session),true);assert.equal(auth.csrf(r,a.session),false);
 const second=await auth.login(r,username,password);assert.equal(auth.session(r),null);const r2=req(auth.cookie(second.token));assert.ok(auth.session(r2));time+=IDLE_MS;assert.equal(auth.session(r2),null);
 const third=await auth.login(req(),username,password),r3=req(auth.cookie(third.token));for(let i=0;i<32;i++){time+=MAX_MS/32-1;auth.session(r3);}time+=100;assert.equal(auth.session(r3),null);
 const fourth=await auth.login(req(),username,password),r4=req(auth.cookie(fourth.token));auth.logout(r4);assert.equal(auth.session(r4),null);
});
test('login throttles repeated failures and recovers after cooldown',async()=>{
 let time=1;const auth=new Auth({username,passwordHash,now:()=>time});
 for(let i=0;i<5;i++)assert.equal((await auth.login(req(),username,'wrong')).status,401);
 assert.equal((await auth.login(req(),username,password)).status,429);time+=IDLE_MS;assert.equal((await auth.login(req(),username,password)).status,200);
});
async function fixture(t,provider,stateStore){
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const origin=`http://127.0.0.1:${port}`;
 const server=createApp({provider,stateStore,username,passwordHash,origin});await new Promise(r=>server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const post=(route,body={},headers={})=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 return {origin,post};
}
test('server protects API and panel files, authenticates, hides secrets and rejects CSRF',async t=>{
 let calls=0;const {origin,post}=await fixture(t,{snapshot:async()=>{calls++;return {accounts:[],issues:[]};}});
 assert.match(await (await fetch(origin+'/')).text(),/login-form/);
 for(const url of ['/api/bank/snapshot','/api/bank/status','/api/auth/session','/app.js','/bank-config.js','/core.js','/planner.js','/web-store.js','/goals-ui.js','/bank-ui.js','/bank-sync.js','/auth-ui.js'])assert.equal((await fetch(origin+url)).status,401);
 for(const url of ['/','/index.html','/login','/login.html']){
  const response=await fetch(origin+url),html=await response.text();
  assert.equal(response.status,200);assert.match(html,/login-form/);assert.doesNotMatch(html,/id="app"/);
  assert.match(html,/https:\/\/wa\.me\/5583998083995\?text=/);
  assert.match(html,/Solicitar acesso pelo WhatsApp/);
 }
 for(const url of ['/.env','/server/config.example','/server/server.cjs','/.git/config'])assert.equal((await fetch(origin+url)).status,404);
 assert.equal((await post('/api/auth/login',{username,password},{Origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/auth/login',{username,password:'wrong'})).status,401);
 const login=await post('/api/auth/login',{username,password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],session=await login.json(),headers={Cookie:cookie};
 assert.ok(!JSON.stringify(session).includes(passwordHash));assert.ok(!JSON.stringify(session).includes(password));
 const response=await fetch(origin+'/api/bank/snapshot',{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),null);
 await fetch(origin+'/api/bank/snapshot',{headers});assert.equal(calls,1);
 assert.equal((await fetch(origin+'/api/bank/snapshot',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
 assert.equal((await post('/api/bank/snapshot',{},headers)).status,405);
 const badHost=await new Promise(resolve=>{require('node:http').get(origin+'/api/bank/snapshot',{headers:{...headers,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});});assert.equal(badHost,403);
 assert.equal((await post('/api/auth/logout',{},headers)).status,403);
 const logout=await post('/api/auth/logout',{}, {...headers,'X-CSRF-Token':session.csrf});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await fetch(origin+'/api/bank/snapshot',{headers})).status,401);
 assert.equal((await fetch(origin+'/api/bank/snapshot',{headers:{Authorization:'Bearer '+password}})).status,401);
});
test('pending bank query cannot return data after logout',async t=>{
 let release,started;const ready=new Promise(r=>started=r);const {origin,post}=await fixture(t,{snapshot:()=>{started();return new Promise(r=>release=r);}});
 const login=await post('/api/auth/login',{username,password}),cookie=login.headers.get('set-cookie').split(';')[0],session=await login.json();const pending=fetch(origin+'/api/bank/snapshot',{headers:{Cookie:cookie}});await ready;
 await post('/api/auth/logout',{}, {Cookie:cookie,'X-CSRF-Token':session.csrf});release({accounts:[{secret:'private'}]});assert.equal((await pending).status,401);
});
test('non-HTTPS public origins fail closed',()=>{assert.throws(()=>createApp({username,passwordHash,origin:'http://public.example'}));});
test('public demo serves only static examples and does not unlock private APIs or access signed-in records',async t=>{
 let reads=0,writes=0,bankCalls=0;
 const {origin,post}=await fixture(t,{snapshot:async()=>{bankCalls++;}},{read:async()=>{reads++;return {revision:0,state:null};},write:async()=>{writes++;}});
 assert.match(await(await fetch(origin+'/login')).text(),/href="\/demo\/"/);
 const redirect=await fetch(origin+'/demo',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/demo/');
 const page=await fetch(origin+'/demo/'),html=await page.text();assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);assert.match(page.headers.get('content-security-policy'),/connect-src 'none'/);
 assert.match(html,/Todos os valores são fictícios/);assert.doesNotMatch(html,/src="(?:auth-ui|bank-ui|cloud-store|web-store)/);
 for(const asset of [...html.matchAll(/(?:src|href)="([^"?]+)(?:\?[^" ]*)?"/g)].map(m=>m[1]).filter(x=>!x.startsWith('/')&&!x.startsWith('https:'))){assert.equal((await fetch(origin+'/demo/'+asset)).status,200,asset);}
 for(const route of ['/api/state','/api/bank/snapshot','/api/auth/session','/app.js','/cloud-store.js'])assert.equal((await fetch(origin+route)).status,401,route);
 for(const route of ['/demo/api/state','/demo/auth-ui.js','/demo/cloud-store.js','/demo/web-store.js','/demo/bank-config.js','/demo/server/server.cjs'])assert.equal((await fetch(origin+route)).status,404,route);
 assert.equal((await post('/api/state',{revision:0,state:{}})).status,401);
 const login=await post('/api/auth/login',{username,password}),cookie=login.headers.get('set-cookie').split(';')[0];
 assert.match(await(await fetch(origin+'/demo/',{headers:{Cookie:cookie}})).text(),/Todos os valores são fictícios/);
 assert.equal(reads,0);assert.equal(writes,0);assert.equal(bankCalls,0);
 assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:cookie}})).status,200);
});
test('financial sync requires login and CSRF, persists the authenticated account and rejects stale versions',async t=>{
 const {PGlite}=require('@electric-sql/pglite'),{StateStore}=require('../server/state-store.cjs'),Core=require('../core.js');
 const database=new PGlite(),store=new StateStore(database);t.after(()=>database.close());
 const {origin,post}=await fixture(t,null,store);
 assert.equal((await fetch(origin+'/api/state')).status,401);
 assert.equal((await post('/api/state',{revision:0,state:Core.initial()})).status,401);
 const login=await post('/api/auth/login',{username,password}),cookie=login.headers.get('set-cookie').split(';')[0],session=await login.json();
 const headers={Cookie:cookie},csrf={...headers,'X-CSRF-Token':session.csrf};
 assert.deepEqual(await(await fetch(origin+'/api/state',{headers})).json(),{configured:true,revision:0,state:null});
 const state=Core.initial();state.setup=true;state.bills[3].amount=13500;
 assert.equal((await post('/api/state',{revision:0,state},headers)).status,403);
 const saved=await post('/api/state',{revision:0,state,username:'another-user'},csrf);assert.equal(saved.status,200);
 assert.deepEqual(await store.read('another-user'),{revision:0,state:null});
 assert.deepEqual(await(await fetch(origin+'/api/state',{headers})).json(),{configured:true,revision:1,state});
 assert.equal((await post('/api/state',{revision:0,state},csrf)).status,409);
 assert.equal((await post('/api/state',{revision:1,state:{...state,startDate:'2999-01-01'}},csrf)).status,400);
 assert.equal((await post('/api/state',{revision:1,state},{...csrf,Origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/auth/login',{username,password:'x'.repeat(5000)})).status,413);
 assert.equal((await fetch(origin+'/cloud-store.js')).status,401);
 assert.equal((await fetch(origin+'/server/state-store.cjs')).status,404);
});
