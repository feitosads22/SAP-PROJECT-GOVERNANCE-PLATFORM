# Deploy na Vercel

## 1. Importar o repositório

vercel.com → **Add New → Project** → conectar a conta do GitHub → **Import** no
repositório.

A Vercel detecta o Vite sozinho. Como o repositório traz `vercel.json`, os campos
já vêm certos:

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Não altere nada aqui.

## 2. Variáveis de ambiente — antes do primeiro deploy

Ainda na tela de import, abra **Environment Variables** e cadastre as duas:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<seu-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a anon key do projeto |

Onde achar: Supabase → Project Settings → API. Use **anon / public**.
A `service_role` **nunca** vai para a Vercel — ela ignora RLS por definição, e
tudo que vai para o frontend é público.

Marque os três ambientes: Production, Preview e Development.

**Atenção:** variáveis `VITE_*` são lidas no momento do build, não em tempo de
execução. Se você cadastrar depois, precisa refazer o deploy
(**Deployments → … → Redeploy**) — só salvar não basta.

Se faltarem, o build ainda passa e o site sobe mostrando a tela "Configuração
ausente" com a instrução. É proposital: página branca sem explicação é pior.

## 3. Deploy

**Deploy**. Leva cerca de um minuto. Você recebe uma URL
`https://<projeto>.vercel.app`.

## 4. Autorizar o domínio no Supabase — obrigatório

Sem este passo o login falha, mesmo com tudo o mais certo.

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<projeto>.vercel.app`
- **Redirect URLs:** adicione `https://<projeto>.vercel.app/**`

Se for usar os previews da Vercel (cada branch ganha uma URL própria), adicione
também `https://*-<sua-conta>.vercel.app/**`.

O link de confirmação de e-mail aponta para a Site URL. Enquanto ela estiver como
`http://localhost:3000`, o cadastro pelo site em produção manda o usuário para um
endereço que não existe.

## 5. Testar em produção

Abra a URL e faça login com um usuário do seed (senha `teste123`):

| E-mail | Esperado |
|---|---|
| `admin.a@alpha.test` | vê apenas `ALPHA-S4` |
| `manager.b@beta.test` | vê apenas `BETA-UPG` |
| `customer.a@alpha.test` | vê `ALPHA-S4`, sem aviso de criação |

O teste que importa é o segundo: **manager.b não pode ver nada da Org Alpha**.
É o critério de conclusão da Fase 1A visto pela tela.

Para o fluxo de organização nova: cadastre um e-mail qualquer, confirme, e a tela
de onboarding aparece. Criar a organização promove você a admin dela — via RPC
`create_organization`, nunca por escrita direta em `profiles`.

## Se der errado

**Página branca, sem nada.** Console do navegador (F12). Se aparecer erro do
Supabase, as variáveis não entraram no build — refaça o Redeploy.

**"Configuração ausente" na tela.** As variáveis faltam ou foram cadastradas
depois do build. Cadastre e refaça o Redeploy.

**Login retorna "Invalid login credentials".** O seed não foi aplicado neste
projeto Supabase, ou foi aplicado sem as linhas de `auth.identities` — use
`supabase/seed/001_seed_supabase.sql`.

**Login funciona mas a lista vem vazia.** Profile sem `organization_id`. Normal
para usuário recém-cadastrado: é a tela de onboarding.

**Alguém vê projeto de outra organização.** Pare o deploy. Isso é falha de RLS,
não de frontend. Rode `supabase/tests/0001_rls_tests_v2.sql` e confirme se o
hotfix `0001b` está aplicado neste projeto.
