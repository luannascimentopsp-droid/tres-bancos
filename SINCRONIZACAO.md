# Ativação da sincronização web

O código funciona com PostgreSQL permanente. O disco temporário do Render Free e bancos em memória não devem ser usados para guardar os dados reais.

1. Crie ou use um banco PostgreSQL na sua própria conta (por exemplo, plano gratuito do Neon). A entrada ou criação da conta precisa ser concluída pelo titular. Confira os termos e os limites do plano escolhido.
2. Copie a conexão PostgreSQL do banco, de preferência a conexão agrupada (pooler).
3. No Render, em **Environment**, adicione `DATABASE_URL` com essa conexão como segredo do servidor. Não envie pelo chat, não coloque em arquivos públicos e não use a senha do banco como senha de login do Facilitador.
4. Em **Settings**, use o comando de build `npm ci --include=dev --ignore-scripts --no-audit --no-fund && npm test` e mantenha `node server/server.cjs` como comando inicial.
5. Publique e abra primeiro o navegador que contém seus registros atuais. Se o banco ainda estiver vazio, os registros locais serão enviados. A primeira gravação cria a tabela `facilitator_state`; a conexão precisa permitir criação e leitura/escrita nessa tabela.
6. Confira **Sincronizado com sua conta** e entre no mesmo endereço e login pelo segundo aparelho. Confira contas, metas e histórico antes de limpar qualquer cópia local.

## Comportamento e proteção

- O servidor identifica o proprietário pela sessão, nunca por um usuário enviado no corpo da requisição. A configuração atual tem um único login; quem usa esse login compartilha os mesmos registros.
- GET e POST `/api/state` exigem sessão. Gravações também exigem token CSRF e origem correta. Senhas do PostgreSQL só ficam no servidor; TLS valida o certificado do banco.
- O banco conserva uma revisão por usuário. Cada gravação exige a revisão anterior; uma revisão antiga recebe HTTP 409 em vez de sobrescrever silenciosamente os dados.
- A cópia local da sincronização, incluindo alterações pendentes e revisão, é gravada de uma vez. Sem internet, ela permanece pendente; o site precisa de conexão para iniciar uma nova sessão de login.
- Se já existir uma versão online e um navegador tiver dados antigos diferentes, a versão online será carregada, preservando os dados antigos na chave original `tres-bancos.web.v1`. Não há mesclagem automática. Exporte as cópias antes de migrar vários navegadores com históricos diferentes.
- Em conflito, baixe sua cópia e escolha a versão desejada. Antes da escolha, ambas são arquivadas no armazenamento local em uma chave `fac.cloud.v1.<usuario>.backup.<data>`. Isso é uma cópia local, não um serviço externo de backup.
- Os testes não comprovam a configuração de uma conta real do provedor. A ativação só está concluída depois de configurar o banco e verificar os registros nos dois acessos.

Referências: [Render Free](https://render.com/docs/free), [Neon Free](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan), [conexão Neon](https://neon.com/docs/connect/connect-from-any-app).
