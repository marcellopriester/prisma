# Seu checkout Prisma na Vercel

Este é o código do checkout Prisma criado nesta conversa, adaptado para Next.js e Vercel. Mantém o painel, produtos, order bumps, QR Code Pix, pedidos e aprovação manual. O banco foi adaptado para PostgreSQL e o login para Supabase Auth.

O código foi compilado para produção e passou por 28 testes de integração com PostgreSQL isolado. A publicação na sua Vercel, a conexão real com Supabase e o login real ainda dependem das suas contas e não foram testados. Nenhuma transação bancária foi realizada.

## Antes de começar

Você precisará de:

- Uma conta GitHub para guardar o código.
- Uma conta Vercel para hospedar o sistema, com plano compatível com uso comercial.
- Um projeto Supabase para banco e login.

Não é necessário contratar uma VPS. A versão atual hospedada aqui continua intacta. Este pacote contém código, não os registros do banco anterior. Se você já cadastrou produtos, chave Pix ou recebeu pedidos na versão anterior, a transferência desses dados é uma etapa separada que precisa ser feita antes de substituir a operação. As identidades administrativas mudam: não copie os identificadores do login antigo diretamente para o banco novo.

## 1. Colocar os arquivos no GitHub

1. Extraia o arquivo ZIP.
2. No GitHub, crie um repositório **privado**, por exemplo `prisma-checkout`.
3. Envie o conteúdo da pasta `prisma-checkout-vercel` para a raiz do repositório. O arquivo `package.json` deve aparecer na raiz, junto das pastas `app`, `db`, `lib` e `migrations`.
4. Confirme o envio com **Commit changes**.
5. O ZIP não contém dependências, arquivos de compilação ou credenciais. Preserve `.gitignore` e `.env.example`. Não envie arquivos `.env` preenchidos.

Se GitHub e Vercel estiverem conectados ao assistente, a criação do repositório e o envio podem ser feitos diretamente por aqui.

## 2. Preparar o Supabase

1. Crie um projeto no Supabase e guarde a senha do banco com você.
2. Abra **SQL Editor**, crie uma consulta e execute o conteúdo de `supabase-setup.sql` uma única vez em um projeto novo.
3. As tabelas ficam no schema privado `prisma_checkout`. Não exponha esse schema na Data API. O código acessa o banco somente pelo servidor.
4. Em **Authentication → Users**, crie sua conta administrativa com e-mail confirmado. Defina a senha no próprio serviço.
5. Copie o UUID dessa conta. Esse valor será o `ADMIN_USER_ID`.
6. Desabilite novos cadastros públicos se não precisar deles. A aplicação não oferece cadastro e só autoriza o UUID administrativo configurado.
7. Na área **Connect**, copie a Project URL, a Publishable key e a conexão PostgreSQL do **Transaction pooler**. Use a conexão exibida pelo seu projeto, não um exemplo da internet. Substitua o marcador de senha pelo valor correto; caracteres especiais na senha precisam de codificação adequada na URL.

O driver já está configurado para o pooler, com `prepare: false` e TLS. A Publishable key serve para autenticação; não é necessário usar a chave `service_role` nesta aplicação.

## 3. Importar na Vercel

1. Acesse https://vercel.com/new e entre na sua conta.
2. Conecte o GitHub e permita acesso ao repositório do checkout.
3. Selecione **Import** nesse repositório.
4. Confira:

| Campo | Valor |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | Raiz do repositório; ou `prisma-checkout-vercel` se você enviou a pasta inteira |
| Build Command | `npm run build` |
| Output Directory | Padrão do Next.js; não preencha `dist` |
| Install Command | Padrão com `npm ci` ou `npm install` |
| Node.js | 22.x ou uma versão compatível com o `package.json` |

5. Adicione as quatro variáveis abaixo em **Environment Variables** antes de publicar:

| Nome exato | Valor |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL do Transaction pooler do Supabase, com senha |
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key desse mesmo projeto |
| `ADMIN_USER_ID` | UUID da sua conta administrativa confirmada |

`DATABASE_URL` é segredo do servidor. Nenhuma dessas variáveis precisa do prefixo `NEXT_PUBLIC_`. Os valores não são enviados ao navegador pela aplicação.

6. Configure as variáveis para **Production**. Para prévias de desenvolvimento, prefira um projeto/banco de testes e variáveis próprias, pois reutilizar a produção faz a prévia acessar os mesmos dados reais.
7. Clique em **Deploy**.
8. Se falhar, veja o erro em **Deployments**. Não altere as configurações por tentativa sem identificar a causa.

## 4. Abrir e configurar seu checkout

1. Abra o domínio gerado pela Vercel.
2. Clique em **Entrar no painel** e use o e-mail e a senha que cadastrou no Supabase.
3. Cadastre produtos, adicionais e identidade visual. A nova base começa vazia.
4. Em **Pagamento Pix**, preencha a chave vinculada à conta C6, titular, cidade, identificação do vendedor e suporte.
5. Confira os dados e ative o recebimento somente quando a configuração estiver correta.
6. Use o link de cada produto para abrir o checkout. Compradores não precisam entrar no painel nem criar conta.
7. Confira os recebimentos no banco antes de aprovar os pedidos.

O botão “Já fiz o pagamento” apenas avisa o vendedor. Confirmação automática do C6 não está incluída e continua dependendo de integração bancária.

## 5. Verificar antes de divulgar

- Entrar e sair do painel, incluindo uma nova sessão do navegador.
- Confirmar que uma conta diferente não acessa a administração.
- Criar um produto e associar um adicional.
- Gerar o Pix com o total correto e conferir o destinatário no aplicativo bancário.
- Fazer uma validação controlada de pagamento real por conta própria antes de iniciar a operação.
- Confirmar que “Já fiz o pagamento” não libera o produto.
- Aprovar manualmente após conferir o crédito e verificar as instruções de entrega.
- Abrir o link no celular e fora da sessão administrativa.

O domínio de produção precisa estar acessível aos compradores. Se houver proteção de acesso ativada na Vercel, revise-a conscientemente; não remova a autenticação do painel.

## 6. Atualizações futuras

Configure a branch de produção na Vercel, geralmente `main`. Mudanças de código precisam ser enviadas a esse repositório. A Vercel publicará as novas versões quando a compilação terminar corretamente.

Alterações de produto, preço, marca e Pix feitas pelo painel são salvas no banco e não precisam de nova publicação.

Alterações em variáveis de ambiente precisam de uma nova publicação para valer. Mudanças futuras no banco devem usar novas migrações versionadas; não apague tabelas com dados reais.

## Desenvolvimento

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Para desenvolver localmente, copie `.env.example` para `.env.local` e preencha as variáveis de um ambiente de testes. Inicie com `npm run dev`.

Para aplicar migrações por terminal em vez do SQL Editor, use `npm run db:migrate` com `DATABASE_URL` disponível no ambiente. Se já usou `supabase-setup.sql`, a migração inicial estará registrada e será ignorada. Não há migração automática durante o build.

## Referências

- Vercel: https://vercel.com/docs/getting-started-with-vercel
- Integração Git: https://vercel.com/docs/git/vercel-for-github
- Supabase Auth: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Conexão PostgreSQL: https://supabase.com/docs/guides/database/connecting-to-postgres

## Verificação da sessão administrativa

O painel só abre os cadastros depois de confirmar o acesso administrativo. O login verifica a sessão em uma segunda requisição; se a sessão expirar durante o preenchimento, permite entrar novamente em um diálogo, mantendo os campos na tela. A gravação deve ser reenviada pelo usuário depois de entrar. Falhas de autenticação e de gravação não são exibidas como sucesso. CPF/CNPJ formatados são normalizados antes da validação da chave Pix.

Após `npm run build`, execute `npm run test:auth`. Esses testes usam o servidor Next.js e o SDK Supabase reais, com um serviço Auth local simulado, cobrindo cookies, renovação, logout e rejeição de outras contas. Não acessam credenciais ou registros de produção. `npm test` cobre as rotas de negócio com PostgreSQL isolado e identidade simulada. A validação com a conta real continua sendo necessária.
