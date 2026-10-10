'use strict';
// Deliberately uses only memory. No browser storage, credentials, or server requests.
window.DemoMode=true;
window.WebStore=class DemoStore {
 constructor(_storage,validate){this.validate=validate;this.state=this.example();}
 example(){
  const s=Core.initial(),today=Core.today();
  s.setup=true;s.startDate=today.slice(0,7)+'-01';
  s.accounts[0].opening=45000;s.accounts[1].opening=180000;s.accounts[2].opening=120000;
  [80000,9000,14000,10000,16000].forEach((amount,i)=>{s.bills[i].amount=amount;s.bills[i].start=s.bills[i].end=[5,10,15,20,25][i];});
  s.weekly={daily:25000,fixed:32000,saving:10000,goal:500000};
  s.planning={configured:true,workdays:[1,2,3,4,5],spendDays:[1,2,3,4,5],paymentMode:'weekly',payday:6,buffer:30000,protectReserve:true};
  s.transactions=[
   {id:'demo_income',kind:'income',account:'c6',cents:70000,date:today,note:'Recebimento de exemplo'},
   {id:'demo_food',kind:'expense',account:'c6',cents:2800,date:today,note:'Almoço de exemplo'},
   {id:'demo_transport',kind:'expense',account:'c6',cents:1200,date:today,note:'Transporte de exemplo'},
   {id:'demo_rent',kind:'expense',account:'nu',cents:80000,date:today,bill:'rent',billMonth:today.slice(0,7),note:'Aluguel de exemplo'}
  ];
  return this.validate(s);
 }
 load(){return structuredClone(this.state);}
 save(state){this.state=structuredClone(this.validate(state));}
};
window.AuthUI=Object.freeze({start:boot=>boot()});
document.getElementById('demo-reset').addEventListener('click',()=>location.reload());
