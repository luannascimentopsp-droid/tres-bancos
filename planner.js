(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
 const DEFAULTS={workdays:[1,2,3,4,5,6],spendDays:[1,2,3,4,5],paymentMode:'weekly',payday:6,buffer:0,protectReserve:true,configured:false};
 function settings(s){return {...DEFAULTS,...s.planning,workdays:[...(s.planning?.workdays||DEFAULTS.workdays)],spendDays:[...(s.planning?.spendDays||DEFAULTS.spendDays)]};}
 function shift(date,days){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return C.dayString(d);}
 function weekday(date){return new Date(date+'T12:00:00').getDay();}
 function monthEnd(date){const d=new Date(date+'T12:00:00');d.setMonth(d.getMonth()+1,0);return C.dayString(d);}
 function weekStart(date){return shift(date,-((weekday(date)+6)%7));}
 function dates(from,to){const result=[];for(let d=from;d<=to;d=shift(d,1))result.push(d);return result;}
 function spread(total,weights){const sum=weights.reduce((a,b)=>a+b,0);let cumulative=0,previous=0;return weights.map(w=>{cumulative+=w;const next=Math.floor(total*cumulative/sum);const value=next-previous;previous=next;return value;});}
 function monthPlan(s,at=C.today()){
  if(!C.validDate(at)||at<s.startDate)throw Error('Data de planejamento inválida.');
  const p=settings(s),month=at.slice(0,7),end=monthEnd(at),calendar=dates(at,end);
  const active=s.transactions.filter(t=>!t.void&&t.date<=at);
  const current={...s,transactions:active},b=C.balances(current);
  const reserve=Math.max(0,b[C.roleAccount(s,'save').id]);
  const totalBalance=Object.values(b).reduce((a,v)=>a+v,0);
  const protectedAmount=p.protectReserve?reserve:0,available=totalBalance-protectedAmount;
  const bills=s.bills.map(bill=>({id:bill.id,name:bill.name,due:month+'-'+String(bill.end).padStart(2,'0'),left:Math.max(0,bill.amount-C.paid(current,bill.id,month))})).filter(bill=>bill.left>0);
  const fixed=bills.reduce((n,bill)=>n+bill.left,0);
  const spentToday=active.filter(t=>t.kind==='expense'&&!t.bill&&t.date===at).reduce((n,t)=>n+t.cents,0);
  const spendDays=[...p.spendDays].sort((a,b)=>((a+6)%7)-((b+6)%7));
  const spendAmounts=spread(s.weekly.daily,spendDays.map(()=>1));
  const living=calendar.map(d=>{const index=spendDays.indexOf(weekday(d));const budget=index<0?0:spendAmounts[index];return d===at?Math.max(0,budget-spentToday):budget;});
  const livingTotal=living.reduce((n,v)=>n+v,0),costs=fixed+livingTotal;
  const minimum=Math.max(0,costs-available),needed=Math.max(0,costs+p.buffer-available);
  const receiptDates=calendar.filter(d=>p.paymentMode==='weekly'?weekday(d)===p.payday:p.workdays.includes(weekday(d)));
  const weights=receiptDates.map((d,i)=>p.paymentMode==='daily'?1:Math.max(1,dates(i?shift(receiptDates[i-1],1):at,d).filter(day=>p.workdays.includes(weekday(day))).length));
  let runningCost=0,offSchedule=0,firstRisk=null;
  const checkpoints=calendar.map((d,i)=>{const dueBills=bills.filter(bill=>(bill.due<at?at:bill.due)===d);runningCost+=living[i]+dueBills.reduce((n,bill)=>n+bill.left,0);const gap=Math.max(0,runningCost-available);const count=receiptDates.filter(day=>day<=d).length;
   if(count===0)offSchedule=Math.max(offSchedule,gap);
   if(gap&&!firstRisk)firstRisk={date:d,amount:gap,bills:dueBills.map(bill=>bill.name),beforePay:count===0};
   return {date:d,required:gap,count};
  });
  if(!receiptDates.length)offSchedule=needed;
  const amounts=spread(needed-offSchedule,weights);
  // Move a share of later receipts forward whenever a due date needs it sooner.
  for(const point of checkpoints){if(!point.count)continue;const have=offSchedule+amounts.slice(0,point.count).reduce((n,v)=>n+v,0);let gap=Math.max(0,point.required-have);if(!gap)continue;const moved=gap;
   for(let i=amounts.length-1;i>=point.count&&gap;i--){const take=Math.min(amounts[i],gap);amounts[i]-=take;gap-=take;}
   if(gap)throw Error('Não foi possível distribuir as metas.');
   const extra=spread(moved,weights.slice(0,point.count));for(let i=0;i<point.count;i++)amounts[i]+=extra[i];
  }
  const schedule=receiptDates.map((date,i)=>({date,amount:amounts[i]}));
  const weeks=[];for(const item of schedule){const start=weekStart(item.date);let row=weeks.find(w=>w.start===start);if(!row){row={start,end:shift(start,6)>end?end:shift(start,6),amount:0,dates:[]};weeks.push(row);}row.amount+=item.amount;row.dates.push(item.date);}
  const next=schedule[0]||null;
  const workRemaining=calendar.filter(d=>p.workdays.includes(weekday(d))&&receiptDates.length&&d<=receiptDates.at(-1)).length;
  const averageDaily=workRemaining?Math.ceil(needed/workRemaining):null;
  const currentWeekStart=[weekStart(at),month+'-01',s.startDate].sort().at(-1);
  const incomeMonth=active.filter(t=>t.kind==='income'&&t.date.startsWith(month)).reduce((n,t)=>n+t.cents,0);
  const incomeWeek=active.filter(t=>t.kind==='income'&&t.date>=currentWeekStart).reduce((n,t)=>n+t.cents,0);
  const incomeToday=active.filter(t=>t.kind==='income'&&t.date===at).reduce((n,t)=>n+t.cents,0);
  const dailyTarget=p.paymentMode==='daily'?(next?.date===at?next.amount:0):averageDaily;
  return {at,month,end,settings:p,totalBalance,protectedAmount,available,bills,fixed,livingTotal,costs,minimum,needed,offSchedule,firstRisk,schedule,weeks,workRemaining,averageDaily,dailyTarget,next,incomeMonth,incomeWeek,incomeToday,withoutIncome:available-costs,withGoal:available+needed-costs};
 }
 const api={settings,shift,weekday,monthEnd,weekStart,dates,monthPlan};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Planner=api;
})(typeof window!=='undefined'?window:globalThis);
