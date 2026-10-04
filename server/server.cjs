'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {Pluggy}=require('./pluggy.cjs'),{Auth}=require('./auth.cjs');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=new Set(['index.html','style.css','favicon.svg','app.js','core.js','planner.js','goals-ui.js','web-store.js','bank-config.js','bank-sync.js','bank-ui.js','auth-ui.js','login.html','login.js','login.css']);
const PUBLIC=new Set(['favicon.svg','login.html','login.js','login.css']);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
async function readJSON(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(Error('Formato inválido.'),{status:415});
 if(Number(req.headers['content-length'])>4096)throw Object.assign(Error('Requisição muito grande.'),{status:413});
 let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw Object.assign(Error('Requisição muito grande.'),{status:413});raw+=chunk;}
 try{return JSON.parse(raw);}catch{throw Object.assign(Error('Requisição inválida.'),{status:400});}
}
function createApp({provider,username,passwordHash,origin,now=()=>Date.now()}){
 const publicUrl=new URL(origin);
 if(publicUrl.origin!==origin||!(publicUrl.protocol==='https:'||(publicUrl.protocol==='http:'&&['127.0.0.1','localhost'].includes(publicUrl.hostname))))throw Error('PUBLIC_ORIGIN deve ser HTTPS ou um endereço local.');
 const auth=new Auth({username,passwordHash,secure:publicUrl.protocol==='https:',now});
 let cached=null,cacheAt=0,inflight=null,attempts=0,windowAt=now();
 const server=http.createServer(async(req,res)=>{
  const send=(status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if(publicUrl.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   if(req.headers.host!==publicUrl.host)return send(403,{error:'Endereço não autorizado.'});
   if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origem não autorizada.'});
   if(req.headers['sec-fetch-site']==='cross-site'&&req.headers['sec-fetch-mode']!=='navigate')return send(403,{error:'Origem não autorizada.'});
   if(!['GET','POST'].includes(req.method))return send(405,{error:'Método não permitido.'});
   if(req.method==='POST'&&req.headers.origin!==origin)return send(403,{error:'Origem não autorizada.'});
   const url=new URL(req.url,origin),session=auth.session(req);
   if(url.pathname==='/api/auth/availability'&&req.method==='GET')return send(200,{login:true});
   if(url.pathname==='/api/auth/login'){
    if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
    const body=await readJSON(req),result=await auth.login(req,body?.username,body?.password);
    if(result.status!==200){if(result.status===429)res.setHeader('Retry-After','900');return send(result.status,{error:result.error});}
    res.setHeader('Set-Cookie',auth.cookie(result.token));return send(200,auth.info(result.session));
   }
   if(url.pathname.startsWith('/api/')){
    if(!session)return send(401,{error:'Entre novamente para acessar o Facilitador.'});
    if(url.pathname==='/api/auth/logout'){
     if(req.method!=='POST')return send(405,{error:'Método não permitido.'});
     if(!auth.csrf(req,session))return send(403,{error:'Recarregue a página antes de sair.'});
     auth.logout(req);cached=null;res.setHeader('Set-Cookie',auth.cookie('',true));return send(200,{ok:true});
    }
    if(req.method!=='GET')return send(405,{error:'Método não permitido.'});
    if(url.pathname==='/api/auth/session')return send(200,auth.info(session));
    if(now()-windowAt>=60000){attempts=0;windowAt=now();}
    if(++attempts>60){res.setHeader('Retry-After','60');return send(429,{error:'Aguarde um minuto antes de consultar novamente.'});}
    if(url.pathname==='/api/bank/status')return send(200,{configured:!!provider,provider:'Meu Pluggy'});
    if(url.pathname!=='/api/bank/snapshot')return send(404,{error:'Recurso não encontrado.'});
    if(!provider)return send(503,{error:'Falta configurar as credenciais e conexões do Meu Pluggy no servidor.'});
    if(cached&&now()-cacheAt<60000)return send(200,cached);
    if(!inflight)inflight=provider.snapshot().then(data=>{cached=data;cacheAt=now();return data;}).finally(()=>{inflight=null;});
    const data=await inflight;
    // Uma resposta atrasada não devolve saldos após logout ou expiração.
    if(!auth.session(req))return send(401,{error:'Entre novamente para acessar o Facilitador.'});
    return send(200,data);
   }
   if(req.method!=='GET')return send(405,{error:'Método não permitido.'});
   let name=url.pathname==='/'?'index.html':url.pathname==='/login'?'login.html':url.pathname.slice(1);
   if(!ASSETS.has(name))return send(404,{error:'Recurso não encontrado.'});
   if(!session&&!PUBLIC.has(name)){if(name==='index.html')name='login.html';else return send(401,{error:'Entre para acessar o Facilitador.'});}
   if(name==='bank-config.js')return send(200,'window.BankConfig=Object.freeze({enabled:true});','text/javascript; charset=utf-8');
   return send(200,await fs.readFile(path.join(ROOT,name)),MIME[path.extname(name)]);
  }catch(error){return send(error.status||502,{error:error.status?error.message:'Não foi possível concluir a solicitação. Seus registros foram preservados.'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;return server;
}
if(require.main===module){
 const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
 const configuredOrigin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;
 if(host!=='127.0.0.1'&&!configuredOrigin)throw Error('Defina PUBLIC_ORIGIN com o endereço HTTPS antes de expor o servidor.');
 const origin=configuredOrigin||`http://127.0.0.1:${port}`;
 let provider=null;
 if(process.env.PLUGGY_CLIENT_ID||process.env.PLUGGY_CLIENT_SECRET||process.env.PLUGGY_ITEM_IDS)provider=new Pluggy({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET,itemIds:(process.env.PLUGGY_ITEM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean)});
 createApp({provider,username:process.env.APP_USERNAME,passwordHash:process.env.APP_PASSWORD_HASH,origin}).listen(port,host,()=>console.log('Facilitador Financeiro: '+origin));
}
module.exports={createApp};
