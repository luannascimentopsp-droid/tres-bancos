'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),readline=require('node:readline');
const {hashPassword}=require('./password.cjs');
function question(label,hidden=false){return new Promise((resolve,reject)=>{
 let value='';process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();readline.emitKeypressEvents(process.stdin);
 const finish=()=>{process.stdin.off('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
 function onKey(text,key={}){if(key.ctrl&&key.name==='c'){finish();reject(Error('Cancelado. Nenhuma senha salva.'));return;}if(key.name==='return'){finish();resolve(value);return;}if(key.name==='backspace'){if(value){value=value.slice(0,-1);if(!hidden)process.stdout.write('\b \b');}return;}if(!key.ctrl&&!key.meta&&text&&!/[\x00-\x1f\x7f]/.test(text)&&value.length+text.length<=128){value+=text;if(!hidden)process.stdout.write(text);}}
 process.stdin.on('keypress',onKey);
});}
(async()=>{
 if(!process.stdin.isTTY)throw Error('Execute em um terminal interativo. A senha será digitada sem aparecer.');
 if(!process.argv[2])throw Error('Informe o caminho de um novo arquivo .env.private fora da pasta do projeto.');
 const target=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..'),relative=path.relative(root,target);
 if(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('Salve a configuração fora da pasta do projeto.');
 const username=await question('Usuário (3 a 80 caracteres, letras/números/_.@-): ');if(!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username))throw Error('Usuário inválido.');
 const password=await question('Senha (12 a 128 caracteres; não aparece): ',true),confirm=await question('Repita a senha: ',true);if(password!==confirm)throw Error('As senhas não coincidem.');
 const hash=await hashPassword(password);
 await fs.writeFile(target,`APP_USERNAME=${username}\nAPP_PASSWORD_HASH='${hash}'\nPLUGGY_CLIENT_ID=\nPLUGGY_CLIENT_SECRET=\nPLUGGY_ITEM_IDS=\nHOST=127.0.0.1\nPORT=8787\n`,{flag:'wx',mode:0o600});
 console.log('Configuração criada em '+target+'. A senha não foi gravada; somente seu hash.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
