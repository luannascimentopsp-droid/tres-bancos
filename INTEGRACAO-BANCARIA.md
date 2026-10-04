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

Crie o login localmente no seu terminal. Este comando solicita o usuário e a senha sem mostrar a senha, gera um hash com salt e salva um novo arquivo privado fora do projeto. Não sobrescreve arquivos existentes.

```powershell
node server/create-login.cjs C:/caminho/privado/.env.private
```

Use uma senha exclusiva de 12 a 128 caracteres. Não envie a senha ao chat. Abra o arquivo privado localmente para preencher PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS. Mantenha APP_PASSWORD_HASH exatamente como gerado; nunca coloque a senha em texto nesse campo.

Na pasta do projeto, inicie:

```powershell
node --env-file=C:/caminho/privado/.env.private server/server.cjs
```

Abra http://127.0.0.1:8787/ no mesmo computador e entre com o usuário e senha que criou. O serviço permanece limitado ao computador por padrão. Fechá-lo interrompe novas consultas.

Para disponibilizar no celular e fora do computador, falta escolher/configurar uma hospedagem com Node e HTTPS. Nesse ambiente, cadastrar as variáveis como segredos do serviço (incluindo APP_USERNAME e APP_PASSWORD_HASH), definir `HOST=0.0.0.0` e `PUBLIC_ORIGIN=https://seu-dominio` (sem barra final ou subpasta). O proxy deve preservar o cabeçalho Host. Não publicar o arquivo privado nem expor o servidor por HTTP. A origem deve ser dedicada ao Facilitador.

## 3. Levar os registros e consultar

1. No site atual, vá a Ajustes → Exportar cópia.
2. No novo endereço privado, entre pelo login, inicie o controle e use Ajustes → Restaurar cópia. Isso substitui os registros daquele endereço. O site antigo permanece com os dados anteriores.
3. Abra Ajustes → Conexão bancária. A consulta usa a sessão do login; não existe mais um campo de chave de API nessa tela.
4. Clique em Consultar saldos. Confira a data da atualização de cada conta e relacione-a ao banco correto no controle.
5. Confira seus pagamentos e movimentos já registrados. Marque a confirmação e clique em Aplicar saldos e recalcular metas.

Cada banco selecionado recebe um ajuste até o saldo informado. Esse ajuste não vira salário, receita ou despesa; não marca contas como pagas. Registre entradas/despesas/pagamentos antes da conferência dos saldos. Se registrar uma transação já incluída no saldo depois da aplicação, ela será contada novamente até uma nova conferência.

Uma mesma atualização do provedor não é reaplicada: isso preserva movimentos manuais posteriores e evita ajustes duplicados. Dados de datas anteriores são recusados. Contas com erro ou autorização pendente ficam fora da aplicação. Saldos com mais de 48 horas exibem aviso; a aplicação exige sua conferência. Cartões, limites de crédito, investimentos e contas em outras moedas não entram na soma. O campo usado é o saldo disponível informado pelo provedor; nunca o limite de crédito ou o saldo contábil bloqueado.

## Privacidade e limites

- O servidor consulta somente os Item IDs configurados e não aceita IDs de contas fornecidos pelo navegador.
- A API exige sessão autenticada, valida a origem e não disponibiliza arquivos de configuração. Nenhum endpoint faz pagamentos, altera consentimentos ou movimenta dinheiro.
- Credenciais da Pluggy permanecem no servidor. Respostas não incluem CPF, nome do titular ou número completo da conta.
- Os registros continuam no navegador e os backups incluem valores e identificadores das contas. Não são sincronizados entre dispositivos.
- Sair invalida a sessão no servidor e bloqueia a tela nas outras abas desse navegador, sem apagar os registros. Para revogar a conexão bancária, use o Meu Pluggy ou o banco.
- Falta validar o fluxo com credenciais reais e confirmar a cobertura das suas instituições antes de considerar a integração ativa.

## Verificação técnica

```powershell
node --test tests/*.test.cjs
```

Referências consultadas em 04/10/2026: [guia pessoal](https://meu.pluggy.ai/api-guide), [contas e significado dos saldos](https://docs.pluggy.ai/en/docs/products/accounts), [atualização das conexões](https://docs.pluggy.ai/en/docs/connections/item), [autenticação](https://docs.pluggy.ai/en/docs/quickstart).

## Login e segurança da versão privada (1.4)

O servidor exige login antes de entregar o painel ou a API. A senha usa scrypt com salt aleatório. O cookie de sessão é HttpOnly e SameSite=Strict, com Secure e prefixo __Host- em HTTPS. A sessão termina após 15 minutos sem atividade ou oito horas, e o servidor limita tentativas de login. Alterar a senha/configuração e reiniciar invalida todas as sessões, que ficam somente na memória do servidor.

Ver sua credencial no painel autenticado da Pluggy é esperado. Isso não significa que esteja publicada. O endereço de uma API pode ser conhecido; o controle de acesso é feito pelo servidor. Nenhuma chave da Pluggy precisa aparecer no código público ou ser digitada na página bancária do Facilitador.

Esta proteção não funciona em hospedagem somente estática. O GitHub Pages mantém o controle manual público; a página login.html reconhece que não há servidor e não solicita senha. Para proteger a versão online é necessário hospedar o servidor Node em origem HTTPS dedicada. Ainda não foi criada uma senha real nem ativada hospedagem privada.

Os registros existentes continuam em localStorage, sem criptografia. O login protege o servidor e a interface servida por ele, mas não criptografa backups nem impede alguém com acesso ao perfil do navegador de ler esses registros locais. A versão é para um único usuário, sem recuperação de senha por e-mail ou cadastro público.

Referências: [OWASP — sessões](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Node — scrypt](https://nodejs.org/api/crypto.html).

## Publicar o servidor online no Render

O projeto inclui `render.yaml` com serviço Node no plano Free, sem banco de dados contratado. A primeira publicação executa os testes antes de iniciar. Atualizações automáticas ficam desativadas para evitar publicar alterações sem conferir.

1. Gere o usuário e o hash com `server/create-login.cjs`, conforme a seção 2. A senha é escolhida por você no terminal, sem aparecer.
2. Abra [Configurar hospedagem no Render](https://render.com/deploy?repo=https://github.com/luannascimentopsp-droid/tres-bancos). Entre ou crie uma conta. Confira que o serviço está no plano **Free**.
3. Nos campos pedidos, informe `APP_USERNAME` e o valor de `APP_PASSWORD_HASH` do arquivo privado (copie o hash sem as aspas externas). Não informe a senha em texto e não envie o hash ao chat. Não envie o arquivo privado ao GitHub.
4. Conclua a publicação e abra o endereço HTTPS fornecido pelo Render. O servidor reconhece esse endereço automaticamente. Entre com sua senha e teste o botão Sair antes de configurar os bancos.
5. No painel do serviço → Environment, adicione `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `PLUGGY_ITEM_IDS`. Salve e publique novamente. Os três campos precisam estar completos para ativar o provedor.
6. Exporte a cópia do site antigo e restaure-a no novo endereço. No celular, faça a importação separadamente: os lançamentos ainda não sincronizam entre aparelhos.

O plano gratuito suspende o serviço após 15 minutos sem requisições; a próxima abertura pode demorar. Reinícios exigem novo login. Esse plano serve para experimentar o acesso pessoal e tem limites de uso. Nenhum plano pago foi contratado por esta configuração. A hospedagem só estará ativa depois de concluir o cadastro e a primeira publicação com seu hash privado.

Fontes: [serviço gratuito](https://render.com/docs/free), [Blueprint](https://render.com/docs/blueprint-spec), [endereço externo](https://render.com/docs/environment-variables).
