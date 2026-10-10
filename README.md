# Facilitador Financeiro 

Controle financeiro pessoal para organizar C6 Bank, Nubank e Mercado Pago em três funções: dia a dia, contas fixas e reserva.

## Acesso autorizado

Use https://facilitador-financeiro-nsex.onrender.com/. O servidor exige usuário e senha para abrir o painel e consultar as APIs. Quem ainda não tem acesso pode solicitar aprovação pelo botão de WhatsApp na tela de entrada, no número +55 (83) 99808-3995. A solicitação não cria conta nem concede acesso automaticamente. A configuração atual usa um único usuário autorizado; não existe cadastro público. A versão estática encaminha para o serviço com login.

## Usar

1. Informe seus saldos iniciais e a data de referência.
2. Em **Ajustes**, configure valores, vencimentos das contas e metas semanais.
3. Registre entradas, despesas e transferências depois de realizá-las no banco.
4. Use **Exportar cópia** regularmente. **Restaurar cópia** substitui os registros após confirmação.
5. Em **Metas**, informe seus dias de trabalho, quando recebe, orçamento semanal e a sobra que deseja ter no fim do mês. O padrão é trabalhar de segunda a sábado e receber no sábado.

A versão pública começa sem saldos, lançamentos ou valores pessoais. Os cinco tipos de conta são modelos editáveis em valor e vencimento.

O resumo inicial e os totais do histórico usam o mês atual. A escolha de outro mês em **Contas** vale apenas para consultar e registrar pagamentos daquele mês; o atalho **Conferir contas** no resumo abre o mês atual.

Cópias com data de saldo inicial ou movimentos posteriores a hoje são recusadas antes de substituir os registros. Um pagamento realizado até hoje pode continuar vinculado a uma conta de um mês futuro.

## Metas para fechar o mês

A meta restante é o maior valor entre zero e **contas do mês ainda não pagas + gastos do dia a dia previstos até o fim do mês + sobra desejada − saldo disponível**. Por padrão, o saldo da reserva fica protegido, fora do dinheiro disponível. É possível incluí-lo explicitamente nas opções.

O orçamento semanal de gastos é distribuído em centavos pelos dias de gastos escolhidos. A parcela de hoje desconta os gastos comuns já lançados hoje. Contas pagas não são cobradas novamente, e transferências não são somadas como receita nem como nova despesa. A meta de guardar por semana e o valor de separar para contas não são cobrados uma segunda vez: a sobra desejada representa o dinheiro adicional que o usuário quer manter.

As entradas necessárias são distribuídas pelos recebimentos restantes do mês. Quando uma conta vence antes de um recebimento posterior, parte da meta é antecipada para um recebimento anterior. Valores necessários antes do primeiro recebimento são destacados como **entrada fora do calendário**, separadamente das metas semanais. Datas não garantem que a entrada ocorra antes da saída no mesmo dia.

A meta diária é uma média equivalente pelos dias de trabalho restantes cujo pagamento pode acontecer neste mês. Para quem recebe semanalmente, ela orienta o trabalho e não representa recebimentos diários garantidos. O sistema não registra produção ainda não paga. Os valores que já entraram no dia, na semana e no mês vêm somente dos lançamentos de entrada.

A previsão é do mês atual e depende das contas, saldos e gastos informados. Não inventa renda futura ou pendências de meses anteriores. Ao mudar o mês ou registrar movimentos, o plano é recalculado. Cópias antigas continuam funcionando; basta configurar as metas sem apagar os lançamentos.

## Conexão bancária opcional

Em Ajustes → Conexão bancária estão as instruções para o Meu Pluggy. A consulta e a conferência de saldos estão implementadas em um servidor privado opcional, mas exigem cadastro, autorização e credenciais. O site no GitHub Pages continua sem conexão direta aos bancos. Veja [INTEGRACAO-BANCARIA.md](INTEGRACAO-BANCARIA.md) para ativação, limitações e validação pendente com contas reais. Não há importação automática do extrato nesta etapa.

## Salvamento automático e sincronização

Ajustes e metas válidos são salvos automaticamente após a edição, sem fechar o formulário. Campos incompletos ou inválidos não substituem os dados anteriores. Novas entradas, despesas, transferências, restaurações e conferências de saldo continuam dependendo de confirmação no formulário, e passam pela mesma persistência após salvar.

A sincronização web entre aparelhos usa o mesmo login e um banco PostgreSQL, configurado por `DATABASE_URL` exclusivamente no servidor. Sem essa variável, o site continua salvando neste navegador e informa que a sincronização não está configurada. Consulte [SINCRONIZACAO.md](SINCRONIZACAO.md) para ativar.

Cada alteração fica primeiro no navegador e depois é enviada com controle de versão. Quedas de conexão deixam os dados pendentes para nova tentativa. Alterações concorrentes não são mescladas automaticamente: o usuário escolhe qual versão manter e ambas são preservadas em uma cópia local antes da resolução. O topo da página informa o estado de sincronização. A consulta ocorre ao abrir, voltar à janela e a cada dez segundos enquanto visível; formulários em edição não são substituídos.

## Dados e limites

- Os dados são salvos em `localStorage` neste navegador e endereço. Limpar os dados do site ou usar navegação privada pode apagá-los.
- Na versão pública estática, não há servidor financeiro ou consulta bancária. A conexão opcional usa o servidor privado descrito no guia. Com o PostgreSQL configurado, os registros sincronizam entre navegadores com o mesmo login. O APK continua separado.
- O site precisa de internet para abrir e não lê notificações do Android. A leitura de notificações pertence ao APK.
- Cópias JSON da versão 1 do APK são compatíveis. Importar uma cópia é uma substituição, não uma mesclagem.
- Os saldos são os registrados por você, incluindo conferências bancárias aplicadas explicitamente na versão privada. Consultar novamente uma mesma atualização não reaplica ajustes. O site não realiza pagamentos ou transferências.
- As cópias contêm informações financeiras sem criptografia; guarde-as em local privado. Não as envie ao repositório.

## Desenvolvimento

Servidor Node.js 22 com PostgreSQL opcional. Instale as dependências com `npm ci --include=dev --ignore-scripts`. Para testes de persistência, a suíte usa PostgreSQL embarcado (PGlite), sem conta externa. Verifique com:

```sh
node --test tests/*.test.cjs
```

O endereço antigo do GitHub Pages encaminha para o serviço privado; somente o servidor Node executa a autenticação.

## Login privado

A versão 1.4 substitui a chave digitada no navegador por usuário, senha e sessão HttpOnly validada no servidor. O GitHub Pages não executa autenticação no servidor. Para habilitar, siga o guia INTEGRACAO-BANCARIA.md e crie a configuração privada com server/create-login.cjs. Não há senha padrão, chaves reais ou dados financeiros no repositório.

## Demonstração pública

A tela de login oferece **Experimentar demonstração**, em `/demo/`. Ela usa as mesmas telas do controle, com exemplos fictícios e armazenamento somente em memória. Recarregar ou usar **Recomeçar demonstração** restaura os exemplos. Nenhum dado real do navegador é lido ou alterado, não há sincronização, consulta bancária ou importação de cópias nessa experiência. O visitante pode solicitar acesso pelo WhatsApp.

O servidor permite somente uma lista explícita de arquivos estáticos sob `/demo/`. As APIs continuam exigindo sessão e proteção CSRF. A página de demonstração bloqueia conexões de rede via CSP.
