'use strict';
const form=document.getElementById('login-form'),message=document.getElementById('login-status'),error=document.getElementById('login-error');
let available=false;
(async()=>{try{const response=await fetch('/api/auth/availability',{cache:'no-store',credentials:'same-origin',redirect:'error'});const data=await response.json();if(!response.ok||data.login!==true)throw Error();available=true;message.hidden=true;form.hidden=false;}catch{message.hidden=true;document.getElementById('login-unavailable').hidden=false;}})();
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!available)return;const button=document.getElementById('login-submit');button.disabled=true;error.textContent='';
 try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',redirect:'error',body:JSON.stringify({username:document.getElementById('username').value.trim(),password:document.getElementById('password').value}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível entrar.');document.getElementById('password').value='';location.replace('/');}
 catch(e){error.textContent=e.name==='TimeoutError'?'O servidor demorou para responder. Tente novamente.':e.message;document.getElementById('password').value='';}finally{button.disabled=false;}
});
