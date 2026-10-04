'use strict';
const C=Core, $=id=>document.getElementById(id), native=typeof Android!=='undefined';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inputMoney=n=>(n/100).toFixed(2).replace('.',',');
const uid=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
const roles={daily:'Dia a dia',bills:'Contas fixas',save:'Reserva'};
const bankMark={c6:'C6',nu:'nu',mp:'MP'};
const kindLabel={expense:'Despesa',income:'Entrada',transfer:'Transferência',adjust:'Ajuste de saldo'};
let state=C.initial(),queue=[],access=false,tab='home',month=C.today().slice(0,7),draft=null,toastTimer;
const app=$('app'),modal=$('modal');
const webStore=native?null:new WebStore(()=>window.localStorage,C.validate);
function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function persist(next){C.validate(next);if(native){const error=Android.save(JSON.stringify(next));if(error)throw Error(error);}else webStore.save(next);state=next;}
function mutate(fn){const next=JSON.parse(JSON.stringify(state));fn(next);persist(next);render();}
function shortDate(d){return d.split('-').reverse().slice(0,2).join('/');}
function fullDate(d){return d.split('-').reverse().join('/');}
function bank(id){return state.accounts.find(a=>a.id===id);}
function options(selected){return state.accounts.map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)} · ${roles[a.role]}</option>`).join('');}
function btn(action,text,cls='',extra=''){return `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;}
function moneyField(id,label,value='',required=true){return `<label for="${id}">${label}</label><input id="${id}" name="${id}" inputmode="decimal" placeholder="0,00" value="${esc(value)}" ${required?'required':''} maxlength="16" autocomplete="off">`;}
function errorForm(e){const target=modal.open?modal.querySelector('#form-error'):$('form-error');if(target)target.textContent=e.message||String(e);else toast(e.message||String(e));}
function openModal(title,html){$('modal-title').textContent=title;$('modal-body').innerHTML=html;modal.showModal();}
function closeModal(){modal.close();draft=null;}
function boot(){try{if(native){const data=JSON.parse(Android.load());if(data.error)throw Error(data.error);if(data.state)state=C.validate(data.state);queue=data.queue||[];access=data.notificationsEnabled;}else{const saved=webStore.load();if(saved)state=saved;}}catch(e){app.innerHTML=`<div class="warning">${esc(e.message)} Os dados existentes foram preservados. Reabra a página ou verifique se o navegador permite armazenamento local.</div>`;return;}render();}
window.refreshNative=function(){if(!native)return;try{const data=JSON.parse(Android.load());if(data.error){toast(data.error);return;}const changed=JSON.stringify(queue)!==JSON.stringify(data.queue)||access!==data.notificationsEnabled;queue=data.queue||[];access=data.notificationsEnabled;if(changed&&!modal.open)render();}catch(e){toast('Não foi possível atualizar os avisos.');}};
window.goHome=function(){if(modal.open)closeModal();else{tab='home';render();window.scrollTo(0,0);}};
window.handleBack=function(){if(modal.open){closeModal();return true;}if(tab!=='home'){window.goHome();return true;}return false;};
function render(){
  $('nav').hidden=!state.setup;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const pending=queue.filter(q=>!state.transactions.some(t=>t.sourceId===q.id&&!t.void));
  $('badge').textContent=pending.length||'';
  if(!state.setup){renderSetup();return;}
  if(tab==='home')renderHome();else if(tab==='bills')renderBills();else if(tab==='goals')renderGoals();else if(tab==='queue')renderQueue();else if(tab==='banks')renderBanks();else renderSettings();
}
function renderSetup(){
 app.innerHTML=`<div class="setup-step">PRIMEIRO PASSO</div><h1>Um banco para cada destino.</h1><p class="muted">Confirme o saldo atual de cada conta. Você pode trocar as funções depois.</p>
 <div class="card"><h2>Comece com os seus valores</h2><p class="small muted">Informe o saldo disponível em cada banco. Depois, em Ajustes, configure as contas do mês e seu plano semanal. Seus registros ficam neste navegador, sem sincronização automática com o APK ou outros aparelhos.</p></div>
 <form id="setup-form"><div class="form-grid">${state.accounts.map(a=>`<div>${moneyField('open-'+a.id,`${esc(a.name)} · ${roles[a.role]}`,'0,00')}</div>`).join('')}</div>
 <label for="start-date">Data desses saldos</label><input type="date" id="start-date" value="${C.today()}" max="${C.today()}" required>
 <p class="note">O aplicativo acompanha os valores que você registra. Ele não consulta nem movimenta dinheiro nos bancos.</p><div id="form-error" class="form-error" role="alert"></div><div class="form-footer"><button class="btn primary full" type="submit">Começar meu controle</button></div></form>`;
}
function renderHome(){
 const b=C.balances(state),day=C.roleAccount(state,'daily'),savings=C.roleAccount(state,'save'),fixed=C.roleAccount(state,'bills');
 const today=C.today(),planning=P.settings(state),nextPay=P.dates(today,P.shift(today,7)).find(d=>planning.paymentMode==='weekly'?P.weekday(d)===planning.payday:planning.workdays.includes(P.weekday(d)));
 const days=P.dates(today,P.shift(nextPay,-1)).filter(d=>planning.spendDays.includes(P.weekday(d))).length,dailyReference=Math.ceil(state.weekly.daily/planning.spendDays.length),dailyAllowance=Math.min(dailyReference,Math.floor(Math.max(0,b[day.id])/Math.max(1,days)));
 const unpaid=state.bills.reduce((n,bill)=>n+Math.max(0,bill.amount-C.paid(state,bill.id,month)),0);
 const savingsBalance=Math.max(0,b[savings.id]),goal=state.weekly.goal;
 const last=[...state.transactions].filter(t=>!t.void).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
 app.innerHTML=`<div class="eyebrow">${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long'}).format(new Date())}</div><h1>Seu dinheiro organizado.</h1>
 <section class="hero"><div class="eyebrow">${esc(day.name)} · Dia a dia</div><div class="amount">${C.money(b[day.id])}</div><div class="hero-foot"><div>Referência diária de gastos<strong>${C.money(dailyAllowance)}</strong></div><div>Próximo recebimento<strong>${weekdayShort[P.weekday(nextPay)]}, ${shortDate(nextPay)}</strong></div></div></section>
 <p class="small muted">${Object.keys(state.bankSync||{}).length?'Saldos do controle, incluindo as conferências bancárias aplicadas.':'Saldos registrados manualmente.'} Orçamento por dia de gastos: ${C.money(dailyReference)}; ajuste para outras despesas.</p>
 <div class="actions">${btn('expense','− Registrar gasto','primary')}${btn('income','+ Recebi dinheiro')}</div>
 ${goalOverview()}
 <section class="section"><div class="heading"><h2>Seus três bancos</h2>${btn('transfer','Transferir','subtle')}</div><div class="banks">${state.accounts.map(a=>`<div class="bank"><div class="bank-icon ${a.id}">${bankMark[a.id]}</div><div><strong>${esc(a.name)}</strong><div class="role">${roles[a.role]}</div></div><div class="bank-value"><strong>${C.money(b[a.id])}</strong><small>${state.bankSync?.[a.id]?'Conferido em '+shortDate(state.bankSync[a.id].appliedAt.slice(0,10)):'Saldo registrado'}</small></div></div>`).join('')}</div></section>
 <div class="right">${btn('plan','Simular divisão do recebimento','subtle')}</div>
 <div class="card"><div class="row"><h3>Contas do mês</h3><strong>${C.money(unpaid)}</strong></div><p class="small muted">Ainda a pagar · ${month.split('-').reverse().join('/')}</p><p class="small">${b[fixed.id]>=unpaid?'Saldo registrado suficiente para essas contas.':`Faltam ${C.money(unpaid-Math.max(0,b[fixed.id]))} no banco de contas.`}</p>${btn('show-bills','Conferir contas','subtle')}</div>
 <div class="card"><div class="row"><h3>Sua primeira reserva</h3><strong>${C.money(savingsBalance)}</strong></div><div class="progress" role="progressbar" aria-label="Meta da reserva" aria-valuemin="0" aria-valuemax="${goal||1}" aria-valuenow="${Math.min(savingsBalance,goal||1)}"><div id="save-progress"></div></div><p class="small muted">Meta: ${C.money(goal)} · ${esc(savings.name)}</p></div>
 <section class="section"><div class="heading"><h2>Últimos movimentos</h2>${btn('history','Ver todos','subtle')}</div>${last.length?`<div class="card">${last.map(historyRow).join('')}</div>`:'<div class="empty">Seus lançamentos aparecerão aqui.<br>O saldo inicial não conta como renda nova.</div>'}</section>`;
 $('save-progress').style.width=Math.min(100,goal?savingsBalance/goal*100:0)+'%';
}
function historyRow(t){const sign=t.kind==='income'?'+':t.kind==='adjust'?(t.cents>=0?'+':'−'):t.kind==='transfer'?'↔':'−';return `<div class="line row"><div class="history-note"><strong>${esc(t.note||kindLabel[t.kind])}</strong><div class="small muted">${shortDate(t.date)} · ${esc(bank(t.account).name)}${t.to?' → '+esc(bank(t.to).name):''}</div><div class="small muted">${kindLabel[t.kind]}${t.billMonth?' · referência '+t.billMonth.split('-').reverse().join('/'):''}</div></div><div class="right"><span class="amount-sm ${t.kind==='income'?'good':''}">${sign} ${C.money(Math.abs(t.cents))}</span></div></div>`;}
function renderBills(){
 const total=state.bills.reduce((n,b)=>n+Math.max(0,b.amount-C.paid(state,b.id,month)),0);
 app.innerHTML=`<div class="eyebrow">Compromissos primeiro</div><div class="heading"><h1>Contas do mês</h1><div class="month"><label class="small" for="month">Mês</label><input id="month" type="month" value="${month}"></div></div><div class="hero"><div class="eyebrow">Falta pagar</div><div class="amount">${C.money(total)}</div><p class="small">Configure valores e vencimentos em Ajustes. Registre os pagamentos para acompanhar o que falta.</p></div>
 <section class="section">${state.bills.map(b=>{let paid=C.paid(state,b.id,month),left=Math.max(0,b.amount-paid),late=C.today()>`${month}-${String(b.end).padStart(2,'0')}`;return `<div class="card"><div class="row"><h3>${esc(b.name)}</h3><span class="pill ${left?(late?'warn':'neutral'):''}">${left?(late?'Confira o pagamento':'Em aberto'):'Pago'}</span></div><p class="muted small">${b.start===b.end?'Até dia '+b.end:'De '+b.start+' a '+b.end} · previsto ${C.money(b.amount)}</p><div class="row"><strong>${C.money(left)}</strong>${left?btn('pay-bill','Registrar pagamento','',`data-id="${b.id}"`):'<span class="good small">Pagamento registrado</span>'}</div>${paid?`<p class="small muted">Já registrado: ${C.money(paid)}</p>`:''}</div>`;}).join('')}</section><p class="note">“Registrar pagamento” apenas atualiza seu controle. Faça o pagamento no aplicativo do banco.</p>`;
}
function renderQueue(){
 const pending=queue.filter(q=>!state.transactions.some(t=>t.sourceId===q.id&&!t.void));
 app.innerHTML=`<div class="eyebrow">Pix e débito</div><h1>Avisos para conferir</h1><p class="muted">Um aviso vira lançamento só depois da sua confirmação.</p>
 ${!native?'<div class="warning">No site, registre os movimentos manualmente. A leitura de notificações dos bancos funciona somente no APK instalado no Android. Os dados do site e do APK são separados; use as cópias para transferi-los.</div>':!access||!state.capture?`<div class="card"><h3>Ativar leitura dos bancos</h3><p class="small muted">Capture novos avisos de C6, Nubank e Mercado Pago. O Android pedirá acesso às notificações.</p>${btn('enable-notifications','Configurar leitura','primary full')}</div>`:'<p class="pill">Leitura ativada para os três bancos</p>'}
 <div class="card">${pending.length?pending.map(q=>{const related=state.transactions.some(t=>!t.void&&t.kind==='transfer'&&t.cents===q.cents&&(t.account===q.bank||t.to===q.bank)&&Math.abs(new Date(t.date+'T12:00:00').getTime()-q.time)<86400000);return `<div class="draft"><div class="row"><strong>${esc(bank(q.bank).name)}</strong><strong>${C.money(q.cents)}</strong></div><p>${esc(q.label)}</p><p class="small muted">${new Date(q.time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${q.kind==='income'?'Possível entrada':q.kind==='expense'?'Possível saída':'Tipo a confirmar'}</p>${related?'<p class="warning">Existe uma transferência parecida. Confira se este é o segundo aviso do mesmo Pix antes de registrar novamente.</p>':''}<div class="draft-actions">${btn('review','Conferir','primary',`data-id="${q.id}"`)}${btn('dismiss','Ignorar','',`data-id="${q.id}"`)}</div></div>`;}).join(''):'<div class="empty"><strong>Nenhum aviso pendente</strong>Novos avisos reconhecidos aparecerão aqui após ativar a leitura. Você também pode registrar manualmente.</div>'}</div>
 <p class="note">Um Pix entre seus bancos é uma transferência: não é renda nem despesa. Se os dois bancos avisarem, registre uma única transferência e ignore o segundo aviso.</p><p class="small muted">Avisos ocultos, sem valor ou com texto não reconhecido precisam de registro manual. Compras no crédito não devem ser lançadas como débito.</p>${pending.length>=300?'<div class="warning">A fila atingiu 300 avisos. Confira ou ignore os pendentes para voltar a receber sugestões.</div>':''}`;
}
function renderSettings(){
 app.innerHTML=`<div class="eyebrow">Do seu jeito</div><h1>Ajustes</h1><div class="card"><h2>Conectar meus bancos</h2><p class="small muted">Prepare a consulta de saldos pelo Meu Pluggy e confira os valores antes de atualizar as metas.</p>${btn('bank-open','Conexão bancária','primary full')}</div><div class="card"><h2>Metas para o mês</h2><p class="small muted">Configure dias de trabalho, recebimento, gastos e a sobra desejada.</p>${btn('goal-settings','Configurar metas','primary full')}</div><form id="settings-form"><div class="card"><h2>Função de cada banco</h2>${state.accounts.map(a=>`<label for="role-${a.id}">${esc(a.name)}</label><select id="role-${a.id}">${Object.entries(roles).map(([k,v])=>`<option value="${k}" ${a.role===k?'selected':''}>${v}</option>`).join('')}</select>`).join('')}<p class="small muted">Trocar a função não transfere dinheiro.</p></div>
 <div class="card"><h2>Plano de cada sábado</h2>${moneyField('weekly-daily','Alimentação e condução',inputMoney(state.weekly.daily))}${moneyField('weekly-fixed','Separar para contas',inputMoney(state.weekly.fixed))}${moneyField('weekly-saving','Meta de guardar por semana',inputMoney(state.weekly.saving))}${moneyField('weekly-goal','Meta da reserva',inputMoney(state.weekly.goal))}</div>
 <div class="card"><h2>Valores das contas mensais</h2>${state.bills.map(b=>moneyField('bill-'+b.id,esc(b.name),inputMoney(b.amount))+`<label for="due-${b.id}">Vencimento de ${esc(b.name)} (dia 1 a 28)</label><input id="due-${b.id}" type="number" min="1" max="28" value="${b.end}" required>`).join('')}<p class="small muted">Valores de referência. Ao pagar, registre o valor real. Os pagamentos já registrados são preservados.</p></div>
 <div id="form-error" class="form-error" role="alert"></div><button class="btn primary full" type="submit">Salvar ajustes</button></form>
 <div class="card section"><h2>Notificações dos bancos</h2><p class="small muted">${native?(access?'Acesso permitido pelo Android.':'Acesso ainda não permitido pelo Android.'):'A leitura funciona somente no Android.'}</p>${native?`<label class="check"><input id="capture" type="checkbox" ${state.capture?'checked':''}>Guardar sugestões dos três bancos</label>${btn('enable-notifications','Abrir permissão do Android','full')}`:'<p class="small muted">Use Registrar gasto, Recebi dinheiro e Transferir no Resumo.</p>'}</div>
 <div class="card"><h2>Conferir saldos</h2><p class="small muted">Se um lançamento ficou de fora, registre-o. Se precisar acertar o saldo atual, use um ajuste; ele não conta como renda.</p>${btn('reconcile','Ajustar saldo registrado','full')}</div>
 <div class="card"><h2>Cópia dos seus dados</h2><p class="small muted">Os registros ficam neste navegador. Exporte uma cópia antes de limpar os dados, usar outro navegador ou trocar de aparelho. Não há sincronização automática. A cópia contém seus valores e não tem senha.</p><div class="actions">${btn('export','Exportar cópia')}${btn('import','Restaurar cópia')}</div></div>
 <p class="privacy">Três Bancos · versão web 1.4<br>Sem cadastro ou anúncios. O site precisa de internet para abrir; os registros são salvos localmente neste navegador. O aplicativo não envia seus lançamentos ao servidor. A consulta opcional de saldos depende da configuração privada e da autorização no Meu Pluggy. Não faz Pix, paga contas ou lê notificações no site.</p>`;
}
function entry(kind='expense',prefill={}){
 const fromDraft=prefill.draft;draft=fromDraft||null;
 let account=prefill.account||C.roleAccount(state,kind==='expense'?'daily':'daily').id;
 const amount=prefill.cents?inputMoney(prefill.cents):'';
 const isBill=!!prefill.bill;
 openModal(fromDraft?'Conferir aviso':isBill?'Registrar pagamento':kind==='transfer'?'Transferência entre seus bancos':kind==='income'?'Recebi dinheiro':'Registrar gasto',`
 <form id="entry-form" data-source="${esc(fromDraft?.id||'')}" data-bill="${esc(prefill.bill||'')}" data-month="${esc(prefill.billMonth||'')}">
 ${fromDraft?'<p class="note">Confira no banco o valor, o tipo e a data. Um Pix entre suas contas deve ser marcado como transferência.</p>':''}
 <label for="kind">Tipo de movimento</label><select id="kind" ${isBill?'disabled':''}>${fromDraft?.kind==='review'?'<option value="" selected>Escolha o tipo</option>':''}${['expense','income','transfer'].map(k=>`<option value="${k}" ${kind===k&&fromDraft?.kind!=='review'?'selected':''}>${kindLabel[k]}</option>`).join('')}</select>
 ${moneyField('value','Valor (R$)',amount)}
 <label for="account" id="account-label">${kind==='income'?'Banco que recebeu':'Banco de saída'}</label><select id="account">${options(account)}</select>
 <div id="to-wrap" ${kind!=='transfer'?'hidden':''}><label for="to">Banco de destino</label><select id="to">${options(state.accounts.find(a=>a.id!==account).id)}</select><p class="small muted">Registre somente depois de realizar a transferência no banco. Ela altera os dois saldos sem contar como gasto.</p></div>
 <label for="entry-date">Data do movimento</label><input id="entry-date" type="date" min="${state.startDate}" max="${C.today()}" value="${prefill.date&&prefill.date>=state.startDate?prefill.date:C.today()}" required>
 <div id="bill-wrap" ${kind!=='expense'?'hidden':''}><label for="bill-select">É pagamento de uma conta fixa?</label><select id="bill-select"><option value="">Não · gasto do dia a dia</option>${state.bills.map(b=>`<option value="${b.id}" ${b.id===prefill.bill?'selected':''}>${esc(b.name)}</option>`).join('')}</select><div id="bill-month-wrap" ${isBill?'':'hidden'}><label for="bill-month">Mês da conta</label><input id="bill-month" type="month" value="${prefill.billMonth||C.today().slice(0,7)}"></div></div>
 <label for="note">Descrição</label><input id="note" maxlength="140" placeholder="Ex.: almoço, condução, pagamento da semana" value="${esc(prefill.note||fromDraft?.label||'')}">
 <div id="form-error" class="form-error" role="alert"></div><div class="form-footer"><button type="submit" class="btn primary full">Salvar lançamento</button></div></form>`);
}
function plan(){openModal('Dividir o recebimento',`<p class="small muted">Use o valor líquido que entrou. Esta tela calcula a separação e não registra movimentações.</p><form id="plan-form">${moneyField('plan-value','Quanto você vai receber?',inputMoney(state.weekly.daily+state.weekly.fixed+state.weekly.saving))}<label for="plan-date">Sábado do recebimento</label><input id="plan-date" type="date" value="${C.nextSaturday(C.today())}" required><div id="plan-result" class="card forecast"></div><div id="form-error" class="form-error" role="alert"></div></form><p class="note">Faça as transferências nos bancos e depois registre-as em “Transferir”. A margem fica no banco do dia a dia.</p>`);updatePlan();}
function updatePlan(){try{const date=$('plan-date').value;if(!C.validDate(date))throw Error('Escolha uma data.');const p=C.split(state,C.parseMoney($('plan-value').value),date);$('plan-result').innerHTML=`<div class="line row"><span>${esc(C.roleAccount(state,'bills').name)}<small class="muted"> · contas</small></span><strong>${C.money(p.fixed)}</strong></div><div class="line row"><span>${esc(C.roleAccount(state,'daily').name)}<small class="muted"> · semana</small></span><strong>${C.money(p.daily)}</strong></div><div class="line row"><span>${esc(C.roleAccount(state,'save').name)}<small class="muted"> · guardar</small></span><strong>${C.money(p.save)}</strong></div><div class="line row"><span>Margem no dia a dia</span><strong>${C.money(p.margin)}</strong></div>${p.shortfall?`<p class="warning">Faltam ${C.money(p.shortfall)} para cobrir contas e semana. Reveja os gastos e vencimentos antes de guardar.</p>`:''}`;$('form-error').textContent='';}catch(e){$('plan-result').innerHTML='';errorForm(e);}}
function history(){const ts=[...state.transactions].filter(t=>!t.void).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));const total=C.totals(state,month);openModal('Histórico de movimentos',`<p class="small muted">${month.split('-').reverse().join('/')} · Entradas ${C.money(total.income)} · Despesas ${C.money(total.expense)}. Transferências e ajustes não entram nesses totais.</p>${ts.length?ts.map(t=>`<div>${historyRow(t)}<div class="right">${btn('undo','Desfazer lançamento','subtle',`data-id="${t.id}"`)}</div></div>`).join(''):'<div class="empty">Nenhum lançamento ainda.</div>'}`);}
function reconcile(){openModal('Ajustar saldo registrado',`<form id="reconcile-form"><p class="note">Compare com o saldo disponível no banco. O ajuste corrige o controle sem contar como entrada ou despesa.</p><label for="reconcile-bank">Banco</label><select id="reconcile-bank">${options('c6')}</select>${moneyField('reconcile-value','Saldo disponível no banco (R$)',inputMoney(C.balances(state).c6))}<div id="form-error" class="form-error" role="alert"></div><div class="form-footer"><button type="submit" class="btn primary full">Salvar ajuste de saldo</button></div></form>`);}
function enableNotifications(){if(!native){toast('Instale o APK para usar esta função.');return;}mutate(s=>s.capture=true);Android.notificationSettings();}
function dismiss(id){if(native){const error=Android.dismiss(id);if(error)throw Error(error);}queue=queue.filter(q=>q.id!==id);render();}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-tab]');if(nav){tab=nav.dataset.tab;render();window.scrollTo(0,0);return;}
 const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;
 try{
  if(action==='close')closeModal();
  else if(['expense','income','transfer'].includes(action))entry(action);
  else if(action==='show-bills'){tab='bills';render();window.scrollTo(0,0);}
  else if(action==='plan')plan();
  else if(action==='goal-settings')goalSettings();
  else if(action==='show-goals'){tab='goals';render();window.scrollTo(0,0);}
  else if(action==='history')history();
  else if(action==='pay-bill'){const b=state.bills.find(b=>b.id===el.dataset.id);entry('expense',{account:C.roleAccount(state,'bills').id,cents:Math.max(0,b.amount-C.paid(state,b.id,month)),bill:b.id,billMonth:month,note:b.name});}
  else if(action==='review'){const q=queue.find(q=>q.id===el.dataset.id);entry(q.kind==='review'?'expense':q.kind,{account:q.bank,cents:q.cents,draft:q,date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(q.time))});}
  else if(action==='dismiss'){if(confirm('Ignorar este aviso? Nenhum saldo será alterado.'))dismiss(el.dataset.id);}
  else if(action==='enable-notifications')enableNotifications();
  else if(action==='export'){if(native)Android.exportBackup();else exportWebBackup();}
  else if(action==='import'){if(native)Android.importBackup();else $('backup-file').click();}
  else if(action==='reconcile')reconcile();
  else if(action==='undo'){if(!confirm('Desfazer este lançamento e recalcular os saldos?'))return;const next=JSON.parse(JSON.stringify(state));next.transactions.find(t=>t.id===el.dataset.id).void=true;if(Object.values(C.balances(next)).some(n=>n<0))throw Error('Desfaça primeiro os movimentos que dependem desse dinheiro, para não deixar saldo negativo.');persist(next);closeModal();render();toast('Lançamento desfeito.');}
 }catch(err){toast(err.message);}
});
document.addEventListener('change',e=>{try{
 if(e.target.id==='month'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))return;month=e.target.value;renderBills();}
 if(e.target.id==='kind'){const k=e.target.value;$('to-wrap').hidden=k!=='transfer';$('bill-wrap').hidden=k!=='expense';$('account-label').textContent=k==='income'?'Banco que recebeu':'Banco de saída';if(k==='transfer'&&draft?.kind==='income'){$('to').value=draft.bank;$('account').value=state.accounts.find(a=>a.id!==draft.bank).id;}}
 if(e.target.id==='bill-select'){$('bill-month-wrap').hidden=!e.target.value;if(e.target.value&&!$('note').value)$('note').value=state.bills.find(b=>b.id===e.target.value).name;}
 if(e.target.id==='capture')mutate(s=>s.capture=e.target.checked);
 if(e.target.id==='plan-date')updatePlan();
 if(e.target.id==='reconcile-bank')$('reconcile-value').value=inputMoney(C.balances(state)[e.target.value]);
 }catch(err){toast(err.message);}});
document.addEventListener('input',e=>{if(e.target.id==='plan-value')updatePlan();});
document.addEventListener('submit',e=>{e.preventDefault();try{
 if(e.target.id==='setup-form'){
  const next=JSON.parse(JSON.stringify(state));for(const a of next.accounts)a.opening=C.parseMoney($('open-'+a.id).value);
  next.startDate=$('start-date').value;if(!C.validDate(next.startDate)||next.startDate>C.today())throw Error('Escolha uma data até hoje.');next.setup=true;persist(next);render();window.scrollTo(0,0);toast('Controle iniciado com seus saldos.');
 }else if(e.target.id==='goals-form'){
  const next=JSON.parse(JSON.stringify(state));
  next.planning={configured:true,workdays:[...e.target.querySelectorAll('[name="workdays"]:checked')].map(x=>Number(x.value)),spendDays:[...e.target.querySelectorAll('[name="spendDays"]:checked')].map(x=>Number(x.value)),paymentMode:$('goal-mode').value,payday:Number($('goal-payday').value),buffer:C.parseMoney($('goal-buffer').value),protectReserve:$('goal-protect').checked};
  if(!next.planning.workdays.length||!next.planning.spendDays.length)throw Error('Selecione pelo menos um dia de trabalho e um dia de gastos.');
  next.weekly.daily=C.parseMoney($('goal-living').value);
  for(const b of next.bills){b.amount=C.parseMoney($('goal-bill-'+b.id).value);b.start=b.end=Number($('goal-due-'+b.id).value);}
  persist(next);closeModal();tab='goals';render();window.scrollTo(0,0);toast('Metas calculadas com o seu plano.');
 }else if(e.target.id==='settings-form'){
  const next=JSON.parse(JSON.stringify(state));for(const a of next.accounts)a.role=$('role-'+a.id).value;if(new Set(next.accounts.map(a=>a.role)).size!==3)throw Error('Escolha uma função diferente para cada banco.');
  for(const k of ['daily','fixed','saving','goal'])next.weekly[k]=C.parseMoney($('weekly-'+k).value);for(const b of next.bills){b.amount=C.parseMoney($('bill-'+b.id).value);b.start=b.end=Number($('due-'+b.id).value);}persist(next);render();toast('Ajustes salvos.');
 }else if(e.target.id==='entry-form'){
  const t={id:uid(),kind:$('kind').value,cents:C.parseMoney($('value').value),account:$('account').value,date:$('entry-date').value,note:$('note').value};
  if(t.kind==='transfer')t.to=$('to').value;
  if(t.kind==='expense'&&$('bill-select').value){t.bill=$('bill-select').value;t.billMonth=$('bill-month').value;}
  if(draft)t.sourceId=draft.id;
  const next=C.add(state,t);
  const duplicate=state.transactions.some(x=>!x.void&&x.date===t.date&&x.cents===t.cents&&x.account===t.account&&x.kind===t.kind);
  if(duplicate&&!confirm('Já existe um movimento parecido no mesmo dia. É uma outra operação e você quer registrá-la também?'))return;
  persist(next);if(draft)dismiss(draft.id);closeModal();render();toast('Lançamento salvo.');
 }else if(e.target.id==='reconcile-form'){
  const account=$('reconcile-bank').value,target=C.parseMoney($('reconcile-value').value),delta=target-C.balances(state)[account];
  if(!delta){closeModal();toast('O saldo já está correto.');return;}
  persist(C.add(state,{id:uid(),kind:'adjust',account,cents:delta,date:C.today(),note:'Conferência de saldo'}));closeModal();render();toast('Saldo ajustado.');
 }
}catch(err){errorForm(err);}});
window.restoreBackup=function(text){try{const restored=C.validate(JSON.parse(text));restored.capture=false;persist(restored);tab='home';render();toast(native?'Cópia restaurada. Reative a leitura dos avisos se desejar.':'Cópia restaurada neste navegador.');}catch(e){toast('Cópia não restaurada: '+e.message);}};
function exportWebBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tres-bancos-'+C.today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Cópia preparada para download.');}
$('backup-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('Arquivo maior que 10 MB.');const text=await file.text();const restored=C.validate(JSON.parse(text));if(!confirm('Restaurar esta cópia substituirá os registros deste navegador. Deseja continuar?'))return;restored.capture=false;persist(restored);tab='home';render();toast('Cópia restaurada neste navegador.');}catch(e){toast('Cópia não restaurada: '+e.message);}});
window.addEventListener('storage',e=>{if(e.key!==WebStore.KEY)return;try{const saved=webStore.load();if(modal.open)closeModal();state=saved||C.initial();render();toast('Dados atualizados por outra aba.');}catch(e){toast(e.message);}});
let displayedDay=C.today();
function refreshDate(){const day=C.today();if(day!==displayedDay&&!modal.open){displayedDay=day;month=day.slice(0,7);render();}}
window.addEventListener('focus',()=>{window.refreshNative();refreshDate();});
setInterval(()=>{if(!document.hidden&&!modal.open){window.refreshNative();refreshDate();}},5000);
AuthUI.start(boot);
