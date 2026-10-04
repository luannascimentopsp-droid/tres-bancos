(function(root){
  'use strict';
  const BANKS=['c6','nu','mp'], TYPES=['income','expense','transfer','adjust'];
  const datePattern=/^\d{4}-\d{2}-\d{2}$/;
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function parseMoney(v){
    let s=String(v).trim().replace(/^R\$\s*/, '');
    if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(s)) throw Error('Digite um valor em reais, como 47,50.');
    const [a,b='']=s.replace(/\./g,'').split(',');
    const n=Number(a)*100+Number(b.padEnd(2,'0'));
    if(!Number.isSafeInteger(n)||n>10000000000) throw Error('Valor acima do limite.');
    return n;
  }
  function money(c){return (c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  function validDate(d){if(!datePattern.test(d))return false;let p=d.split('-').map(Number);let t=new Date(p[0],p[1]-1,p[2],12);return t.getFullYear()===p[0]&&t.getMonth()===p[1]-1&&t.getDate()===p[2];}
  function dayString(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function nextSaturday(date){let d=new Date(date+'T12:00:00');let offset=(6-d.getDay()+7)%7||7;d.setDate(d.getDate()+offset);return dayString(d);}
  function workingDays(date){let d=new Date(date+'T12:00:00'),next=nextSaturday(date),count=0;while(dayString(d)<next){if(d.getDay()>0&&d.getDay()<6)count++;d.setDate(d.getDate()+1);}return count;}
  function initial(){return {version:1,setup:false,startDate:today(),capture:false,accounts:[{id:'c6',name:'C6 Bank',role:'daily',opening:0},{id:'nu',name:'Nubank',role:'bills',opening:0},{id:'mp',name:'Mercado Pago',role:'save',opening:0}],transactions:[],bills:[{id:'rent',name:'Aluguel',amount:0,start:5,end:5},{id:'water',name:'Água',amount:0,start:10,end:20},{id:'power',name:'Luz',amount:0,start:10,end:20},{id:'net',name:'Internet',amount:0,start:10,end:20},{id:'pension',name:'Outras contas',amount:0,start:15,end:15}],weekly:{daily:0,fixed:0,saving:0,goal:0}};}
  function balances(s){let b=Object.fromEntries(s.accounts.map(a=>[a.id,a.opening]));for(const t of s.transactions){if(t.void)continue;if(t.kind==='income'||t.kind==='adjust')b[t.account]+=t.cents;else b[t.account]-=t.cents;if(t.kind==='transfer')b[t.to]+=t.cents;}return b;}
  function roleAccount(s,role){return s.accounts.find(a=>a.role===role);}
  function paid(s,id,month){return s.transactions.filter(t=>!t.void&&t.kind==='expense'&&t.bill===id&&t.billMonth===month).reduce((n,t)=>n+t.cents,0);}
  function totals(s,month){let r={income:0,expense:0,transfer:0};for(const t of s.transactions){if(!t.void&&t.date.startsWith(month)&&Object.hasOwn(r,t.kind))r[t.kind]+=t.cents;}return r;}
  function add(s,t){
    if(!TYPES.includes(t.kind)||!BANKS.includes(t.account)||!validDate(t.date)||t.date<s.startDate||t.date>today())throw Error('Confira a conta e a data. Registre apenas movimentos desde o saldo inicial até hoje.');
    if(!Number.isSafeInteger(t.cents)||t.cents===0||Math.abs(t.cents)>10000000000||(t.kind!=='adjust'&&t.cents<0))throw Error('O valor precisa ser maior que zero.');
    if(s.transactions.some(x=>x.id===t.id))throw Error('Este lançamento já existe.');
    if(t.sourceId&&s.transactions.some(x=>x.sourceId===t.sourceId&&!x.void))throw Error('Este aviso já foi lançado.');
    if(t.kind==='transfer'&&(!BANKS.includes(t.to)||t.to===t.account))throw Error('Escolha dois bancos diferentes.');
    if(t.kind==='expense'&&t.bill){let bill=s.bills.find(b=>b.id===t.bill);if(!bill||!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.billMonth))throw Error('Confira a conta fixa e o mês.');}
    if((t.kind==='expense'||t.kind==='transfer')&&balances(s)[t.account]<t.cents)throw Error('Saldo registrado insuficiente neste banco. Confira o saldo ou registre a entrada que falta.');
    return {...s,transactions:[...s.transactions,{...t,note:String(t.note||'').slice(0,140)}]};
  }
  function split(s,cents,date){
    const bootstrap=false;
    const fixed=s.weekly.fixed,daily=s.weekly.daily;
    const shortfall=Math.max(0,fixed+daily-cents);
    const save=bootstrap?0:Math.min(s.weekly.saving,Math.max(0,cents-fixed-daily));
    const margin=Math.max(0,cents-fixed-daily-save);
    return {fixed,daily,save,margin,shortfall,bootstrap};
  }
  function validate(s){
    if(!s||s.version!==1||typeof s.setup!=='boolean'||typeof s.capture!=='boolean'||!validDate(s.startDate)||!Array.isArray(s.accounts)||s.accounts.length!==3||!Array.isArray(s.transactions)||s.transactions.length>20000||!Array.isArray(s.bills)||s.bills.length!==5)throw Error('Cópia inválida ou incompatível.');
    if(new Set(s.accounts.map(a=>a.id)).size!==3||new Set(s.accounts.map(a=>a.role)).size!==3)throw Error('Bancos inválidos na cópia.');
    for(const a of s.accounts)if(!BANKS.includes(a.id)||!['daily','bills','save'].includes(a.role)||typeof a.name!=='string'||a.name.length>30||!Number.isSafeInteger(a.opening)||a.opening<0||a.opening>10000000000)throw Error('Saldo inicial inválido.');
    const bid=new Set();for(const b of s.bills){if(!['rent','water','power','net','pension'].includes(b.id)||bid.has(b.id)||typeof b.name!=='string'||b.name.length>40||!Number.isSafeInteger(b.amount)||b.amount<0||b.amount>10000000000||!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<1||b.end>28||b.end<b.start)throw Error('Conta fixa inválida.');bid.add(b.id);}
    for(const k of ['daily','fixed','saving','goal'])if(!s.weekly||!Number.isSafeInteger(s.weekly[k])||s.weekly[k]<0||s.weekly[k]>10000000000)throw Error('Plano inválido.');
    const ids=new Set();for(const t of s.transactions){if(typeof t.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(t.id)||ids.has(t.id)||!TYPES.includes(t.kind)||!BANKS.includes(t.account)||!validDate(t.date)||t.date<s.startDate||!Number.isSafeInteger(t.cents)||Math.abs(t.cents)>10000000000||t.cents===0||(t.kind!=='adjust'&&t.cents<0)||(t.to&&(!BANKS.includes(t.to)||t.to===t.account))||(t.kind==='transfer'&&!t.to)||(t.bill&&(!bid.has(t.bill)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.billMonth)))||(t.note&&typeof t.note!=='string')||(t.sourceId&&!/^[a-zA-Z0-9_-]{1,100}$/.test(t.sourceId)))throw Error('Lançamento inválido na cópia.');ids.add(t.id);}
    if(s.planning!==undefined){const p=s.planning;if(!p||typeof p.configured!=='boolean'||typeof p.protectReserve!=='boolean'||!['daily','weekly'].includes(p.paymentMode)||!Number.isInteger(p.payday)||p.payday<0||p.payday>6||!Number.isSafeInteger(p.buffer)||p.buffer<0||p.buffer>10000000000)throw Error('Metas inválidas na cópia.');for(const key of ['workdays','spendDays'])if(!Array.isArray(p[key])||!p[key].length||p[key].length>7||new Set(p[key]).size!==p[key].length||p[key].some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Dias inválidos nas metas.');}
    for(const n of Object.values(balances(s)))if(!Number.isSafeInteger(n))throw Error('Saldo fora do limite.');
    return s;
  }
  const api={today,parseMoney,money,validDate,dayString,nextSaturday,workingDays,initial,balances,roleAccount,paid,totals,add,split,validate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Core=api;
})(typeof window!=='undefined'?window:globalThis);
