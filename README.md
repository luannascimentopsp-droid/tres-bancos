# Três Bancos

Controle financeiro pessoal para organizar C6 Bank, Nubank e Mercado Pago em três funções: dia a dia, contas fixas e reserva.

## Usar

1. Informe seus saldos iniciais e a data de referência.
2. Em **Ajustes**, configure valores, vencimentos das contas e metas semanais.
3. Registre entradas, despesas e transferências depois de realizá-las no banco.
4. Use **Exportar cópia** regularmente. **Restaurar cópia** substitui os registros após confirmação.
5. Em **Metas**, informe seus dias de trabalho, quando recebe, orçamento semanal e a sobra que deseja ter no fim do mês. O padrão é trabalhar de segunda a sábado e receber no sábado.

A versão pública começa sem saldos, lançamentos ou valores pessoais. Os cinco tipos de conta são modelos editáveis em valor e vencimento.

## Metas para fechar o mês

A meta restante é o maior valor entre zero e **contas do mês ainda não pagas + gastos do dia a dia previstos até o fim do mês + sobra desejada − saldo disponível**. Por padrão, o saldo da reserva fica protegido, fora do dinheiro disponível. É possível incluí-lo explicitamente nas opções.

O orçamento semanal de gastos é distribuído em centavos pelos dias de gastos escolhidos. A parcela de hoje desconta os gastos comuns já lançados hoje. Contas pagas não são cobradas novamente, e transferências não são somadas como receita nem como nova despesa. A meta de guardar por semana e o valor de separar para contas não são cobrados uma segunda vez: a sobra desejada representa o dinheiro adicional que o usuário quer manter.

As entradas necessárias são distribuídas pelos recebimentos restantes do mês. Quando uma conta vence antes de um recebimento posterior, parte da meta é antecipada para um recebimento anterior. Valores necessários antes do primeiro recebimento são destacados como **entrada fora do calendário**, separadamente das metas semanais. Datas não garantem que a entrada ocorra antes da saída no mesmo dia.

A meta diária é uma média equivalente pelos dias de trabalho restantes cujo pagamento pode acontecer neste mês. Para quem recebe semanalmente, ela orienta o trabalho e não representa recebimentos diários garantidos. O sistema não registra produção ainda não paga. Os valores que já entraram no dia, na semana e no mês vêm somente dos lançamentos de entrada.

A previsão é do mês atual e depende das contas, saldos e gastos informados. Não inventa renda futura ou pendências de meses anteriores. Ao mudar o mês ou registrar movimentos, o plano é recalculado. Cópias antigas continuam funcionando; basta configurar as metas sem apagar os lançamentos.

## Dados e limites

- Os dados são salvos em `localStorage` neste navegador e endereço. Limpar os dados do site ou usar navegação privada pode apagá-los.
- Não há cadastro, servidor financeiro, conexão bancária ou sincronização entre aparelhos, navegadores ou APK.
- O site precisa de internet para abrir e não lê notificações do Android. A leitura de notificações pertence ao APK.
- Cópias JSON da versão 1 do APK são compatíveis. Importar uma cópia é uma substituição, não uma mesclagem.
- Os saldos são os registrados por você, não saldos consultados nos bancos. O site não realiza pagamentos ou transferências.
- As cópias contêm informações financeiras sem criptografia; guarde-as em local privado. Não as envie ao repositório.

## Desenvolvimento

Site estático, sem etapa de compilação ou dependências de produção. Sirva a pasta por HTTP para desenvolvimento. Verifique a lógica com Node.js:

```sh
node --test tests/*.test.cjs
```

No GitHub Pages, publique a raiz (`/`) da branch `main`. O arquivo `.nojekyll` mantém a publicação estática.
