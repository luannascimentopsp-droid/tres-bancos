'use strict';
const crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),PARAMS={N:32768,r:8,p:3,maxmem:64*1024*1024};
function validHash(hash){return typeof hash==='string'&&/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash);}
async function hashPassword(password){
 if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Use uma senha de 12 a 128 caracteres.');
 const salt=crypto.randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,PARAMS);return `scrypt-v1$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password,hash){
 if(!validHash(hash)||typeof password!=='string'||password.length>128)return false;
 const [,salt,expected]=hash.split('$'),key=await scrypt(password,salt,64,PARAMS);return crypto.timingSafeEqual(key,Buffer.from(expected,'hex'));
}
module.exports={hashPassword,verifyPassword,validHash};
