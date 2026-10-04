'use strict';
// A consulta usa a sessão HttpOnly do servidor; credenciais do provedor não chegam ao navegador.
let bankSnapshot=null,bankBusy=false,bankNotice='',bankRequest=0;
function bankTime(value){return new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});}
function renderBanks(){
 const enabled=window.BankConfig?.enabled===true;
 const metadata=Object.entries(state.bankSync||{});
 app.innerHTML=`<div class="eyebrow">Conexão bancária</div><div class="heading"><h1>Seus saldos, conferidos.</h1>${btn('bank-back','Voltar','subtle')}</div>
 <p class="muted">Consulte suas contas pelo Meu Pluggy e confira os valores antes de atualizar seu controle.</p>
 ${bankNotice?`<div class="warning" role="status">${esc(bankNotice)}</div>`:''}
 ${!enabled?`<div class="card"><h2>Primeiro, conecte suas contas</h2><ol class="bank-steps"><li>Crie sua conta no <a href="https://meu.pluggy.ai/" target="_blank" rel="noopener noreferrer">Meu Pluggy</a>.</li><li>Confira os bancos disponíveis e autorize as contas que deseja consultar.</li><li>No <a href="https://dashboard.pluggy.ai/" target="_blank" rel="noopener noreferrer">Dashboard da Pluggy</a>, conecte o Meu Pluggy na aplicação demo.</li><li>Conclua a configuração do servidor privado do Facilitador para habilitar a consulta.</li></ol><p class="small muted">A conexão real ainda não está ativa nesta página. O GitHub Pages não executa o servidor que protege as credenciais.</p><a href="https://meu.pluggy.ai/api-guide" target="_blank" rel="noopener noreferrer">Ver o guia de cadastro e conexão</a></div><div class="card"><h2>Continue com seus registros</h2><p>Ao abrir a versão privada, use Exportar cópia aqui e Restaurar cópia lá para levar seus dados. Cada endereço e navegador tem seu próprio armazenamento.</p>${btn('export','Exportar cópia','full')}</div>`:
 `<div class="card"><h2>Consultar contas conectadas</h2><p class="small muted">Seu acesso já foi confirmado pelo login. As credenciais bancárias ficam no servidor.</p><form id="bank-access-form"><button class="btn primary full" type="submit" ${bankBusy?'disabled':''}>${bankBusy?'Consultando…':'Consultar saldos'}</button></form>${btn('bank-lock','Limpar consulta da tela','subtle')}<p class="small muted">A consulta usa a última atualização disponível no provedor. Não força uma nova consulta ao banco.</p></div>`}
 ${bankSnapshot?renderBankSnapshot():''}
 ${metadata.length?`<div class="card"><h2>Última conferência aplicada</h2>${metadata.map(([id,m])=>`<p><strong>${esc(bank(id).name)}</strong><br><span class="small">Dados do provedor: ${esc(bankTime(m.updatedAt))}<br>Aplicado aqui: ${esc(bankTime(m.appliedAt))}</span></p>`).join('')}</div>`:''}
 <div class="card"><h2>O que muda nas metas</h2><p>Ao aplicar os saldos, a diferença vira um ajuste, sem contar como renda ou despesa. As metas são recalculadas.</p><p class="small muted">Esta etapa sincroniza saldos após sua conferência. Não importa o extrato nem identifica contas pagas automaticamente. Registre entradas, despesas e pagamentos antes de conferir os saldos, para manter o histórico e as metas corretos.</p><p class="small muted">Não realiza pagamentos ou transferências. A atualização diária depende da conexão no Meu Pluggy; não é em tempo real.</p></div>`;
}
function renderBankSnapshot(){
 const s=bankSnapshot;
 return `${s.issues.map(i=>`<div class="warning">${esc(i.bank)}: ${esc(i.message)}</div>`).join('')}
 <div class="card"><h2>Saldos disponíveis</h2><p class="small muted">Consulta ao provedor: ${esc(bankTime(s.fetchedAt))}. A data de cada saldo aparece abaixo.</p>
 ${s.accounts.length?s.accounts.map(a=>`<div class="line"><strong>${esc(a.bank)} · ${esc(a.name)}</strong><p class="small">Final ${esc(a.last4||'não informado')} · ${C.money(a.cents)}<br>Atualização: ${esc(bankTime(a.updatedAt))}${Date.now()-Date.parse(a.updatedAt)>48*3600000?'<br><strong>Dados há mais de 48 horas sem atualização.</strong>':''}</p></div>`).join(''):'<p>Nenhuma conta em reais disponível para aplicar. Confira as conexões no Meu Pluggy.</p>'}</div>
 ${s.accounts.length?`<form id="bank-apply-form" class="card"><h2>Conferir e usar estes saldos</h2><p class="small muted">Relacione cada banco à conta correta. Contas não selecionadas permanecem como estão. Cartões e limites de crédito ficam fora desta consulta.</p>
 ${state.accounts.map(a=>`<label for="bank-map-${a.id}">${esc(a.name)} · registrado ${C.money(C.balances(state)[a.id])}</label><select id="bank-map-${a.id}"><option value="">Não atualizar este banco</option>${s.accounts.map(source=>`<option value="${esc(source.id)}" ${state.bankSync?.[a.id]?.sourceId===source.id?'selected':''}>${esc(source.bank)} · final ${esc(source.last4)} · ${C.money(source.cents)}</option>`).join('')}</select>`).join('')}
 <label class="check"><input id="bank-confirm" type="checkbox" required>Conferi as contas, os valores e as datas. Entendo que estes saldos substituirão os valores registrados dos bancos selecionados.</label><p class="small muted">Se já registrou movimentos posteriores à atualização do banco, aguarde dados novos para não desfazer esses movimentos no saldo.</p><div id="bank-error" class="form-error" role="alert"></div><button class="btn primary full" type="submit">Aplicar saldos e recalcular metas</button></form>`:''}`;
}
async function fetchBankSnapshot(){
 const response=await AuthUI.request('/api/bank/snapshot');
 let data;try{data=await response.json();}catch{throw Error('O servidor privado não está disponível neste endereço.');}
 if(!response.ok)throw Error(data.error||'Não foi possível consultar os bancos.');
 if(!data||!Array.isArray(data.accounts)||!Array.isArray(data.issues)||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Resposta inválida do servidor.');
 // Validar todos os saldos antes de exibi-los ou permitir aplicação.
 BankSync.validateSnapshot(data);
 return data;
}
document.addEventListener('click',e=>{
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='bank-open'){bankNotice='';tab='banks';render();window.scrollTo(0,0);}
 if(action==='bank-back'){tab='settings';render();}
 if(action==='bank-lock'){bankRequest++;bankBusy=false;bankSnapshot=null;bankNotice='Consulta removida da tela. Para encerrar a sessão, use Sair.';renderBanks();}
});
document.addEventListener('submit',async e=>{
 if(e.target.id==='bank-access-form'){
  e.preventDefault();if(bankBusy)return;
  const request=++bankRequest;bankSnapshot=null;bankBusy=true;bankNotice='';renderBanks();
  try{const result=await fetchBankSnapshot();if(request!==bankRequest)return;bankSnapshot=result;bankNotice='Consulta concluída. Confira os saldos antes de aplicar.';}catch(error){if(request===bankRequest)bankNotice=error.name==='TimeoutError'?'A consulta demorou demais. Tente novamente.':error.message;}finally{if(request===bankRequest){bankBusy=false;if(tab==='banks')renderBanks();}}
 }
 if(e.target.id==='bank-apply-form'){
  e.preventDefault();try{
   if(!$('bank-confirm').checked)throw Error('Confira os saldos antes de aplicar.');
   const mapping=Object.fromEntries(state.accounts.map(a=>[a.id,$('bank-map-'+a.id).value]));
   const next=BankSync.apply(state,bankSnapshot,mapping);persist(next);bankNotice='Conferência salva. As metas já usam os saldos atualizados.';renderBanks();
  }catch(error){$('bank-error').textContent=error.message;}
 }
});
