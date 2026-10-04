(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
 const idPattern=/^[a-zA-Z0-9_-]{1,100}$/;
 function validTime(value){return typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value));}
 function checkAccount(a){
  if(!a||!idPattern.test(a.id)||!/^[a-f0-9]{64}$/.test(a.version)||a.currency!=='BRL'||a.type!=='BANK'||!Number.isSafeInteger(a.cents)||Math.abs(a.cents)>10000000000||!validTime(a.updatedAt)||Date.parse(a.updatedAt)>Date.now()+300000)throw Error('Saldo bancário inválido. Consulte novamente.');
 }
 function validateSnapshot(snapshot){
  if(!snapshot||!Array.isArray(snapshot.accounts)||snapshot.accounts.length>100||new Set(snapshot.accounts.map(a=>a.id)).size!==snapshot.accounts.length)throw Error('Resposta bancária inválida.');
  snapshot.accounts.forEach(checkAccount);
  return snapshot;
 }
 function preview(s,snapshot,mapping){
  validateSnapshot(snapshot);
  const seen=new Set(),balances=C.balances(s),rows=[];
  for(const [bank,source] of Object.entries(mapping)){
   if(!s.accounts.some(a=>a.id===bank))throw Error('Banco de destino inválido.');
   if(!source)continue;
   if(seen.has(source))throw Error('Uma conta bancária não pode alimentar dois bancos.');seen.add(source);
   if(Object.entries(s.bankSync||{}).some(([other,link])=>other!==bank&&link.sourceId===source))throw Error('Esta conta já está vinculada a outro banco do controle.');
   const account=snapshot.accounts.find(a=>a.id===source);if(!account)throw Error('Conta não encontrada na consulta.');
   const previous=s.bankSync?.[bank];
   if(previous&&previous.sourceId===source&&Date.parse(account.updatedAt)<Date.parse(previous.updatedAt))throw Error('O provedor retornou dados mais antigos. Seus saldos foram preservados.');
   const repeated=previous?.sourceId===source&&previous.version===account.version;
   rows.push({bank,account,current:balances[bank],delta:repeated?0:account.cents-balances[bank],repeated});
  }
  if(!rows.length)throw Error('Selecione pelo menos uma conta para sincronizar.');
  return rows;
 }
 function apply(s,snapshot,mapping){
  const rows=preview(s,snapshot,mapping);let next=JSON.parse(JSON.stringify(s));next.bankSync??={};
  for(const row of rows){
   if(row.repeated)continue;
   const a=row.account,id='sync_'+row.bank+'_'+a.version;
   // Nunca reaplica uma fotografia antiga, mesmo depois de desvincular/remapear.
   if(next.transactions.some(t=>t.id===id))throw Error('Este saldo já foi aplicado antes. Consulte dados novos ou ajuste o saldo manualmente.');
   if(row.delta)next=C.add(next,{id,kind:'adjust',account:row.bank,cents:row.delta,date:C.today(),note:'Saldo conferido · Meu Pluggy'});
   next.bankSync[row.bank]={sourceId:a.id,version:a.version,updatedAt:a.updatedAt,appliedAt:new Date().toISOString()};
  }
  return C.validate(next);
 }
 const api={preview,apply,validateSnapshot};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BankSync=api;
})(typeof window!=='undefined'?window:globalThis);
