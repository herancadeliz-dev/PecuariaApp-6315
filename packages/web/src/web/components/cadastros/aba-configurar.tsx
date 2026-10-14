import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, Home, LogIn, Plug, Plus, RotateCcw } from "lucide-react";
import { apagarConfig, CONFIG, clienteTeste, gravarConfig, MODO_DEMO, supabase } from "../../lib/campo/config";
import { apagarTudo, pendentes } from "../../lib/campo/local-db";
import { CampoTexto } from "../curral/campos";

interface Fazenda {
  id: string;
  nome: string;
}

const Passo = ({ n, titulo, feito, children }: { n: number; titulo: string; feito: boolean; children: ReactNode }) => (
  <section className="cartao-campo overflow-hidden" aria-label={titulo}>
    <div className={`flex items-center gap-3 border-b-[3px] border-tinta px-4 py-2.5 ${feito ? "bg-ok-claro" : "bg-sol"}`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-tinta bg-papel font-display text-[22px] font-extrabold">
        {feito ? <CheckCircle2 className="size-6" strokeWidth={3} /> : n}
      </span>
      <h3 className="font-display text-[24px] font-extrabold uppercase leading-none">{titulo}</h3>
    </div>
    <div className="space-y-3 p-4">{children}</div>
  </section>
);

async function trocarParaFazenda(dados: { url: string; chave: string; fazenda: Fazenda }) {
  const fila = pendentes();
  if (!MODO_DEMO && fila > 0 && !window.confirm(`Há ${fila} registros ainda não enviados. Trocar de fazenda apaga esses dados do aparelho. Continuar?`)) return;
  gravarConfig({ url: dados.url, chave: dados.chave, fazendaId: dados.fazenda.id, fazendaNome: dados.fazenda.nome });
  await apagarTudo(); // dados de demonstração / outra fazenda saem do aparelho
  window.location.href = "/";
}

/** Configuração do Supabase dentro do app — sem precisar mexer em .env. */
export function AbaConfigurar() {
  const [url, setUrl] = useState(CONFIG.url);
  const [chave, setChave] = useState(CONFIG.chave);
  const [conexao, setConexao] = useState<"nao" | "testando" | "ok" | "erro">(supabase ? "ok" : "nao");
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", senha: "" });
  const [msgLogin, setMsgLogin] = useState<string | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[] | null>(null);
  const [nomeNova, setNomeNova] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erroFazenda, setErroFazenda] = useState<string | null>(null);

  const urlLimpa = url.trim().replace(/\/+$/, "");
  const cliente: SupabaseClient | null = useMemo(() => {
    if (conexao !== "ok") return null;
    if (supabase && urlLimpa === CONFIG.url && chave.trim() === CONFIG.chave) return supabase;
    return clienteTeste(urlLimpa, chave);
  }, [conexao, urlLimpa, chave]);

  useEffect(() => {
    if (!cliente) return;
    void cliente.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = cliente.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [cliente]);

  async function carregarFazendas() {
    if (!cliente) return;
    const { data, error } = await cliente.from("fazendas").select("id,nome").is("deleted_at", null).order("nome");
    if (error) setErroFazenda(error.message.includes("does not exist") || error.code === "PGRST205" ? "A tabela fazendas não existe: rode o arquivo SQL no Supabase primeiro (passo 0)." : error.message);
    else setFazendas(data as Fazenda[]);
  }
  useEffect(() => {
    if (email) void carregarFazendas();
    else setFazendas(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, cliente]);

  async function testar() {
    setConexao("testando");
    setErroConexao(null);
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(urlLimpa) && !/^https?:\/\//.test(urlLimpa)) {
      setConexao("erro");
      return setErroConexao("A URL deve ser algo como https://abcdxyz.supabase.co");
    }
    try {
      const r = await fetch(`${urlLimpa}/auth/v1/health`, { headers: { apikey: chave.trim() } });
      if (r.status === 401 || r.status === 403) throw new Error("Chave recusada. Use a chave 'anon public' (ou 'publishable').");
      if (!r.ok) throw new Error(`Supabase respondeu ${r.status}`);
      setConexao("ok");
    } catch (e) {
      setConexao("erro");
      setErroConexao(e instanceof TypeError ? "Não consegui acessar essa URL. Confira se copiou certo e se tem internet." : String(e instanceof Error ? e.message : e));
    }
  }

  async function entrar(criar: boolean) {
    if (!cliente) return;
    setOcupado(true);
    setMsgLogin(null);
    const cred = { email: form.email.trim(), password: form.senha };
    const { data, error } = criar ? await cliente.auth.signUp(cred) : await cliente.auth.signInWithPassword(cred);
    setOcupado(false);
    if (error) return setMsgLogin(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    if (criar && !data.session) setMsgLogin("Conta criada. Abra o e-mail de confirmação do Supabase, clique no link e depois toque em Entrar.");
  }

  async function criarFazenda() {
    if (!cliente || nomeNova.trim().length < 2) return;
    setOcupado(true);
    setErroFazenda(null);
    // 1º: função criar_fazenda (SQL V2) — cria e já te põe como dono numa só chamada
    const rpc = await cliente.rpc("criar_fazenda", { p_nome: nomeNova.trim() });
    let id = rpc.data as string | null;
    if (rpc.error) {
      // Fallback (só SQL V1): id gerado aqui e insert sem "returning" (o RLS de select só libera após o trigger)
      id = crypto.randomUUID();
      const { data: u } = await cliente.auth.getUser();
      const { error } = await cliente.from("fazendas").insert({ id, nome: nomeNova.trim(), criado_por: u.user?.id });
      if (error) {
        setOcupado(false);
        return setErroFazenda(error.message);
      }
    }
    setOcupado(false);
    setNomeNova("");
    await trocarParaFazenda({ url: urlLimpa, chave: chave.trim(), fazenda: { id: id!, nome: nomeNova.trim() } });
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-[3px] border-tinta px-4 py-3 text-[17px] font-bold shadow-duro ${MODO_DEMO ? "bg-sol-2" : "bg-ok-claro"}`}>
        {MODO_DEMO ? "Agora: modo demonstração (dados de exemplo, só neste aparelho)." : `Agora: conectado à fazenda ${CONFIG.fazendaNome ?? CONFIG.fazendaId ?? "(não escolhida)"}.`}
      </div>

      <Passo n={0} titulo="Banco pronto" feito={false}>
        <p className="text-[16px] font-semibold">
          No site do Supabase: <b>SQL Editor → New query</b>, cole todo o arquivo <b>pecuaria_mvp_supabase.sql</b> e toque em <b>Run</b>. Pode rodar de novo sem medo: ele não apaga nada. Se você já tinha rodado a primeira versão, basta rodar o <b>pecuaria_v2_reproducao.sql</b>.
        </p>
      </Passo>

      <Passo n={1} titulo="Conectar ao Supabase" feito={conexao === "ok"}>
        <p className="text-[15px] font-semibold">
          No Supabase: <b>Project Settings → API</b> (ou <b>Connect</b>). Copie a <b>Project URL</b> e a chave <b>anon public</b>. Nunca use a chave service_role.
        </p>
        <CampoTexto rotulo="Project URL" valor={url} onChange={(v) => { setUrl(v); setConexao("nao"); }} placeholder="https://abcdxyz.supabase.co" />
        <CampoTexto rotulo="Chave anon public" valor={chave} onChange={(v) => { setChave(v); setConexao("nao"); }} placeholder="eyJhbGciOi… ou sb_publishable_…" />
        {erroConexao && <p className="rounded-xl bg-alerta-claro p-3 text-[16px] font-bold text-alerta">{erroConexao}</p>}
        <button
          onClick={() => void testar()}
          disabled={!urlLimpa || !chave.trim() || conexao === "testando"}
          className={`btn-campo flex h-[68px] w-full items-center justify-center gap-2 font-display text-[24px] font-extrabold uppercase ${conexao === "ok" ? "bg-ok-claro" : "bg-sol"}`}
        >
          <Plug className="size-7" strokeWidth={3} />
          {conexao === "testando" ? "Testando…" : conexao === "ok" ? "Conectado" : "Testar conexão"}
        </button>
      </Passo>

      {conexao === "ok" && (
        <Passo n={2} titulo="Entrar" feito={!!email}>
          {email ? (
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate text-[17px] font-bold">{email}</p>
              <button onClick={() => void cliente?.auth.signOut()} className="btn-campo h-14 bg-papel px-3 text-[16px] font-bold">
                Sair
              </button>
            </div>
          ) : (
            <>
              <CampoTexto rotulo="E-mail" tipo="email" valor={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <CampoTexto rotulo="Senha (mín. 6)" tipo="password" valor={form.senha} onChange={(v) => setForm({ ...form, senha: v })} />
              {msgLogin && <p className="rounded-xl bg-sol-2 p-3 text-[16px] font-bold">{msgLogin}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button disabled={ocupado || !form.email || form.senha.length < 6} onClick={() => void entrar(false)} className="btn-campo flex h-[64px] items-center justify-center gap-2 bg-mata font-display text-[22px] font-extrabold uppercase text-white">
                  <LogIn className="size-6" strokeWidth={3} /> Entrar
                </button>
                <button disabled={ocupado || !form.email || form.senha.length < 6} onClick={() => void entrar(true)} className="btn-campo h-[64px] bg-papel font-display text-[22px] font-extrabold uppercase">
                  Criar conta
                </button>
              </div>
            </>
          )}
        </Passo>
      )}

      {conexao === "ok" && email && (
        <Passo n={3} titulo="Escolher a fazenda" feito={!!CONFIG.fazendaId && !MODO_DEMO}>
          {fazendas === null ? (
            <p className="text-[16px] font-bold">Carregando…</p>
          ) : fazendas.length ? (
            <div className="grid gap-2">
              {fazendas.map((f) => (
                <button
                  key={f.id}
                  onClick={() => void trocarParaFazenda({ url: urlLimpa, chave: chave.trim(), fazenda: f })}
                  className={`btn-campo flex min-h-[68px] items-center gap-3 px-4 text-left ${f.id === CONFIG.fazendaId && !MODO_DEMO ? "bg-mata text-white" : "bg-papel"}`}
                >
                  <Home className="size-7 shrink-0" strokeWidth={2.75} />
                  <span className="font-display text-[24px] font-extrabold uppercase leading-none">{f.nome}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[16px] font-semibold">Você ainda não participa de nenhuma fazenda. Crie a sua abaixo — você vira o dono.</p>
          )}
          <div className="border-t-[3px] border-tinta pt-3">
            <CampoTexto rotulo="Nova fazenda" valor={nomeNova} onChange={setNomeNova} placeholder="Ex.: Fazenda Boa Vista" />
            <button onClick={() => void criarFazenda()} disabled={ocupado || nomeNova.trim().length < 2} className="btn-campo mt-2 flex h-[64px] w-full items-center justify-center gap-2 bg-sol font-display text-[22px] font-extrabold uppercase">
              <Plus className="size-7" strokeWidth={3} /> Criar e usar
            </button>
          </div>
          {erroFazenda && <p className="rounded-xl bg-alerta-claro p-3 text-[16px] font-bold text-alerta">{erroFazenda}</p>}
          <p className="text-[14px] font-semibold">Ao escolher, os dados de demonstração saem do aparelho e o rebanho da fazenda é baixado.</p>
        </Passo>
      )}

      {!MODO_DEMO && (
        <button
          onClick={async () => {
            if (!window.confirm("Desconectar e voltar para o modo demonstração? Dados não enviados serão perdidos.")) return;
            apagarConfig();
            await apagarTudo();
            window.location.href = "/";
          }}
          className="btn-campo flex h-[64px] w-full items-center justify-center gap-2 bg-campo text-[18px] font-bold"
        >
          <RotateCcw className="size-6" strokeWidth={3} /> Voltar ao modo demonstração
        </button>
      )}
    </div>
  );
}
