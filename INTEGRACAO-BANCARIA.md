# Conectar o Facilitador Financeiro aos seus bancos

## Situação desta versão

A consulta de saldos está implementada, mas ainda precisa do seu cadastro, autorização dos bancos e configuração do servidor privado. Os testes usam respostas simuladas; nenhuma conta real foi conectada. A versão do GitHub Pages mostra as instruções de ativação. Ela não contém credenciais e não consulta bancos sozinha.

Este é o primeiro passo da integração: consultar saldos e aplicá-los após conferir contas, valores e datas. Ainda não há importação automática de extrato, classificação de entradas e despesas, identificação de contas pagas nem sincronização dos registros entre aparelhos.

## 1. Cadastro e autorização — feito por você

1. Abra https://meu.pluggy.ai/ e crie sua conta pessoal.
2. Procure Nubank, C6 e Mercado Pago na lista atual de instituições. Conecte somente as contas que quiser usar. A disponibilidade de cada banco deve ser confirmada nessa lista; o código não garante cobertura dos três.
3. Autorize o acesso no fluxo apresentado pelo provedor e pelo banco. Senhas e códigos bancários não devem ser enviados ao chat nem inseridos no Facilitador.
4. Abra https://dashboard.pluggy.ai/, acesse a aplicação demo e conecte nela o conector **Meu Pluggy**, autorizando suas conexões. Uma conta pessoal no Meu Pluggy não basta: essa etapa cria as conexões proxy acessíveis pela API.
5. Localize o **Client ID**, o **Client Secret** e os **Item IDs dessas conexões proxy** na aplicação demo. Guarde-os na configuração privada do servidor, fora do repositório e do site público.

O [guia oficial de acesso via API](https://meu.pluggy.ai/api-guide) descreve esse caminho pessoal. O serviço anuncia cadastro gratuito e sincronização diária. Confira as condições mostradas no cadastro; esta implementação não contrata plano pago. Atualização diária não significa tempo real, e clicar em Consultar saldos não força uma atualização no banco.

## 2. Preparar o servidor privado

O GitHub Pages hospeda apenas arquivos estáticos. A API bancária precisa rodar separadamente. Esta versão é para um único usuário e serve uma cópia completa do aplicativo junto da API. Não exponha esse serviço como plataforma de múltiplos usuários.

Requisito: Node.js 22 ou posterior. Não há dependências npm de produção.

Copie `server/config.example` para um arquivo `.env.private` em pasta privada **fora de qualquer pasta publicada**. Preencha:

```dotenv
APP_ACCESS_KEY=uma-chave-aleatoria-exclusiva-com-pelo-menos-32-caracteres
PLUGGY_CLIENT_ID=client-id-da-aplicacao-demo
PLUGGY_CLIENT_SECRET=client-secret-da-aplicacao-demo
PLUGGY_ITEM_IDS=item-id-proxy-1,item-id-proxy-2
HOST=127.0.0.1
PORT=8787
```

Gere uma chave própria para o Facilitador com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Ela é diferente do Client Secret e será informada na tela Conexão bancária. Não use o texto do exemplo como chave.

Na pasta do projeto, inicie:

```powershell
node --env-file=C:/caminho/privado/.env.private server/server.cjs
```

Abra http://127.0.0.1:8787/ no mesmo computador. O serviço permanece limitado ao computador por padrão. Fechá-lo interrompe novas consultas.

Para disponibilizar no celular e fora do computador, falta escolher/configurar uma hospedagem com Node e HTTPS. Nesse ambiente, cadastrar as variáveis como segredos do serviço, definir `HOST=0.0.0.0` e `PUBLIC_ORIGIN=https://seu-dominio` (sem barra final ou subpasta). O proxy deve preservar o cabeçalho Host. Não publicar o arquivo privado nem expor o servidor por HTTP. A origem deve ser dedicada ao Facilitador.

## 3. Levar os registros e consultar

1. No site atual, vá a Ajustes → Exportar cópia.
2. No novo endereço privado, inicie o controle e use Ajustes → Restaurar cópia. Isso substitui os registros daquele endereço. O site antigo permanece com os dados anteriores.
3. Abra Ajustes → Conexão bancária e informe a chave própria do Facilitador. Ela fica apenas em memória nessa página e precisa ser informada de novo depois de recarregar.
4. Clique em Consultar saldos. Confira a data da atualização de cada conta e relacione-a ao banco correto no controle.
5. Confira seus pagamentos e movimentos já registrados. Marque a confirmação e clique em Aplicar saldos e recalcular metas.

Cada banco selecionado recebe um ajuste até o saldo informado. Esse ajuste não vira salário, receita ou despesa; não marca contas como pagas. Registre entradas/despesas/pagamentos antes da conferência dos saldos. Se registrar uma transação já incluída no saldo depois da aplicação, ela será contada novamente até uma nova conferência.

Uma mesma atualização do provedor não é reaplicada: isso preserva movimentos manuais posteriores e evita ajustes duplicados. Dados de datas anteriores são recusados. Contas com erro ou autorização pendente ficam fora da aplicação. Saldos com mais de 48 horas exibem aviso; a aplicação exige sua conferência. Cartões, limites de crédito, investimentos e contas em outras moedas não entram na soma. O campo usado é o saldo disponível informado pelo provedor; nunca o limite de crédito ou o saldo contábil bloqueado.

## Privacidade e limites

- O servidor consulta somente os Item IDs configurados e não aceita IDs de contas fornecidos pelo navegador.
- A API exige uma chave de acesso, valida a origem e não disponibiliza arquivos de configuração. Nenhum endpoint faz pagamentos, altera consentimentos ou movimenta dinheiro.
- Credenciais da Pluggy permanecem no servidor. Respostas não incluem CPF, nome do titular ou número completo da conta.
- Os registros continuam no navegador e os backups incluem valores e identificadores das contas. Não são sincronizados entre dispositivos.
- Encerrar acesso limpa a chave e a consulta da memória da página, sem apagar os registros. Para revogar a conexão bancária, use o Meu Pluggy ou o banco.
- Falta validar o fluxo com credenciais reais e confirmar a cobertura das suas instituições antes de considerar a integração ativa.

## Verificação técnica

```powershell
node --test tests/*.test.cjs
```

Referências consultadas em 04/10/2026: [guia pessoal](https://meu.pluggy.ai/api-guide), [contas e significado dos saldos](https://docs.pluggy.ai/en/docs/products/accounts), [atualização das conexões](https://docs.pluggy.ai/en/docs/connections/item), [autenticação](https://docs.pluggy.ai/en/docs/quickstart).
