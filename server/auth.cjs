'use strict';
const crypto=require('node:crypto');
const {validHash,verifyPassword}=require('./password.cjs');
const IDLE_MS=15*60*1000,MAX_MS=8*60*60*1000;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
class Auth {
 constructor({username,passwordHash,secure,now=()=>Date.now()}){
  if(typeof username!=='string'||!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username)||!validHash(passwordHash))throw Error('Configure APP_USERNAME e APP_PASSWORD_HASH usando server/create-login.cjs.');
  this.username=username;this.passwordHash=passwordHash;this.secure=secure;this.now=now;this.sessions=new Map();this.failures=new Map();this.verifying=0;
  this.cookieName=secure?'__Host-fac-session':'fac-session';
 }
 cookie(value,clear=false){return `${this.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; ${clear?'Max-Age=0':'Max-Age=28800'}${this.secure?'; Secure':''}`;}
 token(req){const match=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(this.cookieName+'='));const token=match?.slice(this.cookieName.length+1);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
 prune(){const now=this.now();for(const [key,s] of this.sessions)if(now>=s.expiresAt||now-s.lastSeen>=IDLE_MS)this.sessions.delete(key);for(const [ip,f] of this.failures)if(now>=f.until)this.failures.delete(ip);}
 session(req){this.prune();const token=this.token(req);if(!token)return null;const session=this.sessions.get(digest(token));if(session)session.lastSeen=this.now();return session||null;}
 csrf(req,session){const token=req.headers['x-csrf-token'];return typeof token==='string'&&token.length===64&&crypto.timingSafeEqual(Buffer.from(digest(token),'hex'),Buffer.from(digest(session.csrf),'hex'));}
 async login(req,username,password){
  this.prune();const ip=req.socket.remoteAddress||'unknown',previous=this.failures.get(ip);
  if(previous?.count>=5||this.verifying>=2||this.failures.size>=1000)return {status:429,error:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.'};
  this.failures.set(ip,{count:(previous?.count||0)+1,until:previous?.until||this.now()+IDLE_MS});this.verifying++;
  let valid;try{valid=await verifyPassword(password,this.passwordHash);}finally{this.verifying--;}
  if(!valid||username!==this.username)return {status:401,error:'Usuário ou senha inválidos.'};
  this.failures.delete(ip);this.logout(req);
  while(this.sessions.size>=32)this.sessions.delete(this.sessions.keys().next().value);
  const token=crypto.randomBytes(32).toString('hex'),session={csrf:crypto.randomBytes(32).toString('hex'),username:this.username,lastSeen:this.now(),expiresAt:this.now()+MAX_MS};
  this.sessions.set(digest(token),session);return {status:200,token,session};
 }
 logout(req){const token=this.token(req);if(token)this.sessions.delete(digest(token));}
 info(session){return {username:session.username,csrf:session.csrf,expiresAt:session.expiresAt,idleMs:IDLE_MS};}
}
module.exports={Auth,IDLE_MS,MAX_MS};
