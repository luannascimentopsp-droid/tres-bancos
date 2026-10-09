'use strict';
window.AuthUI=(()=>{
 let session=null,timer=null,lastCheck=0,checking=false,leaving=false;
 const privateMode=()=>window.BankConfig?.enabled===true;
 function hide(){document.getElementById('app').hidden=true;document.getElementById('nav').hidden=true;document.getElementById('modal')?.close();}
 function lock(){hide();location.replace('/login');}
 async function verify(){
  if(checking)return true;checking=true;
  try{const r=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();session=await r.json();lastCheck=Date.now();return true;}catch{lock();return false;}finally{checking=false;}
 }
 async function logout(){
  if(leaving)return;leaving=true;hide();
  try{const r=await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':session?.csrf||''},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok&&r.status!==401)throw Error();try{localStorage.setItem('fac.logout',String(Date.now()));}catch{}lock();}
  catch{const target=document.getElementById('app');target.hidden=false;target.replaceChildren();const text=document.createElement('p');text.textContent='Não foi possível encerrar a sessão no servidor. Verifique sua conexão e tente sair novamente.';target.append(text);leaving=false;}
 }
 function activity(){if(!session||leaving)return;clearTimeout(timer);timer=setTimeout(logout,Math.max(0,Math.min(session.idleMs,session.expiresAt-Date.now())));if(Date.now()-lastCheck>60000)void verify();}
 async function start(boot){
  if(typeof Android!=='undefined'){boot();return;}hide();if(!privateMode()){location.replace('https://facilitador-financeiro-nsex.onrender.com/');return;}if(!await verify())return;
  const button=document.createElement('button');button.type='button';button.className='btn subtle';button.textContent='Sair';button.id='auth-logout';button.addEventListener('click',logout);document.querySelector('header').append(button);
  document.getElementById('app').hidden=false;boot();activity();
  for(const event of ['pointerdown','keydown','scroll'])document.addEventListener(event,activity,{passive:true});
  window.addEventListener('storage',e=>{if(e.key==='fac.logout')lock();});
  window.addEventListener('pageshow',e=>{if(e.persisted){hide();location.reload();}});
  window.addEventListener('pagehide',hide);
 }
 async function request(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});if(r.status===401){lock();throw Error('Sessão encerrada. Entre novamente.');}return r;}
 return {start,request,logout};
})();
