# Facilitador Financeiro 

Controle financeiro pessoal para organizar C6 Bank, Nubank e Mercado Pago em três funções: dia a dia, contas fixas e reserva.

## Usar

1. Informe seus saldos iniciais e a data de referência.
2. Em **Ajustes**, configure valores, vencimentos das contas e metas semanais.
3. Registre entradas, despesas e transferências depois de realizá-las no banco.
4. Use **Exportar cópia** regularmente. **Restaurar cópia** substitui os registros após confirmação.

A versão pública começa sem saldos, lançamentos ou valores pessoais. Os cinco tipos de conta são modelos editáveis em valor e vencimento.

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
