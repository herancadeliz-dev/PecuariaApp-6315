# V3 — Controle de acesso SaaS + Vercel

## Decisões
- Solicitar acesso = signUp do Supabase com metadados -> trigger cria `perfis` status `pendente`. Pendente não lê/escreve nada (RLS).
- Status usuário: pendente | ativo | pausado. Pausado: RLS bloqueia + auth.users.banned_until = infinity (não renova token).
- papel_sistema: master | admin | usuario. Master: tudo (excluir, promover admin). Admin: aprovar/pausar usuários comuns, bloquear fazendas. Ninguém mexe no master.
- Master criado por `select public.promover_master('email')` no SQL Editor (função sem grant para app).
- Fazenda: só via RPC criar_fazenda; usuário aprovado com pode_criar_fazenda cria 1 vez; nome travado (só admin renomeia).
- Fazenda.status ativa|bloqueada (pagamento) -> is_membro() falso -> nada lê/escreve. App mostra tela de bloqueio.
- is_membro/is_gestor exigem usuário ativo + fazenda ativa. Triggers impedem referência cruzada entre fazendas e troca de fazenda_id.
- Membros: só admin vincula (RPC). Master não vê dados operacionais de outros tenants, só metadados/contagens.
- Front: PortaoAcesso em app.tsx. Cache do acesso por usuário (offline). Troca de usuário/pausa/exclusão apaga dados locais.
- Vercel: SPA estática (packages/web/dist), vercel.json com rewrites + headers. Env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no painel Vercel.

## Progresso
- [ ] SQL V3 (+ arquivo separado) testado em Postgres local
- [ ] lib/campo/acesso.ts + config ajustado
- [ ] PortaoAcesso (entrar / solicitar / pendente / pausado / bloqueada / criar fazenda)
- [ ] AbaConfigurar -> Conta
- [ ] /admin
- [ ] vercel.json + build limpo
- [ ] testes Playwright com Supabase mockado
