'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {Pluggy}=require('./pluggy.cjs');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=new Set(['index.html','style.css','favicon.svg','app.js','core.js','planner.js','goals-ui.js','web-store.js','bank-config.js','bank-sync.js','bank-ui.js']);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function createApp({provider,accessKey,origin,now=()=>Date.now()}){
 if(typeof accessKey!=='string'||accessKey.length<32)throw Error('APP_ACCESS_KEY precisa ter pelo menos 32 caracteres aleatórios.');
 const publicUrl=new URL(origin);
 if(publicUrl.origin!==origin||!(publicUrl.protocol==='https:'||(publicUrl.protocol==='http:'&&['127.0.0.1','localhost'].includes(publicUrl.hostname))))throw Error('PUBLIC_ORIGIN deve ser HTTPS ou um endereço local.');
 const expected=crypto.createHash('sha256').update(accessKey).digest();
 let cached=null,cacheAt=0,inflight=null,attempts=0,windowAt=now();
 return http.createServer(async(req,res)=>{
  const send=(status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body);};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if(publicUrl.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   if(req.headers.host!==publicUrl.host)return send(403,{error:'Endereço não autorizado.'});
   if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origem não autorizada.'});
   if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Origem não autorizada.'});
   if(req.method!=='GET')return send(405,{error:'Método não permitido.'});
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    if(now()-windowAt>=60000){attempts=0;windowAt=now();}
    if(++attempts>60){res.setHeader('Retry-After','60');return send(429,{error:'Aguarde um minuto antes de consultar novamente.'});}
    const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!crypto.timingSafeEqual(expected,crypto.createHash('sha256').update(supplied).digest()))return send(401,{error:'Chave de acesso do Facilitador inválida.'});
    if(url.pathname==='/api/bank/status')return send(200,{configured:!!provider,provider:'Meu Pluggy'});
    if(url.pathname!=='/api/bank/snapshot')return send(404,{error:'Recurso não encontrado.'});
    if(!provider)return send(503,{error:'Falta configurar as credenciais e conexões do Meu Pluggy no servidor.'});
    if(cached&&now()-cacheAt<60000)return send(200,cached);
    if(!inflight)inflight=provider.snapshot().then(data=>{cached=data;cacheAt=now();return data;}).finally(()=>{inflight=null;});
    return send(200,await inflight);
   }
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!ASSETS.has(name))return send(404,{error:'Recurso não encontrado.'});
   if(name==='bank-config.js')return send(200,'window.BankConfig=Object.freeze({enabled:true});','text/javascript; charset=utf-8');
   return send(200,await fs.readFile(path.join(ROOT,name)),MIME[path.extname(name)]);
  }catch(error){return send(error.status||502,{error:error.status?error.message:'Não foi possível consultar os dados. Seus registros foram preservados.'});}
 });
}
if(require.main===module){
 const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';
 if(host!=='127.0.0.1'&&!process.env.PUBLIC_ORIGIN)throw Error('Defina PUBLIC_ORIGIN com o endereço HTTPS antes de expor o servidor.');
 const origin=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`;
 let provider=null;
 if(process.env.PLUGGY_CLIENT_ID||process.env.PLUGGY_CLIENT_SECRET||process.env.PLUGGY_ITEM_IDS)provider=new Pluggy({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET,itemIds:(process.env.PLUGGY_ITEM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean)});
 createApp({provider,accessKey:process.env.APP_ACCESS_KEY,origin}).listen(port,host,()=>console.log('Facilitador Financeiro: '+origin));
}
module.exports={createApp};
