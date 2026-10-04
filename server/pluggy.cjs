'use strict';
const {createHash}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class ProviderError extends Error {constructor(message,status=502){super(message);this.status=status;}}
function cents(value){
 if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>100000000)throw new ProviderError('O banco não informou um saldo válido.');
 const result=Math.round(value*100);if(!Number.isSafeInteger(result))throw new ProviderError('Saldo fora do limite.');return result;
}
class Pluggy {
 constructor({clientId,clientSecret,itemIds,fetchImpl=fetch,now=()=>Date.now()}){
  if(!clientId||!clientSecret||!Array.isArray(itemIds)||!itemIds.length||itemIds.length>10||itemIds.some(id=>!UUID.test(id)))throw Error('Configure PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS no servidor.');
  this.clientId=clientId;this.clientSecret=clientSecret;this.itemIds=[...new Set(itemIds)];this.fetch=fetchImpl;this.now=now;this.apiKey=null;this.expires=0;
 }
 async request(path,options={}){
  let response;try{response=await this.fetch('https://api.pluggy.ai'+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new ProviderError('Não foi possível consultar o provedor. Tente novamente mais tarde.');}
  if(!response.ok){if(response.status===401||response.status===403){this.expires=0;throw new ProviderError('Acesso ao provedor recusado. Confira a configuração e a autorização no Meu Pluggy.');}if(response.status===429)throw new ProviderError('Limite de consultas atingido. Aguarde antes de tentar novamente.',429);throw new ProviderError('O provedor está indisponível. Seus dados foram preservados.');}
  try{return await response.json();}catch{throw new ProviderError('Resposta inválida do provedor.');}
 }
 async key(){
  if(this.apiKey&&this.expires>this.now())return this.apiKey;
  const data=await this.request('/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:this.clientId,clientSecret:this.clientSecret})});
  if(typeof data.apiKey!=='string'||!data.apiKey)throw new ProviderError('Não foi possível autenticar o serviço.');
  this.apiKey=data.apiKey;this.expires=this.now()+100*60*1000;return this.apiKey;
 }
 async get(path){return this.request(path,{headers:{'X-API-KEY':await this.key()}});}
 async snapshot(){
  const accounts=[],issues=[];
  for(const itemId of this.itemIds){
   const item=await this.get('/items/'+itemId);
   if(item.id!==itemId)throw new ProviderError('Conexão retornada não corresponde à configurada.');
   const label=String(item.connector?.name||'Conexão bancária').slice(0,80);
   if(item.status!=='UPDATED'||!item.lastUpdatedAt||!Number.isFinite(Date.parse(item.lastUpdatedAt))){issues.push({bank:label,message:item.status==='UPDATING'?'Atualização em andamento. Consulte novamente depois.':'Conexão precisa de atenção. Confira a autorização no Meu Pluggy.'});continue;}
   const result=await this.get('/accounts?'+new URLSearchParams({itemId,type:'BANK'}));
   // A API de contas não documenta um parâmetro de paginação. Não aceitar listas incompletas.
   if(!Array.isArray(result.results)||result.totalPages>1||(Number.isFinite(result.total)&&result.total!==result.results.length))throw new ProviderError('Lista de contas incompleta. Nenhum saldo foi aplicado.');
   for(const a of result.results){
    if(a.type!=='BANK'||a.currencyCode!=='BRL')continue;
    if(a.itemId!==itemId||!UUID.test(a.id))throw new ProviderError('Conta inválida recebida do provedor.');
    const value=cents(a.balance),updatedAt=new Date(item.lastUpdatedAt).toISOString();
    const version=createHash('sha256').update(JSON.stringify([a.id,updatedAt,value])).digest('hex');
    accounts.push({id:a.id,type:'BANK',currency:'BRL',name:String(a.name||'Conta bancária').slice(0,80),bank:label,last4:String(a.number||'').replace(/\D/g,'').slice(-4),cents:value,updatedAt,version});
   }
  }
  if(new Set(accounts.map(a=>a.id)).size!==accounts.length)throw new ProviderError('Conta duplicada na resposta do provedor.');
  return {provider:'Meu Pluggy',fetchedAt:new Date(this.now()).toISOString(),accounts,issues};
 }
}
module.exports={Pluggy,ProviderError,cents};
