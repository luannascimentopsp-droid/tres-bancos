(function(root){
 'use strict';
 const CoreApi=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
 const ADVANCE=[0,5,15,30,60,1440];
 function dateFor(item,fromDate){
  const original=item.at.slice(0,10);
  if(item.repeat!=='yearly')return original;
  const from=fromDate||CoreApi.today(),parts=original.split('-').map(Number),now=from.split('-').map(Number);
  let year=Math.max(parts[0],now[0]);
  for(let i=0;i<5;i++,year++){
   const day=parts[1]===2&&parts[2]===29&&!CoreApi.validDate(`${year}-02-29`)?28:parts[2];
   const date=`${year}-${String(parts[1]).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   if(date>=from&&!item.completed.includes(date))return date;
  }
  throw Error('Não foi possível calcular a próxima ocorrência.');
 }
 function occurrence(item,fromDate){return `${dateFor(item,fromDate)}T${item.at.slice(11,16)}`;}
 function sorted(items,fromDate){return items.map(item=>({item,at:occurrence(item,fromDate)})).sort((a,b)=>a.at.localeCompare(b.at)||a.item.title.localeCompare(b.item.title,'pt-BR'));}
 function due(items,now=new Date()){
  const today=CoreApi.today(),nowTime=now.getTime();
  return sorted(items,today).filter(({item,at})=>{
   const eventTime=new Date(`${at}:00`).getTime(),reminderTime=eventTime-item.advance*60000;
   return nowTime>=reminderTime&&nowTime<(item.advance===0?eventTime+60000:eventTime);
  }).map(({item,at})=>({item,at}));
 }
 function advanceLabel(minutes){return minutes===0?'Na hora':minutes===1440?'1 dia antes':`${minutes} min antes`;}
 const api={ADVANCE,dateFor,occurrence,sorted,due,advanceLabel};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Agenda=api;
})(typeof window!=='undefined'?window:globalThis);
